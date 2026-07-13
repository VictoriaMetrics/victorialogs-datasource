import { css, cx } from '@emotion/css';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, Tab, TabsBar, useStyles2 } from '@grafana/ui';

import { AddFieldDropdown } from './AddFieldDropdown';
import { breakdownTabLabel } from './breakdownField';

/** Key of the fixed Patterns tab. It is not a field name, so it cannot collide with one */
export const PATTERNS_TAB = '$patterns';

interface MainFieldTabsProps {
  tabs: string[];
  /** A field name from `tabs`, or PATTERNS_TAB */
  active?: string;
  /** The seeded tabs, which always stay available and render without a close icon */
  unclosableTabs: string[];
  /** Count badge of the Patterns tab, shown once the patterns have loaded */
  patternsCounter?: React.ComponentType<{ className?: string }>;
  onSelect: (tab: string) => void;
  onAddField: (field: string) => void;
  onCloseField: (field: string) => void;
  fieldNames: string[];
  fieldsLoading: boolean;
  fieldsError?: string;
}

/**
 * Builds the close icon of a field tab. A click closes the tab without activating it. The icon
 * is a `span` rather than an IconButton, because it sits inside the Tab's own `<button>` and a
 * button inside a button is invalid DOM nesting
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
          // this span is not a native button, so Space would otherwise scroll the drawer
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

/** The main tab bar: one tab per breakdown field, a fixed Patterns tab, and a "+" that opens more fields */
export const MainFieldTabs: React.FC<MainFieldTabsProps> = ({
  tabs,
  active,
  unclosableTabs,
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

  // a field that already has a tab is not offered again
  const availableFieldNames = useMemo(() => fieldNames.filter((field) => !tabs.includes(field)), [fieldNames, tabs]);

  // the bar shows the seeded tabs first, then Patterns, then the user-added fields in the
  // order they were added. unclosableTabs is what splits the two groups
  const defaultFieldTabs = tabs.filter((field) => unclosableTabs.includes(field));
  const addedFieldTabs = tabs.filter((field) => !unclosableTabs.includes(field));

  // memoized per field, so a Tab's `suffix` keeps one component identity. A new component type
  // on every render would make React remount the suffix each time
  const closeTabSuffixes = useMemo(() => {
    const suffixes = new Map<string, React.ComponentType<{ className?: string }>>();
    for (const field of tabs) {
      if (!unclosableTabs.includes(field)) {
        suffixes.set(field, makeCloseTabSuffix(field, onCloseField));
      }
    }
    return suffixes;
  }, [tabs, unclosableTabs, onCloseField]);

  const handleAddField = (field: string) => {
    onAddField(field);
    setAddOpen(false);
  };

  // an outside click or Escape closes the popover, and Escape also returns focus to the "+" button
  useEffect(() => {
    if (!addOpen) {
      return;
    }
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // FloatingDropdown renders the options list in a document.body portal, outside the
      // popoverRef subtree. Without this check, picking an option would close the popover first
      const inPortal = (target as Element).closest?.('[data-floating-portal]');
      if (popoverRef.current?.contains(target) || addButtonRef.current?.contains(target) || inPortal) {
        return;
      }
      setAddOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // without this the Escape also reaches the Drawer's own listener and closes the whole
        // drawer. The handler runs only while the popover is open, so it swallows nothing else
        e.stopPropagation();
        setAddOpen(false);
        // the "+" button replaces the search input on the re-render setAddOpen just scheduled,
        // so refocus it only after React has committed that swap
        requestAnimationFrame(() => requestAnimationFrame(() => addButtonRef.current?.focus()));
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    // the capture phase is required: the "+" button's Tooltip, which focus opens, stops the
    // Escape from bubbling, so a bubble-phase document listener never sees it
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
  // centers the "+" in the row, because TabsBar aligns its own children to the bottom
  addButton: css({
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'center',
  }),
  closeTabIcon: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    // a fixed square around the glyph keeps the hover backdrop even on all sides
    width: 20,
    height: 20,
    verticalAlign: 'middle',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    // the Tab button gives every descendant svg a margin-right for its leading icon, which
    // skews this suffix sideways, so undo it here
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
