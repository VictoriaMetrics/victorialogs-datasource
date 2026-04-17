import { useCallback, useReducer } from 'react';

import { chipReducer, initialChipState } from './chipReducer';
import { useMultiSelect } from './useMultiSelect';
import { OptionGroup } from './useOptionLoading';

interface UseChipIntentsProps {
  isMulti: boolean;
  hasOptions: boolean;
  optionGroups: OptionGroup[] | null;
  currentMultiValues: string[];
  loadOptions: (query: string) => Promise<void>;
  setHighlightedIndex: (index: number) => void;
  onValueChange: (value: string | null) => void;
  onMultiValuesChange?: (values: string[]) => void;
  onConfirm: () => void;
  onDeactivate: () => void;
  onStreamFieldSelected?: (fieldName: string) => void;
}

interface UseChipIntentsResult {
  inputValue: string;
  /** Called from the activation useEffect in PlaceholderChip. */
  activate: (initialValue: string) => void;
  handleType: (text: string) => void;
  handlePick: (value: string) => void;
  handleRemoveLast: () => void;
  handleFinalize: () => void;
  handleCancel: () => void;
}

type CommitMode = 'stream' | 'multi' | 'single';

/**
 * Resolve which commit flow a selected value belongs to.
 * 'stream' wins when the value belongs to a stream-fields group AND the segment wired a stream handler.
 */
function resolveCommitMode(
  value: string,
  optionGroups: OptionGroup[] | null,
  isMulti: boolean,
  hasStreamHandler: boolean
): CommitMode {
  if (hasStreamHandler && optionGroups) {
    for (const group of optionGroups) {
      if (group.groupId !== 'stream') {
        continue;
      }
      if (group.options.some((o) => String(o.value) === value)) {
        return 'stream';
      }
    }
  }
  return isMulti ? 'multi' : 'single';
}

/**
 * Orchestrates PlaceholderChip intents: owns the reducer for local input state
 * and routes each user-level action (Type/Pick/RemoveLast/Finalize/Cancel/Activate)
 * to the appropriate combination of parent callbacks and side effects.
 *
 * Side-effect ordering in Pick(multi) is preserved exactly as in the pre-refactor code:
 *   1. onMultiValuesChange   (parent state)
 *   2. RESET_INPUT dispatch  (local input)
 *   3. setHighlightedIndex   (navigation state)
 *   4. loadOptions('')       (async reload)
 */
export function useChipIntents({
  isMulti,
  hasOptions,
  optionGroups,
  currentMultiValues,
  loadOptions,
  setHighlightedIndex,
  onValueChange,
  onMultiValuesChange,
  onConfirm,
  onDeactivate,
  onStreamFieldSelected,
}: UseChipIntentsProps): UseChipIntentsResult {
  const [state, dispatch] = useReducer(chipReducer, initialChipState);

  const { addValue: addMultiValue, removeLast: removeLastMultiValue } = useMultiSelect(
    currentMultiValues,
    onMultiValuesChange
  );

  const activate = useCallback((initialValue: string) => {
    dispatch({ type: 'ACTIVATE', initialValue });
    loadOptions(initialValue);
  }, [loadOptions]);

  const handleType = useCallback((text: string) => {
    dispatch({ type: 'TYPE', text });
    setHighlightedIndex(-1);
    loadOptions(text);
    // For freeText segments, save on every change so deactivation always preserves the typed value
    if (!hasOptions) {
      onValueChange(text || null);
    }
  }, [setHighlightedIndex, loadOptions, hasOptions, onValueChange]);

  const handlePick = useCallback((value: string) => {
    const mode = resolveCommitMode(value, optionGroups, isMulti, Boolean(onStreamFieldSelected));
    if (mode === 'stream') {
      // Safe non-null: mode === 'stream' implies onStreamFieldSelected is defined.
      onStreamFieldSelected!(value);
      onConfirm();
      return;
    }
    if (mode === 'multi') {
      // Empty picks in multi are a no-op — useMultiSelect.addValue handles this too,
      // but we short-circuit the UI reset as well.
      if (!value) {
        return;
      }
      addMultiValue(value);
      dispatch({ type: 'RESET_INPUT' });
      setHighlightedIndex(-1);
      loadOptions('');
      return;
    }
    // single
    onValueChange(value || null);
    onConfirm();
  }, [
    optionGroups, isMulti, onStreamFieldSelected, onConfirm,
    addMultiValue, setHighlightedIndex, loadOptions, onValueChange,
  ]);

  const handleRemoveLast = useCallback(() => {
    removeLastMultiValue();
    loadOptions('');
  }, [removeLastMultiValue, loadOptions]);

  const handleFinalize = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    onDeactivate();
  }, [onDeactivate]);

  return {
    inputValue: state.inputValue,
    activate,
    handleType,
    handlePick,
    handleRemoveLast,
    handleFinalize,
    handleCancel,
  };
}
