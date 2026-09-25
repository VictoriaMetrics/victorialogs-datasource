import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { dateTime, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { AdHocFilter } from '../../../../types';

import { FilterChipEditor, FilterSegment, isEditableFilter } from './FilterChipEditor';

// useFieldFetch resolves template variables through the runtime singleton, which a unit test
// never initializes
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ getVariables: () => [] }),
}));

/** FloatingDropdown renders the options list in a document.body portal. Scope the queries to it,
 * so they do not match other elements with the same text */
const getOptionsPortal = () => within(document.querySelector('[data-floating-portal]') as HTMLElement);

/** The portal mounts only after the async options load, so wait for it before querying inside */
const findOption = async (text: string) => {
  await waitFor(() => {
    if (!document.querySelector('[data-floating-portal]')) {
      throw new Error('options portal not rendered yet');
    }
  });
  return getOptionsPortal().findByText(text);
};

const timeRange: TimeRange = {
  from: dateTime('2026-07-06T00:00:00Z'),
  to: dateTime('2026-07-06T01:00:00Z'),
  raw: { from: 'now-1h', to: 'now' },
};

const existingFilters: AdHocFilter[] = [{ key: 'app', value: 'web', operator: '=' }];

beforeAll(() => {
  // jsdom has no scrollIntoView, which useDropdownNavigation calls when the mouse hovers an option
  Element.prototype.scrollIntoView = jest.fn();
});

const makeDatasource = () => {
  // a field-name lookup carries no `field` and a value lookup does, so one mock serves both
  const getFieldList = jest.fn(async ({ field }: { field?: string }) =>
    (field ? ['error', 'warn'] : ['level', 'app']).map((value) => ({ value, hits: 1 }))
  );
  return {
    languageProvider: { getFieldList },
    customQueryParameters: new URLSearchParams(),
    getQueryBuilderLimits: jest.fn(() => 100),
    // buildLookupQuery builds the narrowing query out of these two
    getActiveLevelRules: jest.fn(() => []),
    interpolateString: jest.fn((s: string) => s),
  } as unknown as VictoriaLogsDatasource;
};

const editedFilter: AdHocFilter = { key: 'level', value: 'error', operator: '=' };

const renderEditor = (initialSegment: FilterSegment, initialFilter: AdHocFilter = editedFilter) => {
  const onCommit = jest.fn();
  const onCancel = jest.fn();
  render(
    <FilterChipEditor
      datasource={makeDatasource()}
      existingFilters={existingFilters}
      timeRange={timeRange}
      initialFilter={initialFilter}
      initialSegment={initialSegment}
      onCommit={onCommit}
      onCancel={onCancel}
    />
  );
  return { onCommit, onCancel };
};

describe('FilterChipEditor (edit mode)', () => {
  it('offers the regexp operators and commits an operator change right away, keeping the value', async () => {
    const { onCommit } = renderEditor('operator');

    for (const op of ['!=', '=~', '!~']) {
      expect(await findOption(op)).toBeInTheDocument();
    }
    await userEvent.click(getOptionsPortal().getByText('=~'));

    expect(onCommit).toHaveBeenCalledWith({ key: 'level', value: 'error', operator: '=~' });
  });

  it('commits a picked value with the field and operator kept', async () => {
    const { onCommit } = renderEditor('value');

    await userEvent.click(await findOption('warn'));

    expect(onCommit).toHaveBeenCalledWith({ key: 'level', value: 'warn', operator: '=' });
  });

  it('commits a free-typed regexp pattern as the value', async () => {
    const { onCommit } = renderEditor('value', { key: 'level', value: 'error', operator: '=~' });

    await userEvent.type(screen.getByPlaceholderText('value'), 'err.*{Enter}');

    expect(onCommit).toHaveBeenCalledWith({ key: 'level', value: 'err.*', operator: '=~' });
  });

  it('a picked field moves straight to the value step; the picked value commits with the new field', async () => {
    const { onCommit } = renderEditor('field');

    await userEvent.click(await findOption('app'));

    expect(screen.getByPlaceholderText('value')).toBeInTheDocument();
    await userEvent.click(await findOption('warn'));

    expect(onCommit).toHaveBeenCalledWith({ key: 'app', value: 'warn', operator: '=' });
  });

  it('confirming an empty value input keeps the pre-edit value', async () => {
    const { onCommit } = renderEditor('field');

    await userEvent.click(await findOption('app'));

    fireEvent.keyDown(screen.getByPlaceholderText('value'), { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledWith({ key: 'app', value: 'error', operator: '=' });
  });

  it('Escape cancels the edit without committing', async () => {
    const { onCommit, onCancel } = renderEditor('operator');

    fireEvent.keyDown(await screen.findByRole('textbox'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('the × button cancels the edit', async () => {
    const { onCommit, onCancel } = renderEditor('operator');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel editing filter' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('isEditableFilter', () => {
  it.each<[AdHocFilter, boolean]>([
    [{ key: 'level', value: 'error', operator: '=' }, true],
    [{ key: 'level', value: 'error', operator: '!=' }, true],
    [{ key: 'level', value: 'err.*', operator: '=~' }, true],
    [{ key: 'level', value: 'err.*', operator: '!~' }, true],
    // a multi-value chip supports removal only
    [{ key: 'app', value: 'a', values: ['a', 'b'], operator: '=|' }, false],
    // the editor does not offer the range operators
    [{ key: 'duration', value: '10', operator: '>' }, false],
    // the LevelFilterRow buttons own the level chips
    [{ key: 'level', value: 'error', operator: '=', fromLevelFilter: true }, false],
  ])('%o -> %s', (filter, expected) => {
    expect(isEditableFilter(filter)).toBe(expected);
  });
});
