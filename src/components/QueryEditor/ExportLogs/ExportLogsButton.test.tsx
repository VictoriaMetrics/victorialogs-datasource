import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { LoadingState, PanelData } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../datasource';
import { Query } from '../../../types';

import { ExportLogsButton } from './ExportLogsButton';
import { QUERY_ERROR_BLOCK, QUERY_NOT_RUN_BLOCK } from './exportBlock';

jest.mock('./ExportLogsModal', () => ({ ExportLogsModal: () => <div>modal</div> }));

const query: Query = { refId: 'A', expr: 'app:nginx' };
const editedQuery: Query = { ...query, expr: 'app:apache' };
const datasource = {} as VictoriaLogsDatasource;

const panelDataOf = (state: LoadingState): PanelData => ({ state, request: { targets: [query] } }) as unknown as PanelData;

const buttonFor = (editorQuery: Query, panelData?: PanelData) => (
  <ExportLogsButton datasource={datasource} query={editorQuery} panelData={panelData} />
);

describe('ExportLogsButton', () => {
  it('opens the modal for the query that the panel shows', async () => {
    render(buttonFor(query, panelDataOf(LoadingState.Done)));

    await userEvent.click(screen.getByRole('button', { name: 'Download logs' }));

    expect(screen.getByText('modal')).toBeInTheDocument();
  });

  it('is disabled before the first run', () => {
    render(buttonFor(query, undefined));

    expect(screen.getByRole('button', { name: QUERY_NOT_RUN_BLOCK })).toBeDisabled();
  });

  it('is disabled when the query returned an error', () => {
    render(buttonFor(query, panelDataOf(LoadingState.Error)));

    expect(screen.getByRole('button', { name: QUERY_ERROR_BLOCK })).toBeDisabled();
  });

  it('closes the modal when the query changes after the run', async () => {
    const panelData = panelDataOf(LoadingState.Done);
    const { rerender } = render(buttonFor(query, panelData));
    await userEvent.click(screen.getByRole('button', { name: 'Download logs' }));

    rerender(buttonFor(editedQuery, panelData));

    expect(screen.queryByText('modal')).not.toBeInTheDocument();
  });
});
