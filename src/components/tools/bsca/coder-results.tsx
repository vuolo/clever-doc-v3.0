import { type Dispatch, type SetStateAction, useState } from "react";
import Switch from "react-switch";
import { Menu, MenuItem } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";
import "@szhsin/react-menu/dist/transitions/slide.css";
import toast from "react-hot-toast";

import {
  ArrowUpRight,
  Banknote,
  ChevronDown,
  FileClock,
  FileCog,
  FileLock2,
  FileSpreadsheet,
  Link,
  SidebarClose,
  SidebarOpen,
} from "lucide-react";

import {
  createAndDownloadFile,
  generateMacro,
} from "@/utils/tools/bsca/macro-gen";
import type { Coder } from "@/utils/tools/bsca/Coder";
import AccountSummary from "./account-summary";
import StatementAccuracy from "./statement-accuracy";
import CoderTable from "./coder-table";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const isMac =
  typeof window !== "undefined"
    ? navigator.platform.toUpperCase().indexOf("MAC") >= 0
    : false;

type Props = {
  coders: Coder[];
  setCoders: Dispatch<SetStateAction<Coder[]>>;
};

export default function CoderResults({ coders, setCoders }: Props) {
  const [selectedCoderIndex, setSelectedCoderIndex] = useState(0);
  const [tableTransactionType, setTableTransactionType] = useState<
    "withdrawals" | "deposits" | "fees" | "checks"
  >("withdrawals");
  const [displayShortenedDescriptions, setDisplayShortenedDescriptions] =
    useState(true);
  const [bankStatementSidebarOpen, setBankStatementSidebarOpen] =
    useState(false);

  if (!coders[selectedCoderIndex])
    return <h1>The selected coded results are not available.</h1>;

  function updateCoder(index: number, coder: Coder) {
    setCoders((prev) => {
      const updatedCoders = [...prev];
      updatedCoders[index] = coder;
      return updatedCoders;
    });
  }

  function exportCodedTransactions() {
    const coder = coders[selectedCoderIndex];
    if (!coder) return;

    if (
      tableTransactionType !== "deposits" &&
      tableTransactionType !== "withdrawals"
    )
      return toast.error("Only deposits and withdrawals can be exported.");

    const macroFile = generateMacro(
      "BSCA.bankStatement",
      isMac ? "Mac" : "Windows",
      "Accounting CS",
      coder,
      tableTransactionType
    );
    if (!macroFile) return toast.error("Failed to generate macro file.");

    // console.log(macroFile.contents);
    createAndDownloadFile(macroFile.name, macroFile.contents);
  }

  return (
    <>
      <div className="container mb-4 flex w-full items-start justify-between">
        <div className="w-[33%]">
          {coders.length == 1 ? (
            <>
              {/* <button
                      onClick={() => {
                        setCoders([]);
                      }}
                      className="text-md inline-flex items-center rounded-md border border-transparent bg-red-600 px-6 py-2 font-bold text-white shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2"
                    >
                      <Undo size={20} className="mr-2" />
                      Reupload
                    </button> */}
            </>
          ) : (
            <>
              <button
                onClick={() => setBankStatementSidebarOpen((prev) => !prev)}
                className="text-md absolute left-0 z-[9999998] inline-flex h-[42px] w-fit items-center rounded-r-md border border-transparent bg-brand px-4 py-2 font-bold text-white shadow-md transition-all hover:bg-brand-hover focus:outline-none"
              >
                <SidebarOpen size={20} />
              </button>
              <div
                className={`absolute top-0 z-[9999999] flex h-screen w-[240px] flex-col items-center border-r border-mono-150 bg-brand-offwhite shadow-md transition-[left] ${
                  bankStatementSidebarOpen ? "left-0" : "-left-[240px]"
                }`}
              >
                <div className="mt-7 flex space-x-3 font-bold">
                  <FileLock2 className="" />
                  <h1>Bank Statements</h1>
                </div>
                <button
                  onClick={() => setBankStatementSidebarOpen((prev) => !prev)}
                  className="text-md mt-8 inline-flex h-[42px] w-[240px] items-center justify-between border-r border-mono-150 bg-brand px-4 py-2 font-bold text-white transition-all hover:bg-brand-hover focus:outline-none"
                >
                  <SidebarClose size={20} className="mr-2" />
                  <span className="font-bold">Close Sidebar</span>
                  <SidebarClose size={20} className="invisible mr-2" />
                </button>
                <div
                  id="bankStatementList"
                  className="mt-4 mb-4 flex w-full flex-col items-center space-y-4 overflow-auto py-2"
                >
                  {coders.map((coder, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        if (selectedCoderIndex === index) return;
                        setSelectedCoderIndex(index);
                        setBankStatementSidebarOpen(false);
                      }}
                      className={`inline-flex h-fit w-[200px] items-center justify-between rounded-md border border-transparent px-3 py-2 text-sm font-bold text-white shadow-md ${
                        selectedCoderIndex === index
                          ? "cursor-not-allowed bg-brand-gold"
                          : "bg-mono-500 hover:bg-mono-400 focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2 "
                      }`}
                    >
                      <h3 className="mr-2">{index + 1}.</h3>
                      <h3>
                        {coder.bankStatement.period.start}{" "}
                        <span className="font-bold">
                          #{coder.bankStatement.account.number.slice(-4)}
                        </span>
                      </h3>
                      <h3 className="invisible">{index + 1}.</h3>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex w-[33%] flex-col items-center justify-center text-center">
          <h1 className="text-xl font-extrabold underline underline-offset-4">
            {coders[
              selectedCoderIndex
            ]?.generalLedger.company.name.toUpperCase() ?? "UNKNOWN COMPANY"}
          </h1>
          <div className="mt-1 flex items-center justify-center space-x-3">
            <span className="mt-2 flex items-center justify-center rounded bg-mono-100 px-2.5 py-1 text-sm font-medium">
              <FileClock className="mr-2 h-4" />
              {coders[selectedCoderIndex]?.bankStatement.period.start} -{" "}
              {coders[selectedCoderIndex]?.bankStatement.period.end}
            </span>
            <h3 className="mt-2 text-sm">
              {coders[selectedCoderIndex]?.bankStatement.bank}{" "}
              <span className="font-bold">
                #
                {coders[selectedCoderIndex]?.bankStatement.account.number.slice(
                  -4
                )}
              </span>
            </h3>
          </div>
        </div>

        <div className="flex w-[33%] items-end justify-end">
          <Menu
            arrow
            transition
            position="auto"
            viewScroll="auto"
            menuButton={
              <button className="text-md inline-flex items-center rounded-md border border-transparent bg-brand px-3 py-2 font-bold text-white shadow-md hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2">
                <Link className="mr-2 h-4" />
                Open...
                <ChevronDown className="ml-2 h-4" />
              </button>
            }
            className="[&>ul]:rounded-md [&>ul]:bg-mono-25 [&>ul]:py-1 [&>ul]:text-black [&>ul>li]:m-1 [&>ul>li]:px-2 [&>ul>li.red]:text-red-500 [&>ul>div]:bg-mono-25"
          >
            <MenuItem
              onClick={() =>
                window.open(coders[selectedCoderIndex]?.bankStatement.file?.url)
              }
              className="flex space-x-2"
            >
              <FileLock2 size={20} className="mr-2" />
              Bank Statement
              <span className="text-mono-400">
                (
                {coders[selectedCoderIndex]?.bankStatement.file?.name ??
                  "not found"}
                )
              </span>
            </MenuItem>
            <MenuItem
              onClick={() =>
                window.open(coders[selectedCoderIndex]?.generalLedger.file?.url)
              }
              className="flex space-x-2"
            >
              <FileSpreadsheet size={20} className="mr-2" />
              General Ledger
              <span className="text-mono-400">
                (
                {coders[selectedCoderIndex]?.generalLedger.file?.name ??
                  "not found"}
                )
              </span>
            </MenuItem>
          </Menu>
        </div>
      </div>

      <div className="flex w-full flex-col lg:flex-row lg:space-x-8">
        <AccountSummary coder={coders[selectedCoderIndex]} />
        <StatementAccuracy coder={coders[selectedCoderIndex]} />
      </div>

      <div className="container mb-4 flex w-full items-start justify-between">
        <div className="w-[33%]">
          <label className="flex w-fit items-center space-x-1">
            <Switch
              onChange={() => setDisplayShortenedDescriptions((prev) => !prev)}
              checked={displayShortenedDescriptions}
              className="scale-75"
            />
            <h1 className="font-bold">Shorten Descriptions</h1>
          </label>
        </div>

        <div className="flex w-[33%] items-center justify-center">
          <Menu
            arrow
            transition
            position="auto"
            viewScroll="auto"
            menuButton={
              <h1 className="mb-2 flex w-fit cursor-pointer items-center justify-center pb-2 text-lg font-extrabold underline underline-offset-4">
                <Banknote className="mr-2" />
                <span>
                  {tableTransactionType.charAt(0).toUpperCase() +
                    tableTransactionType.slice(1)}
                </span>
                <ChevronDown className="ml-1 h-4" />
              </h1>
            }
            className="[&>ul]:rounded-md [&>ul]:bg-mono-25 [&>ul]:py-1 [&>ul]:text-black [&>ul>li]:m-1 [&>ul>li]:px-2 [&>ul>li.red]:text-red-500 [&>ul>div]:bg-mono-25"
          >
            <MenuItem onClick={() => setTableTransactionType("withdrawals")}>
              Withdrawals
            </MenuItem>
            <MenuItem onClick={() => setTableTransactionType("deposits")}>
              Deposits
            </MenuItem>
            <MenuItem onClick={() => setTableTransactionType("fees")}>
              Fees
            </MenuItem>
            <MenuItem onClick={() => setTableTransactionType("checks")}>
              Checks
            </MenuItem>
          </Menu>
        </div>

        <div className="flex w-[33%] items-end justify-end">
          <button
            onClick={exportCodedTransactions}
            className="text-md inline-flex items-center rounded-md border border-transparent bg-brand-gold px-4 py-2 font-bold text-white shadow-md hover:bg-brand-gold-hover focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2"
          >
            {/* <Keyboard className="-mr-2 h-4" />
            <Cog className="mr-2 mb-2 h-3 w-3" /> */}
            {/* <SortDesc className="mr-2" /> */}
            <FileCog className="h-5 w-5" />
            <ArrowUpRight className="mr-2 mb-2 h-4 w-4" />
            Create Macro
          </button>
        </div>
      </div>
      {tableTransactionType === "withdrawals" ||
      tableTransactionType == "deposits" ? (
        <CoderTable
          coder={coders[selectedCoderIndex] as Coder}
          coderIndex={selectedCoderIndex}
          updateCoder={updateCoder}
          transactionType={tableTransactionType}
          displayShortenedDescriptions={displayShortenedDescriptions}
        />
      ) : (
        <div className="flex h-full w-full justify-center">
          <h1 className="text-md mt-8 text-mono-500">
            Coming Soon! Check back later.
          </h1>
        </div>
      )}
    </>
  );
}
