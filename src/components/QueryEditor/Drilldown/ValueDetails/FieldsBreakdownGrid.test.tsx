import { render, screen } from '@testing-library/react';
import React from 'react';

import { dateTime, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';
import { FacetField } from '../queries/facets';

import { FieldsBreakdownGrid } from './FieldsBreakdownGrid';

const range: TimeRange = {
  from: dateTime('2026-07-06T00:00:00Z'),
  to: dateTime('2026-07-06T01:00:00Z'),
  raw: { from: 'now-1h', to: 'now' },
};

const renderGrid = (props: Partial<React.ComponentProps<typeof FieldsBreakdownGrid>> = {}) =>
  render(
    <FieldsBreakdownGrid
      datasource={{} as VictoriaLogsDatasource}
      query={{ refId: 'A', expr: '*' } as Query}
      range={range}
      facets={[]}
      fallbackFieldNames={[]}
      facetsLoading={false}
      noun='stream fields'
      onSelectField={jest.fn()}
      {...props}
    />
  );

describe('FieldsBreakdownGrid', () => {
  it('lists a facet without values in the chartless fallback section', () => {
    const facets: FacetField[] = [
      { name: 'empty', values: [] },
      { name: 'const', values: [{ value: 'v', hits: 1 }] },
    ];
    renderGrid({ facets, fallbackFieldNames: ['empty', 'const'] });

    expect(screen.getByText(/Fields without a summary/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'empty' })).toBeInTheDocument();
    // a single-value facet goes to the constant strip, not to the fallback list
    expect(screen.queryByRole('button', { name: 'const' })).not.toBeInTheDocument();
  });

  it('shows a load error instead of the summaries warning when the field list failed', () => {
    renderGrid({ fieldsError: 'boom', facetsError: 'facets down' });

    expect(screen.getByText('Failed to load stream fields')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.queryByText('Field summaries unavailable')).not.toBeInTheDocument();
  });

  it('reports the field list failure while the facets request is still loading', () => {
    renderGrid({ fieldsError: 'boom', facetsLoading: true, facets: [] });

    expect(screen.getByText('Failed to load stream fields')).toBeInTheDocument();
    expect(screen.queryByText('Loading stream fields...')).not.toBeInTheDocument();
  });

  it('warns that summaries are unavailable when only the facets failed', () => {
    renderGrid({ facetsError: 'facets down', fallbackFieldNames: ['app'] });

    expect(screen.getByText('Field summaries unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'app' })).toBeInTheDocument();
  });
});
