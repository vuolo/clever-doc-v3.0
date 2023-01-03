import type { Transaction } from "./bank-statement";

export type CodeResults = {
  method: "levenshtein" | "davinci";
  transactions: {
    deposits: LevenshteinTransaction[];
    withdrawals: LevenshteinTransaction[];
  };
};

export type LevenshteinTransaction = Transaction & {
  matches: LevenshteinAccountMatch[];
  selection?: LevenshteinAccountSelection;
  selectionOverride?: LevenshteinAccountSelectionOverride;
};

export type LevenshteinAccountSelection = {
  account: {
    name: string;
    number: string;
    index: number;
  };
  entry: {
    description: string;
    ratio: number;
    index: number;
  };
};

export type LevenshteinAccountSelectionOverride = {
  account: {
    name: string;
    number: string;
  };
  entry: {
    description: string;
    enabled: boolean;
  };
  enabled: boolean;
};

export type LevenshteinAccountMatch = {
  account: {
    name: string;
    number: string;
  };
  stats: LevenshteinAccountMatchStats;
  entries: LevenshteinEntryMatch[];
};

export type LevenshteinAccountMatchStats = {
  totalEntries: number;
  averageRatio: number;
  // score: number;
};

export type LevenshteinEntryMatch = {
  description: string;
  ratio: number;
  count: number;
};
