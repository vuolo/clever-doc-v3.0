import { useEffect, useState } from "react";
import Switch from "react-switch";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";

import {
  ArrowUpRight,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  CornerRightUp,
  CornerUpRight,
  FileClock,
  HelpCircle,
  Info,
  Landmark,
  Link,
  ListOrdered,
  ScanLine,
  SidebarOpen,
  View,
  X,
} from "lucide-react";

import type { Coder } from "@/utils/tools/bsca/Coder";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type Props = {
  coder: Coder | undefined;
};

export default function StatementAccuracy({ coder }: Props) {
  const [includeFees, setIncludeFees] = useState(false);

  if (!coder)
    return (
      <h1>
        <span className="text-mono-300">No coder selected.</span>
      </h1>
    );

  const calculatedTotalDeposits = Number(
    (
      coder.results.transactions.deposits.reduce(
        (total, deposit) => total + deposit.amount ?? 0,
        0
      ) ?? 0
    ).toFixed(2)
  );
  const calculatedTotalWithdrawals = Number(
    (
      Math.abs(
        coder.results.transactions.withdrawals.reduce(
          (total, withdrawal) => total + withdrawal.amount ?? 0,
          0
        ) ?? 0
      ) -
      (includeFees
        ? coder.bankStatement.summary.totals.fees == -1
          ? 0
          : Math.abs(coder.bankStatement.summary.totals.fees ?? 0)
        : 0)
    ).toFixed(2)
  );

  return (
    <div className="mb-4 w-full p-2 lg:w-[50%]">
      <h1 className="mb-2 flex items-center justify-center pb-2 text-lg font-extrabold">
        <View className="mr-2 h-5" />
        <span>Accuracy</span>
      </h1>
      {/* <div className="flex w-full justify-between">
        <div className="w-[33%]"></div>
        <h1 className="mb-2 flex w-[33%] items-center justify-center pb-2 text-lg font-extrabold">
          <View className="mr-2 h-5" />
          <span>Accuracy</span>
        </h1>
        <div className="mb-4 flex w-[33%] items-center justify-center">
            <label className="flex w-fit items-center space-x-3">
              <Switch
                onChange={() => setIncludeFees((prev) => !prev)}
                checked={includeFees}
              />
              <h1 className="font-bold">Include Fees</h1>
            </label>
        </div>
      </div> */}

      <table className="w-full items-center">
        <tbody className="bg-mono-50 text-sm shadow-lg">
          <tr className="border border-mono-150">
            <td className="px-6 py-4">
              <div className="flex items-center">
                <span>Deposit Instances</span>
                <Info
                  id="deposit-instances-tooltip"
                  data-tooltip-content="A deposit instance is a single recorded deposit from the bank statement. It is important to note that is is the number of deposits our AI has identified, and may not be the number of deposits that are actually present in the bank statement. Make sure to use this information to verify we didn't miss any deposits."
                  data-tooltip-place="bottom"
                  className="ml-1 h-3.5"
                />
                <Tooltip
                  anchorId="deposit-instances-tooltip"
                  className="max-w-[70vw]"
                />
              </div>
            </td>
            <td className="px-6 py-4">
              <p className="flex items-center rounded bg-mono-100 px-2.5 py-1">
                <ListOrdered className="mr-1 h-3.5" />
                <span className="tracking-wider">
                  {coder.results.transactions.deposits.length}
                </span>
              </p>
            </td>
            <td className="px-6 py-4">
              <div className="flex items-center">
                <span>Withdrawal Instances</span>
                <Info
                  id="withdrawal-instances-tooltip"
                  data-tooltip-content="A withdrawal instance is a single recorded withdrawal from the bank statement. It is important to note that is is the number of withdrawals our AI has identified, and may not be the number of withdrawals that are actually present in the bank statement. Make sure to use this information to verify we didn't miss any withdrawals."
                  data-tooltip-place="bottom"
                  className="ml-1 h-3.5"
                />
                <Tooltip
                  anchorId="withdrawal-instances-tooltip"
                  className="max-w-[70vw]"
                />
              </div>
            </td>
            <td className="px-6 py-4">
              <p className="flex items-center rounded bg-mono-100 px-1.5 py-1">
                <ListOrdered className="mr-1 h-3.5" />
                <span className="tracking-wider">
                  {coder.results.transactions.withdrawals.length}
                </span>
              </p>
            </td>
          </tr>
          <tr className="border border-mono-150">
            <td className="px-6 py-4">
              <div className="flex items-center">
                <span>Total Deposits</span>
                <Info
                  id="total-deposits-tooltip"
                  data-tooltip-content="We automatically calculate the total deposits by summing the amount of each deposit instance, and compare it to the total deposits from the bank statement's account summary."
                  data-tooltip-place="bottom"
                  className="ml-1 h-3.5"
                />
                <Tooltip
                  anchorId="total-deposits-tooltip"
                  className="max-w-[70vw]"
                />
              </div>
            </td>
            <td className="px-6 py-4">
              {coder.bankStatement.summary.totals.deposits == -1 ? (
                <p className="flex items-center rounded bg-mono-100 px-2.5 py-1 ring-1 ring-mono-400">
                  <HelpCircle className="mr-1 h-3.5 text-mono-400" />
                  <span className="tracking-wider">
                    {usdFormatter.format(Math.abs(calculatedTotalDeposits))}
                  </span>
                </p>
              ) : Math.abs(calculatedTotalDeposits) ==
                Math.abs(coder.bankStatement.summary.totals.deposits ?? -1) ? (
                <p className="flex items-center rounded bg-mono-100 px-2.5 py-1 ring-1 ring-brand-muted">
                  <Check className="mr-1 h-3.5 text-brand-muted" />
                  <span className="tracking-wider">
                    {usdFormatter.format(Math.abs(calculatedTotalDeposits))}
                  </span>
                </p>
              ) : (
                <p className="flex items-center rounded bg-mono-100 px-1.5 py-1 ring-1 ring-brand-muted-red">
                  <X className="mr-1 h-3.5 text-brand-muted-red" />
                  <span className="tracking-wider">
                    {usdFormatter.format(Math.abs(calculatedTotalDeposits))}
                  </span>
                </p>
              )}
            </td>
            <td className="px-6 py-4">
              <div className="flex flex-col">
                <div className="flex items-center">
                  <span>Total Withdrawals</span>
                  <Info
                    id="total-withdrawals-tooltip"
                    data-tooltip-content="We automatically calculate the total withdrawals by summing the amount of each withdrawal instance, and compare it to the total withdrawals from the bank statement's account summary."
                    data-tooltip-place="bottom"
                    className="ml-1 h-3.5"
                  />
                  <Tooltip
                    anchorId="total-withdrawals-tooltip"
                    className="max-w-[70vw]"
                  />
                </div>
                <label className="flex w-fit items-center space-x-3">
                  <div className="mt-1 flex items-center">
                    <CornerDownRight className="ml-1.5 mb-1 h-4 w-4" />
                    <input
                      onChange={() => setIncludeFees((prev) => !prev)}
                      checked={includeFees}
                      type="checkbox"
                      value=""
                      disabled={coder.bankStatement.summary.totals.fees == -1}
                      className="float-left ml-2 mr-2 h-4 w-4 cursor-pointer rounded-sm border border-gray-300 bg-white bg-contain bg-center bg-no-repeat align-top accent-green-700 transition duration-200 checked:border-brand-gold checked:bg-brand-gold focus:outline-none disabled:cursor-not-allowed"
                    />
                    {/* <Switch
                      onChange={() => setIncludeFees((prev) => !prev)}
                      checked={includeFees}
                      className="scale-75"
                    /> */}
                    <span className="font-bold">Include Fees</span>
                  </div>
                </label>
              </div>
            </td>
            <td className="px-6 py-4">
              {coder.bankStatement.summary.totals.withdrawals == -1 ? (
                <p className="flex items-center rounded bg-mono-100 px-2.5 py-1 ring-1 ring-mono-400">
                  <HelpCircle className="mr-1 h-3.5 text-mono-400" />
                  <span className="tracking-wider">
                    {usdFormatter.format(Math.abs(calculatedTotalWithdrawals))}
                  </span>
                </p>
              ) : Math.abs(calculatedTotalWithdrawals) ==
                Math.abs(
                  coder.bankStatement.summary.totals.withdrawals ?? -1
                ) ? (
                <p className="flex items-center rounded bg-mono-100 px-2.5 py-1 ring-1 ring-brand-muted">
                  <Check className="mr-1 h-3.5 text-brand-muted" />
                  <span className="tracking-wider">
                    {usdFormatter.format(Math.abs(calculatedTotalWithdrawals))}
                  </span>
                </p>
              ) : (
                <p className="flex items-center rounded bg-mono-100 px-1.5 py-1 ring-1 ring-brand-muted-red">
                  <X className="mr-1 h-3.5 text-brand-muted-red" />
                  <span className="tracking-wider">
                    {usdFormatter.format(Math.abs(calculatedTotalWithdrawals))}
                  </span>
                </p>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {coder.bankStatement.summary.totals.deposits == -1 ? (
        <h1 className="mt-4 text-center text-sm text-brand-muted-red drop-shadow-sm">
          <span>
            <span className="underline underline-offset-2">WARNING</span>: There
            <b>may</b> be an inaccuracy with the calculated number of{" "}
            <span className="underline underline-offset-2">withdrawals</span>{" "}
            (see above) against the actual number of{" "}
            <span className="underline underline-offset-2">withdrawals</span> on
            the account summary. Please check the bank statement to confirm.
          </span>
        </h1>
      ) : Math.abs(calculatedTotalWithdrawals) !=
        Math.abs(coder.bankStatement.summary.totals.withdrawals ?? -1) ? (
        <h1 className="mt-4 text-center text-sm text-brand-muted-red drop-shadow-sm">
          <span>
            <span className="underline underline-offset-2">WARNING</span>: There
            is an inaccuracy with the calculated number of{" "}
            <span className="underline underline-offset-2">withdrawals</span>{" "}
            (see above) against the actual number of{" "}
            <span className="underline underline-offset-2">withdrawals</span> on
            the account summary. The difference is{" "}
            <span className="font-black">
              {usdFormatter.format(
                Math.abs(
                  Math.abs(calculatedTotalWithdrawals) -
                    Math.abs(
                      coder.bankStatement.summary.totals.withdrawals ?? 0
                    )
                )
              )}
            </span>
            .
          </span>
        </h1>
      ) : coder.bankStatement.summary.totals.deposits == -1 ? (
        <h1 className="mt-4 text-center text-sm text-brand-muted-red drop-shadow-sm">
          <span>
            <span className="underline underline-offset-2">WARNING</span>: There
            <b>may</b> be an inaccuracy with the calculated number of{" "}
            <span className="underline underline-offset-2">deposits</span> (see
            above) against the actual number of{" "}
            <span className="underline underline-offset-2">deposits</span> on
            the account summary. Please check the bank statement to confirm.
          </span>
        </h1>
      ) : Math.abs(calculatedTotalDeposits) !=
        Math.abs(coder.bankStatement.summary.totals.deposits ?? -1) ? (
        <h1 className="mt-4 text-center text-sm text-brand-muted-red drop-shadow-sm">
          <span>
            <span className="underline underline-offset-2">WARNING</span>: There
            is an inaccuracy with the calculated number of{" "}
            <span className="underline underline-offset-2">deposits</span> (see
            above) against the actual number of{" "}
            <span className="underline underline-offset-2">deposits</span> on
            the account summary. The difference is{" "}
            <span className="font-black">
              {usdFormatter.format(
                Math.abs(
                  Math.abs(calculatedTotalDeposits) -
                    Math.abs(coder.bankStatement.summary.totals.deposits ?? 0)
                )
              )}
            </span>
            .
          </span>
        </h1>
      ) : null}
    </div>
  );
}
