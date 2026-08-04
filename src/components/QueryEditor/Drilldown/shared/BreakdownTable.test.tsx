import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { LoadingState } from '@grafana/data';
import { type PanelRendererProps } from '@grafana/runtime';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { buildValueVolumeQuery } from '../queries/drilldownQueries';
import { makeDatasource, makeLabeledFrame, query, range } from '../queries/hookTestUtils';

import { BreakdownTable, ProvidedRowVolumes } from './BreakdownTable';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelRenderer: (_props: PanelRendererProps) => <div data-testid='panel' />,
}));

beforeAll(() => {
  // jsdom has no ResizeObserver — stub it for useElementWidth
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const items = [
  { label: 'web', total: 12 },
  { label: 'api', total: 3 },
];

const renderTable = (datasource: VictoriaLogsDatasource, rowVolumes?: ProvidedRowVolumes) =>
  render(
    <BreakdownTable
      items={items}
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
        ['web', { frames: [makeLabeledFrame({ app: 'web' }, [10, 2])], total: 12 }],
        ['api', { frames: [makeLabeledFrame({ app: 'api' }, [3, 0])], total: 3 }],
      ]),
      state: LoadingState.Done,
    };
    renderTable(datasource, rowVolumes);

    // sparklines rendered from the provided frames
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
      byLabel: new Map([['web', { frames: [makeLabeledFrame({ app: 'web' }, [10, 2])], total: 12 }]]),
      state: LoadingState.Done,
    };
    renderTable(datasource, rowVolumes);

    // exactly one fallback — for 'api', the row missing from the shared source
    await waitFor(() => expect(datasource.query).toHaveBeenCalledTimes(1));
    const request = (datasource.query as jest.Mock).mock.calls[0][0];
    expect(request.targets[0].expr).toContain('api');
  });
});
