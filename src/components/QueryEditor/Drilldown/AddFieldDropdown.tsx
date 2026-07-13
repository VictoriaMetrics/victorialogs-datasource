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
  /** Wrapping element — also serves as the anchor the options list floats below, forwarded so the caller's outside-click detection can bound it */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Builder-style searchable field input rendered in place of the tab bar's "+" button.
 * Reuses the query builder's ChipDropdown/floating-ui plumbing (PlaceholderChip's dropdown) so
 * both surfaces share the same search UX and float above the Drawer via the same z-index fix;
 * loading/error states float in the same anchored panel instead of inflating the tab bar.
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

  // combined ref: keeps the caller's outside-click bounding element while also anchoring the
  // floating options list to it, mirroring how PlaceholderChip anchors its dropdown to the chip
  // span that contains its own input; memoized so floating-ui does not re-subscribe its
  // autoUpdate listeners on every keystroke re-render
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
        onChange={(e) => setSearch(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (handleNavigationKeyDown(e.nativeEvent)) {
            return;
          }
          if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            onSelect(String(options[highlightedIndex].value));
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
  // sits inline in the tab bar where the "+" button was; the options list floats below via the portal
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
