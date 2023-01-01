export type Company = {
  name: string;
};

export type Period = {
  start: string;
  end: string;
};

export type GeneralLedgerAccount = {
  name: string;
  number: string;
  beginningBalance?: number;
  endingBalance?: number;
  amountTotal?: number;
  entries: GeneralLedgerEntry[];
};

export type GeneralLedgerEntry = {
  date: string;
  description: string;
  amount: number;
};
