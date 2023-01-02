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
} from "@/utils/ocr";

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
