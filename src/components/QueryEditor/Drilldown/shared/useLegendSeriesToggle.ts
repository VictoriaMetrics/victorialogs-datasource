import { useCallback, useEffect, useMemo, useState } from 'react';

import { FieldConfigSource, FieldType, getFieldDisplayName, PanelData } from '@grafana/data';
import { PanelContext, SeriesVisibilityChangeMode, usePanelContext } from '@grafana/ui';

interface LegendSeriesToggle {
  /** Display labels of the selected series. An empty set means no narrowing */
  selected: Set<string>;
  /** Provide it around the PanelRenderer with PanelContextProvider */
  panelContext: PanelContext;
  /** The base config plus hideFrom overrides for the series that are not selected */
  fieldConfig: FieldConfigSource;
}

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
 * Interactive legend for a PanelRenderer chart. A click isolates a series, ctrl or cmd click
 * adds or removes one, and clicking the only selected series resets the selection. The chart
 * hides the series that are not selected but keeps them greyed out in the legend, so the user
 * can always undo a selection. The caller must memoize `allLabels`
 */
export const useLegendSeriesToggle = (allLabels: string[], baseFieldConfig: FieldConfigSource): LegendSeriesToggle => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // a refetch can drop series the selection still references. Pruning them stops the
  // selection from hiding every series that is left
  useEffect(() => {
    setSelected((prev) => {
      const existing = new Set(allLabels);
      const pruned = new Set([...prev].filter((label) => existing.has(label)));
      return pruned.size === prev.size ? prev : pruned;
    });
  }, [allLabels]);

  const onToggleSeriesVisibility = useCallback((label: string | string[] | null, mode: SeriesVisibilityChangeMode) => {
    setSelected((prev) => {
      if (label === null) {
        return new Set();
      }
      const labels = Array.isArray(label) ? label : [label];
      if (mode === SeriesVisibilityChangeMode.AppendToSelection) {
        const next = new Set(prev);
        for (const l of labels) {
          if (next.has(l)) {
            next.delete(l);
          } else {
            next.add(l);
          }
        }
        return next;
      }
      // a plain click isolates the series, and clicking the isolated selection resets it
      const isSameSelection = prev.size === labels.length && labels.every((l) => prev.has(l));
      return isSameSelection ? new Set() : new Set(labels);
    });
  }, []);

  // the handler reaches the legend only through the panel context. Without it the timeseries
  // panel renders the legend items as plain text
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
