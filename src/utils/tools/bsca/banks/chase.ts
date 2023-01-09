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
  isBoundingPolyWithinRange,
  strip,
} from "@/utils/ocr";
import { emptyTransaction } from "../BankStatement";

const DATE_REGEX = /^\d{2}\/\d{2}/;
const PERIOD_REGEX = /(\w+ \d{1,2}, \d{4}) through (\w+ \d{1,2}, \d{4})/;
const AMOUNT_REGEX = /-?\d{1,3}(,\d{3})*\.\d{2}/;
const AMOUNT_END_REGEX = /-?\d{1,3}(,\d{3})*\.\d{2}$/;

export function isBank(textShardGroups: TextShardGroup[][]): boolean {
  const firstPage = textShardGroups[0];
  if (!firstPage) return false;

  for (const textShardGroup of firstPage) {
    const lineText = getGroupedShardTexts(textShardGroup);
    for (const text of lineText) {
      if (text.includes("Chase.com")) return true;
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
          0.08,
          0.48
        ) &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "y",
          0.1675,
          0.22
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
          0.565,
          0.88
        ) &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "y",
          0.0675,
          0.085
        )
      ) {
        const shardText = strip(textShard.text);
        const lineText = getGroupedShardTexts(textShardGroup);

        const query = "Account Number:";
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
      if (
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "x",
          0.565,
          0.88
        ) &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "y",
          0.0525,
          0.07
        )
      ) {
        const shardText = strip(textShard.text);

        const match = PERIOD_REGEX.exec(shardText);
        if (match) {
          const startDate = match[1];
          const endDate = match[2];

          if (startDate && endDate) {
            // Parse and reformat the dates
            const formattedStartDate = moment(startDate, "MMMM D, YYYY").format(
              "MM/DD/YYYY"
            );
            const formattedEndDate = moment(endDate, "MMMM D, YYYY").format(
              "MM/DD/YYYY"
            );

            return {
              start: formattedStartDate,
              end: formattedEndDate,
            };
          }
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
      if (
        !foundAccountSummary &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "x",
          0.05,
          0.32
        ) &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "y",
          0.35,
          0.8
          // 0.62,
          // 0.655
        )
      ) {
        const shardText = strip(textShard.text);

        if (shardText === "CHECKING SUMMARY" || shardText === "SAVINGS SUMMARY")
          foundAccountSummary = true;
      }
      if (!foundAccountSummary) continue;

      // Beginning Balance
      if (summary.balance.begin == -1) {
        const shardText = strip(textShard.text);
        if (shardText.includes("Beginning Balance")) {
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
        if (shardText.includes("Ending Balance")) {
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
        if (shardText.includes("Deposits and Additions")) {
          for (let i = 0; i < textShardGroup.textShards.length; i++) {
            if (i !== textShardGroup.textShards.length - 1) continue;

            const shard = textShardGroup.textShards[i];
            if (!shard) continue;

            const shardText = strip(shard.text);

            const result = AMOUNT_REGEX.exec(shardText);
            if (!result || !result[0]) continue;

            summary.totals.deposits = parseFloat(result[0].replace(/,/g, ""));
            break;
          }
        }
      }

      // Withdrawals (WE KEEP [if (true)] for now because there are 2 withdrawals sections, "ATM & Debit Card Withdrawals" and "Electronic Withdrawals")
      if (true || summary.totals.withdrawals == -1) {
        const shardText = strip(textShard.text);
        if (shardText.includes("Withdrawals")) {
          for (let i = 0; i < textShardGroup.textShards.length; i++) {
            if (i !== textShardGroup.textShards.length - 1) continue;

            const shard = textShardGroup.textShards[i];
            if (!shard) continue;

            const shardText = strip(shard.text);

            const result = AMOUNT_REGEX.exec(shardText);
            if (!result || !result[0]) continue;

            // Clear the default value
            if (summary.totals.withdrawals === -1)
              summary.totals.withdrawals = 0;

            summary.totals.withdrawals += parseFloat(
              result[0].replace(/,/g, "")
            );
            break;
          }
        }
      }

      // Checks
      if (summary.totals.checks === undefined) {
        const shardText = strip(textShard.text);
        if (shardText.includes("Checks Paid")) {
          for (let i = 0; i < textShardGroup.textShards.length; i++) {
            if (i !== textShardGroup.textShards.length - 1) continue;

            const shard = textShardGroup.textShards[i];
            if (!shard) continue;

            const shardText = strip(shard.text);

            const result = AMOUNT_REGEX.exec(shardText);
            if (!result || !result[0]) continue;

            summary.totals.checks = parseFloat(result[0].replace(/,/g, ""));
            break;
          }
        }
      }

      // Fees
      if (summary.totals.fees === undefined) {
        const shardText = strip(textShard.text);
        if (shardText.includes("Fees")) {
          for (let i = 0; i < textShardGroup.textShards.length; i++) {
            if (i !== textShardGroup.textShards.length - 1) continue;

            const shard = textShardGroup.textShards[i];
            if (!shard) continue;

            const shardText = strip(shard.text);

            const result = AMOUNT_REGEX.exec(shardText);
            if (!result || !result[0]) continue;

            summary.totals.fees = parseFloat(result[0].replace(/,/g, ""));
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

  // Transactions start on page 2 (index 1) for Chase bank statements
  for (const page of textShardGroups.slice(1)) {
    let foundTable = false;
    for (const textShardGroup of page) {
      const curTransaction = emptyTransaction();
      for (const textShard of textShardGroup.textShards) {
        if (
          !foundTable
          // This is disabled because it's unnecessary to be honest...
          //  &&
          // isBoundingPolyWithinRange(
          //   textShard.boundingPoly.normalizedVertices,
          //   "x",
          //   0.04,
          //   0.5 // 0.37 (0.37 is for the start of the deposits section, 0.50 is for "continued" deposits section)
          // )
        ) {
          const shardText = strip(textShard.text);

          if (
            shardText.includes(
              type === "deposits"
                ? "DEPOSITS AND ADDITIONS"
                : type === "withdrawals"
                ? "ATM & DEBIT CARD WITHDRAWALS"
                : ""
            ) ||
            (type === "withdrawals" &&
              shardText.includes("ELECTRONIC WITHDRAWALS"))
          ) {
            foundTable = true;
            continue; // Move to next line...
          }
        }
        if (!foundTable) continue;

        // Look for the totals
        const shardText = strip(textShard.text);
        if (
          type === "deposits" &&
          shardText.includes("Total Deposits and Additions")
        )
          return transactions;
        // Prevent ending on the "Total ATM & Debit Card Withdrawals" line, because of the "Total Electronic Withdrawals" line
        else if (
          type === "withdrawals" &&
          shardText.includes("Total ATM & Debit Card Withdrawals")
        ) {
          foundTable = false;
          break;
        }
        // Only return withdrawals on the "Total Electronic Withdrawals" line
        else if (
          type === "withdrawals" &&
          shardText.includes("Total Electronic Withdrawals")
        )
          return transactions;

        const lineText = getGroupedShardTexts(textShardGroup);
        const joinedLineText = lineText.join(" ");

        // Date
        if (!curTransaction.date) {
          const dateText = joinedLineText;
          const dateMatch = dateText?.match(DATE_REGEX);
          if (dateText && dateMatch && dateMatch.index !== undefined) {
            let date = dateText.slice(dateMatch.index, dateMatch.index + 5);
            date += `/${year.slice(2)}`;
            const dateFormatted = moment(date, "MM/DD/YY").format("MM/DD/YYYY");

            curTransaction.date = dateFormatted;
          }
        }

        // Description
        // TODO: possibly include multi-line descriptions
        if (!curTransaction.description.original) {
          const descriptionText = joinedLineText
            .replace(DATE_REGEX, "")
            .replace(AMOUNT_END_REGEX, "")
            .trim();
          if (descriptionText) {
            curTransaction.description.original = descriptionText;
            curTransaction.description.shortened =
              shortenDescription(descriptionText);
          }
        }

        // Amount
        if (curTransaction.amount === -1) {
          let textWithoutBarcode = joinedLineText;
          // Ignore the barcode by checking the bounding box x start past 93%
          if (textShard.boundingPoly.normalizedVertices.bottomLeft.x > 0.93) {
            textWithoutBarcode = textWithoutBarcode
              .replace(textWithoutBarcode.split(" ").splice(-1).join(" "), "")
              .trim();
          }

          const result = AMOUNT_END_REGEX.exec(textWithoutBarcode);
          if (!result || !result[0]) continue;

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

  return transactions;
}

function shortenDescription(description: string): string | undefined {
  let shortened = description;
  if (description.includes(" Orig ID:"))
    shortened = description.split(" Orig ID:")[0]?.trim() ?? description;
  else if (description.includes(" Transaction#:"))
    shortened = description.split(" Transaction#:")[0]?.trim() ?? description;
  // Attempt to remove "Card Purchase 03/07" from the start of shortened, or "Card Purchase With Pin 03/08" from the start of shortened,
  const CARD_PURCHASE_REGEX = /^Card Purchase( With Pin)? \d{2}\/\d{2} /;
  shortened = shortened.replace(CARD_PURCHASE_REGEX, "");
  // or "Non-Chase ATM Withdrawal 03/08" from the start of shortened, where the date is dynamic but always in that format MM/YY...
  const NON_CHASE_ATM_WITHDRAWAL_REGEX =
    /^Non-Chase ATM Withdrawal \d{2}\/\d{2} /;
  shortened = shortened.replace(NON_CHASE_ATM_WITHDRAWAL_REGEX, "");

  // Attempt to remove "Card 2442" from the end of shortened, where the card number is dynamic but always 4 digits...
  const CARD_NUMBER_REGEX = / Card \d{4}$/;
  shortened = shortened.replace(CARD_NUMBER_REGEX, "");

  // TODO: determine whether to keep this in production...
  const SHORTENED = shortened.toUpperCase();
  if (SHORTENED.startsWith("FLA DEPT REVENUE"))
    shortened = SHORTENED.replace("FLA DEPT REVENUE", "FDOR");
  else if (SHORTENED.startsWith("WESTERN UNION"))
    shortened = SHORTENED.replace("WESTERN UNION", "WU").replaceAll(
      "WU WU",
      "WU"
    );

  return shortened !== description ? shortened.trim().toUpperCase() : undefined;
}
