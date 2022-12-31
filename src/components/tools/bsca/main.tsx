import { useState } from "react";
import ProgressBar from "@ramonak/react-progress-bar";

import CoderResults from "@/components/tools/bsca/coder-results";
import FileDropzone from "@/components/tools/bsca/file-dropzone";
import FileSidebar from "@/components/tools/bsca/file-sidebar";
import type { StoredFile } from "@/types/misc";
import { Coder } from "@/utils/tools/bsca/Coder";
import type { BankStatement } from "@/utils/tools/bsca/BankStatement";
import type { GeneralLedger } from "@/utils/tools/bsca/GeneralLedger";

export default function Main(): JSX.Element {
  const [codeProgress, setCodeProgress] = useState(0);
  const [isCoding, setIsCoding] = useState(false);
  const [coders, setCoders] = useState<Coder[]>([]);

  async function codeTransactions(storedFiles: StoredFile[]) {
    setCodeProgress(0);
    setIsCoding(true);

    await sleep(300);

    const generalLedgerFile = storedFiles.find(
      (storedFile) => storedFile?.extractedStructure?.class === "GeneralLedger"
    );

    const bankStatementFiles = storedFiles.filter(
      (storedFile) => storedFile?.extractedStructure?.class === "BankStatement"
    );

    if (!generalLedgerFile) throw new Error("No general ledger file found");
    if (!bankStatementFiles.length)
      throw new Error("No bank statement files found");

    for (let i = 0; i < bankStatementFiles.length; i++) {
      const bankStatementFile = bankStatementFiles[i];
      const coder = new Coder(
        bankStatementFile?.extractedStructure as BankStatement,
        generalLedgerFile.extractedStructure as GeneralLedger
      );

      // Visualize the coding process
      const progress = Math.round(((i + 1) / bankStatementFiles.length) * 100);
      setCodeProgress(progress);
      await sleep(1);

      // Push the resultant coder to the coders array
      setCoders((coders) => [...coders, coder]);

      console.log(progress + "%");
      console.log(coder);
    }

    await sleep(1000);
    setCodeProgress(0);
    setIsCoding(false);
  }

  return (
    <>
      {/* <FileSidebar /> */}
      <section className="flex h-full w-full flex-col items-center space-y-2 overflow-auto p-3">
        {coders.length == 0 ? (
          <>
            <h3 className="text-xl font-extrabold">Let&apos;s get started</h3>
            <p className="text-lg">
              Please upload your general ledger and corresponding bank
              statements
            </p>
            <hr className="h-4" />
            <FileDropzone codeTransactions={codeTransactions} />
          </>
        ) : // <CoderResults coders={coders} setCoders={setCoders} />
        null}
        {isCoding && (
          <ProgressBar
            className="absolute bottom-0 m-2 w-full"
            completed={codeProgress}
            transitionDuration="0.5s"
            borderRadius="0"
            bgColor="#005f4b"
            isLabelVisible={false}
          />
        )}
      </section>
    </>
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
