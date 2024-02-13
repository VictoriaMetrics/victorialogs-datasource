export function queryHasFilter(query: string, key: string, value: string): boolean {
  return query.includes(`${key}:${value}`)
}

export const removeLabelFromQuery = (query: string, key: string, value: string): string => {
  const parts = query.split(' ')
  const index = parts.findIndex((part) => part.includes(`${key}:${value}`))
  const newParts = removeAtIndexAndBefore(parts, index)
  return newParts.join(' ')
}

export const addLabelToQuery = (query: string, key: string, value: string, operator: string): string => {
  return `${query} ${operator} ${key}:${value}`
}

const removeAtIndexAndBefore = (arr: string[], index: number): string[] => {
  if (index < 0 || index >= arr.length) {
    return arr;
  }

  if (index === 0) {
    arr.splice(index, 1);
  } else {
    arr.splice(index - 1, 2);
  }

  return arr;
}
