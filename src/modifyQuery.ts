export function queryHasFilter(query: string, key: string, value: string): boolean {
  return query.includes(`${key}:${value}`)
}

export const removeLabelFromQuery = (query: string, key: string, value: string): string => {
  const operators = ['AND', 'NOT']
  const parts = query.split(' ')
  const index = parts.findIndex((part) => part.includes(`${key}:${value}`))
  const newParts = removeAtIndexAndBefore(parts, index, operators.includes(parts[index - 1]))
  return newParts.join(' ')
}

export const addLabelToQuery = (query: string, key: string, value: string, operator: string): string => {
  return `${query} ${operator} ${key}:${value}`
}

const removeAtIndexAndBefore = (arr: string[], index: number, removeBefore: boolean): string[] => {
  if (index < 0 || index >= arr.length) {
    return arr;
  }

  if (removeBefore) {
    const isStart = index === 0;
    arr.splice(isStart ? index : index - 1, isStart ? 1 : 2);
  } else {
    arr.splice(index, 1);
  }

  return arr;
}
