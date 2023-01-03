import { memo, useMemo, useState } from "react";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import { Menu, MenuItem, MenuDivider } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";
import "@szhsin/react-menu/dist/transitions/slide.css";

import {
  type ColumnDef,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Row,
} from "@tanstack/react-table";
import {
  CheckCircle2,
  Edit2,
  Edit3,
  Info,
  ListEnd,
  MoreVertical,
  Save,
  Trash2,
  Undo,
  X,
} from "lucide-react";

import type { Coder } from "@/utils/tools/bsca/Coder";
import type {
  LevenshteinAccountMatch,
  LevenshteinEntryMatch,
  LevenshteinTransaction,
} from "@/types/tools/bsca/coder";

type Props = {
  coder: Coder;
  coderIndex: number;
  updateCoder: (index: number, coder: Coder) => void;
  transactionType: "withdrawals" | "deposits" | "fees" | "checks";
  displayShortenedDescriptions: boolean;
};

export default function CoderTable({
  coder,
  coderIndex,
  updateCoder,
  transactionType,
  displayShortenedDescriptions,
}: Props) {
  const [showEditTransactionModal, setShowEditTransactionModal] =
    useState(false);
  const [curEditTransactionIndex, setCurEditTransactionIndex] = useState(-1);
  const [curEditTransaction, setCurEditTransaction] = useState<
    LevenshteinTransaction | undefined
  >(undefined);

  // TODO: move these helpers to a separate file and add UpdateCoder as an argument
  function getAccountMatchIndex(
    transactionIndex: number,
    accountNumber: string
  ): number | undefined {
    if (transactionType !== "deposits" && transactionType !== "withdrawals")
      return;

    const transactions = coder.results.transactions[transactionType];
    if (!transactions) return;

    const transaction = transactions[transactionIndex];
    if (!transaction?.matches) return;

    return transaction.matches.findIndex(
      (match) => match.account.number === accountNumber
    );
  }

  function getSelectionOverrideEntryIndex(
    transactionIndex: number,
    entryDescription: string
  ): number | undefined {
    if (transactionType !== "deposits" && transactionType !== "withdrawals")
      return;

    const transactions = coder.results.transactions[transactionType];
    if (!transactions) return;

    const transaction = transactions[transactionIndex];
    if (!transaction?.selection) return;

    const selectionOverride = transaction.selectionOverride;
    if (!selectionOverride) return;

    const accountMatchIndex = getAccountMatchIndex(
      transactionIndex,
      selectionOverride.account.number
    );
    if (accountMatchIndex === -1 || accountMatchIndex === undefined) return;

    return transaction.matches[accountMatchIndex]?.entries.findIndex(
      (entry) => entry.description === entryDescription
    );
  }

  function updateSelectionEntry(transactionIndex: number, entryIndex: number) {
    if (transactionType !== "deposits" && transactionType !== "withdrawals")
      return;

    const updatedCoder = coder;
    const transactions = updatedCoder.results.transactions[transactionType];
    if (!transactions) return;

    const transaction = transactions[transactionIndex];
    if (!transaction?.selection) return;

    const accountMatchIndex = transaction.selection.account.index;
    const entry = transaction.matches[accountMatchIndex]?.entries[entryIndex];
    if (!entry) return;

    transaction.selection.entry = { ...entry, index: entryIndex };
    updatedCoder.results.transactions[transactionType][transactionIndex] =
      transaction;

    updateCoder(coderIndex, updatedCoder);
  }

  function updateSelectionOverrideAccount(
    transactionIndex: number,
    account: { name: string; number: string; index?: number }
  ) {
    if (transactionType !== "deposits" && transactionType !== "withdrawals")
      return;

    const updatedCoder = coder;
    const transactions = updatedCoder.results.transactions[transactionType];
    if (!transactions) return;

    const transaction = transactions[transactionIndex];
    if (!transaction?.selectionOverride) return;

    delete account.index;
    transaction.selectionOverride.account = account;
    updatedCoder.results.transactions[transactionType][transactionIndex] =
      transaction;

    updateCoder(coderIndex, updatedCoder);
  }

  function updateSelectionOverrideEntry(
    transactionIndex: number,
    description: string
  ) {
    if (transactionType !== "deposits" && transactionType !== "withdrawals")
      return;

    const updatedCoder = coder;
    const transactions = updatedCoder.results.transactions[transactionType];
    if (!transactions) return;

    const transaction = transactions[transactionIndex];
    if (!transaction?.selectionOverride) return;

    transaction.selectionOverride.entry.description = description;
    updatedCoder.results.transactions[transactionType][transactionIndex] =
      transaction;

    updateCoder(coderIndex, updatedCoder);
  }

  function getSelectionOverrideEntries(
    transactionIndex: number,
    accountNumber: string
  ): LevenshteinEntryMatch[] {
    if (transactionType !== "deposits" && transactionType !== "withdrawals")
      return [];

    const transactions = coder.results.transactions[transactionType];
    if (!transactions) return [];

    const transaction = transactions[transactionIndex];
    if (!transaction?.matches) return [];

    const accountMatchIndex = getAccountMatchIndex(
      transactionIndex,
      accountNumber
    );
    if (accountMatchIndex === -1 || accountMatchIndex === undefined) return [];

    return transaction.matches[accountMatchIndex]?.entries ?? [];
  }

  function toggleSelectionOverride(
    transactionIndex: number,
    enabled?: boolean
  ) {
    if (transactionType !== "deposits" && transactionType !== "withdrawals")
      return;

    const updatedCoder = coder;
    const transactions = updatedCoder.results.transactions[transactionType];
    if (!transactions) return;

    const transaction = transactions[transactionIndex];
    if (!transaction?.selectionOverride) return;

    transaction.selectionOverride.enabled =
      enabled ?? !transaction.selectionOverride.enabled;
    updatedCoder.results.transactions[transactionType][transactionIndex] =
      transaction;

    updateCoder(coderIndex, updatedCoder);
  }

  function toggleSelectionOverrideEntry(
    transactionIndex: number,
    enabled?: boolean
  ) {
    if (transactionType !== "deposits" && transactionType !== "withdrawals")
      return;

    const updatedCoder = coder;
    const transactions = updatedCoder.results.transactions[transactionType];
    if (!transactions) return;

    const transaction = transactions[transactionIndex];
    if (!transaction) return;
    if (!transaction.selectionOverride) return;

    transaction.selectionOverride.entry.enabled =
      enabled ?? !transaction.selectionOverride.entry.enabled;
    updatedCoder.results.transactions[transactionType][transactionIndex] =
      transaction;

    updateCoder(coderIndex, updatedCoder);
  }

  function updateAllLikeDescriptionSelectionOverrides(
    transactionIndex: number
  ) {
    if (transactionType !== "deposits" && transactionType !== "withdrawals")
      return;

    const updatedCoder = coder;
    const transactions = updatedCoder.results.transactions[transactionType];
    if (!transactions) return;

    const transaction = transactions[transactionIndex];
    if (!transaction?.selectionOverride) return;

    const descriptionNoDigits = transaction.description.original.replace(
      /\d/g,
      ""
    );
    updatedCoder.results.transactions[transactionType] = transactions.map(
      (t) => {
        if (t.description.original.replace(/\d/g, "") === descriptionNoDigits) {
          t.selectionOverride = transaction.selectionOverride;
        }
        return t;
      }
    );

    updateCoder(coderIndex, updatedCoder);
  }

  function updateAllLikeDescriptionSelections(transactionIndex: number) {
    if (transactionType !== "deposits" && transactionType !== "withdrawals")
      return;

    const updatedCoder = coder;
    const transactions = updatedCoder.results.transactions[transactionType];
    if (!transactions) return;

    const transaction = transactions[transactionIndex];
    if (!transaction?.selection) return;

    const descriptionNoDigits = transaction.description.original.replace(
      /\d/g,
      ""
    );
    updatedCoder.results.transactions[transactionType] = transactions.map(
      (t) => {
        if (t.description.original.replace(/\d/g, "") === descriptionNoDigits) {
          t.selection = transaction.selection;
        }
        return t;
      }
    );

    updateCoder(coderIndex, updatedCoder);
  }

  function removeTransaction(transactionIndex: number) {
    if (transactionType !== "deposits" && transactionType !== "withdrawals")
      return;

    const updatedCoder = coder;
    const transactions = updatedCoder.results.transactions[transactionType];
    if (!transactions) return;

    updatedCoder.results.transactions[transactionType] = transactions.filter(
      (_, index) => index !== transactionIndex
    );

    updateCoder(coderIndex, updatedCoder);
  }

  function editTransaction(transactionIndex: number) {
    if (transactionType !== "deposits" && transactionType !== "withdrawals")
      return;

    const transactions = coder.results.transactions[transactionType];
    if (!transactions) return;

    const transaction = transactions[transactionIndex];
    if (!transaction) return;

    setCurEditTransaction(transaction);
    setCurEditTransactionIndex(transactionIndex);
    setShowEditTransactionModal(true);
  }

  function updateTransaction(
    transaction: LevenshteinTransaction,
    transactionIndex: number
  ) {
    if (transactionType !== "deposits" && transactionType !== "withdrawals")
      return;

    const updatedCoder = coder;
    const transactions = updatedCoder.results.transactions[transactionType];
    if (!transactions) return;

    updatedCoder.results.transactions[transactionType] = transactions.map(
      (t, i) => {
        if (i == transactionIndex) {
          // TODO: add other fields once we add them in the edit modal
          t.amount = transaction.amount;
        }
        return t;
      }
    );

    updateCoder(coderIndex, updatedCoder);
  }

  const columnHelper = createColumnHelper<LevenshteinTransaction>();
  const columns = useMemo<ColumnDef<LevenshteinTransaction, any>[]>(
    () => [
      columnHelper.accessor("date", {
        header: "DATE",
        cell: (info) => {
          return <span className="tracking-wider">{info.getValue()}</span>;
        },
      }),
      columnHelper.accessor("description", {
        header: "DESCRIPTION",
        cell: (info) => {
          const description = info.getValue();
          const isTextWidthExceeded =
            getTextWidth(
              displayShortenedDescriptions
                ? description.shortened ?? description.original
                : description.original
            ) > 325;
          return (
            <div className="flex items-center">
              {(displayShortenedDescriptions && description.shortened) ||
              isTextWidthExceeded ? (
                <>
                  <Info
                    id={"tooltip" + info.row.id + transactionType}
                    data-tooltip-content={description.original}
                    data-tooltip-place="bottom"
                    className="mr-2 h-5"
                  />
                  <Tooltip
                    anchorId={"tooltip" + info.row.id + transactionType}
                  />
                </>
              ) : (
                <CheckCircle2 className="mr-2 h-5 text-mono-200" />
              )}
              <span className="w-[325px] overflow-hidden text-ellipsis whitespace-nowrap">
                {displayShortenedDescriptions
                  ? description.shortened ?? description.original
                  : description.original}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor("matches", {
        header: () => (
          <div className="flex items-center space-x-2">
            <span>CODED DESCRIPTION</span>
            <div className="w-fit rounded bg-mono-100 px-2 py-1">MATCH%</div>
          </div>
        ),
        cell: (info) => {
          const matches = info.getValue() as LevenshteinAccountMatch[];
          const selection = info.row.original.selection;
          const selectionOverride = info.row.original.selectionOverride;

          if (!selection || !selectionOverride)
            return "Error. Please take a screenshot and report this bug to Michael.";

          return (
            <div className="flex items-center space-x-2">
              {selectionOverride.enabled ? (
                <>
                  <button
                    onClick={() =>
                      toggleSelectionOverride(info.row.index, false)
                    }
                    className="text-md inline-flex items-center rounded-md border border-transparent px-1 py-1 font-bold text-black focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2"
                  >
                    <Undo
                      id={
                        "tooltip-revert-override" +
                        info.row.id +
                        transactionType
                      }
                      data-tooltip-content="Revert Override"
                      data-tooltip-place="bottom"
                      className="h-4 w-4"
                    />
                    <Tooltip
                      anchorId={
                        "tooltip-revert-override" +
                        info.row.id +
                        transactionType
                      }
                    />
                  </button>
                  <Select
                    onChange={(option) => {
                      if (!option) return;
                      updateSelectionOverrideAccount(info.row.index, {
                        number: option.value,
                        name: option.label.split(" ").slice(1).join(" "),
                      });

                      const entries = getSelectionOverrideEntries(
                        info.row.index,
                        selectionOverride.account.number
                      );
                      if (!selectionOverride.entry.enabled)
                        updateSelectionOverrideEntry(
                          info.row.index,
                          entries[0]?.description ?? ""
                        );

                      updateAllLikeDescriptionSelectionOverrides(
                        info.row.index
                      );
                    }}
                    options={[
                      {
                        label: "Matched Accounts",
                        options: matches.map(
                          (match: LevenshteinAccountMatch) => ({
                            value: match.account.number,
                            label: `${match.account.number} ${match.account.name}`,
                          })
                        ),
                      },
                      {
                        label: "All Accounts",
                        options: coder.generalLedger.accounts.map(
                          (account) => ({
                            value: account.number,
                            label: `${account.number} ${account.name}`,
                          })
                        ),
                      },
                    ]}
                    defaultValue={
                      selectionOverride.account.number && {
                        value: selectionOverride.account.number,
                        label: `${selectionOverride.account.number} ${selectionOverride.account.name}`,
                      }
                    }
                    menuPlacement="auto"
                    classNames={{
                      control: (state) =>
                        state.isFocused
                          ? "ring-1 ring-brand-muted border border-brand-muted"
                          : "",
                      option: (state) =>
                        state.isSelected
                          ? "bg-brand-muted"
                          : state.isFocused
                          ? "bg-brand-muted-super"
                          : "",
                    }}
                    className="w-[300px]"
                  />
                  {selectionOverride.entry.enabled ? (
                    <>
                      <button
                        onClick={() => {
                          toggleSelectionOverrideEntry(info.row.index, false);

                          const entries = getSelectionOverrideEntries(
                            info.row.index,
                            selectionOverride.account.number
                          );
                          updateSelectionOverrideEntry(
                            info.row.index,
                            entries[0]?.description ?? ""
                          );
                        }}
                        className="text-md inline-flex items-center rounded-md border border-transparent px-1 py-1 font-bold text-black focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2"
                      >
                        <ListEnd className="h-4 w-4" />
                      </button>
                      <input
                        onBlur={(e) => {
                          updateSelectionOverrideEntry(
                            info.row.index,
                            e.target.value
                          );
                        }}
                        defaultValue={selectionOverride.entry.description}
                        className="rounded-[4px] border border-[#cccccc] px-2 py-2 focus:border-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-muted"
                      ></input>
                    </>
                  ) : (
                    <CreatableSelect
                      onChange={(option) => {
                        if (!option) return;
                        updateSelectionOverrideEntry(
                          info.row.index,
                          option.label ?? ""
                        );
                        updateAllLikeDescriptionSelectionOverrides(
                          info.row.index
                        );
                      }}
                      onCreateOption={(option) => {
                        toggleSelectionOverrideEntry(info.row.index, true);
                        updateSelectionOverrideEntry(info.row.index, option);
                        updateAllLikeDescriptionSelectionOverrides(
                          info.row.index
                        );
                      }}
                      options={getSelectionOverrideEntries(
                        info.row.index,
                        selectionOverride.account.number
                      ).map((entry: LevenshteinEntryMatch, i: number) => ({
                        value: i.toString(),
                        label: entry.description,
                      }))}
                      value={
                        selectionOverride.entry.description
                          ? {
                              value: (
                                getSelectionOverrideEntryIndex(
                                  info.row.index,
                                  selectionOverride.entry.description
                                ) ?? ""
                              ).toString(),
                              label: selectionOverride.entry.description
                                ? selectionOverride.entry.description
                                : undefined,
                            }
                          : null
                      }
                      placeholder="Create an entry description..."
                      noOptionsMessage={() =>
                        "Type to create an entry description..."
                      }
                      menuPlacement="auto"
                      classNames={{
                        control: (state) =>
                          state.isFocused
                            ? "ring-1 ring-brand-muted border border-brand-muted"
                            : "",
                        option: (state) =>
                          state.isSelected
                            ? "bg-brand-muted"
                            : state.isFocused
                            ? "bg-brand-muted-super"
                            : "",
                      }}
                      className="w-[300px]"
                    />
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() =>
                      toggleSelectionOverride(info.row.index, true)
                    }
                    // className="text-md inline-flex items-center rounded-md border border-transparent bg-brand-gold px-1 py-1 font-bold text-white shadow-md hover:bg-brand-gold-hover focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2"
                    className="text-md inline-flex items-center rounded-md border border-transparent px-1 py-1 font-bold text-black focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2"
                  >
                    <Edit2
                      id={"tooltip-override" + info.row.id + transactionType}
                      data-tooltip-content="Override"
                      data-tooltip-place="bottom"
                      className="h-4 w-4"
                    />
                    <Tooltip
                      anchorId={
                        "tooltip-override" + info.row.id + transactionType
                      }
                    />
                  </button>
                  <div className="w-fit rounded bg-mono-100 px-2 py-1">
                    <p>
                      {selection.account.number} {selection.account.name}
                    </p>
                  </div>
                  <CreatableSelect
                    onChange={(option) => {
                      if (!option) return;
                      updateSelectionEntry(
                        info.row.index,
                        Number(option.value)
                      );

                      updateAllLikeDescriptionSelections(info.row.index);
                    }}
                    onCreateOption={(option) => {
                      toggleSelectionOverride(info.row.index, true);
                      updateSelectionOverrideAccount(
                        info.row.index,
                        selection.account
                      );
                      toggleSelectionOverrideEntry(info.row.index, true);
                      updateSelectionOverrideEntry(info.row.index, option);

                      updateAllLikeDescriptionSelectionOverrides(
                        info.row.index
                      );
                    }}
                    options={
                      // matches[selection.account.index] == -1 ||
                      !matches[selection.account.index]?.entries
                        ? []
                        : matches[selection.account.index]?.entries.map(
                            (entry: LevenshteinEntryMatch, i: number) => ({
                              value: i.toString(),
                              label: entry.description,
                            })
                          ) ?? []
                    }
                    defaultValue={
                      selection.entry.description && {
                        value: "0",
                        label: selection.entry.description,
                      }
                    }
                    placeholder="Create an entry description..."
                    noOptionsMessage={() =>
                      "Type to create an entry description..."
                    }
                    menuPlacement="auto"
                    classNames={{
                      control: (state) =>
                        state.isFocused
                          ? "ring-1 ring-brand-muted border border-brand-muted"
                          : "",
                      option: (state) =>
                        state.isSelected
                          ? "bg-brand-muted"
                          : state.isFocused
                          ? "bg-brand-muted-super"
                          : "",
                    }}
                    className="w-[300px]"
                  />
                  <div
                    className={`w-fit rounded px-2 py-1 ${
                      selection.entry.ratio >= 0.8
                        ? "bg-brand-muted-extra"
                        : selection.entry.ratio >= 0.35
                        ? "bg-brand-muted-yellow"
                        : "bg-brand-muted-red-lighter"
                    }`}
                  >
                    <p>
                      {parseFloat((selection.entry.ratio * 100).toFixed(2))}%
                    </p>
                  </div>
                </>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor("amount", {
        header: "AMOUNT",
        cell: (info) => {
          return (
            <span className="tracking-wider">
              {toAmountString(info.getValue())}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        cell: (info) => (
          <Menu
            arrow
            transition
            position="auto"
            viewScroll="auto"
            menuButton={
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-mono-150 bg-mono-25 hover:cursor-pointer hover:bg-mono-100">
                <MoreVertical size={15} />
              </div>
            }
            className="[&>ul]:rounded-md [&>ul]:bg-mono-25 [&>ul]:py-1 [&>ul]:text-black [&>ul>li]:m-1 [&>ul>li]:px-2 [&>ul>li.red]:text-red-500 [&>ul>div]:bg-mono-25"
          >
            <MenuItem onClick={() => editTransaction(info.row.index)}>
              <Edit3 size={20} className="mr-2" />
              Edit Amount
            </MenuItem>
            <MenuDivider />
            <MenuItem
              onClick={() => removeTransaction(info.row.index)}
              className={"red"}
            >
              <Trash2 size={20} className="mr-2" />
              Remove
            </MenuItem>
          </Menu>
        ),
      }),
    ],
    [transactionType, displayShortenedDescriptions]
  );

  // TODO: virtualize this table, or add pagination
  const table = useReactTable({
    data:
      transactionType == "withdrawals"
        ? coder.results.transactions.withdrawals
        : transactionType == "deposits"
        ? coder.results.transactions.deposits
        : ([] as LevenshteinTransaction[]),
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!coder)
    return (
      <h1>
        <span className="text-mono-300">No coder selected.</span>
      </h1>
    );

  return (
    <div className="w-full p-2">
      {/* Edit Transaction Modal */}
      {showEditTransactionModal && curEditTransaction && (
        <>
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden outline-none focus:outline-none">
            <div className="relative my-6 mx-auto w-auto max-w-3xl">
              {/* content */}
              <div className="relative flex w-full flex-col rounded-lg border-0 bg-white shadow-lg outline-none focus:outline-none">
                {/* header */}
                <div className="flex items-start justify-between rounded-t border-b border-solid border-slate-200 p-4 pb-2">
                  <h3 className="text-xl font-semibold">Edit Transaction</h3>
                  <button
                    onClick={() => {
                      setCurEditTransaction(undefined);
                      setShowEditTransactionModal(false);
                    }}
                    className="float-right ml-8 w-fit border-0 bg-transparent p-1 text-3xl font-semibold leading-none text-black opacity-50 outline-none hover:opacity-70 focus:outline-none"
                  >
                    <span className="block h-6 w-6 bg-transparent text-2xl text-black outline-none focus:outline-none">
                      <X className="text-black" />
                    </span>
                  </button>
                </div>
                {/* body */}
                <div className="relative flex-auto p-6">
                  <p className="pb-2 text-xs tracking-wider">AMOUNT</p>
                  <input
                    onChange={(e) => {
                      let value = e.target.value;
                      if (value == "-") value = "-0.00";
                      if ((e.nativeEvent as any).data == "-")
                        value = `-${Math.abs(curEditTransaction.amount)}`;
                      else if ((e.nativeEvent as any).data == "+")
                        value = `${Math.abs(curEditTransaction.amount)}`;

                      // Remove leading zero
                      if (value.startsWith("0") && !value.startsWith("0."))
                        value = value.slice(1);

                      setCurEditTransaction((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          amount: parseFloat(
                            parseFloat(value ?? "0").toFixed(2)
                          ),
                        };
                      });
                    }}
                    value={curEditTransaction.amount}
                    required
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="rounded-[4px] border border-[#cccccc] px-2 py-2 tracking-wider focus:border-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-muted"
                  ></input>
                </div>
                {/* footer */}
                <div className="flex items-center justify-end rounded-b border-t border-solid border-slate-200 p-6">
                  <button
                    onClick={() => {
                      setCurEditTransaction((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          amount: parseFloat(prev.amount.toFixed(2)),
                        };
                      });
                      updateTransaction(
                        curEditTransaction,
                        curEditTransactionIndex
                      );
                      setCurEditTransaction(undefined);
                      setCurEditTransactionIndex(-1);
                      setShowEditTransactionModal(false);
                    }}
                    className="text-md inline-flex items-center rounded-md border border-transparent bg-brand-gold px-4 py-2 font-bold text-white shadow-md hover:bg-brand-gold-hover focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2"
                  >
                    <Save className="mr-2 h-5 w-5" />
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="fixed inset-0 z-40 bg-black opacity-25"></div>
        </>
      )}

      <table className="w-full items-center">
        <thead className="text-left text-xs tracking-wider">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-6 pb-4">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="bg-mono-50 text-sm shadow-lg">
          {table.getRowModel().rows.map((row) => (
            <MemoizedTableRow
              key={
                row.id +
                row.original.selection?.account.index +
                row.original.selection?.entry.index +
                row.original.selection?.account.number +
                row.original.selection?.entry.description +
                row.original.selectionOverride?.enabled +
                row.original.selectionOverride?.entry.enabled +
                row.original.selectionOverride?.account.number +
                row.original.selectionOverride?.entry.description +
                row.original.amount +
                displayShortenedDescriptions
              }
              row={row}
              displayShortenedDescriptions={displayShortenedDescriptions}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableRowComponent({
  row,
  displayShortenedDescriptions, // KEEP ALTHOUGH "UNUSED"... this is used in the memoization
}: {
  row: Row<LevenshteinTransaction>;
  displayShortenedDescriptions: boolean;
}) {
  // console.log("rendering row", row.index);
  return (
    <tr className="border border-mono-150">
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-6 py-4">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}

const MemoizedTableRow = memo(TableRowComponent, (prev, next) => {
  return (
    // selection
    prev.row.original.selection?.account.index ==
      next.row.original.selection?.account.index &&
    prev.row.original.selection?.entry.index ==
      next.row.original.selection?.entry.index &&
    prev.row.original.selection?.account.number ==
      next.row.original.selection?.account.number &&
    prev.row.original.selection?.entry.description ==
      next.row.original.selection?.entry.description &&
    // selectionOverride
    prev.row.original.selectionOverride?.enabled ==
      next.row.original.selectionOverride?.enabled &&
    prev.row.original.selectionOverride?.entry.enabled ==
      next.row.original.selectionOverride?.entry.enabled &&
    prev.row.original.selectionOverride?.account.number ==
      next.row.original.selectionOverride?.account.number &&
    prev.row.original.selectionOverride?.entry.description ==
      next.row.original.selectionOverride?.entry.description &&
    // amount
    prev.row.original.amount == next.row.original.amount &&
    // displayShortenedDescriptions
    prev.displayShortenedDescriptions == next.displayShortenedDescriptions
  );
});

function toAmountString(amount: number) {
  // Round the number to 2 decimal places and add commas as thousands separators
  const amountStr = amount.toLocaleString("en-US", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Add parentheses if the number is negative
  return amount < 0 ? "(" + amountStr.replace("-", "") + ")" : amountStr;
}

function getTextWidth(text: string, className = "text-sm") {
  // Create a dummy span element
  const span = document.createElement("span");

  // Set the class name of the span element
  span.className = className;

  // Set the text to the span element
  span.innerHTML = text;

  // Add the span element to the document
  document.body.appendChild(span);

  // Get the computed styles of the span element
  // const styles = getComputedStyle(span);

  // Get the width of the span element
  const width = span.offsetWidth;

  // Remove the span element from the document
  document.body.removeChild(span);

  // Return the width
  return width;
}
