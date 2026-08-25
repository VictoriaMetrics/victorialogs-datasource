import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { dateTime, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { AdHocFilter } from '../../../../types';

import { DrilldownFiltersRow } from './DrilldownFiltersRow';

// useFieldFetch (mounted by the in-place editor) resolves template variables through the
// runtime singleton, which is not initialized in unit tests
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ getVariables: () => [] }),
}));

/** The options list renders in a document.body portal (FloatingDropdown) — scope queries to it,
 * same helper as AddFilterControl.test.tsx */
const getOptionsPortal = () => within(document.querySelector('[data-floating-portal]') as HTMLElement);

const datasource = {
  languageProvider: undefined,
  interpolateString: (s: string) => s,
  customQueryParameters: undefined,
} as unknown as VictoriaLogsDatasource;

/** Datasource with working lookups — needed by tests that open the in-place editor */
const makeLookupDatasource = () => {
  // field-name lookups carry no `field`; value lookups do — one mock serves both
  const getFieldList = jest.fn(async ({ field }: { field?: string }) =>
    (field ? ['error', 'warn'] : ['level', 'app']).map((value) => ({ value, hits: 1 }))
  );
  return {
    languageProvider: { getFieldList },
    customQueryParameters: new URLSearchParams(),
    getQueryBuilderLimits: jest.fn(() => 100),
    getActiveLevelRules: jest.fn(() => []),
    interpolateString: jest.fn((s: string) => s),
  } as unknown as VictoriaLogsDatasource;
};

beforeAll(() => {
  // jsdom has no scrollIntoView — useDropdownNavigation calls it when the mouse hovers an option
  Element.prototype.scrollIntoView = jest.fn();
});

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

  it('hides level-button chips — their state lives on the LevelFilterRow buttons', () => {
    const filters: AdHocFilter[] = [
      { key: 'level', value: 'error', operator: '=', fromLevelFilter: true },
      { key: 'app', value: 'web', operator: '=' },
    ];
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

    expect(screen.queryByTitle('level:="error"')).not.toBeInTheDocument();
    expect(screen.getByTitle('app:="web"')).toBeInTheDocument();
  });

  it('removing a chip keeps hidden level-button chips in the reported list', async () => {
    const onFiltersChange = jest.fn();
    const levelChip: AdHocFilter = { key: 'level', value: 'error', operator: '=', fromLevelFilter: true };
    const filters: AdHocFilter[] = [levelChip, { key: 'app', value: 'web', operator: '=' }];
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

    await userEvent.click(screen.getByRole('button', { name: 'Remove filter app:="web"' }));

    expect(onFiltersChange).toHaveBeenCalledWith([levelChip]);
  });

  it('clicking the value segment opens the in-place editor; a picked value updates that filter', async () => {
    const onFiltersChange = jest.fn();
    const filters: AdHocFilter[] = [
      { key: 'level', value: 'error', operator: '=' },
      { key: 'app', value: 'web', operator: '=' },
    ];
    render(
      <DrilldownFiltersRow
        datasource={makeLookupDatasource()}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onApply={jest.fn()}
        timeRange={timeRange}
        existingFilters={filters}
        onAdd={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Edit value of filter level:="error"' }));
    await userEvent.click(await getOptionsPortal().findByText('warn'));

    expect(onFiltersChange).toHaveBeenCalledWith([
      { key: 'level', value: 'warn', operator: '=' },
      { key: 'app', value: 'web', operator: '=' },
    ]);
  });

  it('clicking the operator segment and picking "=~" updates only the operator', async () => {
    const onFiltersChange = jest.fn();
    const filters: AdHocFilter[] = [{ key: 'level', value: 'error', operator: '=' }];
    render(
      <DrilldownFiltersRow
        datasource={makeLookupDatasource()}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onApply={jest.fn()}
        timeRange={timeRange}
        existingFilters={filters}
        onAdd={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Edit operator of filter level:="error"' }));
    await userEvent.click(await getOptionsPortal().findByText('=~'));

    expect(onFiltersChange).toHaveBeenCalledWith([{ key: 'level', value: 'error', operator: '=~' }]);
  });

  it('Escape while editing reverts the chip unchanged', async () => {
    const onFiltersChange = jest.fn();
    const filters: AdHocFilter[] = [{ key: 'level', value: 'error', operator: '=' }];
    render(
      <DrilldownFiltersRow
        datasource={makeLookupDatasource()}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onApply={jest.fn()}
        timeRange={timeRange}
        existingFilters={filters}
        onAdd={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Edit operator of filter level:="error"' }));
    fireEvent.keyDown(await screen.findByRole('textbox'), { key: 'Escape' });

    expect(onFiltersChange).not.toHaveBeenCalled();
    expect(screen.getByTitle('level:="error"')).toBeInTheDocument();
  });

  it('multi-value chips are not editable in place — removal only', () => {
    const filters: AdHocFilter[] = [{ key: 'app', value: 'a', values: ['a', 'b'], operator: '=|' }];
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

    expect(screen.queryByRole('button', { name: /Edit (field|operator|value) of filter/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove filter/ })).toBeInTheDocument();
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
