import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { LoadingState } from '@grafana/data';
import { type PanelRendererProps } from '@grafana/runtime';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { buildValueVolumeQuery } from '../queries/drilldownQueries';
import { makeDatasource, makeLabeledFrame, query, range } from '../queries/hookTestUtils';

import { BreakdownTable, BreakdownTableItem, ProvidedRowVolumes } from './BreakdownTable';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelRenderer: (_props: PanelRendererProps) => <div data-testid='panel' />,
}));

const items = [
  { label: 'web', total: 12 },
  { label: 'api', total: 3 },
];

const renderTable = (
  datasource: VictoriaLogsDatasource,
  rowVolumes?: ProvidedRowVolumes,
  tableItems: BreakdownTableItem[] = items
) =>
  render(
    <BreakdownTable
      items={tableItems}
      loading={false}
      noun='values'
      searchPlaceholder='Search values'
      datasource={datasource}
      range={range}
      buildVolumeQuery={(label, refIdSuffix) =>
        buildValueVolumeQuery(query, 'app', label, { pipes: '', fields: ['level'] }, range, refIdSuffix)
      }
      rowVolumes={rowVolumes}
      renderActions={() => null}
      renderExpandedRow={() => null}
    />
  );

describe('BreakdownTable row volumes', () => {
  it('fires one query per visible row without a shared source', async () => {
    const datasource = makeDatasource();
    renderTable(datasource);
    await waitFor(() => expect(datasource.query).toHaveBeenCalledTimes(items.length));
  });

  it('renders every covered row from the shared source without any per-row query', async () => {
    const datasource = makeDatasource();
    const rowVolumes: ProvidedRowVolumes = {
      byLabel: new Map([
        ['web', { frames: [makeLabeledFrame({ app: 'web' }, [10, 2])] }],
        ['api', { frames: [makeLabeledFrame({ app: 'api' }, [3, 0])] }],
      ]),
      state: LoadingState.Done,
    };
    renderTable(datasource, rowVolumes);

    await waitFor(() => expect(screen.getAllByTestId('panel').length).toBeGreaterThanOrEqual(items.length));
    expect(datasource.query).not.toHaveBeenCalled();
  });

  it('does not query while the shared source is still loading', () => {
    const datasource = makeDatasource();
    renderTable(datasource, { byLabel: new Map(), state: LoadingState.Loading });

    expect(datasource.query).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText('Loading volume')).toHaveLength(items.length);
  });

  it('falls back to a per-row query only for rows the settled shared source does not cover', async () => {
    const datasource = makeDatasource();
    const rowVolumes: ProvidedRowVolumes = {
      byLabel: new Map([['web', { frames: [makeLabeledFrame({ app: 'web' }, [10, 2])] }]]),
      state: LoadingState.Done,
    };
    renderTable(datasource, rowVolumes);

    // exactly one fallback, for 'api', the row the shared source does not cover
    await waitFor(() => expect(datasource.query).toHaveBeenCalledTimes(1));
    const request = (datasource.query as jest.Mock).mock.calls[0][0];
    expect(request.targets[0].expr).toContain('api');
  });

  it('handles row values that shadow Object.prototype members', async () => {
    const datasource = makeDatasource();
    const prototypeItems = [
      { label: 'constructor', total: 5 },
      { label: 'toString', total: 2 },
    ];
    renderTable(datasource, undefined, prototypeItems);

    expect(screen.getByText('constructor')).toBeInTheDocument();
    expect(screen.getByText('toString')).toBeInTheDocument();
    // each row loads and reports its own volume without tripping over inherited properties
    await waitFor(() => expect(screen.getAllByTestId('panel')).toHaveLength(prototypeItems.length));
  });
});

describe('BreakdownTable counts', () => {
  const labelsInOrder = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent);

  it('keeps an approximate count as "~N" after the row volume loads', async () => {
    const datasource = makeDatasource();
    renderTable(datasource, undefined, [{ label: 'web', total: 120, approx: true }]);

    await waitFor(() => expect(screen.getAllByTestId('panel')).toHaveLength(1));
    expect(screen.getByText('~120')).toBeInTheDocument();
  });

  it('sorts rows by count when the Count header is clicked', async () => {
    renderTable(makeDatasource(), undefined, [
      { label: 'mid', total: 5 },
      { label: 'big', total: 9 },
      { label: 'small', total: 1 },
    ]);

    await userEvent.click(screen.getByText('Count'));
    const ascending = labelsInOrder();
    expect(ascending[0]).toContain('small');
    expect(ascending[2]).toContain('big');

    await userEvent.click(screen.getByText('Count'));
    const descending = labelsInOrder();
    expect(descending[0]).toContain('big');
    expect(descending[2]).toContain('small');
  });
});
