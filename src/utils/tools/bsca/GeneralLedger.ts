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
    // this.textShards = this.#textShards;
    // this.textShardGroups = this.#textShardGroups;

    this.parse();
  }

  // TODO: FIX why ROYAL BEAUTY, INC. has 73.99% accuracy... it should be 99.57% AT LEAST.
  // YES: Also check if this happens because of the uniqueLines feature in the OCR.

  parse() {
    if (!this.parseGLFormat()) return;

    this.parseCompany();
    this.parsePeriod();
    this.parseAccounts();
    this.parseDistributionCount();

    this.reconcileEntries();
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

  parseDistributionCount() {
    if (this.glFormat === "accountingcs")
      this.distributionCount = accountingcs.parseDistributionCount(
        this.#textShardGroups
      );
  }

  // Check if the total number of entries in the account reconcile with the distribution count
  reconcileEntries() {
    if (this.distributionCount) {
      let totalEntries = 0;
      for (const account of this.accounts) {
        totalEntries += account.entries.length;
      }

      if (totalEntries !== this.distributionCount) {
        console.error(
          `x [${this.company.name} - (from ${this.period.start} to ${
            this.period.end
          })] The total number of entries (${totalEntries}) does not match the distribution count (${
            this.distributionCount
          }) • ${((totalEntries / this.distributionCount) * 100).toFixed(
            2
          )}% accuracy.`
        );

        // Look for accounts where the amountTotal does not match the amount of each entry in that account
        for (const account of this.accounts) {
          let accountTotal = 0;
          for (const entry of account.entries) {
            accountTotal += entry.amount ?? 0;
          }

          // Round to 2 decimal places
          accountTotal = parseFloat(accountTotal.toFixed(2));
          if (account.amountTotal !== accountTotal) {
            console.error(
              `... [${this.company.name} - (from ${this.period.start} to ${this.period.end})] The total amount (${accountTotal}) for the account ${account.number} ${account.name} does not match the calculated amount total (${account.amountTotal}).`
            );
          }
        }
      } else {
        console.log(
          `✓ [${this.company.name} - (from ${this.period.start} to ${this.period.end})] The total number of entries matches the distribution count (${this.distributionCount}) • 100.00% accuracy!`
        );
      }
    }
  }
}
