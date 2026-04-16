import { cx } from '@emotion/css';
import React from 'react';

import { ComboboxOption, useStyles2 } from '@grafana/ui';

import { FloatingDropdown } from '../FloatingDropdown';

import { getStyles } from './styles';
import { OptionGroup } from './useOptionLoading';

interface Props {
  /** Flat list of options in display order — used as the source of truth for highlighted index */
  options: ComboboxOption[];
  /** Grouped rendering when non-null; falls back to flat rendering otherwise */
  optionGroups: OptionGroup[] | null;
  highlightedIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (value: string) => void;
  floatingRef: (el: HTMLElement | null) => void;
  floatingStyles: React.CSSProperties;
  listRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Presentational dropdown for PlaceholderChip. Renders flat or grouped options
 * inside a portal-based FloatingDropdown and delegates keyboard/mouse wiring to the parent.
 */
export const ChipDropdown: React.FC<Props> = ({
  options,
  optionGroups,
  highlightedIndex,
  onHighlight,
  onSelect,
  floatingRef,
  floatingStyles,
  listRef,
}) => {
  const styles = useStyles2(getStyles);

  const renderOption = (opt: ComboboxOption, index: number) => (
    <div
      key={String(opt.value)}
      data-option-item='true'
      className={cx(styles.optionItem, index === highlightedIndex && styles.optionItemHighlighted)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelect(String(opt.value))}
      onMouseEnter={() => onHighlight(index)}
    >
      <span className={styles.optionLabel}>{opt.label ?? opt.value}</span>
      {opt.description && <span className={styles.optionDescription}>{opt.description}</span>}
    </div>
  );

  return (
    <FloatingDropdown floatingRef={floatingRef} floatingStyles={floatingStyles} className={styles.optionsList}>
      <div ref={listRef} onMouseDown={(e) => e.preventDefault()}>
        {optionGroups ? (
          // Grouped rendering — flat index is pre-computed via options order
          optionGroups.map((group) => (
            <div key={group.groupId}>
              <div className={styles.optionGroupLabel}>{group.groupLabel}</div>
              {group.options.map((opt) => {
                const flatIndex = options.indexOf(opt);
                return renderOption(opt, flatIndex);
              })}
            </div>
          ))
        ) : (
          // Flat rendering
          options.map((opt, index) => renderOption(opt, index))
        )}
      </div>
    </FloatingDropdown>
  );
};
