import { useMemo } from "react";
import { Menu, MenuItem, MenuDivider } from "@szhsin/react-menu";
import "@szhsin/react-menu/dist/index.css";
import "@szhsin/react-menu/dist/transitions/slide.css";
import {
  type ColumnDef,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  FileLock2,
  FileSpreadsheet,
  FileText,
  Loader2,
  MoreVertical,
  Redo,
  Trash2,
  View,
} from "lucide-react";
import Link from "next/link";

import type { StoredFile } from "@/types/misc";

type Props = {
  storedFiles: StoredFile[];
  removeStoredFilesByHash: (hash: string) => void;
};

export default function FileTable({
  storedFiles,
  removeStoredFilesByHash,
}: Props) {
  // Yes, I know: "any"?! Normally I would use StoredFile, but I'm getting a type error that is too deep to fix.
  const columnHelper = createColumnHelper<any>();
  const columns = useMemo<ColumnDef<any, any>[]>(
    () => [
      columnHelper.accessor("name", {
        header: "NAME",
        cell: (info) => (
          <div className="flex space-x-2">
            {info.row.original.structure.startsWith("Bank Statement") ? (
              <FileLock2 size={20} />
            ) : info.row.original.structure.startsWith("General Ledger") ? (
              <FileSpreadsheet size={20} />
            ) : (
              <FileText size={20} />
            )}
            {/* TODO: possibly make this PDF view page show all details it gathered */}
            <Link
              href={info.row.original.url}
              target="_blank"
              className="font-semibold hover:cursor-pointer hover:underline"
            >
              {/* TODO: figure out why below line says "Type instantiation is excessively deep and possibly infinite" */}
              {info.getValue()}
            </Link>
          </div>
        ),
      }),
      columnHelper.accessor("structure", {
        header: "STRUCTURE",
        cell: (info) => (
          <div className="flex space-x-2">
            {/* TODO: add maybe a red X icon and/or red text whenever the structure is "Unknown" */}
            {!info.row.original.uploading && !info.row.original.parsing ? (
              <span>{info.getValue()}</span>
            ) : info.row.original.uploading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Parsing...</span>
              </>
            )}
          </div>
        ),
      }),
      columnHelper.accessor("size", {
        header: "SIZE",
        cell: (info) => {
          const kb = Math.round(info.getValue() / 1024);
          if (kb >= 1024) return `${(kb / 1024).toFixed(2)} MB`;
          return `${kb} KB`;
        },
      }),
      columnHelper.display({
        id: "actions",
        cell: (info) => (
          <>
            {!info.row.original.uploading ? (
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
                <MenuItem onClick={() => window.open(info.row.original.url)}>
                  <View size={20} className="mr-2" />
                  View
                </MenuItem>
                {info.row.original.structure == "Unknown" &&
                  !info.row.original.uploading &&
                  !info.row.original.parsing && (
                    <MenuItem
                      disabled
                      onClick={() => {
                        /* TODO */
                      }}
                    >
                      <Redo size={20} className="mr-2" />
                      Reparse
                    </MenuItem>
                  )}
                <MenuDivider />
                <MenuItem
                  onClick={() =>
                    removeStoredFilesByHash(info.row.original.hash)
                  }
                  className={"red"}
                >
                  <Trash2 size={20} className="mr-2" />
                  Remove
                </MenuItem>
              </Menu>
            ) : (
              <Loader2 size={20} className="animate-spin" />
            )}
          </>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: storedFiles,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="w-full p-2">
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
            <tr key={row.id} className="border border-mono-150">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-6 py-4">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
