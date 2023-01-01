export type Company = {
  name: string;
  address?: string;
};

export type BankAccount = {
  number: string;
  name?: string;
  type?: string;
};

export type BankStatementSummary = {
  balance: {
    begin: number;
    end: number;
  };
  totals: {
    deposits: number;
    withdrawals: number;
    fees?: number;
    checks?: number;
  };
};

export type Period = {
  start: string;
  end: string;
};

export type Transaction = {
  date: string;
  description: {
    original: string;
    shortened?: string;
  };
  amount: number;
};

export type Check = {
  date: string;
  number: string;
  amount: number;
};
