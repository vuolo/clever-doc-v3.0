import {
  type CSSProperties,
  useCallback,
  useMemo,
  useState,
  useEffect,
} from "react";
import { useSession } from "next-auth/react";
import { type FileRejection, useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import {
  FilePlus2,
  FileX2,
  Link,
  Link2,
  Loader2,
  Unlink2,
  Wand2,
} from "lucide-react";

// PLAID INTEGRATION START
import { usePlaidLink } from "react-plaid-link";
// PLAID INTEGRATION END

import FileTable from "@/components/tools/bsca/file-table";
import type { StoredFile } from "@/types/misc";
import * as fileHandler from "@/utils/file-handler";
import { trpc } from "@/utils/trpc";

const focusedStyle: CSSProperties = {
  borderColor: "#2196f3",
  backgroundColor: "rgba(32, 148, 243, 0.05)",
  borderStyle: "solid",
  borderWidth: 2,
};

const acceptStyle: CSSProperties = {
  borderColor: "#38a169",
  backgroundColor: "rgba(56, 161, 105, .05)",
  borderStyle: "solid",
  borderWidth: 2,
};

const rejectStyle: CSSProperties = {
  borderColor: "#ff1744",
  backgroundColor: "rgba(255, 23, 68, .05)",
  borderStyle: "solid",
  borderWidth: 2,
};

type Props = {
  codeTransactions: (storedFiles: StoredFile[]) => void;
};

export default function FileDropzone({ codeTransactions }: Props): JSX.Element {
  // PLAID INTEGRATION START
  const [refetchPlaid, setRefetchPlaid] = useState([false]);
  const [plaidLinked, setPlaidLinked] = useState(false);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const createLinkToken = async () => {
      const response = await fetch("/api/plaid/create-link-token", {
        method: "POST",
      });
      const { link_token } = await response.json();
      setToken(link_token);
    };
    createLinkToken();
  }, []);

  const onPlaidSuccess = useCallback(async (publicToken: string) => {
    await fetch("/api/plaid/exchange-public-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ public_token: publicToken }),
    });

    // Router.push('/dash');
    console.log("SUCCESSFULLY LINKED PLAID ACCOUNT!");
    setRefetchPlaid([true]);
    setPlaidLinked(true);
  }, []);

  const { open, ready } = usePlaidLink({
    token,
    onSuccess: onPlaidSuccess,
  });

  const unlinkPlaid = async () => {
    await fetch("/api/plaid/unlink", {
      method: "GET",
    });
    setRefetchPlaid([false]);
    getPlaidTransactions();
    window.location.reload();
  };

  const getPlaidTransactions = async () => {
    const response = await fetch("/api/plaid/get-transactions", {
      method: "GET",
    });
    if (response.status == 500) {
      getPlaidTransactions();
      // We reload here because of our jank cookie system
      window.location.reload();
      return;
    }
    const { transactions } = await response.json();

    setPlaidLinked(true);
    setPlaidTransactions(transactions);
  };

  const [plaidTransactions, setPlaidTransactions] = useState();
  useEffect(() => {
    getPlaidTransactions();
  }, refetchPlaid);

  // PLAID INTEGRATION END

  const { data: sessionData } = useSession();
  const [files, setFiles] = useState<File[]>([]);
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  const [isCoding, setIsCoding] = useState(false);

  const uploadFile = trpc.file.upload.useMutation({
    onSuccess() {
      toast.success("File uploaded successfully");
    },
    onError(error) {
      toast.error("Failed to upload file");
      console.error(error);
    },
  });

  const parseFile = trpc.bsca.parse.useMutation({
    onSuccess() {
      toast.success("File parsed successfully");
    },
    onError(error) {
      if (error.message.includes("request timed out"))
        toast.error("Request to parse file timed out");
      else if (error.message.includes("Too Many Requests"))
        toast.error(
          "Too many requests to parse file, please try again in a few minutes"
        );
      console.error(error);
    },
  });

  useEffect(() => {
    const newStoredFiles = files.map(
      (file) =>
        ({
          name: file.name,
          structure: "Unknown",
          url: "api/uploads/unknown-user/unknown",
          size: file.size,
          hash: `uuid-${fileHandler.hash_uuid()}`,
          file: file,
          blob: undefined,
        } as StoredFile)
    );

    // Read file(s) contents and hash them
    newStoredFiles.forEach(async (newStoredFile) => {
      const blob = await fileHandler.read(newStoredFile.file);
      const contents = (await fileHandler.blobToBase64(blob)) as string;
      const hash = await fileHandler.hash(contents);
      newStoredFile.hash = hash;
      newStoredFile.blob = blob;

      // Store unique files only
      setStoredFiles((prev) => [
        ...new Map([...prev, newStoredFile].map((f) => [f.hash, f])).values(),
      ]);

      // Upload new file to the database
      newStoredFile.uploading = true;
      const input = {
        userId: sessionData?.user?.id ?? "Unknown",
        name: newStoredFile.name,
        type: "application/pdf",
        size: newStoredFile.size,
        hash: hash,
        contents: contents.replace(
          "application/octet-stream",
          "application/pdf"
        ),
      };

      try {
        await uploadFile.mutateAsync(input);
      } catch (cause) {
        newStoredFile.uploading = false;
        setStoredFiles((prev) => [
          ...new Map([...prev, newStoredFile].map((f) => [f.hash, f])).values(),
        ]);

        return console.error({ cause }, "Failed to upload file");
      }

      const url = `${window.location.protocol}//${
        window.location.host
      }/api/uploads/${sessionData?.user?.id ?? "unknown-user"}/${hash}`;
      newStoredFile.url = url;
      newStoredFile.uploading = false;

      // Updated stored file
      setStoredFiles((prev) => [
        ...new Map([...prev, newStoredFile].map((f) => [f.hash, f])).values(),
      ]);

      newStoredFile.parsing = true;

      // Parse the file with adobe sdk
      const extractedStructure = await parseFile
        .mutateAsync({ url, hash, userId: sessionData?.user?.id ?? "" })
        .catch(() => {
          newStoredFile.parsing = false;
          setStoredFiles((prev) => [
            ...new Map(
              [...prev, newStoredFile].map((f) => [f.hash, f])
            ).values(),
          ]);
          return;
        });

      newStoredFile.parsing = false;

      if (!extractedStructure) {
        toast.error("Failed to parse file");
        setStoredFiles((prev) => [
          ...new Map([...prev, newStoredFile].map((f) => [f.hash, f])).values(),
        ]);
        return;
      }

      console.log(extractedStructure);

      // Assign the detected visual structure to the file
      if (extractedStructure.class === "BankStatement")
        newStoredFile.structure = `Bank Statement (${extractedStructure.bank})`;
      else if (extractedStructure.class === "GeneralLedger")
        newStoredFile.structure = `General Ledger (${extractedStructure.company.name})`;

      newStoredFile.extractedStructure = extractedStructure;
      extractedStructure.file = newStoredFile;

      // Updated stored file
      setStoredFiles((prev) => [
        ...new Map([...prev, newStoredFile].map((f) => [f.hash, f])).values(),
      ]);
    });
  }, [files]);

  function removeStoredFilesByHash(hash: string) {
    setStoredFiles((prev) => prev.filter((file) => file.hash != hash));
  }

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (acceptedFiles.length > 0) setFiles(acceptedFiles);

      fileRejections.forEach((file) => {
        file.errors.forEach((err) => {
          if (err.code === "file-too-large")
            toast.error("File too large. 10MB maximum.");
          else if (err.code === "file-invalid-type")
            toast.error("Invalid file type. PDF and Excel files only.");
          else if (err.code === "too-many-files")
            toast.error(
              "Too many files. Please upload maximum 20 files at once."
            );
          else toast.error(err.message);
        });
      });
    },
    []
  );

  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } =
    useDropzone({
      accept: {
        "application/pdf": [".pdf"],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
          ".xlsx",
        ],
        "application/vnd.ms-excel": [".xls"],
        "text/csv": [".csv"],
      },
      multiple: true,
      minSize: 0,
      maxSize: 10485760, // 10MB
      maxFiles: 20,
      onDrop,
    });

  const style: CSSProperties = useMemo(
    () => ({
      ...(isFocused && files.length == 0 ? focusedStyle : {}),
      ...(isDragAccept ? acceptStyle : {}),
      ...(isDragReject ? rejectStyle : {}),
    }),
    [files.length, isFocused, isDragAccept, isDragReject]
  );

  return (
    <>
      {storedFiles.length == 0 ? (
        <div
          {...getRootProps({ style })}
          className="flex items-center justify-center space-x-6 rounded-md border-2 border-brand-slate px-12 py-10 shadow-lg transition-colors"
        >
          <input {...getInputProps()} />
          <FileX2 size={120} color="#bababa" />
          <div>
            <h1 className="text-xl font-bold">No uploaded documents</h1>
            <p className="text-lg">
              Documents that you upload will appear here.
            </p>
            <button className="text-md mt-2 inline-flex items-center rounded-md border border-transparent bg-brand px-6 py-2 font-bold text-white shadow-md hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2">
              <FilePlus2 size={20} className="mr-2" />
              Upload file(s)
            </button>
          </div>
        </div>
      ) : (
        <div
          {...getRootProps({
            style,
            onClick: (e) => {
              if (e.target instanceof HTMLButtonElement === false)
                e.stopPropagation();
            },
          })}
          className="flex w-[80%] flex-col items-center justify-center rounded-md p-4"
        >
          <input {...getInputProps()} />
          <FileTable
            storedFiles={storedFiles}
            removeStoredFilesByHash={removeStoredFilesByHash}
          />
          <div className="flex w-full items-start justify-center space-x-4">
            <button className="text-md mt-4 inline-flex items-center rounded-md border border-transparent bg-brand px-6 py-2 font-bold text-white shadow-md hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2">
              <FilePlus2 size={20} className="mr-2" />
              Upload more files
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                setIsCoding(true);
                await sleep(1);
                await codeTransactions(storedFiles);
                setIsCoding(false);
              }}
              disabled={
                isCoding ||
                storedFiles.some((file) => {
                  if (
                    file.uploading ||
                    file.parsing ||
                    file.structure == "Unknown"
                  )
                    return true;

                  // If there is a plaid account linked, we don't need to check for the Bank Statement... for now during experimental stage
                  if (
                    storedFiles.filter((f) =>
                      f.structure.startsWith("General Ledger")
                    ).length == 1 &&
                    plaidTransactions
                  )
                    return false;

                  // Check if there is only one file with a structure starting with "General Ledger" and at least on "Bank Statement"
                  return (
                    storedFiles.filter((f) =>
                      f.structure.startsWith("General Ledger")
                    ).length != 1 ||
                    storedFiles.filter((f) =>
                      f.structure.startsWith("Bank Statement")
                    ).length == 0
                  );
                })
              }
              className="text-md mt-4 inline-flex items-center rounded-md border border-transparent bg-brand-gold px-6 py-2 font-bold text-white shadow-md hover:bg-brand-gold-hover focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-mono-200"
            >
              {storedFiles.some((file) => file.uploading || file.parsing) ? (
                <Wand2 size={20} className="mr-2 mt-1 animate-bounce" />
              ) : isCoding ? (
                <Wand2 size={20} className="mr-2 mt-1 animate-spin" />
              ) : (
                // <ListVideo size={20} className="mr-2" />
                // <ScanLine size={20} className="mr-2" />
                // <Cpu size={20} className="mr-2" />
                <Wand2 size={20} className="mr-2" />
              )}
              {isCoding ? "Coding Transactions..." : "Code Transactions"}
            </button>
          </div>
        </div>
      )}

      {/* Experimental feature: Plaid integration START */}
      <br />
      <div className="container flex w-auto flex-col items-center justify-center rounded-md border-2 bg-mono-50 px-8 py-6">
        {plaidTransactions || plaidLinked ? (
          <>
            <h3 className="text-lg font-extrabold">
              Your bank is currently linked with Plaid.
            </h3>
            <p className="text-md text-center"></p>
            <br />
            {plaidTransactions && plaidLinked ? (
              <>
                <button
                  onClick={() => unlinkPlaid()}
                  disabled={!ready}
                  className="relative inline-flex cursor-pointer items-center rounded-md border border-transparent bg-red-600 px-6 py-2 text-sm font-medium text-white shadow-md hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2"
                >
                  <Unlink2 size={20} className="mr-2" />
                  <span>Unlink Account</span>
                </button>
                {/* Test Only: Raw data view */}
                {/* <br />
                <code>{JSON.stringify(plaidTransactions, null, 2)}</code> */}
              </>
            ) : (
              <>
                <div className="mb-2 flex space-x-2">
                  <Loader2 className="animate-spin" />
                  <p>Loading...</p>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <h3 className="text-lg font-extrabold">Want to try out Plaid?</h3>
            <p className="text-md text-center">
              Plaid is a third-party service that allows you to connect your
              bank account to our application. This is a{" "}
              <span className="font-bold">beta</span> feature, so please be
              patient with us as we work out the kinks.
            </p>
            <br />
            <button
              onClick={() => open()}
              disabled={!ready}
              className="relative inline-flex cursor-pointer items-center rounded-md border border-transparent bg-mono-500 px-6 py-2 text-sm font-medium text-white shadow-md hover:bg-mono-400 focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2"
            >
              <Link2 size={20} className="mr-2" />
              <span>Link Account</span>
            </button>
          </>
        )}
      </div>
      {/* Experimental feature: Plaid integration END */}
    </>
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
