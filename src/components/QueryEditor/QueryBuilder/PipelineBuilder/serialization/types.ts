export interface RowSerializeResult {
  result: string;
}

export interface SerializeResult {
  pipes: string[];
}

export const escapeQuotes = (s: string): string => s.replace(/"/g, '\\"');

