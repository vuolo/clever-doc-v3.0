import * as levenshtein from "./code-methods/levenshtein";

import type { BankStatement } from "./BankStatement";
import type { GeneralLedger } from "./GeneralLedger";
import type {
  CodeResults,
  LevenshteinAccountSelection,
  LevenshteinAccountSelectionOverride,
  LevenshteinTransaction,
} from "@/types/tools/bsca/coder";

const emptySelection = {
  account: {
    name: "SUSPENSE",
    number: "3130",
    index: 0,
  },
  entry: {
    description: "",
    ratio: 0,
    index: 0,
  },
};

const emptySelectionOverride = {
  account: {
    name: "SUSPENSE",
    number: "3130",
  },
  entry: {
    description: "",
    enabled: false,
  },
  enabled: false,
};

export class Coder {
  readonly class = "Coder";
  readonly bankStatement: BankStatement;
  readonly generalLedger: GeneralLedger;
  readonly method: string;
  results!: CodeResults;

  constructor(
    bankStatement: BankStatement,
    generalLedger: GeneralLedger,
    method = "levenshtein"
  ) {
    this.bankStatement = bankStatement;
    this.generalLedger = generalLedger;
    this.method = method;

    this.code();
    this.initializeSelections();
  }

  code() {
    if (this.method === "levenshtein")
      this.results = levenshtein.code(this.bankStatement, this.generalLedger);
  }

  initializeSelections() {
    this.results.transactions.deposits.forEach((transaction) => {
      const [selection, selectionOverride] = getInitialSelections(
        this.generalLedger,
        transaction
      );
      transaction.selection = selection;
      transaction.selectionOverride = selectionOverride;
    });

    this.results.transactions.withdrawals.forEach((transaction) => {
      const [selection, selectionOverride] = getInitialSelections(
        this.generalLedger,
        transaction
      );
      transaction.selection = selection;
      transaction.selectionOverride = selectionOverride;
    });
  }
}

function getInitialSelections(
  generalLedger: GeneralLedger,
  transaction: LevenshteinTransaction
): [LevenshteinAccountSelection, LevenshteinAccountSelectionOverride] {
  // Check whether the transaction has matches
  if (!transaction.matches[0] || !transaction.matches[0].entries[0]) {
    // Initialize the empty selection
    transaction.selection = emptySelection;
    transaction.selectionOverride = emptySelectionOverride;

    // Update account selection index
    const accountIndex = generalLedger.accounts.findIndex(
      (account) => account.name === transaction.selection?.account.name
    );
    transaction.selection.account.index = accountIndex;

    // Find the SUSPENSE account
    const suspenseAccount = generalLedger.accounts.find(
      (account) => account.name === "SUSPENSE"
    );
    if (suspenseAccount)
      // Update the selection override's account number
      transaction.selectionOverride.account.number = suspenseAccount.number;

    return [transaction.selection, transaction.selectionOverride];
  }

  // Initialize the selection
  transaction.selection = {
    account: {
      name: transaction.matches[0].account.name,
      number: transaction.matches[0].account.number,
      index: 0,
    },
    entry: {
      description: transaction.matches[0].entries[0].description,
      ratio: transaction.matches[0].entries[0].ratio,
      index: 0,
    },
  };

  // Initialize the selection override
  transaction.selectionOverride = {
    account: {
      name: transaction.matches[0].account.name ?? "SUSPENSE",
      number: transaction.matches[0].account.number ?? "3130",
    },
    entry: {
      description: transaction.matches[0].entries[0].description ?? "",
      enabled: false,
    },
    enabled: false,
  };

  return [transaction.selection, transaction.selectionOverride];
}
