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

const PERIOD_START_REGEX = /Beginning balance on (\d+\/\d+)/;
const PERIOD_END_REGEX = /(\w+ \d{1,2}, \d{4})/;

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
