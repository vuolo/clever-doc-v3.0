import moment from "moment";

import type {
  BankAccount,
  BankStatementSummary,
  Company,
  OCR,
  Period,
  Transaction,
} from "@/types/tools/bsca";

const PERIOD_REGEX = /for (\w+ \d{1,2}, \d{4}) to (\w+ \d{1,2}, \d{4})/;

export function isBank({ textStructuredData }: OCR): boolean {
  for (const element of textStructuredData.elements)
    if (element.Page > 0) break;
    else if (element.Text?.includes("1.888.BUSINESS")) return true;
  return false;
}

export function parseCompany({ textStructuredData }: OCR): Company {
  const query = "Account number: ";
  for (const [i, element] of textStructuredData.elements.entries())
    if (element.Page > 0) break;
    else if (element.Text?.includes(query))
      return {
        name: textStructuredData.elements[i - 1]?.Text?.trim() || "Unknown",
      };
  return {
    name: "Unknown",
  };
}

export function parseAccount({ textStructuredData }: OCR): BankAccount {
  const query = "Account number: ";
  for (const element of textStructuredData.elements)
    if (element.Page > 0) break;
    else if (element.Text?.includes(query))
      return {
        number: element.Text?.slice(query.length).trim() || "Unknown",
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
      if (
        !foundTable &&
        summary.balance.begin == -1 &&
        row[0]?.includes("Beginning balance on")
      ) {
        foundTable = true;
        summary.balance.begin = Number(row[1]?.replace(/[^0-9.-]+/g, ""));
      }

      if (!foundTable) continue;

      if (
        summary.totals.deposits == -1 &&
        row[0]?.includes("Deposits and other credits")
      )
        summary.totals.deposits = Number(row[1]?.replace(/[^0-9.-]+/g, ""));
      else if (
        summary.totals.withdrawals == -1 &&
        row[0]?.includes("Withdrawals and other debits")
      )
        summary.totals.withdrawals = Number(row[1]?.replace(/[^0-9.-]+/g, ""));
      else if (summary.totals.checks == -1 && row[0]?.includes("Checks"))
        summary.totals.checks = Number(row[1]?.replace(/[^0-9.-]+/g, ""));
      else if (summary.totals.fees == -1 && row[0]?.includes("Service fees"))
        summary.totals.fees = Number(row[1]?.replace(/[^0-9.-]+/g, ""));
      else if (
        summary.balance.end == -1 &&
        row[0]?.includes("Ending balance on")
      )
        summary.balance.end = Number(row[1]?.replace(/[^0-9.-]+/g, ""));

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
      if (row.join(" ").includes("Total deposits and other credits"))
        return true;
    return false;
  });
  const depositTables = tables.slice(0, lastDepositTableIndex + 1);
  return parseTransactions(depositTables);
}

export function parseWithdrawals({ tables }: OCR): Transaction[] {
  const lastDepositTableIndex = tables.findIndex((table) => {
    for (const row of table)
      if (row.join(" ").includes("Total deposits and other credits"))
        return true;
    return false;
  });
  const lastWithdrawalTableIndex = tables.findIndex((table) => {
    for (const row of table)
      if (row.join(" ").includes("Total withdrawals and other debits"))
        return true;
    return false;
  });
  const withdrawalTables = tables.slice(
    lastDepositTableIndex + 1,
    lastWithdrawalTableIndex + 1
  );
  return parseTransactions(withdrawalTables);
}

export function parseTransactions(tables: string[][][]): Transaction[] {
  const transactions: Transaction[] = [];

  for (const table of tables) {
    let foundTable = false;
    for (const row of table) {
      if (!foundTable && row[0]?.includes("Date")) {
        foundTable = true;
        continue;
      }

      if (!foundTable) continue;

      const date = row[0];
      const description = row[1];
      const amount = row[2];

      if (!date || !description || !amount) continue;

      transactions.push({
        date,
        description: {
          original: description,
          shortened: shortenDescription(description),
        },
        amount: Number(amount.replace(/[^0-9.-]+/g, "")),
      });
    }
  }

  return transactions;
}

function shortenDescription(description: string): string | undefined {
  if (description.includes("DES:")) return description.split("DES:")[0]?.trim();

  // TODO: determine whether to keep this in production...
  const DESCRIPTION = description.toUpperCase();
  if (DESCRIPTION.startsWith("FLA DEPT REVENUE")) return "FDOR";
  if (DESCRIPTION.startsWith("WESTERN UNION")) return "WU";
}
