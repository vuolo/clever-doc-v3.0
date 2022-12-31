import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  FileClock,
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

export default function AccountSummary({ coder }: Props) {
  if (!coder)
    return (
      <h1>
        <span className="text-mono-300">No coder selected.</span>
      </h1>
    );

  return (
    <div className="mb-4 w-full p-2 lg:w-[50%]">
      <h1 className="mb-2 flex items-center justify-center pb-2 text-lg font-extrabold">
        <Landmark className="mr-2 h-5" />
        <span>Account Summary</span>
      </h1>
      <table className="w-full items-center">
        <tbody className="bg-mono-50 text-sm shadow-lg">
          <tr className="border border-mono-150">
            <td className="px-6 py-4 underline underline-offset-2">
              Beginning Balance
            </td>
            <td className="px-6 py-4">
              <p className="flex items-center rounded bg-mono-100 px-1.5 py-1">
                {coder.bankStatement.summary.balance.begin !== undefined &&
                coder.bankStatement.summary.balance.begin !== -1 ? (
                  <>
                    <ScanLine className="mr-1 h-3.5" />
                    <span className="tracking-wider">
                      {usdFormatter.format(
                        coder.bankStatement.summary.balance.begin ?? -1
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <X className="mr-1 h-3.5" />
                    <span className="tracking-wider">N/A</span>
                  </>
                )}
              </p>
            </td>
            <td className="px-6 py-4 underline underline-offset-2">
              Ending Balance
            </td>
            <td className="px-6 py-4">
              <p className="flex items-center rounded bg-mono-100 px-1.5 py-1">
                {coder.bankStatement.summary.balance.end !== undefined &&
                coder.bankStatement.summary.balance.end !== -1 ? (
                  <>
                    <ScanLine className="mr-1 h-3.5" />
                    <span className="tracking-wider">
                      {usdFormatter.format(
                        coder.bankStatement.summary.balance.end ?? -1
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <X className="mr-1 h-3.5" />
                    <span className="tracking-wider">N/A</span>
                  </>
                )}
              </p>
            </td>
          </tr>
          <tr className="border border-mono-150">
            <td className="px-6 py-4">Total Deposits</td>
            <td className="px-6 py-4">
              <p className="flex items-center rounded bg-mono-100 px-1.5 py-1">
                {coder.bankStatement.summary.totals.deposits !== undefined &&
                coder.bankStatement.summary.totals.deposits !== -1 ? (
                  <>
                    <ScanLine className="mr-1 h-3.5" />
                    <span className="tracking-wider">
                      {usdFormatter.format(
                        coder.bankStatement.summary.totals.deposits ?? -1
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <X className="mr-1 h-3.5" />
                    <span className="tracking-wider">N/A</span>
                  </>
                )}
              </p>
            </td>
            <td className="px-6 py-4">Total Withdrawals</td>
            <td className="px-6 py-4">
              <p className="flex items-center rounded bg-mono-100 px-1.5 py-1">
                {coder.bankStatement.summary.totals.withdrawals !== undefined &&
                coder.bankStatement.summary.totals.withdrawals !== -1 ? (
                  <>
                    <ScanLine className="mr-1 h-3.5" />
                    <span className="tracking-wider">
                      {usdFormatter.format(
                        Math.abs(
                          coder.bankStatement.summary.totals.withdrawals ?? -1
                        )
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <X className="mr-1 h-3.5" />
                    <span className="tracking-wider">N/A</span>
                  </>
                )}
              </p>
            </td>
          </tr>
          <tr className="border border-mono-150">
            <td className="px-6 py-4">Total Fees</td>
            <td className="px-6 py-4">
              <p className="flex items-center rounded bg-mono-100 px-1.5 py-1">
                {coder.bankStatement.summary.totals.fees !== undefined &&
                coder.bankStatement.summary.totals.fees !== -1 ? (
                  <>
                    <ScanLine className="mr-1 h-3.5" />
                    <span className="tracking-wider">
                      {usdFormatter.format(
                        Math.abs(coder.bankStatement.summary.totals.fees ?? -1)
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <X className="mr-1 h-3.5" />
                    <span className="tracking-wider">N/A</span>
                  </>
                )}
              </p>
            </td>
            <td className="px-6 py-4">Total Checks</td>
            <td className="px-6 py-4">
              <p className="flex items-center rounded bg-mono-100 px-1.5 py-1">
                {coder.bankStatement.summary.totals.checks !== undefined &&
                coder.bankStatement.summary.totals.checks !== -1 ? (
                  <>
                    <ScanLine className="mr-1 h-3.5" />
                    <span className="tracking-wider">
                      {usdFormatter.format(
                        Math.abs(
                          coder.bankStatement.summary.totals.checks ?? -1
                        )
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <X className="mr-1 h-3.5" />
                    <span className="tracking-wider">N/A</span>
                  </>
                )}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
