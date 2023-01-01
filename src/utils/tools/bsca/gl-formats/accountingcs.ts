import moment from "moment";

import type {
  Company,
  GeneralLedgerAccount,
  GeneralLedgerEntry,
  Period,
} from "@/types/tools/bsca/general-ledger";
import type { TextShard } from "@/types/ocr";
import { getTextShardsAsLines } from "@/utils/ocr";

const PERIOD_REGEX = /(\w+ \d{1,2}, \d{4}) ?- ?(\w+ \d{1,2}, \d{4})/;

export function isGLFormat(textShards: TextShard[][]): boolean {
  const lines = getTextShardsAsLines(textShards);
  // TODO: check if GL...
}
