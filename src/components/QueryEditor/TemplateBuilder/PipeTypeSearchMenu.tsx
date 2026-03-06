import { cx } from '@emotion/css';
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useStyles2 } from '@grafana/ui';

import { getStyles } from './styles';
import { getMenuGroups } from './templates/registry';
import { useDropdownNavigation } from './useDropdownNavigation';

interface Props {
  isOpen: boolean;
  onAdd: (templateType: string) => void;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
}

export const PipeTypeSearchMenu: React.FC<Props> = ({ isOpen, onAdd, onClose, anchorEl }) => {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { refs: floatingRefs, floatingStyles } = useFloating({
    open: isOpen,
    placement: 'bottom-start',
    middleware: [offset(4), flip(), shift()],
    whileElementsMounted: autoUpdate,
  });
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

  const allGroups = getMenuGroups();

  const displayGroups = (() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return allGroups;
    }

    // Check if query matches a category keyword — if so, show that group only
    const keywordGroup = allGroups.find((g) =>
      g.keywords.some((kw) => kw.startsWith(q))
    );
    if (keywordGroup) {
      return [keywordGroup];
    }

    // Otherwise search by label and description across all items
    const matched = allGroups.flatMap((g) => g.items).filter((item) =>
      item.label.toLowerCase().includes(q) ||
      (item.description ?? '').toLowerCase().includes(q)
    );
    return [{ label: 'Results', keywords: [], items: matched }];
  })();

  // Flat index for keyboard navigation
  const navItems = displayGroups.flatMap((g) => g.items);

  const { highlightedIndex, setHighlightedIndex, handleNavigationKeyDown, listRef } = useDropdownNavigation({
    itemCount: navItems.length,
    isOpen,
    initialIndex: 0,
  });

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      return;
    }
    setSearch('');
    requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
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
      onAdd('__open__');
    }
  }, [isOpen, anchorEl, onClose, onAdd]);

  // Flat item index mapping through groups
  let flatCounter = -1;

  return (
    <>
      <button
        ref={(el) => {
          buttonRef.current = el;
          if (!anchorEl) {
            (setReference as (el: HTMLButtonElement | null) => void)(el);
          }
        }}
        className={styles.addPipeButton}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleButtonClick}
        aria-label='Add pipe'
        aria-expanded={isOpen}
        type='button'
      >
        +
      </button>

      {isOpen && (
        <div
          ref={setFloating}
          style={{ ...floatingStyles, zIndex: 1000 }}
          className={styles.pipeSearchPanel}
        >
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
                  flatCounter++;
                  const idx = flatCounter;
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
        </div>
      )}
    </>
  );
};
