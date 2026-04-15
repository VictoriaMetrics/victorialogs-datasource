import { useCallback } from 'react';

import { TEXT_FILTER_ALL_VALUE } from '../../../../constants';

interface UseMultiSelectResult {
  /** Append a value. '*' clears other values; non-'*' values are appended after any existing '*' is removed. No-op for empty strings. */
  addValue: (value: string) => void;
  /** Drop the most recently added value (Backspace). No-op when empty. */
  removeLast: () => void;
}

/**
 * Pure multi-value selection logic for PlaceholderChip.
 * Wildcard ('*') semantics: selecting '*' collapses the list to ['*']; selecting a specific value drops any existing '*'.
 */
export function useMultiSelect(
  currentValues: string[],
  onChange: ((values: string[]) => void) | undefined
): UseMultiSelectResult {
  const addValue = useCallback((value: string) => {
    if (!value) {
      return;
    }
    const newValues = value === TEXT_FILTER_ALL_VALUE
      ? [TEXT_FILTER_ALL_VALUE]
      : [...currentValues.filter((v) => v !== TEXT_FILTER_ALL_VALUE), value];
    onChange?.(newValues);
  }, [currentValues, onChange]);

  const removeLast = useCallback(() => {
    if (currentValues.length === 0) {
      return;
    }
    onChange?.(currentValues.slice(0, -1));
  }, [currentValues, onChange]);

  return { addValue, removeLast };
}
