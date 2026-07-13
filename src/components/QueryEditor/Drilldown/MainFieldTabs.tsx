import { css, cx } from '@emotion/css';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, Tab, TabsBar, useStyles2 } from '@grafana/ui';

import { AddFieldDropdown } from './AddFieldDropdown';
import { breakdownTabLabel } from './breakdownField';

/** Sentinel key of the fixed main-view Patterns tab — not a field name, can't collide with one */
export const PATTERNS_TAB = '$patterns';

interface MainFieldTabsProps {
  tabs: string[];
  /** A field name from `tabs`, or PATTERNS_TAB */
  active?: string;
  /** Seeded default tabs that must always stay available — rendered without a close affordance */
  unclosableTabs?: string[];
  /** Count badge for the fixed Patterns tab, shown once patterns have been loaded */
  patternsCounter?: React.ComponentType<{ className?: string }>;
  onSelect: (tab: string) => void;
  onAddField: (field: string) => void;
  onCloseField: (field: string) => void;
  fieldNames: string[];
  fieldsLoading: boolean;
  fieldsError?: string;
}

/**
 * Builds the close-icon suffix for a field tab; a click closes the tab without also activating it.
 * Rendered as a `span` rather than `IconButton` — the suffix is nested inside the Tab's own
 * `<button>`, and a `<button>` inside a `<button>` is invalid DOM nesting.
 */
const makeCloseTabSuffix = (
  field: string,
  onCloseField: (field: string) => void
): React.ComponentType<{ className?: string }> => {
  const CloseTabSuffix: React.FC<{ className?: string }> = ({ className }) => {
    const styles = useStyles2(getStyles);
    return (
      <span
        role='button'
        tabIndex={0}
        aria-label={`Close ${field} tab`}
        className={cx(className, styles.closeTabIcon)}
        onClick={(e) => {
          e.stopPropagation();
          onCloseField(field);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
          // Space would otherwise scroll the drawer, since this span isn't a native button
            e.preventDefault();
            e.stopPropagation();
            onCloseField(field);
          }
        }}
      >
        <Icon name='times' />
      </span>
    );
  };
  return CloseTabSuffix;
};

/** Main-view tab bar: one tab per breakdown field (user-added ones closable), a fixed Patterns tab, and a "+" to open more */
export const MainFieldTabs: React.FC<MainFieldTabsProps> = ({
  tabs,
  active,
  unclosableTabs = [],
  patternsCounter,
  onSelect,
  onAddField,
  onCloseField,
  fieldNames,
  fieldsLoading,
  fieldsError,
}) => {
  const styles = useStyles2(getStyles);
  const [addOpen, setAddOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // fields already open as tabs don't need to be offered again
  const availableFieldNames = useMemo(() => fieldNames.filter((field) => !tabs.includes(field)), [fieldNames, tabs]);

  // unclosableTabs is a new array on every render — a stable string key keeps the memos below honest
  const unclosableKey = unclosableTabs.join(',');

  // bar order: seeded defaults (service, streams), then Patterns, then user-added fields
  // in the order they were added — the defaults/added split comes from unclosableTabs
  const { defaultFieldTabs, addedFieldTabs } = useMemo(
    () => ({
      defaultFieldTabs: tabs.filter((field) => unclosableTabs.includes(field)),
      addedFieldTabs: tabs.filter((field) => !unclosableTabs.includes(field)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabs, unclosableKey]
  );

  // memoized per field so each Tab's `suffix` component keeps a stable identity across renders —
  // a fresh component type on every render would make React remount the suffix each time
  const closeTabSuffixes = useMemo(() => {
    const suffixes = new Map<string, React.ComponentType<{ className?: string }>>();
    for (const field of tabs) {
      if (!unclosableTabs.includes(field)) {
        suffixes.set(field, makeCloseTabSuffix(field, onCloseField));
      }
    }
    return suffixes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, unclosableKey, onCloseField]);

  const handleAddField = (field: string) => {
    onAddField(field);
    setAddOpen(false);
  };

  // dismiss the popover on an outside click or Escape; Escape also returns focus to the "+" button
  useEffect(() => {
    if (!addOpen) {
      return;
    }
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // the options list itself lives in a document.body portal (FloatingDropdown), outside
      // popoverRef's subtree — exclude it too, or picking an option would close the popover first
      const inPortal = (target as Element).closest?.('[data-floating-portal]');
      if (popoverRef.current?.contains(target) || addButtonRef.current?.contains(target) || inPortal) {
        return;
      }
      setAddOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // this handler only runs while the popover is open, so stopping propagation here can't
        // swallow Escape at other times — without it, the bubble-phase Escape also reaches the
        // Drawer's own document listener and closes the whole drawer along with the popover
        e.stopPropagation();
        setAddOpen(false);
        // the "+" button mounts back in place of the search input on the re-render this
        // setAddOpen just scheduled — refocus it only after React has committed that swap
        requestAnimationFrame(() => requestAnimationFrame(() => addButtonRef.current?.focus()));
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    // capture phase: the "+" button's own Tooltip (opened by focus) stops propagation of its
    // Escape handling in the bubble phase, so a bubble-phase document listener never sees it
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [addOpen]);

  return (
    <TabsBar>
      {defaultFieldTabs.map((field) => (
        <Tab
          key={field}
          label={breakdownTabLabel(field)}
          active={active === field}
          onChangeTab={() => onSelect(field)}
        />
      ))}
      <Tab
        label='Patterns'
        active={active === PATTERNS_TAB}
        onChangeTab={() => onSelect(PATTERNS_TAB)}
        suffix={patternsCounter}
      />
      {addedFieldTabs.map((field) => (
        <Tab
          key={field}
          label={breakdownTabLabel(field)}
          active={active === field}
          onChangeTab={() => onSelect(field)}
          suffix={closeTabSuffixes.get(field)}
        />
      ))}
      {/* the search input takes the "+" button's place in the bar; its options list floats below it */}
      {addOpen ? (
        <AddFieldDropdown
          fieldNames={availableFieldNames}
          onSelect={handleAddField}
          loading={fieldsLoading}
          error={fieldsError}
          containerRef={popoverRef}
        />
      ) : (
        <span className={styles.addButton}>
          <IconButton
            ref={addButtonRef}
            name='plus'
            aria-label='Add field tab'
            tooltip='Add field tab'
            onClick={() => setAddOpen(true)}
          />
        </span>
      )}
    </TabsBar>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  // centers the "+" affordance in the bar row — TabsBar's own children are bottom-aligned tabs
  addButton: css({
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'center',
  }),
  closeTabIcon: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    // a fixed square centered on the glyph keeps the hover backdrop even on all sides
    width: 20,
    height: 20,
    verticalAlign: 'middle',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    // the Tab button styles every descendant svg with margin-right (meant for its leading
    // icon) — that skews the hover area of this suffix sideways, so undo it here
    '& svg': {
      margin: 0,
    },
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: -2,
    },
  }),
});
