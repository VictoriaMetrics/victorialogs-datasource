import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Button, useStyles2 } from '@grafana/ui';

import { FloatingDropdown } from '../FloatingDropdown';
import { useDropdownNavigation } from '../hooks/useDropdownNavigation';
import { useFloatingDropdown } from '../hooks/useFloatingDropdown';
import { getStyles } from '../styles';
import { getMenuGroups } from '../templates/registry';

import { usePipeTypeSearch } from './usePipeTypeSearch';

interface Props {
  isOpen: boolean;
  onAdd: (templateType: string) => void;
  onOpenMenu: () => void;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
}

export const PipeTypeSearchMenu: React.FC<Props> = ({ isOpen, onAdd, onOpenMenu, onClose, anchorEl }) => {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { refs: floatingRefs, floatingStyles } = useFloatingDropdown({ open: isOpen, offsetPx: 4, maxHeight: 320, minHeight: 100 });
  const setReference = floatingRefs.setReference;
  const setFloating = floatingRefs.setFloating;

  // When an external anchor element is provided (e.g. from InsertableSeparator),
  // use it as the floating-ui reference instead of the internal button.
  // useLayoutEffect runs before paint, preventing the menu from visually jumping.
  useLayoutEffect(() => {
    if (anchorEl) {
      setReference(anchorEl);
    } else if (buttonRef.current) {
      setReference(buttonRef.current);
    }
  }, [anchorEl, setReference]);

  const allGroups = useMemo(() => getMenuGroups(), []);
  const { displayGroups, navItems, flatIndexMap } = usePipeTypeSearch(search, allGroups);

  const { highlightedIndex, setHighlightedIndex, handleNavigationKeyDown, listRef } = useDropdownNavigation({
    itemCount: navItems.length,
    isOpen,
    initialIndex: 0,
  });

  useEffect(() => {
    // Reset search on every open/close; focus input when opening
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch('');
    if (isOpen) {
      requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
    }
  }, [isOpen]);

  // Reset highlighted index when search filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, setHighlightedIndex]);

  const handleSelect = useCallback((type: string) => {
    onAdd(type);
    onClose();
  }, [onAdd, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (handleNavigationKeyDown(e)) {
      // ArrowUp/Down handled by navigation hook
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const item = navItems[highlightedIndex];
      if (item) {
        handleSelect(item.type);
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      buttonRef.current?.focus();
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const item = navItems[highlightedIndex];
      if (item) {
        handleSelect(item.type);
      }
    }
  }, [navItems, highlightedIndex, handleSelect, onClose, handleNavigationKeyDown]);

  const handleButtonClick = useCallback(() => {
    // If menu is open and anchored to this button (no external anchor) → close (toggle).
    // Otherwise (closed, or open at an insert position) → open at this button.
    if (isOpen && !anchorEl) {
      onClose();
    } else {
      onOpenMenu();
    }
  }, [isOpen, anchorEl, onClose, onOpenMenu]);

  return (
    <>
      <Button
        ref={(el) => {
          buttonRef.current = el;
          if (!anchorEl) {
            (setReference as (el: HTMLButtonElement | null) => void)(el);
          }
        }}
        size={'sm'}
        variant='secondary'
        icon='plus'
        aria-label='Add pipe'
        aria-expanded={isOpen}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleButtonClick}
      />

      {isOpen && (
        <FloatingDropdown floatingRef={setFloating} floatingStyles={floatingStyles} className={styles.pipeSearchPanel}>
          <div className={styles.pipeSearchInputRow}>
            <input
              ref={inputRef}
              className={styles.pipeSearchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Search step type…'
              autoComplete='off'
            />
          </div>
          <div ref={listRef} className={styles.pipeSearchList}>
            {displayGroups.map((group) => (
              <div key={group.label}>
                {!search.trim() && (
                  <div className={styles.pipeSearchGroupLabel}>{group.label}</div>
                )}
                {group.items.map((item) => {
                  const idx = flatIndexMap.get(item.type) ?? -1;
                  return (
                    <div
                      key={item.type}
                      data-option-item='true'
                      className={cx(
                        styles.pipeSearchItem,
                        idx === highlightedIndex && styles.pipeSearchItemHighlighted
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(item.type)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                    >
                      <span className={styles.pipeSearchItemLabel}>{item.label}</span>
                      {item.description && (
                        <span className={styles.pipeSearchItemDesc}>{item.description}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {navItems.length === 0 && (
              <div className={styles.pipeSearchEmpty}>No matches</div>
            )}
          </div>
        </FloatingDropdown>
      )}
    </>
  );
};
