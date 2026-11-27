import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { dateTime, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../datasource';
import { Query } from '../../../types';
import { VictoriaLogsRequirement } from '../../../victoriaLogsCompat/victoriaLogsSupport';

import { ExportLogsModal } from './ExportLogsModal';
import { useUnmetCsvExport } from './useUnmetCsvExport';

jest.mock('./useUnmetCsvExport');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: { bootData: { user: { orgId: 3 } } },
}));

const START_MS = 1600000000000;
const END_MS = 1600000060000;

const timeRange: TimeRange = {
  from: dateTime(START_MS),
  to: dateTime(END_MS),
  raw: { from: 'now-1m', to: 'now' },
};

const query: Query = { refId: 'A', expr: 'app:$app' };

const csvExport: VictoriaLogsRequirement = {
  id: 'csvExport',
  feature: 'Download logs in the CSV format',
  needs: 'the format=csv query arg',
  link: 'https://example.com',
  pluginVersion: 'v0.35.0',
  minVersion: 'v1.49.0',
};

const renderModal = (unmetCsvExport?: VictoriaLogsRequirement) => {
  jest.mocked(useUnmetCsvExport).mockReturnValue(unmetCsvExport);
  const applied: Query = { ...query, expr: 'app:nginx', extraFilters: '{"level":"error"}', extraStreamFilters: '{app="nginx"}' };
  const datasource = {
    uid: 'vl-uid',
    applyTemplateVariables: jest.fn().mockReturnValue(applied),
  } as unknown as VictoriaLogsDatasource;
  const onClose = jest.fn();
  render(<ExportLogsModal datasource={datasource} query={query} timeRange={timeRange} onClose={onClose} />);
  return { onClose };
};

const downloadLink = () => screen.getByRole('link', { name: 'Download' });

const downloadParams = () => {
  const href = downloadLink().getAttribute('href') ?? '';
  return new URLSearchParams(href.split('?')[1]);
};

describe('ExportLogsModal', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('links to the export of the resolved query in JSON lines', () => {
    renderModal();

    expect(downloadLink().getAttribute('href')).toContain('api/datasources/uid/vl-uid/resources/export/logs?');
    expect(Object.fromEntries(downloadParams())).toEqual({
      orgId: '3',
      query: 'app:nginx',
      start: String(START_MS),
      end: String(END_MS),
      format: 'jsonl',
      extra_filters: '{"level":"error"}',
      extra_stream_filters: '{app="nginx"}',
    });
    expect(downloadLink()).toHaveAttribute('target', '_blank');
    expect(downloadLink()).not.toHaveAttribute('download');
  });

  it('shows the resolved query and its filters', () => {
    renderModal();

    expect(screen.getByText('app:nginx')).toBeInTheDocument();
    expect(screen.getByText('{"level":"error"}')).toBeInTheDocument();
    expect(screen.getByText('{app="nginx"}')).toBeInTheDocument();
  });

  it('switches the link to CSV', async () => {
    renderModal();

    await userEvent.click(screen.getByRole('radio', { name: 'CSV' }));

    expect(downloadParams().get('format')).toBe('csv');
  });

  it('disables CSV for a VictoriaLogs that does not support it', () => {
    renderModal(csvExport);

    expect(screen.getByRole('radio', { name: 'CSV' })).toBeDisabled();
    expect(screen.getByText('The CSV format needs VictoriaLogs v1.49.0 or newer.')).toBeInTheDocument();
  });

  it('keeps the time range of the moment it opened', () => {
    jest.mocked(useUnmetCsvExport).mockReturnValue(undefined);
    const datasource = {
      uid: 'vl-uid',
      applyTemplateVariables: jest.fn().mockReturnValue(query),
    } as unknown as VictoriaLogsDatasource;
    const laterRange: TimeRange = { ...timeRange, from: dateTime(START_MS + 1000), to: dateTime(END_MS + 1000) };
    const modalWith = (range: TimeRange) => (
      <ExportLogsModal datasource={datasource} query={query} timeRange={range} onClose={jest.fn()} />
    );
    const { rerender } = render(modalWith(timeRange));

    rerender(modalWith(laterRange));

    expect(downloadParams().get('start')).toBe(String(START_MS));
    expect(downloadParams().get('end')).toBe(String(END_MS));
  });

  it('closes on cancel', async () => {
    const { onClose } = renderModal();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
