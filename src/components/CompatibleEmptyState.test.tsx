import { render, screen } from '@testing-library/react';
import React from 'react';

import * as grafanaUi from '@grafana/ui';

import { CompatibleEmptyState } from './CompatibleEmptyState';

jest.mock('@grafana/ui', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/ui'),
  EmptyState: jest.fn(({ message, children }) => (
    <div data-testid='grafana-empty-state'>
      {message}
      {children}
    </div>
  )),
}));

const mockedUi = grafanaUi as { EmptyState?: unknown };

describe('CompatibleEmptyState', () => {
  const originalEmptyState = mockedUi.EmptyState;

  afterEach(() => {
    mockedUi.EmptyState = originalEmptyState;
  });

  it('renders Grafana EmptyState when it is exported (Grafana 11+)', () => {
    render(
      <CompatibleEmptyState variant='not-found' message='No data'>
        details
      </CompatibleEmptyState>
    );

    const emptyState = screen.getByTestId('grafana-empty-state');
    expect(emptyState).toHaveTextContent('No data');
    expect(emptyState).toHaveTextContent('details');
  });

  it('renders a plain fallback when EmptyState is missing (Grafana 10.x)', () => {
    mockedUi.EmptyState = undefined;

    render(
      <CompatibleEmptyState variant='not-found' message='No data'>
        details
      </CompatibleEmptyState>
    );

    expect(screen.queryByTestId('grafana-empty-state')).not.toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('details')).toBeInTheDocument();
  });
});
