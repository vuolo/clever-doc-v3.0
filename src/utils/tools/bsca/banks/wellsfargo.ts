import moment from "moment";

import type {
  BankAccount,
  BankStatementSummary,
  Company,
  Period,
  Transaction,
} from "@/types/tools/bsca/bank-statement";
import type { TextShardGroup } from "@/types/ocr";
import {
  getGroupedShardTexts,
  getTextShardGroupsWithinRange,
  getTextShardWithinRange,
  isBoundingPolyWithinRange,
  strip,
} from "@/utils/ocr";
import { emptyTransaction } from "../BankStatement";

const DATE_REGEX = /^\d{1,2}\/\d{1,2}/;
const PERIOD_START_REGEX = /Beginning balance on (\d+\/\d+)/;
const PERIOD_END_REGEX = /(\w+ \d{1,2}, \d{4})/;
const AMOUNT_REGEX = /-?\s?\d{1,3}(,\d{3})*\.\d{2}/;

export function isBank(textShardGroups: TextShardGroup[][]): boolean {
  const firstPage = textShardGroups[0];
  if (!firstPage) return false;

  for (const textShardGroup of firstPage) {
    const lineText = getGroupedShardTexts(textShardGroup);
    for (const text of lineText) {
      if (text.includes("1-800-CALL-WELLS")) return true;
    }
  }
  return false;
}

export function parseCompany(textShardGroups: TextShardGroup[][]): Company {
  const company = {
    name: "Unknown",
  } as Company;

  const firstPage = textShardGroups[0];
  if (!firstPage) return company;

  for (const textShardGroup of firstPage) {
    for (const textShard of textShardGroup.textShards) {
      if (
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "x",
          0.03,
          0.35
        ) &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "y",
          0.2,
          0.265
        )
      ) {
        const shardText = strip(textShard.text);

        if (company.name === "Unknown") company.name = shardText;
        else if (!company.address) company.address = shardText;
        else company.address += `, ${shardText}`;
      }
    }
  }

  return company;
}

export function parseAccount(textShardGroups: TextShardGroup[][]): BankAccount {
  const account = {
    number: "Unknown",
  } as BankAccount;

  const firstPage = textShardGroups[0];
  if (!firstPage) return account;

  for (const textShardGroup of firstPage) {
    for (const textShard of textShardGroup.textShards) {
      if (
        account.number == "Unknown" &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "x",
          0.6,
          0.83
        ) &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "y",
          0.59,
          0.62
        )
      ) {
        const shardText = strip(textShard.text);
        const lineText = getGroupedShardTexts(textShardGroup);

        const query = "Account number:";
        if (!shardText.startsWith(query)) continue;
        const joinedLineText = lineText.join(" ");
        const accountNumber = joinedLineText
          .substring(joinedLineText.indexOf(query) + query.length)
          .trim();
        account.number = accountNumber;
      }
    }
  }

  return account;
}

export function parsePeriod(textShardGroups: TextShardGroup[][]): Period {
  const period = {
    start: "Unknown",
    end: "Unknown",
  } as Period;

  const firstPage = textShardGroups[0];
  if (!firstPage) return period;

  for (const textShardGroup of firstPage) {
    for (const textShard of textShardGroup.textShards) {
      const shardText = strip(textShard.text);

      if (period.end === "Unknown") {
        const match = PERIOD_END_REGEX.exec(shardText);
        if (match) {
          const endDate = match[1];

          if (endDate) {
            // Parse and reformat the date
            const formattedEndDate = moment(endDate, "MMMM D, YYYY").format(
              "MM/DD/YYYY"
            );

            period.end = formattedEndDate;
            continue;
          }
        }
      }

      const match = PERIOD_START_REGEX.exec(shardText);
      if (match) {
        const startDate = match[1];

        if (startDate) {
          // Get the year from the end date
          const matchedYear = /\/(\d{4})$/.exec(period.end);
          if (!matchedYear) continue;
          const year = matchedYear[1];

          // Parse and reformat the date
          const formattedStartDate = moment(
            startDate + "/" + year,
            "M/D/YYYY"
          ).format("MM/DD/YYYY");

          period.start = formattedStartDate;
          return period;
        }
      }
    }
  }

  return period;
}

export function parseSummary(
  textShardGroups: TextShardGroup[][]
): BankStatementSummary {
  const summary = {
    balance: {
      begin: -1,
      end: -1,
    },
    totals: {
      deposits: -1,
      withdrawals: -1,
    },
  } as BankStatementSummary;

  const firstPage = textShardGroups[0];
  if (!firstPage) return summary;

  let foundAccountSummary = false;
  for (const textShardGroup of firstPage) {
    for (const textShard of textShardGroup.textShards) {
      // Account Summary
      const shardText = strip(textShard.text);
      if (shardText === "Statement period activity summary")
        foundAccountSummary = true;
      if (!foundAccountSummary) continue;

      // Beginning Balance
      if (summary.balance.begin == -1) {
        const shardText = strip(textShard.text);
        if (shardText.includes("Beginning balance on ")) {
          for (const shard of textShardGroup.textShards) {
            const shardText = strip(shard.text);

            if (shardText.startsWith("$")) {
              summary.balance.begin = parseFloat(
                shardText.replace("$", "").replace(/,/g, "")
              );
              break;
            }
          }
        }
      }

      // Ending Balance
      if (summary.balance.end == -1) {
        const shardText = strip(textShard.text);
        if (shardText.includes("Ending balance on ")) {
          for (const shard of textShardGroup.textShards) {
            const shardText = strip(shard.text);

            if (shardText.startsWith("$")) {
              summary.balance.end = parseFloat(
                shardText.replace("$", "").replace(/,/g, "")
              );
              break;
            }
          }
        }
      }

      // Deposits
      if (summary.totals.deposits == -1) {
        const shardText = strip(textShard.text);
        if (shardText.includes("Deposits/Credits")) {
          for (const shard of textShardGroup.textShards) {
            const shardText = strip(shard.text);

            const result = AMOUNT_REGEX.exec(shardText);
            if (!result || !result[0]) continue;

            summary.totals.deposits = parseFloat(
              result[0].replace(/,/g, "").replace(" ", "")
            );
            break;
          }
        }
      }

      // Withdrawals
      if (summary.totals.withdrawals == -1) {
        const shardText = strip(textShard.text);
        if (shardText.includes("Withdrawals/Debits")) {
          for (const shard of textShardGroup.textShards) {
            const shardText = strip(shard.text);

            const result = AMOUNT_REGEX.exec(shardText);
            if (!result || !result[0]) continue;

            summary.totals.withdrawals = parseFloat(
              result[0].replace(/,/g, "").replace(" ", "")
            );
            break;
          }
        }
      }
    }
  }

  return summary;
}

export function parseDeposits(
  textShardGroups: TextShardGroup[][],
  year: string
): Transaction[] {
  return parseTransactions(textShardGroups, "deposits", year);
}

export function parseWithdrawals(
  textShardGroups: TextShardGroup[][],
  year: string
): Transaction[] {
  return parseTransactions(textShardGroups, "withdrawals", year);
}

function parseTransactions(
  textShardGroups: TextShardGroup[][],
  type: "deposits" | "withdrawals",
  year: string
): Transaction[] {
  const transactions = [] as Transaction[];
  if (type !== "deposits" && type !== "withdrawals") return transactions;

  // Transactions start on page 2 (index 1) for Wells Fargo bank statements
  for (const page of textShardGroups.slice(1)) {
    let foundTable = false;
    for (const textShardGroup of page) {
      const curTransaction = emptyTransaction();
      for (const textShard of textShardGroup.textShards) {
        if (!foundTable) {
          const shardText = strip(textShard.text);

          if (shardText.includes("Transaction history")) {
            foundTable = true;
            continue; // Move to next line...
          }
        }
        if (!foundTable) continue;

        // Look for the totals
        const shardText = strip(textShard.text);
        if (shardText.includes("Ending balance on")) return transactions;

        const lineText = getGroupedShardTexts(textShardGroup);
        const joinedLineText = lineText.join(" ");

        // Date
        if (!curTransaction.date) {
          const dateText = joinedLineText;
          const dateMatch = dateText?.match(DATE_REGEX);
          if (dateText && dateMatch && dateMatch.index !== undefined) {
            let date = dateMatch[0];
            date += `/${year.slice(2)}`;
            const dateFormatted = moment(date, "M/D/YY").format("MM/DD/YYYY");

            curTransaction.date = dateFormatted;
          }
        }

        // Description
        // TODO: possibly include multi-line descriptions
        if (!curTransaction.description.original) {
          if (
            isBoundingPolyWithinRange(
              textShard.boundingPoly.normalizedVertices,
              "x",
              0.17,
              0.64
            )
          ) {
            const descriptionText = shardText;
            if (descriptionText) {
              curTransaction.description.original = descriptionText;
              curTransaction.description.shortened =
                shortenDescription(descriptionText);
            }
          }
        }

        // Amount
        if (curTransaction.amount === -1) {
          if (
            type === "deposits"
              ? isBoundingPolyWithinRange(
                  textShard.boundingPoly.normalizedVertices,
                  "x",
                  0.63,
                  0.73
                )
              : isBoundingPolyWithinRange(
                  textShard.boundingPoly.normalizedVertices,
                  "x",
                  0.73,
                  0.83
                )
          ) {
            let result = AMOUNT_REGEX.exec(shardText);
            if (!result || !result[0]) {
              // Attempt to fix broken amounts (no decimal places) before continuing
              if (!shardText.endsWith(".")) continue;
              const fixedAmount = shardText.endsWith(".")
                ? shardText + "00"
                : shardText;
              result = AMOUNT_REGEX.exec(fixedAmount);
              if (!result || !result[0]) continue;
            }

            curTransaction.amount =
              parseFloat(result[0].replace(/,/g, "")) *
              (type === "withdrawals" ? -1 : 1);

            if (curTransaction.date && curTransaction.description.original)
              transactions.push(curTransaction);
            else {
              // Override the date check and as long as there's a description, just push it through
              if (curTransaction.description.original)
                transactions.push(curTransaction);
              else {
                curTransaction.description.original =
                  "UNKNOWN - PLEASE CHECK MANUALLY";
                transactions.push(curTransaction);
              }
            }
            break;
          }
        }
      }
    }
  }

  return transactions;
}

function shortenDescription(description: string): string | undefined {
  let shortened = description;
  // Attempt to remove all contents before and including " authorized on 08/25" from shortened, where the date dynamic but always 2 digits for month and day
  const authorizedOnMatch = shortened.match(
    new RegExp(` authorized on [0-9]{2}/[0-9]{2}`, "i")
  );
  if (authorizedOnMatch && authorizedOnMatch.index !== undefined) {
    shortened = shortened.slice(
      authorizedOnMatch.index + authorizedOnMatch[0].length
    );
  }
  const atmCheckMatch = shortened.match(
    new RegExp(`ATM Check Deposit on [0-9]{2}/[0-9]{2}`, "i")
  );
  if (atmCheckMatch && atmCheckMatch.index !== undefined) {
    shortened = shortened.slice(atmCheckMatch.index + atmCheckMatch[0].length);
  }

  // Attempt to replace "Online Transfer To " from the start of shortened, with "TRANSFER TO"
  const ONLINE_BANKING_TRANSFER_TO_REGEX = /^Online Transfer To /;
  shortened = shortened.replace(
    ONLINE_BANKING_TRANSFER_TO_REGEX,
    "TRANSFER TO "
  );
  // Attempt to replace "Online Transfer From " from the start of shortened, with "TRANSFER FROM"
  const ONLINE_BANKING_TRANSFER_FROM_REGEX = /^Online Transfer From /;
  shortened = shortened.replace(
    ONLINE_BANKING_TRANSFER_FROM_REGEX,
    "TRANSFER FROM "
  );

  // Attempt to replace "Zelle to " from the start of shortened, with "ZELLE TO "
  const ZELLE_TO_REGEX = /^Zelle to /;
  if (ZELLE_TO_REGEX.test(shortened)) {
    // Replace all contents starting at " on 09/01" to the end from shortened, where the date dynamic but always 2 digits for month and day
    const zelleOnMatch = shortened.match(
      new RegExp(` on [0-9]{2}/[0-9]{2}`, "i")
    );
    if (zelleOnMatch && zelleOnMatch.index !== undefined)
      shortened = shortened.slice(0, zelleOnMatch.index);
    shortened = shortened.replace(ZELLE_TO_REGEX, "ZELLE TO ");
  }

  // Attempt to replace "Zelle from " from the start of shortened, with "ZELLE FROM "
  const ZELLE_FROM_REGEX = /^Zelle from /;
  if (ZELLE_FROM_REGEX.test(shortened)) {
    // Replace all contents starting at " on 09/01" to the end from shortened, where the date dynamic but always 2 digits for month and day
    const zelleOnMatch = shortened.match(
      new RegExp(` on [0-9]{2}/[0-9]{2}`, "i")
    );
    if (zelleOnMatch && zelleOnMatch.index !== undefined)
      shortened = shortened.slice(0, zelleOnMatch.index);
    shortened = shortened.replace(ZELLE_FROM_REGEX, "ZELLE FROM ");
  }

  // Mark returns
  if (description.includes("Return authorized"))
    shortened = shortened.trim() + " RETURN";

  // Add TRANSFERS to shortened if not yet added
  if (
    description.includes("Transfer authorized") &&
    !shortened.includes("TRANSFER")
  )
    shortened = "TRANSFER " + shortened.trim();

  // Make sure to mark whenever a transaction is an ATM Check Deposit
  if (description.includes("ATM Check") && !shortened.includes("ATM CHECK"))
    shortened = "ATM CHECK " + shortened.trim();

  // TODO: determine whether to keep this in production...
  const SHORTENED = shortened.toUpperCase();
  if (SHORTENED.startsWith("FLA DEPT REVENUE"))
    shortened = SHORTENED.replace("FLA DEPT REVENUE", "FDOR");
  else if (SHORTENED.startsWith("WESTERN UNION"))
    shortened = SHORTENED.replace("WESTERN UNION", "WU").replace("WU WU", "WU");

  return shortened !== description ? shortened.trim().toUpperCase() : undefined;
}
