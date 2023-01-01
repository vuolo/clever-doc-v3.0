import moment from "moment";

import type {
  Company,
  GeneralLedgerAccount,
  GeneralLedgerEntry,
  Period,
} from "@/types/tools/bsca/general-ledger";
import type { TextShard, TextShardGroup } from "@/types/ocr";
import {
  getTextShardGroupsWithinRange,
  isBoundingPolyWithinRange,
} from "@/utils/ocr";

const PERIOD_REGEX = /(\w+ \d{1,2}, \d{4}) ?- ?(\w+ \d{1,2}, \d{4})/;
const NEWLINES_REGEX = /\r?\n|\r/g;

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
      const lineText =
        textShardGroup[1].textShards[0]?.text.replace(NEWLINES_REGEX, "") ?? "";

      if (lineText == "General Ledger") return true;
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
      const lineText =
        textShardGroup[0].textShards[0]?.text.replace(NEWLINES_REGEX, "") ?? "";

      return {
        name: lineText,
      };
    }
  }

  return {
    name: "Unknown Company",
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
      const lineText =
        textShardGroup[2].textShards[0]?.text.replace(NEWLINES_REGEX, "") ?? "";

      const match = PERIOD_REGEX.exec(lineText);
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
  const textShardGroups_body = getTextShardGroupsWithinRange(
    textShardGroups,
    "y",
    0.11,
    0.96
  );
  return textShardGroups_body;
}
