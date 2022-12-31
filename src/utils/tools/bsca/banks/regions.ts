import moment from "moment";

import type {
  BankAccount,
  BankStatementSummary,
  Company,
  OCR,
  Period,
  Transaction,
} from "@/types/tools/bsca";

const PERIOD_REGEX = /(\w+ \d{1,2}, \d{4}) through (\w+ \d{1,2}, \d{4})/;

export function isBank({ textStructuredData }: OCR): boolean {
  for (const element of textStructuredData.elements)
    if (element.Page > 0) break;
    else if (element.Text?.includes("Regions Bank")) return true;
  return false;
}

export function parseCompany({ tables }: OCR): Company {
  for (const table of tables)
    if ((table[0] ?? [])[0]?.trim() == "1")
      return {
        name: (table[1] ?? [])[0]?.trim() ?? "Unknown",
        address: (table[2] ?? [])[0]?.trim() ?? undefined,
      };
  return {
    name: "Unknown",
  };
}

export function parseAccount({ tables }: OCR): BankAccount {
  for (const table of tables)
    if ((table[1] ?? [])[1]?.trim() == "ACCOUNT #")
      return {
        number: (table[1] ?? [])[2]?.trim() ?? "Unknown",
      };
  return {
    number: "Unknown",
  };
}

export function parseSummary({ tables }: OCR): BankStatementSummary {
  const summary = {
    balance: {
      begin: -1,
      end: -1,
    },
    totals: {
      deposits: -1,
      withdrawals: -1,
      fees: -1,
      checks: -1,
    },
  };

  for (const table of tables) {
    let foundTable = false;
    for (const row of table) {
      if (!foundTable && row[0]?.includes("SUMMARY")) foundTable = true;
      if (!foundTable) continue;

      if (summary.balance.begin == -1 && row[0]?.includes("Beginning Balance"))
        summary.balance.begin = Number(row[1]?.replace(/[^0-9.]+/g, ""));
      else if (
        summary.totals.deposits == -1 &&
        row[0]?.includes("Deposits & Credits")
      )
        summary.totals.deposits = Number(row[1]?.replace(/[^0-9.]+/g, ""));
      else if (
        summary.totals.withdrawals == -1 &&
        row[0]?.includes("Withdrawals")
      )
        summary.totals.withdrawals =
          Number(row[1]?.replace(/[^0-9.]+/g, "")) * -1;
      else if (summary.totals.fees == -1 && row[0]?.includes("Fees"))
        summary.totals.fees = Number(row[1]?.replace(/[^0-9.]+/g, "")) * -1;
      else if (summary.totals.checks == -1 && row[0]?.includes("Checks"))
        summary.totals.checks = Number(row[1]?.replace(/[^0-9.]+/g, "")) * -1;
      else if (summary.balance.end == -1 && row[0]?.includes("Ending Balance"))
        summary.balance.end = Number(row[1]?.replace(/[^0-9.]+/g, ""));

      if (summary.balance.end != -1) break;
    }
    if (foundTable) break;
  }

  return summary;
}

export function parsePeriod({ textStructuredData }: OCR): Period {
  for (const element of textStructuredData.elements) {
    if (element.Page > 0) break;

    const match = PERIOD_REGEX.exec(element.Text ?? "");
    if (match) {
      const startDate = match[1];
      const endDate = match[2];

      if (!startDate || !endDate) continue;

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
  return {
    start: "Unknown",
    end: "Unknown",
  };
}

export function parseDeposits({ tables }: OCR): Transaction[] {
  const lastDepositTableIndex = tables.findIndex((table) => {
    for (const row of table)
      if (row.join(" ").includes("Total Deposits & Credits")) return true;
    return false;
  });
  const depositTables = tables.slice(0, lastDepositTableIndex + 1);
  return parseTransactions(depositTables);
}

export function parseWithdrawals({ tables }: OCR): Transaction[] {
  const lastDepositTableIndex = tables.findIndex((table) => {
    for (const row of table)
      if (row.join(" ").includes("Total Deposits & Credits")) return true;
    return false;
  });
  const lastWithdrawalTableIndex = tables.findIndex((table) => {
    for (const row of table)
      if (row.join(" ").includes("Total Withdrawals")) return true;
    return false;
  });
  const withdrawalTables = tables.slice(
    lastDepositTableIndex + 1,
    lastWithdrawalTableIndex + 1
  );
  return parseTransactions(withdrawalTables, true);
}

// We should make this a separate function for this regions bank parser specifically, and have many other queries for other ways to shorten the description.
export function parseTransactions(
  tables: string[][][],
  flipSign = false
): Transaction[] {
  const transactions: Transaction[] = [];

  for (const table of tables) {
    let foundTable = false;
    for (const row of table) {
      if (!foundTable && /[0-9,.]{2}\/[0-9,.]{2}/.test(row[0] ?? ""))
        foundTable = true;
      if (!foundTable) continue;

      // Ensure the date is valid
      if (!/[0-9,.]{2}\/[0-9,.]{2}/.test(row[0] ?? "")) continue;

      const date = row[0];
      const description = row.splice(1, row.length - 2).join(" ");
      const amount = row[row.length - 1];

      if (!date || !description || !amount) continue;

      transactions.push({
        date,
        description: {
          original: description,
          shortened: shortenDescription(description),
        },
        amount: Number(amount.replace(/[^0-9.-]+/g, "")) * (flipSign ? -1 : 1),
      });
    }
  }

  // Make sure to also remove any transactions without any letters in the description
  return transactions.filter((transaction) => {
    return /[a-zA-Z]/.test(transaction.description.original);
  });
}

function shortenDescription(description: string): string | undefined {
  // TODO: determine whether to keep this in production...
  const DESCRIPTION = description.toUpperCase();
  if (DESCRIPTION.startsWith("FLA DEPT REVENUE")) return "FDOR";
  if (DESCRIPTION.startsWith("WESTERN UNION")) return "WU";
}
