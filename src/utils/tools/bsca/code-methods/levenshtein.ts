import levenshtein from "fast-levenshtein";

import type { BankStatement } from "../BankStatement";
import type { GeneralLedger } from "../GeneralLedger";
import type {
  CodeResults,
  LevenshteinAccountMatch,
  LevenshteinEntryMatch,
  LevenshteinTransaction,
} from "@/types/tools/bsca/coder";

export function code(
  bankStatement: BankStatement,
  generalLedger: GeneralLedger
) {
  const results: CodeResults = {
    method: "levenshtein",
    transactions: {
      deposits: [],
      withdrawals: [],
    },
  };

  results.transactions.deposits = matchDescriptions(
    [...bankStatement.deposits] as LevenshteinTransaction[],
    generalLedger
  );
  results.transactions.withdrawals = matchDescriptions(
    [...bankStatement.withdrawals] as LevenshteinTransaction[],
    generalLedger
  );

  return results;
}

function matchDescriptions(
  transactions: LevenshteinTransaction[],
  generalLedger: GeneralLedger
): LevenshteinTransaction[] {
  transactions.forEach((transaction) => {
    transaction.matches = [];
    generalLedger.accounts.forEach((account) => {
      let match: LevenshteinAccountMatch = {
        account: {
          name: account.name,
          number: account.number,
        },
        stats: {
          totalEntries: 0,
          averageRatio: 0,
        },
        entries: [] as LevenshteinEntryMatch[],
      };

      account.entries.forEach((entry) => {
        // Check if the entry description was previously matched to this transaction
        const matchIndex = getMatchIndex(match, entry.description);
        if (matchIndex != -1) {
          match = addMatchCount(match, matchIndex);
          return;
        }

        // Calculate the Levenshtein distance (and construct ratio) for both the original and shortened description
        const description = (
            transaction.description.shortened ??
            transaction.description.original
          )
            // Cap the length of the original description to 16 characters
            .substring(0, 16)
            .toUpperCase(),
          shortenedDescription =
            transaction.description.shortened?.toUpperCase();

        if (shortenedDescription)
          match = matchDescription(
            match,
            entry.description,
            shortenedDescription
          );
        else match = matchDescription(match, entry.description, description);
      });

      // Sort the entries by ratio and by the number of times they were matched
      match.entries.sort((a, b) => {
        if (a.ratio > b.ratio) return -1;
        if (a.ratio < b.ratio) return 1;
        if (a.count > b.count) return -1;
        if (a.count < b.count) return 1;
        return 0;
      });

      // Update average ratio
      match.stats.averageRatio /= match.stats.totalEntries;

      if (match.stats.totalEntries > 0) transaction.matches.push(match);
    });

    // Sort the matches by stats.averageRatio and stats.totalEntries
    transaction.matches.sort((a, b) => {
      if (a.stats.totalEntries > b.stats.totalEntries) return -1;
      if (a.stats.totalEntries < b.stats.totalEntries) return 1;
      if (a.stats.averageRatio > b.stats.averageRatio) return -1;
      if (a.stats.averageRatio < b.stats.averageRatio) return 1;
      return 0;
    });

    // Add SUSPENSE account if no matches were found, this is a workaround for the issue where all SUSPENSE accounts update in the table at once
    if (transaction.matches.length == 0) {
      const suspenseAccount = generalLedger.accounts.find(
        (account) => account.name == "SUSPENSE"
      );
      const descriptionSplit = (
        transaction.description.shortened ?? transaction.description.original
      ).split(" ");
      const description = descriptionSplit[0]?.toUpperCase() ?? "UNKNOWN";

      transaction.matches.push({
        account: {
          name: "SUSPENSE",
          number: suspenseAccount?.number ?? "3130",
        },
        stats: {
          totalEntries: 0,
          averageRatio: 0,
        },
        entries: [
          {
            description: description,
            ratio: 0,
            count: 0,
          },
        ],
      });
    }
  });

  return transactions;
}

function matchDescription(
  match: LevenshteinAccountMatch,
  entryDescription: string,
  description: string,
  ratio_cutoff = 0.35,
  matchExactWords = true
) {
  const ratio = calcRatio(description, entryDescription.toUpperCase());

  // Use a threshold to determine if the entry is a "match"
  if (ratio && ratio >= ratio_cutoff)
    match = addMatch(match, entryDescription, ratio);

  // Add matches for "exact" words
  if (matchExactWords)
    match = addWordMatches(match, entryDescription, description);

  return match;
}

function addWordMatches(
  match: LevenshteinAccountMatch,
  entryDescription: string,
  description: string
): LevenshteinAccountMatch {
  // Add matches for "exact" words
  const lettersOnly = description.replace(/[^a-z\s]/gi, "");
  const words = lettersOnly.split(" ");
  words.forEach((word) => {
    // Remove commas and periods from the word
    word = word.replace(/[,\.]/g, "");

    // Attempt to add a match for each word in the entry description as well instead of against the entire entry description
    match = addEntryWordMatches(match, entryDescription, word);

    // Calculate a ratio for the word against the entry description
    const ratio = calcRatio(word, entryDescription.toUpperCase());

    // Use a threshold to determine if the entry is a "match" (expierment with 0.85, 0.9, etc.)
    if (ratio && ratio >= 0.85) {
      // Check if the entry description was previously matched to this transaction
      const matchIndex = getMatchIndex(match, entryDescription);
      if (matchIndex != -1) {
        match = addMatchCount(match, matchIndex);
        return;
      }

      match = addMatch(match, entryDescription, ratio);
    }
  });

  // Now, let's do the same but only for account numbers (last 4 digits)
  description.split(" ").forEach((word) => {
    // Remove commas and periods from the word
    word = word.replace(/[,\.]/g, "");

    // Check if it is the last 4 digits of an account number
    word = word.replace("#", "");
    if (!word.match(/^\d{4}$/)) return;

    // Attempt to add a match for each word in the entry description as well instead of against the entire entry description
    match = addEntryWordMatches(match, entryDescription, word);

    // Calculate a ratio for the word against the entry description
    const ratio = calcRatio(word, entryDescription.toUpperCase());

    // Use a threshold to determine if the entry is a "match" (expierment with 0.85, 0.9, etc.)
    if (ratio && ratio >= 0.85) {
      // Check if the entry description was previously matched to this transaction
      const matchIndex = getMatchIndex(match, entryDescription);
      if (matchIndex != -1) {
        match = addMatchCount(match, matchIndex);
        return;
      }

      match = addMatch(match, entryDescription, ratio);
    }
  });

  return match;
}

function addEntryWordMatches(
  match: LevenshteinAccountMatch,
  entryDescription: string,
  word: string
): LevenshteinAccountMatch {
  entryDescription
    .toUpperCase()
    .split(" ")
    .forEach((entryWord) => {
      // Remove commas and periods from the word
      entryWord = entryWord.replace(/[,\.]/g, "");

      // Calculate a ratio for the word
      const ratio = calcRatio(word, entryWord);

      // Use a threshold to determine if the entry is a "match" (expierment with 0.85, 0.9, etc.)
      if (ratio && ratio >= 0.85) {
        // Check if the entry description was previously matched to this transaction
        const matchIndex = getMatchIndex(match, entryDescription);
        if (matchIndex != -1) {
          match = addMatchCount(match, matchIndex);
          return;
        }

        // TODO: determine whether to override the ratio (to 0 or 0.35) for these "exact" entry description word to transaction description word matches
        let exactWordFinalRatio = 0.35; // ratio;
        // Check if the word and entryWord are 4 digits using regex, if so, override the ratio (meaning this most likely the last 4 of an account number)
        if (
          word.match(/^\d{4}$/) &&
          entryWord.replace("#", "").match(/^\d{4}$/)
        )
          exactWordFinalRatio = 0.95;

        match = addMatch(match, entryDescription, exactWordFinalRatio);
      }
    });
  return match;
}

function addMatch(
  match: LevenshteinAccountMatch,
  description: string,
  ratio: number
): LevenshteinAccountMatch {
  match.entries.push({
    description,
    ratio,
    count: 1,
  });
  match.stats.totalEntries += 1;
  match.stats.averageRatio += ratio;
  return match;
}

function addMatchCount(
  match: LevenshteinAccountMatch,
  index: number
): LevenshteinAccountMatch {
  (match.entries[index] as LevenshteinEntryMatch).count += 1;
  match.stats.totalEntries += 1;
  match.stats.averageRatio += (
    match.entries[index] as LevenshteinEntryMatch
  ).ratio;
  return match;
}

function getMatchIndex(
  match: LevenshteinAccountMatch,
  description: string
): number {
  for (let i = 0; i < match.entries.length; i++)
    if (match.entries[i]?.description === description) return i;
  return -1;
}

function calcRatio(first: string, second: string): number {
  const ldist = levenshtein.get(first, second);
  const ratio = 1 - ldist / second.length;
  return ratio;
}
