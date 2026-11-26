import { render, screen } from '@testing-library/react';
import React from 'react';

import { CoreApp } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../datasource';
import { Query, QueryEditorMode, QueryType } from '../../types';

import { EditorHeader } from './EditorHeader';

jest.mock('./Drilldown/DrilldownButton', () => ({ DrilldownButton: () => null }));
jest.mock('./LevelQueryFilter/LeveQueryFilter', () => ({ LevelQueryFilter: () => null }));
jest.mock('./LogsQLSyntaxHelp', () => ({ LogsQLSyntaxHelp: () => null }));
jest.mock('./QueryEditorHelp', () => ({ QueryEditorHelp: () => null }));
jest.mock('./QueryHints', () => ({ QueryHintsExample: () => null }));
jest.mock('./VmuiLink', () => ({ __esModule: true, default: () => null }));

const renderHeader = (app: CoreApp, queryType: QueryType) => {
  const query: Query = { refId: 'A', expr: 'error', queryType };
  render(
    <EditorHeader
      editorMode={QueryEditorMode.Code}
      onEditorModeChange={jest.fn()}
      query={query}
      datasource={{} as VictoriaLogsDatasource}
      data={undefined}
      app={app}
      queries={[query]}
      dataIsStale={false}
      onRunQuery={jest.fn()}
      onQueryExprChange={jest.fn()}
      onChange={jest.fn()}
    />
  );
};

const downloadButton = () => screen.queryByRole('button', { name: 'Download logs' });

describe('EditorHeader', () => {
  it('shows the logs download for a Raw Logs query in Explore', () => {
    renderHeader(CoreApp.Explore, QueryType.Instant);
    expect(downloadButton()).toBeInTheDocument();
  });

  it.each([QueryType.Stats, QueryType.StatsRange])('hides the logs download for a %s query in Explore', (queryType) => {
    renderHeader(CoreApp.Explore, queryType);
    expect(downloadButton()).not.toBeInTheDocument();
  });

  it.each([CoreApp.Dashboard, CoreApp.PanelEditor])('hides the logs download in %s', (app) => {
    renderHeader(app, QueryType.Instant);
    expect(downloadButton()).not.toBeInTheDocument();
  });
});
