import moment from "moment";

import * as bofa from "./banks/bofa";
import * as chase from "./banks/chase";
import * as regions from "./banks/regions";
import * as surety from "./banks/surety";
import * as wellsfargo from "./banks/wellsfargo";

import type {
  BankAccount,
  BankStatementSummary,
  Check,
  Company,
  Period,
  Transaction,
} from "@/types/tools/bsca/bank-statement";
import type { TextShard, TextShardGroup } from "@/types/ocr";
import type { StoredFile } from "@/types/misc";
import { getTextShardsAsLines } from "@/utils/ocr";

export class BankStatement {
  readonly class = "BankStatement";
  readonly #textShards: TextShard[][];
  readonly #textShardGroups: TextShardGroup[][];
  bank?: string;
  company!: Company;
  account!: BankAccount;
  summary!: BankStatementSummary;
  period!: Period;
  deposits!: Transaction[];
  withdrawals!: Transaction[];
  fees!: Transaction[];
  checks!: Check[];
  file?: StoredFile;

  constructor(textShards: TextShard[][]) {
    this.#textShards = textShards;
    this.#textShardGroups = getTextShardsAsLines(
      textShards
    ) as TextShardGroup[][];
    // Uncomment this below to pass the OCR data to the client. This is not recommended, so use for debugging only.
    // this.textShards = this.#textShards;
    // this.textShardGroups = this.#textShardGroups;

    // this.fillWithTestData();
    this.parse();

    this.reconcileTransactions();
  }

  parse() {
    if (!this.parseBank()) return;
    this.parseCompany();
    this.parseAccount();
    this.parsePeriod();
    this.parseSummary();
    this.parseDeposits();
    this.parseWithdrawals();

    // TODO: Implement this in a future update (not necessary for now)
    // this.parseFees();
    // this.parseChecks();
  }

  parseBank() {
    if (bofa.isBank(this.#textShardGroups))
      this.bank = "Bank of America - Business";
    else if (chase.isBank(this.#textShardGroups))
      this.bank = "Chase - Business";
    else if (regions.isBank(this.#textShardGroups))
      this.bank = "Regions - Business";
    else if (surety.isBank(this.#textShardGroups))
      this.bank = "Surety Bank - Business";
    else if (wellsfargo.isBank(this.#textShardGroups))
      this.bank = "Wells Fargo - Business";

    return this.bank !== undefined;
  }

  parseCompany() {
    if (this.bank === "Bank of America - Business")
      this.company = bofa.parseCompany(this.#textShardGroups);
    else if (this.bank === "Regions - Business")
      this.company = regions.parseCompany(this.#textShardGroups);
    else if (this.bank === "Chase - Business")
      this.company = chase.parseCompany(this.#textShardGroups);
  }

  parseAccount() {
    if (this.bank === "Bank of America - Business")
      this.account = bofa.parseAccount(this.#textShardGroups);
    else if (this.bank === "Regions - Business")
      this.account = regions.parseAccount(this.#textShardGroups);
    else if (this.bank === "Chase - Business")
      this.account = chase.parseAccount(this.#textShardGroups);
  }

  parsePeriod() {
    if (this.bank === "Bank of America - Business")
      this.period = bofa.parsePeriod(this.#textShardGroups);
    else if (this.bank === "Regions - Business")
      this.period = regions.parsePeriod(this.#textShardGroups);
    else if (this.bank === "Chase - Business")
      this.period = chase.parsePeriod(this.#textShardGroups);
  }

  parseSummary() {
    if (this.bank === "Bank of America - Business")
      this.summary = bofa.parseSummary(this.#textShardGroups);
    else if (this.bank === "Regions - Business")
      this.summary = regions.parseSummary(this.#textShardGroups);
    else if (this.bank === "Chase - Business")
      this.summary = chase.parseSummary(this.#textShardGroups);
  }

  parseDeposits() {
    // Get the statement's year (for transaction dates)
    const year = moment(this.period.start, "MM/DD/YYYY").format("YYYY");

    if (this.bank === "Bank of America - Business")
      this.deposits = bofa.parseDeposits(this.#textShardGroups);
    else if (this.bank === "Regions - Business")
      this.deposits = regions.parseDeposits(this.#textShardGroups, year);
    else if (this.bank === "Chase - Business")
      this.deposits = chase.parseDeposits(this.#textShardGroups, year);
  }

  parseWithdrawals() {
    // Get the statement's year (for transaction dates)
    const year = moment(this.period.start, "MM/DD/YYYY").format("YYYY");

    if (this.bank === "Bank of America - Business")
      this.withdrawals = bofa.parseWithdrawals(this.#textShardGroups);
    else if (this.bank === "Regions - Business")
      this.withdrawals = regions.parseWithdrawals(this.#textShardGroups, year);
    else if (this.bank === "Chase - Business")
      this.withdrawals = chase.parseWithdrawals(this.#textShardGroups, year);
  }

  // Check if the total number of deposits and withdrawals match reconcile with the summary's totals
  reconcileTransactions() {
    if (this.deposits && this.summary.totals.deposits)
      if (!this.doDepositsMatchTotal()) {
        const accuracy =
          (this.getTotalDeposits() / this.summary.totals.deposits) * 100;
        console.error(
          `x [${this.company.name} (${this.bank} #${this.account.number.slice(
            -4
          )}) - (from ${this.period.start} to ${
            this.period.end
          })] Deposits are inaccurate. Summary Total: $${
            this.summary.totals.deposits
          } • Calculated Total: $${this.getTotalDeposits()} • Instances: ${
            this.deposits.length
          } • ${(accuracy > 100 ? 100 - (accuracy - 100) : accuracy).toFixed(
            2
          )}% accuracy.`
        );
      } else {
        console.log(
          `✓ [${this.company.name} (${this.bank} #${this.account.number.slice(
            -4
          )}) - (from ${this.period.start} to ${
            this.period.end
          })] Deposits are accurate. Summary Total: $${
            this.summary.totals.deposits
          } • Calculated Total: $${this.summary.totals.deposits} • Instances: ${
            this.deposits.length
          } • 100.00% accuracy.`
        );
      }
    if (this.withdrawals && this.summary.totals.withdrawals)
      if (!this.doWithdrawalsMatchTotal()) {
        const accuracy =
          (this.getTotalWithdrawals() / this.summary.totals.withdrawals) * 100;
        console.error(
          `x [${this.company.name} (${this.bank} #${this.account.number.slice(
            -4
          )}) - (from ${this.period.start} to ${
            this.period.end
          })] Withdrawals are inaccurate. Summary Total: $${
            this.summary.totals.withdrawals
          } • Calculated Total: $${this.getTotalWithdrawals()} • Fees (from summary): ${
            this.summary.totals.fees
          } • Difference: ${(
            Math.abs(this.summary.totals.withdrawals) -
            Math.abs(this.getTotalWithdrawals())
          ).toFixed(2)} • Instances: ${this.withdrawals.length} • ${(accuracy >
          100
            ? 100 - (accuracy - 100)
            : accuracy
          ).toFixed(2)}% accuracy!`
        );
      } else {
        console.log(
          `✓ [${this.company.name} (${this.bank} #${this.account.number.slice(
            -4
          )}) - (from ${this.period.start} to ${
            this.period.end
          })] Withdrawals are accurate. Summary Total: $${
            this.summary.totals.withdrawals
          } • Calculated Total: $${
            this.summary.totals.withdrawals
          } • Instances: ${this.withdrawals.length} • 100.00% accuracy!`
        );
      }
  }

  getTotalDeposits(): number {
    let total = 0;
    for (const deposit of this.deposits) total += deposit.amount;
    return Number(total.toFixed(2));
  }

  doDepositsMatchTotal(): boolean {
    return this.getTotalDeposits() === this.summary.totals.deposits;
  }

  getTotalWithdrawals(): number {
    let total = 0;
    for (const withdrawal of this.withdrawals) total += withdrawal.amount;
    return Number(total.toFixed(2));
  }

  doWithdrawalsMatchTotal(): boolean {
    return this.getTotalWithdrawals() === this.summary.totals.withdrawals;
  }

  fillWithTestData() {
    this.bank = "Bank Name";
    this.company = {
      name: "Company Name",
      address: "Company Address",
    };
    this.account = {
      number: "123456789",
      name: "Account Name",
      type: "Account Type",
    };
    this.summary = {
      balance: {
        begin: 1000,
        end: 2000,
      },
      totals: {
        deposits: 2000,
        withdrawals: 1000,
        fees: 0,
        checks: 0,
      },
    };
    this.period = {
      start: "08/17/2002",
      end: "09/17/2002",
    };
    this.deposits = [
      {
        date: "08/23/2002",
        description: {
          original: "Deposit Description",
          shortened: "Shortened Deposit Description",
        },
        amount: 1000,
      },
    ];
    this.withdrawals = [
      {
        date: "08/23/2002",
        description: {
          original: "Withdrawal Description",
          shortened: "Shortened Withdrawal Description",
        },
        amount: 1000,
      },
    ];
    this.fees = [];
    this.checks = [];
  }
}

export function emptyTransaction(): Transaction {
  return {
    date: "",
    description: {
      original: "",
    },
    amount: -1,
  };
}
