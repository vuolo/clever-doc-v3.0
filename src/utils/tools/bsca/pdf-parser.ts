import { BankStatement } from "./BankStatement";
import { GeneralLedger } from "./GeneralLedger";

const PAGE_SPLIT_COUNT = 10;

// TODO: rework to include user id in the url
type ParseProps = {
  url: string;
  hash: string;
};

export async function parse({ url, hash }: ParseProps) {
  return undefined;
}
