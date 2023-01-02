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

const PERIOD_REGEX = /(\w+ \d{1,2}, \d{4}) through (\w+ \d{1,2}, \d{4})/;

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

function shortenDescription(description: string): string | undefined {
  let shortened = description;

  // TODO: determine whether to keep this in production...
  const SHORTENED = shortened.toUpperCase();
  if (SHORTENED.startsWith("FLA DEPT REVENUE")) shortened = "FDOR";
  else if (SHORTENED.startsWith("WESTERN UNION")) shortened = "WU";

  return shortened !== description ? shortened : undefined;
}
