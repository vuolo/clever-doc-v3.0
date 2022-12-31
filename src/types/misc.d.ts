export type StoredFile = {
  name: string;
  structure: string;
  extractedStructure?: BankStatement | GeneralLedger;
  url: string;
  size: number;
  hash: string;
  file: File;
  blob?: Blob;
  uploading: boolean;
  parsing: boolean;
};
