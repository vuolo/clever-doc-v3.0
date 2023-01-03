import moment from "moment";

import type {
  Company,
  GeneralLedgerAccount,
  GeneralLedgerEntry,
  Period,
} from "@/types/tools/bsca/general-ledger";
import type { TextShardGroup } from "@/types/ocr";
import {
  getGroupedShardTexts,
  getTextShardGroupsWithinRange,
  getTextShardWithinRange,
  isBoundingPolyWithinRange,
  strip,
} from "@/utils/ocr";

const DISTRIBUTION_COUNT_REGEX = /Distribution count = (\d+)/;
const TOTALS_REGEX = /Totals for (\S+)/;
const DATE_REGEX = /^\d{2}\/\d{2}\/\d{2}/;
const PERIOD_REGEX = /(\w+ \d{1,2}, \d{4}) ?- ?(\w+ \d{1,2}, \d{4})/;
const PARENTHESIS_REGEX = /^\((.+)\)$/;

export function isGLFormat(textShardGroups: TextShardGroup[][]): boolean {
  for (const textShardGroup of textShardGroups) {
    // Check for "General Ledger" in the second line of any page
    if (
      textShardGroup[1] &&
      // We are only checking whether the bounding poly is within the specified range
      // just to test the new idea of matching text using boundingPoly. This is not
      // necessary for this particular case, but it's a good reference for other cases.
      isBoundingPolyWithinRange(
        textShardGroup[1].boundingPoly.normalizedVertices,
        "x",
        0.38,
        0.62
      ) &&
      isBoundingPolyWithinRange(
        textShardGroup[1].boundingPoly.normalizedVertices,
        "y",
        0.03,
        0.07
      )
    ) {
      const shardText = strip(textShardGroup[1].textShards[0]?.text);

      if (shardText == "General Ledger") return true;
    }
  }

  return false;
}

export function parseCompany(textShardGroups: TextShardGroup[][]): Company {
  for (const textShardGroup of textShardGroups) {
    // Check for company in the first line of any page
    if (
      textShardGroup[0] &&
      isBoundingPolyWithinRange(
        textShardGroup[0].boundingPoly.normalizedVertices,
        "y",
        0.02,
        0.045
      )
    ) {
      const shardText = strip(textShardGroup[0].textShards[0]?.text);

      return {
        name: shardText,
      };
    }
  }

  return {
    name: "Unknown",
  };
}

export function parsePeriod(textShardGroups: TextShardGroup[][]): Period {
  for (const textShardGroup of textShardGroups) {
    // Check for period in the third line of any page
    if (
      textShardGroup[2] &&
      isBoundingPolyWithinRange(
        textShardGroup[2].boundingPoly.normalizedVertices,
        "x",
        0.3,
        0.7
      ) &&
      isBoundingPolyWithinRange(
        textShardGroup[2].boundingPoly.normalizedVertices,
        "y",
        0.05,
        0.073
      )
    ) {
      const shardText = strip(textShardGroup[2].textShards[0]?.text);

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

  return {
    start: "Unknown",
    end: "Unknown",
  };
}

export function parseAccounts(
  textShardGroups: TextShardGroup[][]
): GeneralLedgerAccount[] {
  // Limit the textShardGroups to the body of the document
  const textShardGroups_body = getTextShardGroupsWithinRange(
    getTextShardGroupsWithinRange(textShardGroups, "x", 0.02, 0.97),
    "y",
    0.11,
    0.96
  );

  // Parse the accounts
  let accounts = [] as GeneralLedgerAccount[],
    curEntries = [] as GeneralLedgerEntry[],
    curAccountNumber = "";
  for (const page of textShardGroups_body) {
    for (const textShardGroup of page) {
      for (const textShard of textShardGroup.textShards) {
        // Check fore the accounts' beginning balance
        if (
          isBoundingPolyWithinRange(
            textShard.boundingPoly.normalizedVertices,
            "x",
            0.65,
            0.75
          )
        ) {
          const shardText = strip(textShard.text);
          const lineText = getGroupedShardTexts(textShardGroup);

          // Format can be [ '2163', 'BANK ATLANTIC- LOC', '0.00' ] or [ '2163 BANK ATLANTIC- LOC', '0.00' ] for example...
          // Make sure to combine all the contents of the array except the last one for the account number and name
          // and use the last one for the beginning balances
          const beginningBalance = getAmount(shardText);

          // Combine all the text shards except the last one
          const accountNumberAndName = lineText
            .slice(0, lineText.length - 1)
            .join(" ")
            .trim();
          const accountNumber =
            accountNumberAndName.split(" ")[0] ?? accountNumberAndName; // Sometimes (very rarely) the account name isn't present
          const accountName = accountNumberAndName
            .split(" ")
            .slice(1)
            .join(" ");

          // If the account number is different than the current account number, then we have reached a new account
          if (!doesAccountNumberExistInAccounts(accounts, accountNumber))
            accounts = addAccount(
              accounts,
              accountName,
              accountNumber,
              beginningBalance
            );
          curAccountNumber = accountNumber ?? "Unknown";
        }

        // Record the entries by first looking for the date
        if (
          isBoundingPolyWithinRange(
            textShard.boundingPoly.normalizedVertices,
            "x",
            0.04,
            0.11
          )
        ) {
          const shardText = strip(textShard.text);

          const dateMatch = shardText.match(DATE_REGEX);
          if (dateMatch && dateMatch.index !== undefined) {
            const date = shardText.slice(dateMatch.index, dateMatch.index + 8);
            const dateFormatted = moment(date, "MM/DD/YY").format("MM/DD/YYYY");

            const reference = getTextShardWithinRange(
              textShardGroup.textShards,
              "x",
              0.14,
              0.22
            );
            const journal = getTextShardWithinRange(
              textShardGroup.textShards,
              "x",
              0.23,
              0.29
            );
            // TODO: possibly include multi-line descriptions
            const description = getTextShardWithinRange(
              textShardGroup.textShards,
              "x",
              0.29,
              0.66
            );
            const amount = getTextShardWithinRange(
              textShardGroup.textShards,
              "x",
              0.74,
              0.855
            );

            const entry = {
              date: dateFormatted,
              description: strip(description?.text),
              reference:
                (reference?.text.split(" ") ?? []).length == 1
                  ? strip(reference?.text)
                  : undefined,
              journal: strip(journal?.text),
              amount: getAmount(amount?.text),
            };
            curEntries.push(entry);
          }
        }

        // Check for the totals, which marks the end of the entries for the account
        if (
          isBoundingPolyWithinRange(
            textShard.boundingPoly.normalizedVertices,
            "x",
            0.45,
            0.63
          )
        ) {
          const shardText = strip(textShard.text);

          const totalsMatch = TOTALS_REGEX.exec(shardText);
          if (totalsMatch && totalsMatch[1]) {
            const accountNumber = totalsMatch[1];

            const lineText = getGroupedShardTexts(textShardGroup);
            const endingBalance = lineText[lineText.length - 1];
            const amountTotal = lineText[lineText.length - 2];

            // // Force add the entries to the account
            // const account = accounts.find((a) => a.number == accountNumber);
            // if (account) {
            //   account.entries.push(...curEntries);
            //   account.endingBalance = getAmount(endingBalance);
            //   account.amountTotal = getAmount(amountTotal);
            //   curAccountNumber = "";
            // }

            // Only push entries if the totals' account number matches the current account number (meaning the entries we have been collecting are accurate and for this account)
            const account = accounts.find((a) => a.number == accountNumber);
            if (account?.number == curAccountNumber) {
              account.entries.push(...curEntries);
              account.endingBalance = getAmount(endingBalance);
              account.amountTotal = getAmount(amountTotal);
              curAccountNumber = "";
            } else {
              const account = accounts.find(
                (a) => a.number == curAccountNumber
              );
              if (account) curAccountNumber = accountNumber;
              else {
                accounts.push({
                  name: "Unknown",
                  number: curAccountNumber,
                  entries: [],
                });
              }
            }

            // Clear the current entries. We just found the totals, so time to start a record a new account's entries
            curEntries = [];
          }
        }
      }
    }
  }

  return accounts;
}

export function parseDistributionCount(
  textShardGroups: TextShardGroup[][]
): number | undefined {
  const lastPage = textShardGroups[textShardGroups.length - 1];
  if (!lastPage) return;

  // Check for the distribution count on the last page
  for (const textShardGroup of lastPage) {
    for (const textShard of textShardGroup.textShards) {
      if (
        isBoundingPolyWithinRange(
          textShard.boundingPoly.normalizedVertices,
          "x",
          0.025,
          0.22
        )
      ) {
        const shardText = strip(textShard.text);

        if (shardText.includes("Distribution count")) {
          const lineText = getGroupedShardTexts(textShardGroup);
          const joinedLineText = lineText.join(" ").replace(/,/g, "");

          const distributionCountMatch = joinedLineText.match(
            DISTRIBUTION_COUNT_REGEX
          );
          if (distributionCountMatch && distributionCountMatch[1])
            return parseInt(distributionCountMatch[1]);
        }
      }
    }
  }
}

function getAmount(text?: string): number | undefined {
  return text
    ? parseFloat(
        strip(text).replace(/,/g, "").replace(PARENTHESIS_REGEX, "$1")
      ) * (text.includes("(") ? -1 : 1)
    : undefined;
}

function doesAccountNumberExistInAccounts(
  accounts: GeneralLedgerAccount[],
  accountNumber = "Unknown"
) {
  return accounts.find((a) => a.number == accountNumber);
}

function addAccount(
  accounts: GeneralLedgerAccount[],
  name = "Unknown",
  number = "Unknown",
  beginningBalance?: number,
  entries: GeneralLedgerEntry[] = []
): GeneralLedgerAccount[] {
  accounts.push({
    name,
    number,
    entries,
    beginningBalance,
  });
  return accounts;
}
