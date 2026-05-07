import { cx } from '@emotion/css';
import React, { useEffect, useMemo, useRef } from 'react';

import { useStyles2 } from '@grafana/ui';

import { useDropdownNavigation } from '../hooks/useDropdownNavigation';
import { useFloatingDropdown } from '../hooks/useFloatingDropdown';
import { PlaceholderSegment } from '../types';

import { ChipDropdown } from './ChipDropdown';
import { getStyles } from './styles';
import { useChipIntents } from './useChipIntents';
import { useChipKeyboard } from './useChipKeyboard';
import { useOptionLoading } from './useOptionLoading';

interface Props {
  segment: PlaceholderSegment;
  isActive: boolean;
  onClick: () => void;
  onValueChange: (value: string | null) => void;
  onMultiValuesChange?: (values: string[]) => void;
  onConfirm: () => void;
  onDeactivate: () => void;
  /** Called when the user selects a field from the stream group (fieldNamesWithStream source) */
  onStreamFieldSelected?: (fieldName: string) => void;
  dependencyValue?: string | null;
}

export const PlaceholderChip: React.FC<Props> = ({
  segment,
  isActive,
  onClick,
  onValueChange,
  onMultiValuesChange,
  onConfirm,
  onDeactivate,
  onStreamFieldSelected,
  dependencyValue,
}) => {
  const styles = useStyles2(getStyles);
  const inputRef = useRef<HTMLInputElement>(null);

  const isMulti = Boolean(segment.multi);
  const currentMultiValues = useMemo(() => segment.multiValues ?? [], [segment.multiValues]);
  const hasOptions = segment.optionSource !== 'freeText';

  const { options, optionGroups, loadOptions } = useOptionLoading({
    optionSource: segment.optionSource,
    staticOptions: segment.staticOptions,
    isActive,
    dependencyValue,
    excludeOptions: segment.excludeOptions,
    multiValues: isMulti ? currentMultiValues : undefined,
  });

  const { highlightedIndex, setHighlightedIndex, handleNavigationKeyDown, listRef } = useDropdownNavigation({
    itemCount: options.length,
    isOpen: isActive,
    initialIndex: -1,
  });

  const { refs: floatingRefs, floatingStyles } = useFloatingDropdown({ open: isActive, minHeight: 60, maxHeight: 320 });
  const setReference = floatingRefs.setReference;
  const setFloating = floatingRefs.setFloating;

  const { inputValue, activate, handleType, handlePick, handleRemoveLast, handleFinalize, handleCancel } = useChipIntents({
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
  });

  const pickedValue = highlightedIndex >= 0 ? String(options[highlightedIndex].value) : inputValue;

  const handleKeyDown = useChipKeyboard({
    state: { inputValue, pickedValue },
    ctx: { isMulti, hasMultiValues: currentMultiValues.length > 0 },
    handlers: { handleType, handlePick, handleRemoveLast, handleFinalize, handleCancel },
    onNavigate: handleNavigationKeyDown,
  });

  const isFilled = segment.value !== null || (isMulti && currentMultiValues.length > 0);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    // For freeText segments, pre-populate with the current value so the user can edit it.
    // For other sources, start with empty to trigger a fresh search.
    const initial = segment.optionSource === 'freeText' ? (segment.value ?? '') : '';
    activate(initial);
    requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const displayText = isFilled
    ? isMulti && currentMultiValues.length > 0
      ? currentMultiValues.join(', ')
      : (segment.value ?? '')
    : segment.displayHint;

  const showDropdown = isActive && hasOptions && options.length > 0;

  return (
    <>
      <span
        ref={setReference}
        className={cx(
          isFilled ? styles.placeholderFilled : styles.placeholderEmpty,
          isActive && styles.placeholderActive
        )}
        onClick={onClick}
        role='button'
        tabIndex={0}
      >
        {isActive ? (
          <>
            {isMulti && currentMultiValues.length > 0 && (
              <span className={styles.multiSelectedValues}>
                {currentMultiValues.join(', ')},&nbsp;
              </span>
            )}
            <input
              ref={inputRef}
              className={styles.chipInput}
              value={inputValue}
              onChange={(e) => handleType(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleCancel}
              placeholder={isMulti && currentMultiValues.length > 0 ? '' : segment.displayHint}
              size={Math.max(inputValue.length || (isMulti && currentMultiValues.length > 0 ? 1 : segment.displayHint.length), 2)}
            />
          </>
        ) : (
          displayText
        )}
      </span>

      {showDropdown && (
        <ChipDropdown
          options={options}
          optionGroups={optionGroups}
          highlightedIndex={highlightedIndex}
          onHighlight={setHighlightedIndex}
          onSelect={handlePick}
          floatingRef={setFloating}
          floatingStyles={floatingStyles}
          listRef={listRef}
        />
      )}
    </>
  );
};
