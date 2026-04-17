import { Dispatch, RefObject, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';

interface UseDropdownNavigationOptions {
  itemCount: number;
  isOpen: boolean;
  /** Initial highlighted index when dropdown opens. Use -1 for no selection (PlaceholderChip), 0 for first item (PipeTypeSearchMenu). */
  initialIndex?: number;
}

interface UseDropdownNavigationResult {
  highlightedIndex: number;
  setHighlightedIndex: Dispatch<SetStateAction<number>>;
  handleNavigationKeyDown: (e: KeyboardEvent) => boolean;
  listRef: RefObject<HTMLDivElement | null>;
}

export function useDropdownNavigation({
  itemCount,
  isOpen,
  initialIndex = -1,
}: UseDropdownNavigationOptions): UseDropdownNavigationResult {
  const [highlightedIndex, setHighlightedIndex] = useState(initialIndex);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset index when dropdown opens/closes
  useEffect(() => {
    setHighlightedIndex(initialIndex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) {
      return;
    }
    const items = listRef.current.querySelectorAll<HTMLElement>('[data-option-item]');
    items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  /**
   * Handles ArrowUp/ArrowDown keys. Returns true if the key was handled.
   */
  const handleNavigationKeyDown = useCallback((e: KeyboardEvent): boolean => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightedIndex((i) => Math.min(i + 1, itemCount - 1));
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightedIndex((i) => Math.max(i - 1, initialIndex));
      return true;
    }
    return false;
  }, [itemCount, initialIndex]);

  return { highlightedIndex, setHighlightedIndex, handleNavigationKeyDown, listRef };
}
