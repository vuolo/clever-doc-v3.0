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

const DATE_REGEX = /^\d{2}\/\d{2}\/\d{2}/;
const PERIOD_REGEX = /for (\w+ \d{1,2}, \d{4}) to (\w+ \d{1,2}, \d{4})/;
const AMOUNT_REGEX = /-?\d{1,3}(,\d{3})*\.\d{2}/;
const AMOUNT_END_REGEX = /-?\d{1,3}(,\d{3})*\.\d{2}$/;

export function isBank(textShardGroups: TextShardGroup[][]): boolean {
  const firstPage = textShardGroups[0];
  if (!firstPage) return false;

  for (const textShardGroup of firstPage) {
    const lineText = getGroupedShardTexts(textShardGroup);
    for (const text of lineText) {
      if (text.includes("1.888.BUSINESS")) return true;
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
          0.04,
          0.34
        ) &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "y",
          0.18,
          0.35
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
          0.9
        ) &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "y",
          // Sometimes, the account name is short or large. If it is large, the bounding poly is slightly lower. So make it work for both cases:
          0.41,
          0.455
          // With a large (2-lined) account name:
          // 0.435,
          // 0.455
        )
      ) {
        const shardText = strip(textShard.text);

        if (!shardText.startsWith("Account number: ")) continue;
        account.number = shardText.replace("Account number: ", "");
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
          0.045,
          0.46
        ) &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "y",
          // Sometimes, the account name is short or large. If it is large, the bounding poly is slightly lower. So make it work for both cases:
          0.41,
          0.455
          // With a large (2-lined) account name:
          // 0.435,
          // 0.455
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
          0.045,
          0.27
        ) &&
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "y",
          // Sometimes, the account name is short or large. If it is large, the bounding poly is slightly lower. So make it work for both cases:
          0.46,
          0.515
          // With a large (2-lined) account name:
          // 0.49,
          // 0.515
        )
      ) {
        const shardText = strip(textShard.text);

        if (shardText === "Account summary") foundAccountSummary = true;
      }
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
        if (shardText.includes("Deposits and other credits")) {
          for (const shard of textShardGroup.textShards) {
            const shardText = strip(shard.text);

            const result = AMOUNT_REGEX.exec(shardText);
            if (!result || !result[0]) continue;

            summary.totals.deposits = parseFloat(result[0].replace(/,/g, ""));
            break;
          }
        }
      }

      // Withdrawals
      if (summary.totals.withdrawals == -1) {
        const shardText = strip(textShard.text);
        if (shardText.includes("Withdrawals and other debits")) {
          for (const shard of textShardGroup.textShards) {
            const shardText = strip(shard.text);

            const result = AMOUNT_REGEX.exec(shardText);
            if (!result || !result[0]) continue;

            summary.totals.withdrawals = parseFloat(
              result[0].replace(/,/g, "")
            );
            break;
          }
        }
      }

      // Checks
      if (summary.totals.checks === undefined) {
        const shardText = strip(textShard.text);
        if (shardText.includes("Checks")) {
          for (const shard of textShardGroup.textShards) {
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
        if (shardText.includes("Service fees")) {
          for (const shard of textShardGroup.textShards) {
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
  textShardGroups: TextShardGroup[][]
): Transaction[] {
  return parseTransactions(textShardGroups, "deposits");
}

export function parseWithdrawals(
  textShardGroups: TextShardGroup[][]
): Transaction[] {
  return parseTransactions(textShardGroups, "withdrawals");
}

function parseTransactions(
  textShardGroups: TextShardGroup[][],
  type: "deposits" | "withdrawals"
): Transaction[] {
  const transactions = [] as Transaction[];
  if (type !== "deposits" && type !== "withdrawals") return transactions;

  // Transactions start on page 3 (index 2) for Bank of America bank statements
  for (const page of textShardGroups.slice(2)) {
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
                ? "Deposits and other credits"
                : type === "withdrawals"
                ? "Withdrawals and other debits"
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
              ? "Total deposits and other credits"
              : type === "withdrawals"
              ? "Total withdrawals and other debits"
              : ""
          )
        )
          return transactions;

        const lineText = getGroupedShardTexts(textShardGroup);
        const joinedLineText = lineText.join(" ");

        // Date
        if (!curTransaction.date) {
          const dateText = joinedLineText;
          const dateMatch = dateText?.match(DATE_REGEX);
          if (dateText && dateMatch && dateMatch.index !== undefined) {
            const date = dateText.slice(dateMatch.index, dateMatch.index + 8);
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

          curTransaction.amount = parseFloat(result[0].replace(/,/g, ""));

          if (curTransaction.date && curTransaction.description.original)
            transactions.push(curTransaction);
          else {
            // Override the date check and as long as there's a description, just push it through
            if (curTransaction.description.original) {
              if (
                !curTransaction.description.original.includes(
                  "Subtotal for card account"
                )
              ) {
                transactions.push(curTransaction);
              }
            } else {
              curTransaction.description.original =
                "UNKNOWN - PLEASE CHECK MANUALLY";
              transactions.push(curTransaction);
            }
          }
          break;
        }

        // @DEPRECIATED: This is the old way of parsing transactions, which is now deprecated because sometimes some textShards are combined
        // // Ensure there are at least 3 items, representing a table row
        // if (textShardGroup.textShards.length <= 2) continue;

        // // Date
        // if (!curTransaction.date) {
        //   const dateText = textShardGroup.textShards[0]?.text;
        //   const dateMatch = dateText?.match(DATE_REGEX);
        //   if (dateText && dateMatch && dateMatch.index !== undefined) {
        //     const date = dateText.slice(dateMatch.index, dateMatch.index + 8);
        //     const dateFormatted = moment(date, "MM/DD/YY").format("MM/DD/YYYY");

        //     curTransaction.date = dateFormatted;
        //   }
        // }

        // // Description
        // // Note: this doesn't work for multi-line descriptions
        // else if (!curTransaction.description.original) {
        //   const descriptionText = textShardGroup.textShards[1]?.text;
        //   if (descriptionText) {
        //     curTransaction.description.original = descriptionText;
        //     curTransaction.description.shortened =
        //       shortenDescription(descriptionText);
        //   }
        // }

        // // Amount
        // else if (curTransaction.amount === -1) {
        //   const result = AMOUNT_REGEX.exec(shardText);
        //   if (!result || !result[0]) continue;

        //   curTransaction.amount = parseFloat(result[0].replace(/,/g, ""));

        //   transactions.push(curTransaction);
        //   break;
        // }
      }
    }
  }

  return transactions;
}

function shortenDescription(description: string): string | undefined {
  let shortened = description;
  if (description.includes("DES:"))
    shortened = description.split("DES:")[0]?.trim() ?? description;
  // Attempt to remove "CHECKCARD 0907" from the start of shortened, where the CHECKCARD number is dynamic but always 4 digits...
  if (shortened.startsWith("CHECKCARD ")) {
    const checkcardNumber = shortened.slice(10, 14);
    if (checkcardNumber.length === 4 && !isNaN(parseInt(checkcardNumber)))
      shortened = shortened.slice(14).trim();
  }
  // Attempt to replace "Online Banking transfer to " from the start of shortened, with "TRANSFER TO"
  const ONLINE_BANKING_TRANSFER_TO_REGEX = /^Online Banking transfer to /;
  shortened = shortened.replace(
    ONLINE_BANKING_TRANSFER_TO_REGEX,
    "TRANSFER TO "
  );
  // Attempt to replace "Online Banking transfer from " from the start of shortened, with "TRANSFER FROM"
  const ONLINE_BANKING_TRANSFER_FROM_REGEX = /^Online Banking transfer from /;
  shortened = shortened.replace(
    ONLINE_BANKING_TRANSFER_FROM_REGEX,
    "TRANSFER FROM "
  );

  // Attempt to remove "Online Banking Transfer Conf# jicq53rao;" from the start of shortened, where the confirmation number is dynamic and a random string...
  const ONLINE_BANKING_TRANSFER_CONF_REGEX =
    /^Online Banking Transfer Conf# [a-z0-9]+; /;
  shortened = shortened.replace(ONLINE_BANKING_TRANSFER_CONF_REGEX, "");

  // Attempt to remove "Confirmation# 9219408141" from the end of shortened, where the confirmation number is dynamic and a random number of digits...
  const CONFIRMATION_NUMBER_REGEX = / Confirmation# \d+$/;
  shortened = shortened.replace(CONFIRMATION_NUMBER_REGEX, "");

  // TODO: determine whether to keep this in production...
  const SHORTENED = shortened.toUpperCase();
  if (SHORTENED.startsWith("FLA DEPT REVENUE"))
    shortened = SHORTENED.replace("FLA DEPT REVENUE", "FDOR");
  else if (SHORTENED.startsWith("WESTERN UNION"))
    shortened = SHORTENED.replace("WESTERN UNION", "WU");

  return shortened !== description ? shortened.trim().toUpperCase() : undefined;
}
