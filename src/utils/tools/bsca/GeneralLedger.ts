import * as accountingcs from "./gl-formats/accountingcs";

import type {
  Company,
  GeneralLedgerAccount,
  OCR,
  Period,
  StoredFile,
  StructuredData,
} from "@/types/tools/bsca";

export class GeneralLedger {
  readonly class = "GeneralLedger";
  readonly #ocr: OCR;
  glFormat!: string;
  company!: Company;
  period!: Period;
  accounts!: GeneralLedgerAccount[];
  file?: StoredFile;

  constructor(tables: string[][][], textStructuredData: StructuredData) {
    this.#ocr = {
      tables,
      textStructuredData,
    };
    // Uncomment this below to pass the OCR data to the client. This is not recommended, so use for debugging only.
    // this.ocr = this.#ocr;

    this.parse();
  }

  parse() {
    if (!this.parseGLFormat()) return;

    this.parseCompany();
    this.parsePeriod();
    this.parseAccounts();
  }

  parseGLFormat() {
    if (accountingcs.isGLFormat(this.#ocr)) this.glFormat = "accountingcs";

    return this.glFormat !== undefined;
  }

  parseCompany() {
    if (this.glFormat === "accountingcs")
      this.company = accountingcs.parseCompany(this.#ocr);
  }

  parsePeriod() {
    if (this.glFormat === "accountingcs")
      this.period = accountingcs.parsePeriod(this.#ocr);
  }

  parseAccounts() {
    if (this.glFormat === "accountingcs")
      // this.accounts = accountingcs.parseAccountsUsingTables(this.#ocr);
      // this.accounts = accountingcs.parseAccountsUsingText(this.#ocr);
      this.accounts = accountingcs.parseAccountsUsingTablesAndText(this.#ocr);
  }
}
