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
  readonly #textShards: TextShard[][] = [];
  readonly #textShardGroups: TextShardGroup[][] = [];
  glFormat!: string;
  company!: Company;
  period!: Period;
  accounts!: GeneralLedgerAccount[];
  distributionCount?: number; // This represents the total number of entries, used check if the total number of entries in the account reconcile
  file?: StoredFile;

  constructor(
    textShards?: TextShard[][],
    workSheet?: {
      name: string;
      data: unknown[];
    }
  ) {
    if (workSheet) this.parseWorkSheet(workSheet);
    if (!textShards) return;

    this.#textShards = textShards;
    this.#textShardGroups = getTextShardsAsLines(
      textShards
    ) as TextShardGroup[][];
    // Uncomment this below to pass the OCR data to the client. This is not recommended, so use for debugging only.
    // this.textShards = this.#textShards;
    // this.textShardGroups = this.#textShardGroups;

    this.parse();
  }

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
    if (!this.distributionCount) {
      console.warn(
        `! [${this.company.name} - (from ${this.period.start} to ${this.period.end})] The distribution count is not defined. Instead, we will check if each account's amountTotal matches the sum of each entry's amount.`
      );

      // Since the distribution count is not defined, we cannot check if the total number of entries in the account reconcile
      // but, we can check if each account's amountTotal matches the sum of each entry's amount
      for (const account of this.accounts) {
        if (!account.amountTotal) continue;

        let accountTotal = 0;
        for (const entry of account.entries) {
          accountTotal += entry.amount ?? 0;
        }

        // Round to 2 decimal places
        accountTotal = Math.round(accountTotal * 100) / 100;

        if (account.amountTotal !== accountTotal) {
          console.error(
            `... [${this.company.name} - (from ${this.period.start} to ${this.period.end})] The parsed total amount (${account.amountTotal}) for the account ${account.number} ${account.name} does not match the calculated amount total (${accountTotal}).`
          );
        }
        // else {
        //   console.log(
        //     `✓ [${this.company.name} - (from ${this.period.start} to ${this.period.end})] The parsed total amount (${account.amountTotal}) for the account ${account.number} ${account.name} matches the calculated amount total (${accountTotal}).`
        //   );
        // }
      }

      return;
    }

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
        if (
          account.amountTotal !== undefined &&
          account.amountTotal !== accountTotal
        ) {
          console.error(
            `... [${this.company.name} - (from ${this.period.start} to ${this.period.end})] The parsed total amount (${account.amountTotal}) for the account ${account.number} ${account.name} does not match the calculated amount total (${accountTotal}).`
          );
        }
      }
    } else {
      console.log(
        `✓ [${this.company.name} - (from ${this.period.start} to ${this.period.end})] The total number of entries matches the distribution count (${this.distributionCount}) • 100.00% accuracy!`
      );
    }
  }

  // QuickBooks worksheet parser
  parseWorkSheet(workSheet: { name: string; data: unknown[] }): void | never {
    // Get the columns
    const columns = workSheet.data[0] as string[];

    // Get the column indexes
    const entryDateColumnIndex = columns.indexOf("Date");
    const entryDescriptionColumnIndex = columns.indexOf("Name");
    const entryAmountColumnIndex = columns.indexOf("Amount");
    const entryBalanceColumnIndex = columns.indexOf("Balance");

    // Loop through the rows, starting from the second row
    let curAccount = emptyAccount();
    const accounts = [] as GeneralLedgerAccount[];
    for (let i = 1; i < workSheet.data.length; i++) {
      const row = workSheet.data[i] as string[];

      // Get the account name
      const accountName = row[1];
      if (accountName) {
        // Found the end of the account
        if (accountName.startsWith("Total")) {
          // Read the amount total and ending balance
          curAccount.amountTotal = row[entryAmountColumnIndex]
            ? parseFloat(row[entryAmountColumnIndex] ?? "-1")
            : undefined;
          curAccount.endingBalance = row[entryBalanceColumnIndex]
            ? parseFloat(row[entryBalanceColumnIndex] ?? "-1")
            : undefined;

          // Add the account to the accounts
          accounts.push(curAccount);

          // Reset the current account
          curAccount = emptyAccount();
          continue;
        }

        // Found the beginning of the account. Get the account name and beginning balance
        curAccount.name = accountName;
        curAccount.beginningBalance = row[entryBalanceColumnIndex]
          ? parseFloat(row[entryBalanceColumnIndex] ?? "-1")
          : undefined;
        continue;
      }
      if (!curAccount.name) continue;

      // Get the entry date
      const entryDate = row[entryDateColumnIndex];

      // Get the entry description
      const entryDescription = row[entryDescriptionColumnIndex];

      // Get the entry amount
      const entryAmount = row[entryAmountColumnIndex];

      // Check if the entry is valid
      if (!entryDate || !entryDescription || !entryAmount) continue;

      // Add the entry to the account
      curAccount.entries.push({
        date: entryDate,
        description: entryDescription,
        amount: parseFloat(entryAmount),
      });
    }

    this.accounts = accounts;

    // Reverse the accounts (so that we prioritize non-bank accounts during the coding process. This is a hacky solution)
    this.accounts.reverse();

    // Right now we don't have a way to get the company name and period from the QuickBooks worksheet...
    this.company = {
      name: "Unknown Company",
    };
    this.period = {
      start: "01/01/1989",
      end: "12/31/1990",
    };

    this.reconcileEntries();
  }
}

function emptyAccount(): GeneralLedgerAccount {
  return {
    number: "",
    name: "",
    entries: [],
  };
}
