import { useMemo } from 'react';

import { MenuGroup } from '../templates/registry';

interface NavItem {
  type: string;
  label: string;
  description?: string;
}

interface UsePipeTypeSearchResult {
  /** Groups to render in the menu (filtered by search) */
  displayGroups: MenuGroup[];
  /** Flat list of items in display order — used for keyboard navigation */
  navItems: NavItem[];
  /** O(1) lookup of an item's flat index by template type — used during render */
  flatIndexMap: Map<string, number>;
}

/**
 * Pure search/filtering logic for PipeTypeSearchMenu.
 * Keeps the component focused on presentation and keyboard wiring.
 */
export function usePipeTypeSearch(search: string, allGroups: MenuGroup[]): UsePipeTypeSearchResult {
  const displayGroups = useMemo<MenuGroup[]>(() => {
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
  }, [search, allGroups]);

  const navItems = useMemo(() => displayGroups.flatMap((g) => g.items), [displayGroups]);

  const flatIndexMap = useMemo(
    () => new Map(navItems.map((item, i) => [item.type, i])),
    [navItems]
  );

  return { displayGroups, navItems, flatIndexMap };
}
