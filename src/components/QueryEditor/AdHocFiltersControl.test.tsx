import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { CoreApp } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../datasource';
import { AdHocFilter, Query, QueryEditorMode } from '../../types';

import { AdHocFiltersControl } from './AdHocFiltersControl';

// languageProvider is undefined → useAdHocFilterValidation returns {} (all chips treated valid)
const datasource = {
  languageProvider: undefined,
  interpolateString: (s: string) => s,
  customQueryParameters: undefined,
} as unknown as VictoriaLogsDatasource;

const renderControl = (filters: AdHocFilter[]) => {
  const query: Query = { refId: 'A', expr: '', adHocFilters: filters };
  return render(
    <AdHocFiltersControl
      datasource={datasource}
      query={query}
      app={CoreApp.Explore}
      onChange={jest.fn()}
      onRunQuery={jest.fn()}
    />
  );
};

describe('AdHocFiltersControl', () => {
  it('renders move-to-query and delete buttons for a normal chip', () => {
    renderControl([{ key: 'service', operator: '=', value: 'api' }]);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('hides the move-to-query button for a fromLevelFilter chip, keeping delete', () => {
    renderControl([{ key: 'level', operator: '=', value: 'error', fromLevelFilter: true }]);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('only the level chip loses its move-to-query button in a mixed list', () => {
    renderControl([
      { key: 'service', operator: '=', value: 'api' },
      { key: 'level', operator: '=', value: 'error', fromLevelFilter: true },
    ]);
    // normal chip: move + delete (2) + level chip: delete only (1) = 3
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('renders exact-match chips with the unified in/not_in operator label', () => {
    renderControl([
      { key: 'service', operator: '!=', value: 'api' },
      { key: 'app', operator: '=|', value: 'nginx', values: ['nginx'] },
    ]);
    expect(screen.getByText('service :!')).toBeInTheDocument();
    expect(screen.getByText('app :')).toBeInTheDocument();
    expect(screen.getByText('api')).toBeInTheDocument();
  });

  it('keeps the native operator in the label for regex chips', () => {
    renderControl([{ key: 'app', operator: '=~', value: 'ngin.*' }]);
    expect(screen.getByText('app :=~')).toBeInTheDocument();
  });

  it('moves the filter into the builder model as a prepended pipe in builder mode', () => {
    const onChange = jest.fn();
    const query: Query = {
      refId: 'A',
      expr: '*',
      editorMode: QueryEditorMode.Builder,
      templateBuilder: { pipes: [] },
      adHocFilters: [{ key: 'foo', operator: '=', value: 'bar' }],
    };
    render(
      <AdHocFiltersControl
        datasource={datasource}
        query={query}
        app={CoreApp.Explore}
        onChange={onChange}
        onRunQuery={jest.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('Move to query'));
    const updated = onChange.mock.calls[0][0];
    expect(updated.expr).toBe('foo:in("bar")');
    expect(updated.templateBuilder.pipes).toHaveLength(1);
    expect(updated.templateBuilder.pipes[0].templateType).toBe('exact');
    expect(updated.adHocFilters).toBeUndefined();
  });
});
