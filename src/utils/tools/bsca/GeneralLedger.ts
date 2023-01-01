import * as accountingcs from "./gl-formats/accountingcs";

import type {
  Company,
  GeneralLedgerAccount,
  Period,
} from "@/types/tools/bsca/general-ledger";
import type { TextShard } from "@/types/ocr";
import type { StoredFile } from "@/types/misc";

export class GeneralLedger {
  readonly class = "GeneralLedger";
  readonly #textShards: TextShard[][];
  glFormat!: string;
  company!: Company;
  period!: Period;
  accounts!: GeneralLedgerAccount[];
  file?: StoredFile;

  constructor(textShards: TextShard[][]) {
    this.#textShards = textShards;
    // Uncomment this below to pass the OCR data to the client. This is not recommended, so use for debugging only.
    // this.textShards = this.#textShards;

    // TODO: rework all of this to use the new OCR data structure
    this.parse();
  }

  parse() {
    if (!this.parseGLFormat()) return;

    this.parseCompany();
    this.parsePeriod();
    this.parseAccounts();
  }

  parseGLFormat() {
    if (accountingcs.isGLFormat(this.#textShards))
      this.glFormat = "accountingcs";

    return this.glFormat !== undefined;
  }

  parseCompany() {
    if (this.glFormat === "accountingcs")
      this.company = accountingcs.parseCompany(this.#textShards);
  }

  parsePeriod() {
    if (this.glFormat === "accountingcs")
      this.period = accountingcs.parsePeriod(this.#textShards);
  }

  parseAccounts() {
    if (this.glFormat === "accountingcs")
      // this.accounts = accountingcs.parseAccountsUsingTables(this.#textShards);
      // this.accounts = accountingcs.parseAccountsUsingText(this.#textShards);
      this.accounts = accountingcs.parseAccountsUsingTablesAndText(
        this.#textShards
      );
  }
}
