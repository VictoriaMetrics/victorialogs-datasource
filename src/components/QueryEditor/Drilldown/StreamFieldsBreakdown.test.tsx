import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';

import { type PanelRendererProps } from '@grafana/runtime';

import { StreamFieldsBreakdown } from './StreamFieldsBreakdown';
import { makeDatasource, query, range } from './queries/hookTestUtils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelRenderer: (_props: PanelRendererProps) => <div data-testid='panel' />,
}));

// the values level is FieldValuesTable's own concern — here only the navigation matters
jest.mock('./FieldValuesTable', () => ({
  FieldValuesTable: ({ field }: { field: string }) => <div data-testid='values-table'>{field}</div>,
}));

beforeAll(() => {
  // jsdom has no ResizeObserver — stub it for useElementWidth
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const streamFields = [
  { value: 'namespace', hits: 42 },
  { value: 'pod', hits: 7 },
];

/** Owns the drill state the way DrilldownDrawer/ValueDetails do */
const Harness: React.FC = () => {
  const [drillField, setDrillField] = useState<string>();
  return (
    <StreamFieldsBreakdown
      datasource={makeDatasource()}
      query={query}
      range={range}
      streamFields={streamFields}
      loading={false}
      drillField={drillField}
      onDrillFieldChange={setDrillField}
      onFilterClick={jest.fn()}
    />
  );
};

describe('StreamFieldsBreakdown', () => {
  it('lists the stream fields with their hit counts on the fields level', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'namespace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'pod' })).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('opens the values level of a clicked field under a breadcrumb', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'namespace' }));
    expect(screen.getByTestId('values-table')).toHaveTextContent('namespace');
    expect(screen.getByRole('button', { name: 'Stream fields' })).toBeInTheDocument();
  });

  it('returns to the fields level via the breadcrumb', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'pod' }));
    await userEvent.click(screen.getByRole('button', { name: 'Stream fields' }));
    expect(screen.queryByTestId('values-table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'namespace' })).toBeInTheDocument();
  });
});
