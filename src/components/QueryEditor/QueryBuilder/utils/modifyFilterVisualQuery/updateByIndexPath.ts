import { FilterVisualQuery } from "../../../../../types";

export function updateValueByIndexPath(obj: FilterVisualQuery, indexPath: number[], newValue: string): FilterVisualQuery {
  // Helper function to recursively navigate the object and create a new copy
  function recursiveUpdateValue(currentObj: FilterVisualQuery, path: number[], level: number): FilterVisualQuery {
    if (level === path.length - 1) {
      // If we are at the last index, update the value
      const newValues = [...currentObj.values];
      newValues[path[level]] = newValue;
      return {
        ...currentObj,
        values: newValues,
      };
    } else {
      // Otherwise, continue recursively and copy current level
      const newValues = [...currentObj.values];
      if (typeof newValues[path[level]] !== "object" || newValues[path[level]] === null) {
        newValues[path[level]] = { values: [], operators: currentObj.operators }; // Create a new valid FilterVisualQuery object
      }
      newValues[path[level]] = recursiveUpdateValue(newValues[path[level]] as FilterVisualQuery, path, level + 1);
      return {
        ...currentObj,
        values: newValues,
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
      const newOperators = [...currentObj.operators];
      newOperators[path[level]] = newOperator;
      return {
        ...currentObj,
        operators: newOperators,
      };
    } else {
      // Otherwise, continue recursively and copy current level
      const newValues = [...currentObj.values];
      if (typeof newValues[path[level]] !== "object" || newValues[path[level]] === null) {
        newValues[path[level]] = { values: [], operators: [] }; // Create a new valid FilterVisualQuery object
      }
      newValues[path[level]] = recursiveUpdateOperator(newValues[path[level]] as FilterVisualQuery, path, level + 1);
      return {
        ...currentObj,
        values: newValues,
      };
    }
  }

  return recursiveUpdateOperator(obj, indexPath, 0);
}

