/** Extracts a human-readable message from an Error instance or a plain DataQueryError-shaped object */
export const errorMessage = (e: unknown): string => {
  if (e instanceof Error) {
    return e.message;
  }
  const message = (e as { message?: string } | undefined)?.message;
  return message ?? String(e);
};
