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
      if (text.includes("Regions Bank")) return true;
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
          0.11,
          0.45
        ) &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "y",
          0.14,
          0.215
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
          0.65,
          0.96
        ) &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "y",
          0.1935,
          0.22
        )
      ) {
        const shardText = strip(textShard.text);
        const lineText = getGroupedShardTexts(textShardGroup);

        if (!shardText.startsWith("ACCOUNT #")) continue;
        const joinedLineText = lineText.join(" ");
        const accountNumber = joinedLineText
          .substring(joinedLineText.indexOf("ACCOUNT #") + 9)
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
          0.3,
          0.7
        ) &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "y",
          0.31,
          0.33
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
          0.44,
          0.56
        ) &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "y",
          0.355,
          0.375
        )
      ) {
        const shardText = strip(textShard.text);

        if (shardText === "SUMMARY") foundAccountSummary = true;
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
        if (shardText.includes("Deposits & Credits")) {
          for (const shard of textShardGroup.textShards) {
            const shardText = strip(shard.text);

            if (shardText.startsWith("$")) {
              summary.totals.deposits = parseFloat(
                shardText.replace("$", "").replace(/,/g, "")
              );
              break;
            }
          }
        }
      }

      // Withdrawals
      if (summary.totals.withdrawals == -1) {
        const shardText = strip(textShard.text);
        if (shardText.includes("Withdrawals")) {
          for (const shard of textShardGroup.textShards) {
            const shardText = strip(shard.text);

            if (shardText.startsWith("$")) {
              summary.totals.withdrawals =
                parseFloat(shardText.replace("$", "").replace(/,/g, "")) * -1;
              break;
            }
          }
        }
      }

      // Checks
      if (summary.totals.checks === undefined) {
        const shardText = strip(textShard.text);
        if (shardText.includes("Checks")) {
          for (const shard of textShardGroup.textShards) {
            const shardText = strip(shard.text);

            if (shardText.startsWith("$")) {
              summary.totals.checks =
                parseFloat(shardText.replace("$", "").replace(/,/g, "")) * -1;
              break;
            }
          }
        }
      }

      // Fees
      if (summary.totals.fees === undefined) {
        const shardText = strip(textShard.text);
        if (shardText.includes("Fees")) {
          for (const shard of textShardGroup.textShards) {
            const shardText = strip(shard.text);

            if (shardText.startsWith("$")) {
              summary.totals.fees =
                parseFloat(shardText.replace("$", "").replace(/,/g, "")) * -1;
              break;
            }
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

  // Transactions start on page 1 for Regions bank statements
  for (const page of textShardGroups) {
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
                ? "DEPOSITS & CREDITS"
                : type === "withdrawals"
                ? "WITHDRAWALS"
                : ""
            )
          )
            foundTable = true;
        }
        if (!foundTable) continue;

        // Look for the totals
        const shardText = strip(textShard.text);
        if (
          shardText.includes(
            type === "deposits"
              ? "Total Deposits & Credits"
              : type === "withdrawals"
              ? "Total Withdrawals"
              : ""
          ) ||
          shardText.includes(type === "deposits" ? "WITHDRAWALS" : "FEES")
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
          const result = AMOUNT_END_REGEX.exec(joinedLineText);
          if (!result || !result[0]) continue;

          curTransaction.amount =
            parseFloat(result[0].replace(/,/g, "")) *
            (type === "withdrawals" ? -1 : 1);

          transactions.push(curTransaction);
          break;
        }
      }
    }
  }

  return transactions;
}

function shortenDescription(description: string): string | undefined {
  let shortened = description;

  // TODO: determine whether to keep this in production...
  const SHORTENED = shortened.toUpperCase();
  if (SHORTENED.startsWith("FLA DEPT REVENUE")) shortened = "FDOR";
  else if (SHORTENED.startsWith("WESTERN UNION")) shortened = "WU";

  return shortened !== description ? shortened : undefined;
}
