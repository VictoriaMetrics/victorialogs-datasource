import { css } from '@emotion/css';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Tab, TabsBar, useStyles2 } from '@grafana/ui';

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
        // the close button is a sibling of the Tab, not its suffix: the suffix renders inside the
        // Tab's own `<button role="tab">`, and an interactive element must not nest in another one
        <div key={field} className={styles.closableTab}>
          <Tab label={breakdownTabLabel(field)} active={active === field} onChangeTab={() => onSelect(field)} />
          <span className={styles.closeTabButton}>
            <IconButton
              name='times'
              size='sm'
              aria-label={`Close ${field} tab`}
              tooltip={`Close ${field} tab`}
              onClick={() => onCloseField(field)}
            />
          </span>
        </div>
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
  // the close button overlays the right end of the Tab, whose padding makes room for it. The
  // Tab's hover and active underline then still span the close button, as they did with a suffix
  closableTab: css({
    position: 'relative',
    '& [role="tab"]': {
      paddingRight: theme.spacing(4.5),
    },
  }),
  closeTabButton: css({
    position: 'absolute',
    top: 0,
    bottom: 0,
    // the Tab item's side padding plus its button's side padding
    right: 16,
    display: 'flex',
    alignItems: 'center',
  }),
});
