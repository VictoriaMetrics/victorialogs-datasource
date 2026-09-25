import { css } from '@emotion/css';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, ComboboxOption, Input, LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import { FloatingDropdown } from '../TemplateBuilder/FloatingDropdown';
import { ChipDropdown } from '../TemplateBuilder/PlaceholderChip/ChipDropdown';
import { useDropdownNavigation } from '../TemplateBuilder/hooks/useDropdownNavigation';
import { useFloatingDropdown } from '../TemplateBuilder/hooks/useFloatingDropdown';

interface AddFieldDropdownProps {
  fieldNames: string[];
  onSelect: (field: string) => void;
  loading: boolean;
  error?: string;
  /** The wrapping element. The options list floats below it, and the caller's outside-click detection uses it as the boundary */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Searchable field input that replaces the tab bar's "+" button. It reuses the query builder's
 * ChipDropdown, so both surfaces share one search experience and the same z-index fix that
 * floats them above the Drawer. The loading and error states appear in that floating panel, so
 * they never change the height of the tab bar
 */
export const AddFieldDropdown: React.FC<AddFieldDropdownProps> = ({
  fieldNames,
  onSelect,
  loading,
  error,
  containerRef,
}) => {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const options: ComboboxOption[] = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term ? fieldNames.filter((f) => f.toLowerCase().includes(term)) : fieldNames;
    return filtered.map((field) => ({ value: field, label: field }));
  }, [fieldNames, search]);

  const { refs, floatingStyles } = useFloatingDropdown({ open: true, minHeight: 60, maxHeight: 280 });
  const { highlightedIndex, setHighlightedIndex, handleNavigationKeyDown, listRef } = useDropdownNavigation({
    itemCount: options.length,
    isOpen: true,
    initialIndex: -1,
  });

  // one ref serves as both the caller's outside-click boundary and the anchor of the floating
  // options list. It is memoized so floating-ui does not re-subscribe its autoUpdate listeners
  // on every keystroke
  const setContainerRef = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      refs.setReference(el);
    },
    [containerRef, refs]
  );

  return (
    <div ref={setContainerRef} className={styles.wrapper}>
      <Input
        ref={inputRef}
        autoFocus
        placeholder='Search fields'
        value={search}
        onChange={(e) => {
          setSearch(e.currentTarget.value);
          // the options list changes with the search, so a previous highlight may point past its end
          setHighlightedIndex(-1);
        }}
        onKeyDown={(e) => {
          if (handleNavigationKeyDown(e.nativeEvent)) {
            return;
          }
          const highlighted = highlightedIndex >= 0 ? options[highlightedIndex] : undefined;
          if (e.key === 'Enter' && highlighted) {
            e.preventDefault();
            onSelect(String(highlighted.value));
          }
        }}
        width={30}
      />
      {(loading || error) && (
        <FloatingDropdown floatingRef={refs.setFloating} floatingStyles={floatingStyles} className={styles.statusPanel}>
          {loading ? (
            <LoadingPlaceholder text='Loading fields...' />
          ) : (
            <Alert severity='error' title='Failed to load fields'>
              {error}
            </Alert>
          )}
        </FloatingDropdown>
      )}
      {!loading && !error && options.length > 0 && (
        <ChipDropdown
          options={options}
          optionGroups={null}
          highlightedIndex={highlightedIndex}
          onHighlight={setHighlightedIndex}
          onSelect={onSelect}
          floatingRef={refs.setFloating}
          floatingStyles={floatingStyles}
          listRef={listRef}
        />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  // sits inline where the "+" button was, and the options list floats below it through the portal
  wrapper: css({
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'center',
    margin: theme.spacing(0, 0.5),
  }),
  statusPanel: css({
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z2,
    padding: theme.spacing(1),
    minWidth: 160,
  }),
});
