import moment from "moment";

import type {
  Company,
  GeneralLedgerAccount,
  GeneralLedgerEntry,
  OCR,
  Period,
  StructuredData,
  StructuredDataLines,
} from "@/types/tools/bsca";

const PERIOD_REGEX = /(\w+ \d{1,2}, \d{4}) ?- ?(\w+ \d{1,2}, \d{4})/;

export function isGLFormat({ tables, textStructuredData }: OCR): boolean {
  for (const table of tables) {
    const firstRow = table[0];
    if (!firstRow) return false;

    for (const cell of firstRow)
      if (cell.includes("General Ledger")) return true;
  }

  return getGLTextLine(textStructuredData).includes("General Ledger");
}

function getGLTextLine(textStructuredData: StructuredData): string {
  // Check if it is the first 5 Text attributes from each page
  let curPageNumTextElementsRead = 0,
    lastPageNum = 0;
  for (const element of textStructuredData.elements) {
    if (element.Text !== undefined) curPageNumTextElementsRead++;
    if (element.Page !== lastPageNum) {
      lastPageNum = element.Page;
      curPageNumTextElementsRead = 0;
    }
    if (curPageNumTextElementsRead > 5) continue;

    if (element.Text?.includes("General Ledger")) return element.Text;
  }
  return "";
}

export function parseCompany({ textStructuredData }: OCR): Company {
  const glLine = getGLTextLine(textStructuredData);
  if (glLine.includes("General Ledger")) {
    const glLineSplit = glLine.split("General Ledger");
    if (glLineSplit[0]) return { name: glLineSplit[0].trim() };
  }
  return { name: "Unknown" };
}

export function parsePeriod({ textStructuredData }: OCR): Period {
  for (const element of textStructuredData.elements)
    if (element.Page > 0) break;
    else if (element.Path == "//Document/Table/TR/TD/P[3]") {
      const match = PERIOD_REGEX.exec(element.Text ?? "");
      if (match) {
        const startDate = match[1];
        const endDate = match[2];

        if (!startDate || !endDate) continue;

        // Parse and reformat the dates
        const formattedStartDate = moment(startDate, "MMMM D, YYYY").format(
          "MM/DD/YYYY"
        );
        const formattedEndDate = moment(endDate, "MMMM D, YYYY").format(
          "MM/DD/YYYY"
        );

        return {
          start: formattedStartDate,
          end: formattedEndDate,
        };
      }
    }

  const glLine = getGLTextLine(textStructuredData);
  if (glLine.includes("General Ledger")) {
    const glLineSplit = glLine.split("General Ledger");
    if (glLineSplit[1]) {
      const match = PERIOD_REGEX.exec(glLineSplit[1]);
      if (match) {
        const startDate = match[1];
        const endDate = match[2];

        if (startDate && endDate) {
          // Parse and reformat the dates
          const formattedStartDate = moment(startDate, "MMMM D, YYYY").format(
            "MM/DD/YYYY"
          );
          const formattedEndDate = moment(endDate, "MMMM D, YYYY").format(
            "MM/DD/YYYY"
          );

          return {
            start: formattedStartDate,
            end: formattedEndDate,
          };
        }
      }
    }
  }

  return {
    start: "Unknown",
    end: "Unknown",
  };
}

export function parseAccountsUsingTablesAndText(
  ocr: OCR
): GeneralLedgerAccount[] {
  const accountsUsingTables = parseAccountsUsingTables(ocr, false),
    accountsUsingText = parseAccountsUsingText(ocr);

  return (
    accountsUsingText
      .concat(accountsUsingTables)
      .reduce((acc: GeneralLedgerAccount[], obj) => {
        // Check if an account with the same number already exists in the accumulated array
        const duplicate = acc.find((a) => a.number === obj.number);
        if (!duplicate) {
          // If no duplicate is found, add the account to the accumulated array
          acc.push(obj);
        }
        return acc;
      }, [])
      // Also sort accounts by account number (again, after combining the two arrays)
      .sort((a, b) => {
        // Attempt to convert the account numbers to Numbers and sort by that
        const aNum = Number(a.number);
        const bNum = Number(b.number);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        // If that fails, then sort by the account numbers as strings
        else return a.number.localeCompare(b.number);
      })
  );
}

// This function is more accurate than parseAccountsUsingTables, but still misses some accounts. But, NEVER will put entries in the wrong accounts (MUCH NEEDED).
export function parseAccountsUsingText({
  textStructuredData,
}: OCR): GeneralLedgerAccount[] {
  const structuredLines = getLinesUsingBounds(textStructuredData);
  let accounts = [] as GeneralLedgerAccount[],
    curEntries = [] as GeneralLedgerEntry[],
    curAccountNumber = "",
    insideTable = false;
  structuredLines.forEach((structuredLine) => {
    structuredLine.lines.forEach((line, i) => {
      if (line.join(" ").includes("Period End Balance")) {
        insideTable = true;

        // Move to inside the table
        return;
      }
      if (!insideTable) return;
      if (!line[0]) return;

      // Check for an {ACCOUNT NUMBER} {ACCOUNT NAME} line
      if (line[0].match(/^\d+\.?\d* .+/)) {
        const accountNumber = line[0].split(" ")[0];
        let accountName = line[0].split(" ").slice(1).join(" ").trim();

        // Remove possible balance at the end of the account name
        accountName = accountName.replace(/ \(?[\d,]+\.\d{2} ?\)?$/, "");

        if (!doesAccountNumberExistInAccounts(accounts, accountNumber))
          accounts = addAccount(accounts, accountName, accountNumber);
        curAccountNumber = accountNumber ?? "Unknown";
      }

      // // Check for an {ACCOUNT NAME} {ACCOUNT NUMBER} line
      // if (line[0]?.match(/^\b\w+\b \d+\.?\d*$/)) {
      //   const accountNumber = line[0].split(" ")[1];
      //   const accountName = (
      //     line[0].split(" ")[0]?.trim() +
      //     " " +
      //     line[1]?.trim() +
      //     " " +
      //     line[2]?.trim()
      //   ).trim();

      //   if (!doesAccountNumberExistInAccounts(accounts, accountNumber))
      //     accounts = addAccount(accounts, accountName, accountNumber);
      //   curAccountNumber = accountNumber ?? "Unknown";
      // }

      // // Check for a {ACCOUNT NUMBER} {ACCOUNT NAME} row that starts with the account number and has the account name in the second cell
      // if (line[0]?.match(/^\d+\.?\d*$/) && line[1]?.match(/^\b\w+\b/)) {
      //   const accountNumber = line[0];
      //   const accountName = line[1];

      //   if (!doesAccountNumberExistInAccounts(accounts, accountNumber))
      //     accounts = addAccount(accounts, accountName, accountNumber);
      //   curAccountNumber = accountNumber ?? "Unknown";
      // }

      // // Check for an {ACCOUNT NUMBER} {ACCOUNT NAME} row that starts with a word followed by " - " and has the account number in the first cell and the account name in the second cell
      // if (line[0]?.match(/^\b\w+\b - \d+\.?\d*$/)) {
      //   const accountNumber = line[0].split(" ")[2];
      //   const accountName =
      //     line[0].split(" ").slice(0, 2).join(" ").trim() +
      //     " " +
      //     line[1]?.trim();

      //   if (!doesAccountNumberExistInAccounts(accounts, accountNumber))
      //     accounts = addAccount(accounts, accountName, accountNumber);
      //   curAccountNumber = accountNumber ?? "Unknown";
      // }

      // Look for entries
      const dateMatch = line[0].match(/^\d{2}\/\d{2}\/\d{2}/);
      if (dateMatch && dateMatch.index !== undefined) {
        const date = line[0].slice(dateMatch.index, dateMatch.index + 8);
        const dateFormatted = moment(date, "MM/DD/YY").format("MM/DD/YYYY");
        let possibleDescriptionCells = line.slice(1);

        // Remove all empty cells
        possibleDescriptionCells = possibleDescriptionCells.filter(
          (cell) => cell !== ""
        );

        // NOTE: a reference can either be a digit of any length or a few specific strings, with a space before it
        const isReferenceInFirstCell = line[0].match(
          /\s(?:[\d.]+|PR|SS|MD|JV|RU)$/
        );
        if (!isReferenceInFirstCell) {
          // Check if the second row is a reference by itself
          if (
            /^(?:[\d.]+|PR|SS|MD|JV|RU)$/.test(
              possibleDescriptionCells[0] ?? ""
            )
          )
            possibleDescriptionCells.shift();
        }

        // Remove possible "Reference" data from the description if they are in the same cell
        const descriptionWithoutReference =
          possibleDescriptionCells[0]?.replace(
            /^(?:[\d.]+|PR|SS|MD|JV|RU) \b/,
            ""
          );

        let description = descriptionWithoutReference ?? "";

        // Check if the description was cut off and is in the next cell
        if (possibleDescriptionCells[1]?.startsWith("&"))
          description += " " + possibleDescriptionCells[1];
        if (possibleDescriptionCells[0]?.endsWith(" TO"))
          description += " " + possibleDescriptionCells[1];

        if (description) {
          const entry = {
            date: dateFormatted,
            description: description,
          };
          curEntries.push(entry);
        }
      }

      // Look for the end of account entries
      let accountNumber = "Unknown";
      if (line[0].startsWith("Totals for ")) {
        accountNumber = line[0].split(" ")[2] ?? "Unknown";
      } else if (line[0] == "Totals") {
        const next3LinesCombined = [
          ...line,
          ...(structuredLine.lines[i + 1] ?? []),
          ...(structuredLine.lines[i + 2] ?? []),
        ].join(" ");
        const match = next3LinesCombined.match(
          /Totals\s+(?:(?!for).)*for (\d+(?:\.\d+)?)/
        );
        if (match) accountNumber = match[1] ?? "Unknown";
        // // ['Totals', 'for 1234']:
        // if (line[1]?.startsWith("for "))
        //   accountNumber = line[1]?.split(" ")[1] ?? "Unknown";
        // // ['Totals', 'for', '1234']:
        // else if (line[1] == "for") accountNumber = line[2] ?? "Unknown";
        // // ['Totals'], ['for 1234']:
        // else if ((structuredLine.lines[i + 1] ?? [])[0]?.startsWith("for "))
        //   accountNumber =
        //     (structuredLine.lines[i + 1] ?? [])[0]?.split(" ")[1] ?? "Unknown";
        // // ['Totals'], ['for', '1234']:
        // else if ((structuredLine.lines[i + 1] ?? [])[0] == "for")
        //   accountNumber = (structuredLine.lines[i + 1] ?? [])[1] ?? "Unknown";
      }
      if (accountNumber != "Unknown") {
        // Only push entries if the totals' account number matches the current account number (meaning the entries we have been collecting are accurate and for this account)
        const account = accounts.find((a) => a.number == accountNumber);
        if (account?.number == curAccountNumber) {
          account.entries.push(...curEntries);
          curAccountNumber = "";
        } else {
          const account = accounts.find((a) => a.number == curAccountNumber);
          if (account) curAccountNumber = accountNumber;
          else {
            accounts.push({
              name: "Unknown",
              number: curAccountNumber,
              entries: [],
            });
          }
        }

        // Clear the current entries. We just found the totals, so time to start a record a new account's entries
        curEntries = [];
      }
    });
  });

  return (
    accounts
      // Remove possible invalid accounts
      .filter(
        (a) =>
          a.number !== "0.00" &&
          a.number !== "Unknown" &&
          a.name !== "Unknown" &&
          !a.name.includes("Net Profit")
      )
      // Also sort accounts by account number
      .sort((a, b) => {
        // Attempt to convert the account numbers to Numbers and sort by that
        const aNum = Number(a.number);
        const bNum = Number(b.number);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        // If that fails, then sort by the account numbers as strings
        else return a.number.localeCompare(b.number);
      })
  );
}

function addAccount(
  accounts: GeneralLedgerAccount[],
  name = "Unknown",
  number = "Unknown",
  entries: GeneralLedgerEntry[] = []
): GeneralLedgerAccount[] {
  accounts.push({
    name,
    number,
    entries,
  });
  return accounts;
}

function getLinesUsingBounds(
  textStructuredData: StructuredData
): StructuredDataLines[] {
  const lines = [] as StructuredDataLines[];
  let curLineArr = [] as string[][],
    curLine = "",
    curPage = 0,
    prevBoundsY = -1,
    curBoundsY = -1;
  textStructuredData.elements.forEach((element) => {
    if (!element.Text || element.Page == undefined || !element.Bounds[3])
      return;
    curBoundsY = Math.floor(element.Bounds[3]);

    // If the current bounds Y is the same as the previous bounds Y, then add the text to the current line
    // NOTE: 1(px) is the threshold for error to detect whether we are on the same line
    if (
      prevBoundsY == -1 ||
      (curBoundsY - prevBoundsY <= 1 && curBoundsY - prevBoundsY >= 0)
    ) {
      curLine += ` <[${element.Text.trim()}]>`;
    } else {
      const splitLine = (curLine.trim().match(/<\[(.*?)\]>/g) ?? []).map((s) =>
        s.slice(2, -2)
      );
      curLineArr.push(splitLine);
      curLine = `<[${element.Text.trim()}]>`;
    }

    prevBoundsY = curBoundsY;

    // If we are on a new page, then push the current lines to the lines array and reset the current lines
    if (element.Page != curPage) {
      // Combine the Totals and Totals for lines (sometimes they are split into 2 lines)
      // curLineArr.forEach((line) => {
      //   line.forEach((str, i) => {
      //     if (
      //       // str.endsWith("-") ||
      //       // str.endsWith("&") ||
      //       str.endsWith("Totals") ||
      //       str.endsWith("Totals for")
      //     ) {
      //       line[i] = `${str} ${line[i + 1]}`;
      //       line.splice(i + 1, 1);
      //     }
      //   });
      // });

      // Push the current lines to the lines array
      lines.push({
        page: curPage,
        lines: curLineArr,
      });
      curLineArr = [];
      curPage = element.Page;
    }
  });
  return lines;
}

// TODO: figure out why 4201 FOOD PURCHASES is not being parsed correctly. It is empty, look @ m_noor-tables.json

// This uses an approach that doesnt use the D,R,J table structure format because it is very fragile and will break if the table format changes.
// TODO: finish... Read rows cell by cell in order. If we encounter a row with a date, we know that the next row will be the description, and continue until we find the "totals". And for totals, make sure to match the account number to the specified "totals for" account number.
export function parseAccountsUsingTables(
  { tables }: OCR,
  recordEntries = true
): GeneralLedgerAccount[] {
  const accounts = [] as GeneralLedgerAccount[];
  let curEntries = [] as GeneralLedgerEntry[];
  let curAccountNumber = "";
  let insideTable = false;
  for (const table of tables) {
    // Make sure we read by row and not by cell to avoid issues with the table format changing
    for (const row of table) {
      if (!insideTable && row[0]?.startsWith("Date")) {
        insideTable = true;

        // Move to inside the table (notice how we ignore the D,R,J table format)
        continue;
      }
      if (!insideTable) continue;

      // Check for an {ACCOUNT NUMBER} {ACCOUNT NAME} row
      if (row[0]?.match(/^\d+\.?\d* .+/)) {
        const accountNumber = row[0].split(" ")[0];
        let accountName = row[0].split(" ").slice(1).join(" ").trim();

        // Remove possible balance at the end of the account name
        accountName = accountName.replace(/ \(?[\d,]+\.\d{2} ?\)?$/, "");

        if (
          !doesAccountNumberExistInAccounts(
            accounts,
            accountNumber ?? "Unknown"
          )
        ) {
          accounts.push({
            name: accountName,
            number: accountNumber ?? "Unknown",
            entries: [],
          });
        }
        curAccountNumber = accountNumber ?? "Unknown";
      }

      // Check for an {ACCOUNT NAME} {ACCOUNT NUMBER} row
      if (row[0]?.match(/^\b\w+\b \d+\.?\d*$/)) {
        const accountNumber = row[0].split(" ")[1];
        const accountName = (
          row[0].split(" ")[0]?.trim() +
          " " +
          row[1]?.trim() +
          " " +
          row[2]?.trim()
        ).trim();

        if (
          !doesAccountNumberExistInAccounts(
            accounts,
            accountNumber ?? "Unknown"
          )
        ) {
          accounts.push({
            name: accountName,
            number: accountNumber ?? "Unknown",
            entries: [],
          });
        }
        curAccountNumber = accountNumber ?? "Unknown";
      }

      // Check for a {ACCOUNT NUMBER} {ACCOUNT NAME} row that starts with the account number and has the account name in the second cell
      if (row[0]?.match(/^\d+\.?\d*$/) && row[1]?.match(/^\b\w+\b/)) {
        const accountNumber = row[0];
        const accountName = row[1];

        if (
          !doesAccountNumberExistInAccounts(
            accounts,
            accountNumber ?? "Unknown"
          )
        ) {
          accounts.push({
            name: accountName,
            number: accountNumber ?? "Unknown",
            entries: [],
          });
        }
        curAccountNumber = accountNumber ?? "Unknown";
      }

      // Check for an {ACCOUNT NUMBER} {ACCOUNT NAME} row that starts with a word followed by " - " and has the account number in the first cell and the account name in the second cell
      if (row[0]?.match(/^\b\w+\b - \d+\.?\d*$/)) {
        const accountNumber = row[0].split(" ")[2];
        const accountName =
          row[0].split(" ").slice(0, 2).join(" ").trim() + " " + row[1]?.trim();

        if (
          !doesAccountNumberExistInAccounts(
            accounts,
            accountNumber ?? "Unknown"
          )
        ) {
          accounts.push({
            name: accountName ?? "Unknown",
            number: accountNumber ?? "Unknown",
            entries: [],
          });
        }
        curAccountNumber = accountNumber ?? "Unknown";
      }

      // Check for an {ACCOUNT NUMBER} {ACCOUNT NAME} row that starts with "Totals for" and has the account name in the third cell
      if (row[0]?.startsWith("Totals for ") && row[0]?.split(" ").length > 3) {
        // Replace all spaces with a single space
        const rowClean = row[0].replace(/\s+/g, " ");
        const accountNumber = rowClean.split(" ")[3];
        const accountName = rowClean.split(" ").slice(4).join(" ").trim();

        if (
          !doesAccountNumberExistInAccounts(
            accounts,
            accountNumber ?? "Unknown"
          )
        ) {
          accounts.push({
            name: accountName ?? "Unknown",
            number: accountNumber ?? "Unknown",
            entries: [],
          });
        }
        curAccountNumber = accountNumber ?? "Unknown";
      }

      // Look for entries
      const dateMatch = row[0]?.match(/^\d{2}\/\d{2}\/\d{2}/);
      if (
        recordEntries &&
        row[0] !== undefined &&
        dateMatch &&
        dateMatch.index !== undefined
      ) {
        const date = row[0].slice(dateMatch.index, dateMatch.index + 8);
        const dateFormatted = moment(date, "MM/DD/YY").format("MM/DD/YYYY");
        let possibleDescriptionCells = row.slice(1);

        // Remove all empty cells
        possibleDescriptionCells = possibleDescriptionCells.filter(
          (cell) => cell !== ""
        );

        // NOTE: a reference can either be a digit of any length or a few specific strings, with a space before it
        const isReferenceInFirstCell = row[0].match(
          /\s(?:[\d.]+|PR|SS|MD|JV|RU)$/
        );
        if (!isReferenceInFirstCell) {
          // Check if the second row is a reference by itself
          if (
            /^(?:[\d.]+|PR|SS|MD|JV|RU)$/.test(
              possibleDescriptionCells[0] ?? ""
            )
          )
            possibleDescriptionCells.shift();
        }

        // Remove possible "Reference" data from the description if they are in the same cell
        const descriptionWithoutReference =
          possibleDescriptionCells[0]?.replace(
            /^(?:[\d.]+|PR|SS|MD|JV|RU) \b/,
            ""
          );

        let description = descriptionWithoutReference ?? "";

        // Check if the description was cut off and is in the next cell
        if (possibleDescriptionCells[1]?.startsWith("&"))
          description += " " + possibleDescriptionCells[1];
        if (possibleDescriptionCells[0]?.endsWith(" TO"))
          description += " " + possibleDescriptionCells[1];

        const entry = {
          date: dateFormatted,
          description: description,
        };
        curEntries.push(entry);

        // TODO: Now, sometimes there are 2 entries in one row. But, the problem is the possible second entry is from another page and may match with a different account number.
        // So, let's ignore them for now and just push the first entry to the account. We can come back to this later and figure out how to handle it.
      }

      // Look for the end of account entries
      if (recordEntries)
        row.forEach((cell, i) => {
          let accountNumber = "Unknown";
          if (cell.startsWith("Totals for ")) {
            accountNumber = cell.split(" ")[2] ?? "Unknown";
          } else if (cell == "Totals") {
            if (row[i + 1]?.startsWith("for "))
              accountNumber = row[i + 1]?.split(" ")[1] ?? "Unknown";
            else if (row[i + 1] == "for")
              accountNumber = row[i + 2] ?? "Unknown";
          }
          if (accountNumber == "Unknown") return;
          const account = accounts.find((a) => a.number == accountNumber);
          // Only push entries if the totals' account number matches the current account number (meaning the entries we have been collecting are accurate and for this account)
          if (account?.number == curAccountNumber) {
            account.entries.push(...curEntries);
            curAccountNumber = "";
          } else {
            const account = accounts.find((a) => a.number == curAccountNumber);
            if (account) curAccountNumber = accountNumber;
            else {
              accounts.push({
                name: "Unknown",
                number: curAccountNumber,
                entries: [],
              });
            }
          }
          // Clear the current entries. We just found the totals, so time to start a record a new account's entries
          curEntries = [];
        });
    }
  }

  return (
    accounts
      // Remove possible invalid accounts
      .filter(
        (a) =>
          a.number !== "0.00" &&
          a.number !== "Unknown" &&
          a.name !== "Unknown" &&
          !a.name.includes("Net Profit")
      )
      // Also sort accounts by account number
      .sort((a, b) => {
        // Attempt to convert the account numbers to numbers and sort by that
        const aNum = Number(a.number);
        const bNum = Number(b.number);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        // If that fails, then sort by the account numbers as strings
        else return a.number.localeCompare(b.number);
      })
  );
}

function doesAccountNumberExistInAccounts(
  accounts: GeneralLedgerAccount[],
  accountNumber = "Unknown"
) {
  return accounts.find((a) => a.number == accountNumber);
}

// This function is depreciated and will be removed in the future. Use parseAccountsUsingTables instead.
export function parseAccountsUsingTables_depreciated({
  tables,
}: OCR): GeneralLedgerAccount[] {
  let accounts: (GeneralLedgerAccount & { row?: string[] })[] = [];
  let curAccount: (GeneralLedgerAccount & { row?: string[] }) | null = null;
  for (const table of tables) {
    let tableFormat = null;
    for (const row of table) {
      if (!curAccount?.name || !curAccount?.number) curAccount = null;

      if (!tableFormat) {
        if (!row[0]?.startsWith("Date")) continue;

        // Four possibilities for the column format: ["Date", "Reference", "Journal"], ["Date Reference Journal"], ["Date Reference", "Journal"], ["Date", "Reference Journal"]
        // Check format for ["Date, Reference, Journal"]
        if (row[0] == "Date" && row[1] == "Reference" && row[2] == "Journal")
          tableFormat = "D,R,J";
        // Check format for ["Date Reference Journal"]
        else if (row[0] == "Date Reference Journal") tableFormat = "DRJ";
        // Check format for ["Date Reference", "Journal"]
        else if (row[0] == "Date Reference" && row[1] == "Journal")
          tableFormat = "DR,J";
        // Check format for ["Date", "Reference Journal"]
        else if (row[0] == "Date" && row[1] == "Reference Journal")
          tableFormat = "D,RJ";

        // if (tableFormat) console.log(tableFormat);
        if (tableFormat) continue;
      }

      // BAD: End here to avoid parsing the rest of the table (if we continue, we'll get incorrect results)
      if (!tableFormat) return accounts;

      // Parse the table
      if (tableFormat == "D,R,J") {
        let accountStr = row[0];
        let date = row[0];
        const reference = row[1];
        const journal = row[2];
        const description = row[3];
        const totals = row[3];
        const totals_2 = row[4];

        if (accountStr?.startsWith("Totals for ")) {
          if (curAccount) accounts.push(curAccount);
          curAccount = null;
          accountStr = accountStr.split(" ").slice(3).join(" ").trim();
        }

        if (
          row.length == 1 ||
          (accountStr &&
            reference?.length == 0 &&
            journal?.length == 0 &&
            description?.length == 0 &&
            totals?.length == 0 &&
            totals_2?.length == 0)
        ) {
          if (!curAccount && accountStr) {
            // Check for account number: if a digit including decimals separated by a space is present at the beginning of the string.
            if (!/^\d+(\.\d+)?\s/.test(accountStr)) continue;
            let accountName = accountStr.split(" ").slice(1).join(" ");

            // Attempt to remove any amounts past the account name
            const match = accountName.match(/^(.*) \(?[0-9,]*\.\d{2}\)?$/);
            if (match) accountName = match[1] ?? accountName;

            curAccount = {
              name: accountName,
              number: accountStr.split(" ")[0] ?? "Unknown",
              entries: [],
              row: row, // for further processing if needed
            };
          }
          continue;
        }

        if (
          accountStr === undefined ||
          date === undefined ||
          reference === undefined ||
          journal === undefined ||
          description === undefined ||
          totals === undefined ||
          totals_2 === undefined
        )
          continue;

        // Sometimes OCR will combine tables from separate pages. If we encounter a table with a different format, we reset the current table format and look for the new one
        if (
          accountStr.length == 0 &&
          date.length == 0 &&
          reference.length == 0 &&
          journal.length == 0 &&
          description.length == 0 &&
          totals.length == 0 &&
          totals_2.length == 0
        ) {
          tableFormat = null;
          continue;
        }

        if (!curAccount) {
          curAccount = {
            name: accountStr.split(" ").slice(1).join(" "),
            number: accountStr.split(" ")[0] ?? "Unknown",
            entries: [],
            row: row, // for further processing if needed
          };

          if (
            totals?.startsWith("Totals for ") ||
            totals_2?.startsWith("Totals for ")
          ) {
            accounts.push(curAccount);
            curAccount = null;
            continue;
          }

          continue;
        }

        // Attempt to remove any content past the date
        const match = date.match(/\b(\d{2}\/\d{2}\/\d{2})\b/);
        if (match) date = match[1] ?? date;
        if (date && description)
          curAccount.entries.push({
            date,
            description,
          });

        if (
          totals?.startsWith("Totals for ") ||
          totals_2?.startsWith("Totals for ")
        ) {
          accounts.push(curAccount);

          const accountNumber = accountStr.split(" ")[0] ?? "Unknown";

          // Check if we ended a previous account and there is a new account to start
          if (/^[\d.-]+$/.test(accountNumber)) {
            if (accountNumber == curAccount.number) {
              curAccount = null;
              continue;
            }

            // Check for account number: if a digit including decimals separated by a space is present at the beginning of the string.
            if (!/^\d+(\.\d+)?\s/.test(accountStr)) continue;
            let accountName = accountStr.split(" ").slice(1).join(" ");

            // Attempt to remove any amounts past the account name
            const match = accountName.match(/^(.*) \(?[0-9,]*\.\d{2}\)?$/);
            if (match) accountName = match[1] ?? accountName;

            curAccount = {
              name: accountName,
              number: accountNumber,
              entries: [],
              row: row, // for further processing if needed
            };
          } else curAccount = null;

          continue;
        }
      } else if (tableFormat == "DRJ") {
        const accountStr = row[0];
        let date = row[0];
        const reference = row[0];
        const journal = row[0];
        const description = row[1];
        const totals = row[2];
        const totals_2 = row[3];

        if (
          row.length == 1 ||
          (accountStr &&
            reference?.length == 0 &&
            journal?.length == 0 &&
            description?.length == 0 &&
            totals?.length == 0 &&
            totals_2?.length == 0)
        ) {
          if (!curAccount && accountStr) {
            // Check for account number: if a digit including decimals separated by a space is present at the beginning of the string.
            if (!/^\d+(\.\d+)?\s/.test(accountStr)) continue;
            let accountName = accountStr.split(" ").slice(1).join(" ");

            // Attempt to remove any amounts past the account name
            const match = accountName.match(/^(.*) \(?[0-9,]*\.\d{2}\)?$/);
            if (match) accountName = match[1] ?? accountName;

            curAccount = {
              name: accountName,
              number: accountStr.split(" ")[0] ?? "Unknown",
              entries: [],
              row: row, // for further processing if needed
            };
          }
          continue;
        }

        if (
          accountStr === undefined ||
          date === undefined ||
          reference === undefined ||
          journal === undefined ||
          description === undefined ||
          totals === undefined ||
          totals_2 === undefined
        )
          continue;

        // Sometimes OCR will combine tables from separate pages. If we encounter a table with a different format, we reset the current table format and look for the new one
        if (
          accountStr.length == 0 &&
          date.length == 0 &&
          reference.length == 0 &&
          journal.length == 0 &&
          description.length == 0 &&
          totals.length == 0 &&
          totals_2.length == 0
        ) {
          tableFormat = null;
          continue;
        }

        if (!curAccount) {
          curAccount = {
            name: accountStr.split(" ").slice(1).join(" "),
            number: accountStr.split(" ")[0] ?? "Unknown",
            entries: [],
            row: row, // for further processing if needed
          };

          if (
            totals?.startsWith("Totals for ") ||
            totals_2?.startsWith("Totals for ")
          ) {
            accounts.push(curAccount);
            curAccount = null;
            continue;
          }

          continue;
        }

        // Attempt to remove any content past the date
        const match = date.match(/\b(\d{2}\/\d{2}\/\d{2})\b/);
        if (match) date = match[1] ?? date;
        if (date && description)
          curAccount.entries.push({
            date,
            description,
          });

        if (
          totals?.startsWith("Totals for ") ||
          totals_2?.startsWith("Totals for ")
        ) {
          accounts.push(curAccount);
          curAccount = null;
          continue;
        }
      } else if (tableFormat == "DR,J") {
        const accountStr = row[0];
        let date = row[0];
        const reference = row[0];
        const journal = row[1];
        const description = row[2];
        const totals = row[2];
        const totals_2 = row[3];

        if (
          row.length == 1 ||
          (accountStr &&
            reference?.length == 0 &&
            journal?.length == 0 &&
            description?.length == 0 &&
            totals?.length == 0 &&
            totals_2?.length == 0)
        ) {
          if (!curAccount && accountStr) {
            // Check for account number: if a digit including decimals separated by a space is present at the beginning of the string.
            if (!/^\d+(\.\d+)?\s/.test(accountStr)) continue;
            let accountName = accountStr.split(" ").slice(1).join(" ");

            // Attempt to remove any amounts past the account name
            const match = accountName.match(/^(.*) \(?[0-9,]*\.\d{2}\)?$/);
            if (match) accountName = match[1] ?? accountName;

            curAccount = {
              name: accountName,
              number: accountStr.split(" ")[0] ?? "Unknown",
              entries: [],
              row: row, // for further processing if needed
            };
          }
          continue;
        }

        if (
          accountStr === undefined ||
          date === undefined ||
          reference === undefined ||
          journal === undefined ||
          description === undefined ||
          totals === undefined ||
          totals_2 === undefined
        )
          continue;

        // Sometimes OCR will combine tables from separate pages. If we encounter a table with a different format, we reset the current table format and look for the new one
        if (
          accountStr.length == 0 &&
          date.length == 0 &&
          reference.length == 0 &&
          journal.length == 0 &&
          description.length == 0 &&
          totals.length == 0 &&
          totals_2.length == 0
        ) {
          tableFormat = null;
          continue;
        }

        if (!curAccount) {
          curAccount = {
            name: accountStr.split(" ").slice(1).join(" "),
            number: accountStr.split(" ")[0] ?? "Unknown",
            entries: [],
            row: row, // for further processing if needed
          };

          if (
            totals?.startsWith("Totals for ") ||
            totals_2?.startsWith("Totals for ")
          ) {
            accounts.push(curAccount);
            curAccount = null;
            continue;
          }

          continue;
        }

        // Attempt to remove any content past the date
        const match = date.match(/\b(\d{2}\/\d{2}\/\d{2})\b/);
        if (match) date = match[1] ?? date;
        if (date && description)
          curAccount.entries.push({
            date,
            description,
          });

        if (
          totals?.startsWith("Totals for ") ||
          totals_2?.startsWith("Totals for ")
        ) {
          accounts.push(curAccount);
          curAccount = null;
          continue;
        }
      } else if (tableFormat == "D,RJ") {
        const accountStr = row[0];
        let date = row[0];
        const reference = row[1];
        const journal = row[1];
        const description = row[2];
        const totals = row[2];
        const totals_2 = row[3];

        if (
          row.length == 1 ||
          (accountStr &&
            reference?.length == 0 &&
            journal?.length == 0 &&
            description?.length == 0 &&
            totals?.length == 0 &&
            totals_2?.length == 0)
        ) {
          if (!curAccount && accountStr) {
            // Check for account number: if a digit including decimals separated by a space is present at the beginning of the string.
            if (!/^\d+(\.\d+)?\s/.test(accountStr)) continue;
            let accountName = accountStr.split(" ").slice(1).join(" ");

            // Attempt to remove any amounts past the account name
            const match = accountName.match(/^(.*) \(?[0-9,]*\.\d{2}\)?$/);
            if (match) accountName = match[1] ?? accountName;

            curAccount = {
              name: accountName,
              number: accountStr.split(" ")[0] ?? "Unknown",
              entries: [],
              row: row, // for further processing if needed
            };
          }
          continue;
        }

        if (
          accountStr === undefined ||
          date === undefined ||
          reference === undefined ||
          journal === undefined ||
          description === undefined ||
          totals === undefined ||
          totals_2 === undefined
        )
          continue;

        // Sometimes OCR will combine tables from separate pages. If we encounter a table with a different format, we reset the current table format and look for the new one
        if (
          accountStr.length == 0 &&
          date.length == 0 &&
          reference.length == 0 &&
          journal.length == 0 &&
          description.length == 0 &&
          totals.length == 0 &&
          totals_2.length == 0
        ) {
          tableFormat = null;
          continue;
        }

        if (!curAccount) {
          curAccount = {
            name: accountStr.split(" ").slice(1).join(" "),
            number: accountStr.split(" ")[0] ?? "Unknown",
            entries: [],
            row: row, // for further processing if needed
          };

          if (
            totals?.startsWith("Totals for ") ||
            totals_2?.startsWith("Totals for ")
          ) {
            accounts.push(curAccount);
            curAccount = null;
            continue;
          }

          continue;
        }

        // Attempt to remove any content past the date
        const match = date.match(/\b(\d{2}\/\d{2}\/\d{2})\b/);
        if (match) date = match[1] ?? date;
        if (date && description)
          curAccount.entries.push({
            date,
            description,
          });

        if (
          totals?.startsWith("Totals for ") ||
          totals_2?.startsWith("Totals for ")
        ) {
          accounts.push(curAccount);
          curAccount = null;
          continue;
        }
      }
    }
  }

  // Fix all accounts with numbers as names using the row property
  accounts = accounts.map((account) => {
    if (/^[\d.-]+$/.test(account.name)) {
      account.number = account.name.replace("-", "").trim();
      account.name = (
        (account.row ?? [""])[0]?.replace(account.number, "").trim() +
        " " +
        (account.row ?? [""])[1]?.trim() +
        " " +
        (account.row ?? [""])[2]?.trim()
      ).trim();
    }
    return account;
  });

  // Filter out any accounts that don't have a name or number and remove the row property
  return accounts
    .map((account) => {
      delete account.row;
      return account;
    })
    .filter((a) => a.name && a.number);
}
