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
import type { TextShard } from "@/types/ocr";
import type { StoredFile } from "@/types/misc";

export class BankStatement {
  readonly class = "BankStatement";
  readonly #textShards: TextShard[][];
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
    // Uncomment this below to pass the OCR data to the client. This is not recommended, so use for debugging only.
    // this.textShards = this.#textShards;

    // this.fillWithTestData();
    // TODO: rework all of this to use the new OCR data structure
    this.parse();

    // Uncomment this below to test the data. This is not needed for production, so use for debugging only.
    // if (this.deposits) {
    //   console.log(this.doDepositsMatchTotal());
    //   console.log(this.getTotalDeposits());
    //   console.log(this.summary.totals.deposits);
    // }
    // if (this.withdrawals) {
    //   console.log(this.doWithdrawalsMatchTotal());
    //   console.log(this.getTotalWithdrawals());
    //   console.log(this.summary.totals.withdrawals);
    // }
  }

  parse() {
    if (!this.parseBank()) return;
    this.parseCompany();
    this.parseAccount();
    this.parseSummary();
    this.parsePeriod();
    this.parseDeposits();
    this.parseWithdrawals();
    // this.parseFees();
    // this.parseChecks();
  }

  parseBank() {
    if (bofa.isBank(this.#textShards)) this.bank = "Bank of America - Business";
    else if (chase.isBank(this.#textShards)) this.bank = "Chase - Business";
    else if (regions.isBank(this.#textShards)) this.bank = "Regions - Business";
    else if (surety.isBank(this.#textShards))
      this.bank = "Surety Bank - Business";
    else if (wellsfargo.isBank(this.#textShards))
      this.bank = "Wells Fargo - Business";

    return this.bank !== undefined;
  }

  parseCompany() {
    if (this.bank === "Bank of America - Business")
      this.company = bofa.parseCompany(this.#textShards);
    if (this.bank === "Regions - Business")
      this.company = regions.parseCompany(this.#textShards);
  }

  parseAccount() {
    if (this.bank === "Bank of America - Business")
      this.account = bofa.parseAccount(this.#textShards);
    else if (this.bank === "Regions - Business")
      this.account = regions.parseAccount(this.#textShards);
  }

  parseSummary() {
    if (this.bank === "Bank of America - Business")
      this.summary = bofa.parseSummary(this.#textShards);
    else if (this.bank === "Regions - Business")
      this.summary = regions.parseSummary(this.#textShards);
  }

  parsePeriod() {
    if (this.bank === "Bank of America - Business")
      this.period = bofa.parsePeriod(this.#textShards);
    else if (this.bank === "Regions - Business")
      this.period = regions.parsePeriod(this.#textShards);
  }

  parseDeposits() {
    if (this.bank === "Bank of America - Business")
      this.deposits = bofa.parseDeposits(this.#textShards);
    else if (this.bank === "Regions - Business")
      this.deposits = regions.parseDeposits(this.#textShards);
  }

  parseWithdrawals() {
    if (this.bank === "Bank of America - Business")
      this.withdrawals = bofa.parseWithdrawals(this.#textShards);
    else if (this.bank === "Regions - Business")
      this.withdrawals = regions.parseWithdrawals(this.#textShards);
  }

  // For testing purposes...
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
        deposits: 1000,
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
