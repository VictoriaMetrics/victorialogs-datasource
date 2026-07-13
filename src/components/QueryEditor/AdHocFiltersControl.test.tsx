import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { CoreApp } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../datasource';
import { AdHocFilter, Query } from '../../types';

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

});
