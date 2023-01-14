import fs from "fs";
import os from "os";
import { decrypt } from "node-qpdf2";
import { PDFDocument } from "pdf-lib";
import {
  DocumentProcessorServiceClient,
  protos as GoogleProtos,
} from "@google-cloud/documentai";
import GoogleDocument = GoogleProtos.google.cloud.documentai.v1.Document;
import xlsx from "node-xlsx";

import { prisma } from "@/server/db/client";
import type { Coordinates, TextShard } from "@/types/ocr";
import { getTextShardsAsLines } from "@/utils/ocr";
import { BankStatement } from "./BankStatement";
import { GeneralLedger } from "./GeneralLedger";
import { workerData } from "worker_threads";

const NUM_PAGES_PER_SPLIT = 10;
const projectId = "176698041005";
const location = "us";
const processorId = "143545f85669a6ef";
const processorURL = `projects/${projectId}/locations/${location}/processors/${processorId}`;
const client = new DocumentProcessorServiceClient();

type Props = {
  hash: string;
  userId: string;
};

export async function parse({
  hash,
  userId,
}: Props): Promise<BankStatement | GeneralLedger | undefined> {
  // Get the PDF file from the database
  const file = await prisma.file.findFirst({
    where: {
      userId,
      hash,
    },
  });
  if (!file) return;

  const fileContents = file.contents.split("base64,")[1];
  if (!fileContents) return;

  console.log("Parsing file... (" + file.name + ")");
  if (!file.name.endsWith(".pdf")) {
    if (file.name.endsWith(".csv")) {
      return;
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      // Read the fileContents as a buffer
      const fileBytes = Buffer.from(fileContents, "base64");

      // Parse the buffer as a workbook
      const workSheetsFromBuffer = xlsx.parse(fileBytes, {
        // header: 1,
      });

      // TODO: get the header which includes the period and company name...

      // Get the first worksheet that is not the name "QuickBooks Export Tips"
      const workSheet = workSheetsFromBuffer.find(
        (workSheet) => workSheet.name !== "QuickBooks Export Tips"
      );
      if (!workSheet) return;

      // // Get the header
      // console.log(workSheet.data);

      // Attempt to parse the Excel file as a General Ledger
      const generalLedger = new GeneralLedger(undefined, workSheet);
      if (generalLedger.accounts.length > 0) return generalLedger;

      return;
    }

    console.log("File is not a PDF, CSV, XLSX, or XLS");
    return;
  }

  // Split the PDF into multiple documents, because the Document AI processor can only process PDFs with a maximum of 10 pages
  const splitPDFs = await splitBase64PDF(fileContents);

  // Look in the OCR Result cache and pull the text shards from there if they exist
  const cachedOCRResult = await prisma.oCRResult.findFirst({
    where: {
      userId,
      hash,
    },
  });
  if (cachedOCRResult)
    return parseTextShards(cachedOCRResult.textShards as TextShard[][]);

  // Upload the PDF document(s) to the Document AI processor
  const requests = splitPDFs.map((splitPDF) => {
    const request = {
      name: processorURL,
      rawDocument: {
        content: splitPDF,
        mimeType: "application/pdf",
      },
    };
    return client.processDocument(request);
  });

  // Use Promise.all() to speed up the processing whenever there are multiple split PDFs
  const results = await Promise.all(requests);

  // Process each split PDF document and get the text shards, storing them in an array representing each page
  const textShards = [] as TextShard[][];
  results.forEach((result) => {
    const { document } = result[0];
    if (!document) return;

    // Get all of the document text as one big string
    const { text, pages } = document;
    if (!text || !pages) return;

    // Get the text shards from the document
    pages.forEach((page, i) => {
      const { lines } = page;
      if (!lines) return;

      const unsortedTextShards = [] as TextShard[];
      for (const line of lines) {
        const textShard = getTextShard(text, line, i);
        if (textShard) unsortedTextShards.push(textShard);
      }

      // Sort the text shards into their visual order
      const sortedTextShards = sortTextShards(unsortedTextShards);
      textShards.push(sortedTextShards);
    });
  });

  // Store the text shards in the OCR cache
  await prisma.oCRResult.create({
    data: {
      userId,
      hash,
      textShards,
    },
  });

  return parseTextShards(textShards);
}

// Parse the text shards into a bank statement or general ledger
function parseTextShards(
  textShards: TextShard[][]
): BankStatement | GeneralLedger | undefined {
  // Check whether the document is a bank statement or general ledger
  const bankStatement = new BankStatement(textShards);
  if (bankStatement.bank) return bankStatement;

  const generalLedger = new GeneralLedger(textShards);
  if (generalLedger.company) return generalLedger;
}

// Sort the text shards into their visual order
function sortTextShards(textShards: TextShard[]): TextShard[] {
  // Sort by Y coordinate first
  const sortedByY = textShards.sort(
    (a, b) =>
      a.boundingPoly.normalizedVertices.bottomLeft.y -
      b.boundingPoly.normalizedVertices.bottomLeft.y
  );

  // Then for each Y coordinate that is no different than 0.01, sort by X coordinate
  // Note: 0.01 is an arbitrary number that I chose to use as a threshold, so it may need to be adjusted in the future
  return sortedByY.sort((a, b) =>
    a.boundingPoly.normalizedVertices.bottomLeft.y -
      b.boundingPoly.normalizedVertices.bottomLeft.y <=
    0.01
      ? a.boundingPoly.normalizedVertices.bottomLeft.x -
        b.boundingPoly.normalizedVertices.bottomLeft.x
      : 0
  );
}

// Extract shards from the text field
function getTextShard(
  text: string,
  textEntity:
    | GoogleDocument.Page.IBlock
    | GoogleDocument.Page.IParagraph
    | GoogleDocument.Page.ILine
    | GoogleDocument.Page.IToken,
  page: number
): TextShard | undefined {
  // Ensure type safety
  const textAnchor = textEntity.layout?.textAnchor;
  if (
    !textAnchor ||
    !textAnchor.textSegments ||
    textAnchor.textSegments.length === 0 ||
    !textAnchor.textSegments[0] ||
    !textEntity.layout ||
    !textEntity.layout.boundingPoly ||
    !textEntity.layout.boundingPoly.vertices ||
    !textEntity.layout.boundingPoly.normalizedVertices
  )
    return;

  // Note: The first shard in the document doesn't have the startIndex property
  const startIndex = (textAnchor.textSegments[0].startIndex || 0) as number;
  const endIndex = textAnchor.textSegments[0].endIndex as number;

  const shardText = text.substring(startIndex, endIndex);

  return {
    text: shardText,
    page: page,
    indices: {
      start: startIndex,
      end: endIndex,
    },
    boundingPoly: {
      vertices: {
        topLeft: textEntity.layout.boundingPoly.vertices[3] as Coordinates,
        topRight: textEntity.layout.boundingPoly.vertices[2] as Coordinates,
        bottomLeft: textEntity.layout.boundingPoly.vertices[0] as Coordinates,
        bottomRight: textEntity.layout.boundingPoly.vertices[1] as Coordinates,
      },
      normalizedVertices: {
        topLeft: textEntity.layout.boundingPoly
          .normalizedVertices[3] as Coordinates,
        topRight: textEntity.layout.boundingPoly
          .normalizedVertices[2] as Coordinates,
        bottomLeft: textEntity.layout.boundingPoly
          .normalizedVertices[0] as Coordinates,
        bottomRight: textEntity.layout.boundingPoly
          .normalizedVertices[1] as Coordinates,
      },
    },
  };
}

async function splitBase64PDF(fileContents: string): Promise<string[]> {
  // Decode the base64 file contents to a Uint8Array
  const pdfBytes = Buffer.from(fileContents, "base64");

  // Load the PDF document
  let pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
  });

  // Remove encryption if it exists
  if (pdfDoc.isEncrypted) {
    const decryptedPdfBytes = await decryptPdfBytes(pdfBytes);
    pdfDoc = await PDFDocument.load(decryptedPdfBytes);
  }

  // Get the total number of pages in the PDF
  const numPages = pdfDoc.getPageCount();

  // Initialize an array to store the split PDF documents
  const splitPDFDocs = [] as PDFDocument[];

  // Split the PDF into multiple documents, each containing `NUM_PAGES_PER_SPLIT` pages
  for (let i = 0; i < numPages; i += NUM_PAGES_PER_SPLIT) {
    // Create a new PDF document
    const splitPDFDoc = await PDFDocument.create();

    // Get the indices of the pages to be copied
    const pageIndices = [];
    for (let j = 0; j < NUM_PAGES_PER_SPLIT; j++) {
      const pageIndex = i + j;
      if (pageIndex < numPages) {
        pageIndices.push(pageIndex);
      }
    }

    // Copy the pages from the original PDF to the new document
    const copiedPages = await splitPDFDoc.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach((page) => {
      splitPDFDoc.addPage(page);
    });

    // Add the new document to the array
    splitPDFDocs.push(splitPDFDoc);
  }

  // Return the array of split PDF documents
  // return splitPDFDocs;

  // Return the array of split PDF documents' base64-encoded contents
  const base64SplitPDFDocs = [] as string[];
  for (const doc of splitPDFDocs)
    base64SplitPDFDocs.push(await doc.saveAsBase64());
  return base64SplitPDFDocs;
}

async function decryptPdfBytes(input: Buffer): Promise<Buffer> {
  // Get the path to the operating system's temporary directory
  const tempDir = os.tmpdir();

  // Create the full path to the temporary input file
  const tempInputFile = `${tempDir}/encrypted-input.pdf`;

  // Write the input pdf buffer to the temporary input file
  fs.writeFileSync(tempInputFile, input);

  // Create the full path to the temporary output file
  const tempOutputFile = `${tempDir}/decrypted-output.pdf`;

  // Decrypt the pdf file and store the result in the temporary output file
  await decrypt({
    input: tempInputFile,
    output: tempOutputFile,
  });

  // Read the contents of the decrypted file into a buffer
  const decryptedContents = fs.readFileSync(tempOutputFile);

  // Delete the temporary files
  fs.unlinkSync(tempInputFile);
  fs.unlinkSync(tempOutputFile);

  // Return the decrypted file's contents buffer
  return decryptedContents;
}
