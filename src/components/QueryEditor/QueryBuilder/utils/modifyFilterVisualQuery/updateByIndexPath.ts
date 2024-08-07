import { FilterVisualQuery } from "../../../../../types";

export function updateValueByIndexPath(obj: FilterVisualQuery, indexPath: number[], newValue: string): FilterVisualQuery {
  // Helper function to recursively navigate the object and create a new copy
  function recursiveUpdateValue(currentObj: FilterVisualQuery, path: number[], level: number): FilterVisualQuery {
    if (level === path.length - 1) {
      // If we are at the last index, update the value
      const newValues = currentObj.values.map((item, index) => (index === path[level] ? newValue : item));
      return {
        ...currentObj,
        values: newValues,
      };
    } else {
      // Otherwise, continue recursively and copy current level
      return {
        ...currentObj,
        values: currentObj.values.map((item, index) => {
          if (index === path[level] && typeof item !== 'string') {
            return recursiveUpdateValue(item, path, level + 1);
          }
          return item;
        })
      };
    }
  }

  return recursiveUpdateValue(obj, indexPath, 0);
}

export function updateOperatorByIndexPath(obj: FilterVisualQuery, indexPath: number[], newOperator: string): FilterVisualQuery {
  // Helper function to recursively navigate the object and create a new copy
  function recursiveUpdateOperator(currentObj: FilterVisualQuery, path: number[], level: number): FilterVisualQuery {
    if (level === path.length - 1) {
      // If we are at the last index, update the operator
      const newOperators = currentObj.operators.map((op, index) => (index === Math.max(path[level] - 1, 0) ? newOperator : op));
      return {
        ...currentObj,
        operators: newOperators,
      };
    } else {
      // Otherwise, continue recursively and copy current level
      return {
        ...currentObj,
        values: currentObj.values.map((item, index) => {
          if (index === path[level] && typeof item !== 'string') {
            return recursiveUpdateOperator(item, path, level + 1);
          }
          return item;
        })
      };
    }
  }

  return recursiveUpdateOperator(obj, indexPath, 0);
}

