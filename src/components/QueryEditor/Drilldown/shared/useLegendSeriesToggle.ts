import { useCallback, useEffect, useMemo, useState } from 'react';

import { FieldConfigSource, FieldType, getFieldDisplayName, PanelData } from '@grafana/data';
import { PanelContext, SeriesVisibilityChangeMode, usePanelContext } from '@grafana/ui';

interface LegendSeriesToggle {
  /** Display labels of the currently selected series; empty set = no narrowing */
  selected: Set<string>;
  /** Panel context wired with the toggle handler — provide it around the PanelRenderer via PanelContextProvider */
  panelContext: PanelContext;
  /** Base field config extended with hideFrom overrides for the non-selected series */
  fieldConfig: FieldConfigSource;
}

/** Display labels of every numeric series in the panel data, for useLegendSeriesToggle */
export const getSeriesLabels = (data: PanelData): string[] => {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const frame of data.series) {
    for (const field of frame.fields) {
      if (field.type !== FieldType.number) {
        continue;
      }
      const label = getFieldDisplayName(field, frame, data.series);
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
  }
  return labels;
};

/**
 * Grafana-standard interactive legend for a PanelRenderer chart: clicking a legend item
 * isolates its series, ctrl/cmd+click appends/removes it, clicking the only selected one
 * resets. Non-selected series are hidden from the viz but stay greyed in the legend
 * (hideFrom overrides) so a selection can always be undone.
 * `allLabels` must be referentially stable between renders (memoized by the caller)
 */
export const useLegendSeriesToggle = (allLabels: string[], baseFieldConfig: FieldConfigSource): LegendSeriesToggle => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // a refetch may drop series the selection still references — prune them so the
  // selection can't silently hide everything that is left
  useEffect(() => {
    setSelected((prev) => {
      const existing = new Set(allLabels);
      const pruned = new Set([...prev].filter((label) => existing.has(label)));
      return pruned.size === prev.size ? prev : pruned;
    });
  }, [allLabels]);

  const onToggleSeriesVisibility = useCallback((label: string, mode: SeriesVisibilityChangeMode) => {
    setSelected((prev) => {
      if (mode === SeriesVisibilityChangeMode.AppendToSelection) {
        const next = new Set(prev);
        if (next.has(label)) {
          next.delete(label);
        } else {
          next.add(label);
        }
        return next;
      }
      // plain click isolates the series; clicking the only selected one resets the selection
      return prev.size === 1 && prev.has(label) ? new Set() : new Set([label]);
    });
  }, []);

  // the toggle handler reaches the legend through the panel context — without it the
  // timeseries panel renders legend items as inert text
  const baseContext = usePanelContext();
  const panelContext = useMemo(
    () => ({ ...baseContext, onToggleSeriesVisibility }),
    [baseContext, onToggleSeriesVisibility]
  );

  const fieldConfig = useMemo<FieldConfigSource>(() => {
    if (!selected.size) {
      return baseFieldConfig;
    }
    return {
      ...baseFieldConfig,
      overrides: [
        ...baseFieldConfig.overrides,
        ...allLabels
          .filter((label) => !selected.has(label))
          .map((label) => ({
            matcher: { id: 'byName', options: label },
            properties: [{ id: 'custom.hideFrom', value: { viz: true, legend: false, tooltip: true } }],
          })),
      ],
    };
  }, [baseFieldConfig, allLabels, selected]);

  return { selected, panelContext, fieldConfig };
};
