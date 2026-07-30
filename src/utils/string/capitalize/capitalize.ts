/** Capitalizes the first letter of a string, leaving the rest unchanged */
export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
