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
