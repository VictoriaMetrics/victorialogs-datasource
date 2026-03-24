export const createIdGenerator = (prefix: string): (() => string) => {
  let counter = 0;
  return (): string => {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  };
};
