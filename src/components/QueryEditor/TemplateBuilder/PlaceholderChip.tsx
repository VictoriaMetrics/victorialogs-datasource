import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ComboboxOption, useStyles2 } from '@grafana/ui';

import { FloatingDropdown } from './FloatingDropdown';
import { useDropdownNavigation } from './hooks/useDropdownNavigation';
import { useFloatingDropdown } from './hooks/useFloatingDropdown';
import { OptionGroup, useOptionLoading } from './hooks/useOptionLoading';
import { getStyles } from './styles';
import { PlaceholderSegment } from './types';

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

  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { options, optionGroups, loadOptions } = useOptionLoading({
    optionSource: segment.optionSource,
    staticOptions: segment.staticOptions,
    isActive,
    dependencyValue,
    excludeOptions: segment.excludeOptions,
  });

  // Navigation hook is placed before other callbacks so setHighlightedIndex
  // is available in their dependency arrays. options.length is used here;
  // filteredOptions is a subset, so over-clamping is acceptable.
  const { highlightedIndex, setHighlightedIndex, handleNavigationKeyDown, listRef } = useDropdownNavigation({
    itemCount: options.length,
    isOpen: isActive,
    initialIndex: -1,
  });

  const { refs: floatingRefs, floatingStyles } = useFloatingDropdown({ open: isActive, minHeight: 60, maxHeight: 320 });
  const setReference = floatingRefs.setReference;
  const setFloating = floatingRefs.setFloating;

  const isMulti = Boolean(segment.multi);
  const currentMultiValues = useMemo(() => segment.multiValues ?? [], [segment.multiValues]);
  const isFilled = segment.value !== null || (isMulti && currentMultiValues.length > 0);
  const hasOptions = segment.optionSource !== 'freeText';

  useEffect(() => {
    if (!isActive) {
      return;
    }
    // For freeText segments, pre-populate with the current value so the user can edit it.
    // For other sources, start with empty to trigger a fresh search.
    const initial = segment.optionSource === 'freeText' ? (segment.value ?? '') : '';
    setInputValue(initial);
    loadOptions(initial);
    requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setHighlightedIndex(-1);
    loadOptions(val);
    // For freeText segments, save on every change so deactivation always preserves the typed value
    if (!hasOptions) {
      onValueChange(val || null);
    }
  }, [loadOptions, setHighlightedIndex, hasOptions, onValueChange]);

  // Multi: add one value, keep chip open for next
  // If '*' is selected, clear other values; if a non-'*' value is selected, remove '*'
  const addMultiValue = useCallback((val: string) => {
    if (!val) {
      return;
    }
    let newValues: string[];
    if (val === '*') {
      newValues = ['*'];
    } else {
      newValues = [...currentMultiValues.filter((v) => v !== '*'), val];
    }
    onMultiValuesChange?.(newValues);
    setInputValue('');
    setHighlightedIndex(-1);
    loadOptions('');
  }, [currentMultiValues, onMultiValuesChange, loadOptions, setHighlightedIndex]);

  // Single: set value and close
  const confirmSingle = useCallback((val: string) => {
    onValueChange(val || null);
    onConfirm();
  }, [onValueChange, onConfirm]);

  const handleBlur = useCallback(() => {
    // Blur always deactivates without advancing to next placeholder.
    // This prevents race conditions when the user clicks outside (e.g. on the "+" button)
    // while a placeholder is active — blur closing and click opening would conflict.
    // Multi values are already saved via onMultiValuesChange, so no data is lost.
    onDeactivate();
  }, [onDeactivate]);

  // Resolve which group (if any) an option belongs to
  const getOptionGroupId = useCallback((val: string): string | null => {
    if (!optionGroups) {
      return null;
    }
    for (const group of optionGroups) {
      if (group.options.some((o) => String(o.value) === val)) {
        return group.groupId;
      }
    }
    return null;
  }, [optionGroups]);

  // For grouped sources, apply multi-value filtering per-group; for flat, filter as before
  const filteredGroups: OptionGroup[] | null = useMemo(() => {
    if (!optionGroups) {
      return null;
    }
    if (!isMulti || currentMultiValues.length === 0) {
      return optionGroups;
    }
    const selected = new Set(currentMultiValues);
    return optionGroups
      .map((g) => ({ ...g, options: g.options.filter((o) => !selected.has(String(o.value))) }))
      .filter((g) => g.options.length > 0);
  }, [optionGroups, isMulti, currentMultiValues]);

  const filteredOptions = useMemo(() => {
    if (filteredGroups) {
      return filteredGroups.flatMap((g) => g.options);
    }
    if (!isMulti || currentMultiValues.length === 0) {
      return options;
    }
    const selected = new Set(currentMultiValues);
    return options.filter((o) => !selected.has(String(o.value)));
  }, [filteredGroups, options, isMulti, currentMultiValues]);

  const handleSelect = useCallback((val: string) => {
    const groupId = getOptionGroupId(val);
    if (groupId === 'stream' && onStreamFieldSelected) {
      onStreamFieldSelected(val);
      onConfirm();
      return;
    }
    if (isMulti) {
      addMultiValue(val);
    } else {
      confirmSingle(val);
    }
  }, [getOptionGroupId, onStreamFieldSelected, onConfirm, isMulti, addMultiValue, confirmSingle]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const picked = highlightedIndex >= 0 ? filteredOptions[highlightedIndex] : null;
    const pickedVal = picked ? String(picked.value) : inputValue;

    if (e.key === 'Backspace' && isMulti && inputValue === '' && currentMultiValues.length > 0) {
      e.preventDefault();
      const newValues = currentMultiValues.slice(0, -1);
      onMultiValuesChange?.(newValues);
      loadOptions('');
    } else if (handleNavigationKeyDown(e)) {
      // ArrowUp/Down handled by navigation hook
    } else if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      if (isMulti) {
        if (pickedVal) {
          handleSelect(pickedVal);
        } else {
          // Empty Enter on multi → finalize
          onConfirm();
        }
      } else {
        handleSelect(pickedVal);
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onDeactivate();
    } else if (e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      if (isMulti) {
        if (pickedVal) {
          handleSelect(pickedVal);
        }
        onConfirm();
      } else {
        handleSelect(pickedVal);
      }
    }
  }, [
    filteredOptions, highlightedIndex, inputValue, isMulti,
    currentMultiValues, handleSelect, onMultiValuesChange, onConfirm, onDeactivate, loadOptions,
    handleNavigationKeyDown,
  ]);

  const displayText = isFilled
    ? isMulti && currentMultiValues.length > 0
      ? currentMultiValues.join(', ')
      : (segment.value ?? '')
    : segment.displayHint;

  const showDropdown = isActive && hasOptions && filteredOptions.length > 0;

  const renderOption = (opt: ComboboxOption, index: number) => (
    <div
      key={String(opt.value)}
      data-option-item='true'
      className={cx(styles.optionItem, index === highlightedIndex && styles.optionItemHighlighted)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => handleSelect(String(opt.value))}
      onMouseEnter={() => setHighlightedIndex(index)}
    >
      <span className={styles.optionLabel}>{opt.label ?? opt.value}</span>
      {opt.description && <span className={styles.optionDescription}>{opt.description}</span>}
    </div>
  );

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
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onBlur={handleBlur}
              placeholder={isMulti && currentMultiValues.length > 0 ? '' : segment.displayHint}
              size={Math.max(inputValue.length || (isMulti && currentMultiValues.length > 0 ? 1 : segment.displayHint.length), 2)}
            />
          </>
        ) : (
          displayText
        )}
      </span>

      {showDropdown && (
        <FloatingDropdown floatingRef={setFloating} floatingStyles={floatingStyles} className={styles.optionsList}>
          <div ref={listRef} onMouseDown={(e) => e.preventDefault()}>
            {filteredGroups ? (
              // Grouped rendering — flat index is pre-computed via filteredOptions order
              filteredGroups.map((group) => (
                <div key={group.groupId}>
                  <div className={styles.optionGroupLabel}>{group.groupLabel}</div>
                  {group.options.map((opt) => {
                    const flatIndex = filteredOptions.indexOf(opt);
                    return renderOption(opt, flatIndex);
                  })}
                </div>
              ))
            ) : (
              // Flat rendering
              filteredOptions.map((opt, index) => renderOption(opt, index))
            )}
          </div>
        </FloatingDropdown>
      )}
    </>
  );
};
