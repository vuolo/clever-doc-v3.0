import * as accountingcs from "./gl-formats/accountingcs";

import type {
  Company,
  GeneralLedgerAccount,
  Period,
} from "@/types/tools/bsca/general-ledger";
import type { TextShard, TextShardGroup } from "@/types/ocr";
import type { StoredFile } from "@/types/misc";
import { getTextShardsAsLines } from "@/utils/ocr";

export class GeneralLedger {
  readonly class = "GeneralLedger";
  readonly #textShards: TextShard[][];
  readonly #textShardGroups: TextShardGroup[][];
  glFormat!: string;
  company!: Company;
  period!: Period;
  accounts!: GeneralLedgerAccount[];
  distributionCount?: number; // This represents the total number of entries, used check if the total number of entries in the account reconcile
  file?: StoredFile;

  constructor(textShards: TextShard[][]) {
    this.#textShards = textShards;
    this.#textShardGroups = getTextShardsAsLines(
      textShards
    ) as TextShardGroup[][];
    // Uncomment this below to pass the OCR data to the client. This is not recommended, so use for debugging only.
    this.textShards = this.#textShards;
    this.textShardGroups = this.#textShardGroups;

    this.parse();
  }

  parse() {
    if (!this.parseGLFormat()) return;

    this.parseCompany();
    this.parsePeriod();
    this.parseAccounts();

    // TODO: Check if the total number of entries in the account reconcile with the distribution count
  }

  parseGLFormat() {
    if (accountingcs.isGLFormat(this.#textShardGroups))
      this.glFormat = "accountingcs";

    return this.glFormat !== undefined;
  }

  parseCompany() {
    if (this.glFormat === "accountingcs")
      this.company = accountingcs.parseCompany(this.#textShardGroups);
  }

  parsePeriod() {
    if (this.glFormat === "accountingcs")
      this.period = accountingcs.parsePeriod(this.#textShardGroups);
  }

  parseAccounts() {
    if (this.glFormat === "accountingcs")
      this.accounts = accountingcs.parseAccounts(this.#textShardGroups);
  }
}
