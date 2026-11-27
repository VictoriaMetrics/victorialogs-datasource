import { dateTime, getDefaultTimeRange, PanelData, TimeRange } from '@grafana/data';

import { resolveExportRange } from './exportRange';

const rangeFrom = (fromMs: number): TimeRange => ({
  from: dateTime(fromMs),
  to: dateTime(fromMs + 60000),
  raw: { from: 'now-1m', to: 'now' },
});

const requestRange = rangeFrom(1600000000000);
const editorRange = rangeFrom(1700000000000);
const panelRange = rangeFrom(1800000000000);

describe('resolveExportRange', () => {
  it('uses the range of the last request', () => {
    const panelData = { request: { range: requestRange }, timeRange: panelRange } as unknown as PanelData;

    expect(resolveExportRange(panelData, editorRange)).toBe(requestRange);
  });

  it('uses the range of the editor when the panel has no request yet', () => {
    const panelData = { timeRange: panelRange } as unknown as PanelData;

    expect(resolveExportRange(panelData, editorRange)).toBe(editorRange);
  });

  it('uses the range of the panel data when the editor has no range', () => {
    const panelData = { timeRange: panelRange } as unknown as PanelData;

    expect(resolveExportRange(panelData, undefined)).toBe(panelRange);
  });

  it('uses the default range when there is no other range', () => {
    const defaultRange = getDefaultTimeRange();

    expect(resolveExportRange(undefined, undefined).raw).toEqual(defaultRange.raw);
  });
});
