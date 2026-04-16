import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useStyles2 } from '@grafana/ui';

import { FloatingDropdown } from '../FloatingDropdown';
import { useDropdownNavigation } from '../hooks/useDropdownNavigation';
import { MenuGroup } from '../templates/registry';

import { getStyles } from './styles';
import { usePipeTypeSearch } from './usePipeTypeSearch';

interface Props {
  groups: MenuGroup[];
  floatingRef: (el: HTMLElement | null) => void;
  floatingStyles: React.CSSProperties;
  excludeRef: React.RefObject<HTMLElement | null>;
  onAdd: (type: string) => void;
  onClose: () => void;
  onButtonFocus: () => void;
}

export const PipeTypeSearchPopup: React.FC<Props> = ({
  groups,
  floatingRef,
  floatingStyles,
  excludeRef,
  onAdd,
  onClose,
  onButtonFocus,
}) => {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { displayGroups, navItems, flatIndexMap } = usePipeTypeSearch(search, groups);

  const { highlightedIndex, setHighlightedIndex, handleNavigationKeyDown, listRef } = useDropdownNavigation({
    itemCount: navItems.length,
    isOpen: true,
    initialIndex: 0,
  });

  // Focus input on mount
  useEffect(() => {
    // Use two animation frames so focus happens after the popup is fully painted and any layout/portal
    requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
  }, []);

  // Close on click outside the popup, excluding the toggle button
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest?.('[data-floating-portal]')) {
        return;
      }
      if (excludeRef.current?.contains(target)) {
        return;
      }
      onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose, excludeRef]);

  // Reset highlighted index when search filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, setHighlightedIndex]);

  const handleSelect = useCallback(
    (type: string) => {
      onAdd(type);
      onClose();
    },
    [onAdd, onClose]
  );

  // Keyboard navigation on document level — added on mount, removed on unmount
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (handleNavigationKeyDown(e)) {
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const item = navItems[highlightedIndex];
        if (item) {
          handleSelect(item.type);
        }
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        onButtonFocus();
      } else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const item = navItems[highlightedIndex];
        if (item) {
          handleSelect(item.type);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navItems, highlightedIndex, handleSelect, onClose, onButtonFocus, handleNavigationKeyDown]);

  return (
    <FloatingDropdown floatingRef={floatingRef} floatingStyles={floatingStyles} className={styles.pipeSearchPanel}>
      <div className={styles.pipeSearchInputRow}>
        <input
          ref={inputRef}
          className={styles.pipeSearchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search step type…'
          autoComplete='off'
        />
      </div>
      <div ref={listRef} className={styles.pipeSearchList}>
        {displayGroups.map((group) => (
          <div key={group.label}>
            {!search.trim() && <div className={styles.pipeSearchGroupLabel}>{group.label}</div>}
            {group.items.map((item) => {
              const idx = flatIndexMap.get(item.type) ?? -1;
              return (
                <div
                  key={item.type}
                  data-option-item='true'
                  className={cx(styles.pipeSearchItem, idx === highlightedIndex && styles.pipeSearchItemHighlighted)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(item.type)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <span className={styles.pipeSearchItemLabel}>{item.label}</span>
                  {item.description && <span className={styles.pipeSearchItemDesc}>{item.description}</span>}
                </div>
              );
            })}
          </div>
        ))}
        {navItems.length === 0 && <div className={styles.pipeSearchEmpty}>No matches</div>}
      </div>
    </FloatingDropdown>
  );
};
