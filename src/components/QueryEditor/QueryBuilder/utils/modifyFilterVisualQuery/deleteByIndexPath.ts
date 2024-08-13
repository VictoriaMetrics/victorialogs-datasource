import { FilterVisualQuery } from "../../../../../types";

export function deleteByIndexPath(obj: FilterVisualQuery, indexPath: number[]): FilterVisualQuery {
  // Helper function to recursively navigate the object and create a new copy
  function recursiveDelete(currentObj: FilterVisualQuery, path: number[], level: number): FilterVisualQuery {
    if (level === path.length - 1) {
      // If we are at the last index, create a new array without the target element and operator
      const newValues = [
        ...currentObj.values.slice(0, path[level]),
        ...currentObj.values.slice(path[level] + 1)
      ];

      let newOperators;
      if (path[level] === 0) {
        newOperators = currentObj.operators.slice(1); // Remove the first operator
      } else {
        newOperators = [
          ...currentObj.operators.slice(0, path[level] - 1),
          ...currentObj.operators.slice(path[level])
        ];
      }

      return {
        ...currentObj,
        values: newValues,
        operators: newOperators
      };
    } else {
      // Otherwise, continue recursively and copy current level
      return {
        ...currentObj,
        values: currentObj.values.map((item, index) => {
          if (index === path[level] && typeof item !== 'string') {
            return recursiveDelete(item, path, level + 1);
          }
          return item;
        })
      };
    }
  }

  return recursiveDelete(obj, indexPath, 0);
}
