import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { dateTime, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { AdHocFilter } from '../../../../types';

import { DrilldownFiltersRow } from './DrilldownFiltersRow';

const datasource = {
  languageProvider: undefined,
  interpolateString: (s: string) => s,
  customQueryParameters: undefined,
} as unknown as VictoriaLogsDatasource;

const timeRange: TimeRange = {
  from: dateTime('2026-07-06T00:00:00Z'),
  to: dateTime('2026-07-06T01:00:00Z'),
  raw: { from: 'now-1h', to: 'now' },
};

// shared defaults for the "+ Filter" control's props — most tests below don't exercise it and
// only need it to render without error
const addFilterDefaults = {
  existingFilters: [] as AdHocFilter[],
  onAdd: jest.fn(),
};

describe('DrilldownFiltersRow', () => {
  it('renders the local filters as segmented chips without the editor chrome', () => {
    const filters: AdHocFilter[] = [{ key: 'level', value: 'error', operator: '=' }];
    render(
      <DrilldownFiltersRow
        datasource={datasource}
        filters={filters}
        onFiltersChange={jest.fn()}
        onApply={jest.fn()}
        timeRange={timeRange}
        {...addFilterDefaults}
      />
    );

    // one segment per filter part; the full LogsQL form lives in the chip tooltip
    const chip = screen.getByTitle('level:="error"');
    expect(chip).toBeInTheDocument();
    expect(screen.getByText('level')).toBeInTheDocument();
    expect(screen.getByText('=')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    // bare chips only — no "Ad-hoc filters:" caption and no move-to-query control
    expect(screen.queryByText('Ad-hoc filters:')).not.toBeInTheDocument();
    expect(screen.queryByTestId('arrow-up')).not.toBeInTheDocument();
  });

  it('renders chips before the "+ Filter" control', () => {
    const filters: AdHocFilter[] = [{ key: 'level', value: 'error', operator: '=' }];
    render(
      <DrilldownFiltersRow
        datasource={datasource}
        filters={filters}
        onFiltersChange={jest.fn()}
        onApply={jest.fn()}
        timeRange={timeRange}
        {...addFilterDefaults}
      />
    );

    const chip = screen.getByTitle('level:="error"');
    const addButton = screen.getByRole('button', { name: 'Filter' });
    // DOCUMENT_POSITION_FOLLOWING: the add button comes after the chip in DOM order
    expect(chip.compareDocumentPosition(addButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the "+ Filter" control when there are no filters yet', () => {
    render(
      <DrilldownFiltersRow
        datasource={datasource}
        filters={[]}
        onFiltersChange={jest.fn()}
        onApply={jest.fn()}
        timeRange={timeRange}
        {...addFilterDefaults}
      />
    );

    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
  });

  it('removing a chip reports the remaining filters via onFiltersChange', async () => {
    const onFiltersChange = jest.fn();
    const filters: AdHocFilter[] = [
      { key: 'level', value: 'error', operator: '=' },
      { key: 'app', value: 'web', operator: '=' },
    ];
    render(
      <DrilldownFiltersRow
        datasource={datasource}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onApply={jest.fn()}
        timeRange={timeRange}
        {...addFilterDefaults}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remove filter level:="error"' }));

    expect(onFiltersChange).toHaveBeenCalledTimes(1);
    expect(onFiltersChange).toHaveBeenCalledWith([{ key: 'app', value: 'web', operator: '=' }]);
  });

  it('renders the zoom toolbar slot and fires onApply once', async () => {
    const onApply = jest.fn();
    render(
      <DrilldownFiltersRow
        datasource={datasource}
        filters={[]}
        onFiltersChange={jest.fn()}
        onApply={onApply}
        timeRange={timeRange}
        zoomToolbar={<span>fake-zoom-toolbar</span>}
        {...addFilterDefaults}
      />
    );

    expect(screen.getByText('fake-zoom-toolbar')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Go to editor' }));

    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
