/**
 * German legal text chunker.
 * Splits OCR'd document text into overlapping chunks suitable for embedding.
 * Uses paragraph-aware splitting with German legal section separators
 * (Tenor, Tatbestand, Entscheidungsgruende, Gruende).
 */

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/**
 * Separators ordered from most-specific (legal section headers)
 * to least-specific (character-level fallback).
 */
const GERMAN_LEGAL_SEPARATORS = [
  "\n\nTenor\n",
  "\n\nTatbestand\n",
  "\n\nEntscheidungsgründe\n",
  "\n\nGründe\n",
  "\n\n", // Standard paragraph break
  "\n",   // Line break
  ". ",   // Sentence boundary
  " ",    // Word boundary
  "",     // Character-level fallback
];

/**
 * Create a RecursiveCharacterTextSplitter configured for German legal text.
 * - chunkSize: 1000 characters (~250 tokens for German)
 * - chunkOverlap: 200 characters (20% overlap for context continuity)
 */
export function createLegalTextSplitter(): RecursiveCharacterTextSplitter {
  return new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: GERMAN_LEGAL_SEPARATORS,
  });
}

/**
 * Chunk a document's text content into indexed pieces.
 * Returns an empty array if the text is empty or whitespace-only.
 */
export async function chunkDocument(
  text: string
): Promise<{ content: string; index: number }[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const splitter = createLegalTextSplitter();
  const chunks = await splitter.splitText(trimmed);

  return chunks.map((content, index) => ({ content, index }));
}

/**
 * Chunk a document into parent-child pairs for RAG.
 *
 * Parent chunks (~2000 tokens = ~8000 chars for German legal text) are stored
 * unembedded as context retrieval units. Child chunks (~500 tokens = ~2000 chars)
 * are embedded and used as retrieval units.
 *
 * Returns an empty array if the text is empty or whitespace-only.
 */
export async function chunkDocumentParentChild(text: string): Promise<{
  parent: { content: string; index: number };
  children: { content: string; index: number }[];
}[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Step 1: Split into PARENT chunks (~2000 tokens = ~8000 chars for German)
  const parentSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 8000,
    chunkOverlap: 400,
    separators: GERMAN_LEGAL_SEPARATORS,
  });
  const parentTexts = await parentSplitter.splitText(trimmed);

  // Step 2: For each parent, split into CHILD chunks (~500 tokens = ~2000 chars)
  const childSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000,
    chunkOverlap: 200,
    separators: GERMAN_LEGAL_SEPARATORS,
  });

  const results: {
    parent: { content: string; index: number };
    children: { content: string; index: number }[];
  }[] = [];
  let globalChildIndex = 0;

  for (let parentIndex = 0; parentIndex < parentTexts.length; parentIndex++) {
    const childTexts = await childSplitter.splitText(parentTexts[parentIndex]);
    results.push({
      parent: { content: parentTexts[parentIndex], index: parentIndex },
      children: childTexts.map((c) => ({ content: c, index: globalChildIndex++ })),
    });
  }

  return results;
}
