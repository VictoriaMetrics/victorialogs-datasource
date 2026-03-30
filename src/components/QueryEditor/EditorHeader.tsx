import { css } from '@emotion/css';
import React from 'react';

import { CoreApp, DataQuery, GrafanaTheme2, LoadingState, PanelData } from '@grafana/data';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { LevelQueryFilter } from '../../configuration/LogLevelRules/LevelQueryFilter/LeveQueryFilter';
import { VictoriaLogsDatasource } from '../../datasource';
import { Query, QueryEditorMode } from '../../types';

import { LogsQLSyntaxHelp } from './LogsQLSyntaxHelp';
import { QueryEditorModeToggle } from './QueryBuilder/QueryEditorModeToggle';
import { QueryEditorHelp } from './QueryEditorHelp';
import { QueryHintsExample } from './QueryHints';
import VmuiLink from './VmuiLink';

interface EditorHeaderProps {
  editorMode: QueryEditorMode;
  onEditorModeChange: (mode: QueryEditorMode) => void;
  query: Query;
  datasource: VictoriaLogsDatasource;
  data: PanelData | undefined;
  app: CoreApp | undefined;
  queries: DataQuery[] | undefined;
  dataIsStale: boolean;
  onRunQuery: () => void;
  onQueryExprChange: (expr: string, newQuery?: boolean) => void;
  onChange: (query: Query) => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  editorMode,
  onEditorModeChange,
  query,
  datasource,
  data,
  app,
  queries,
  dataIsStale,
  onRunQuery,
  onQueryExprChange,
  onChange,
}) => {
  const styles = useStyles2(getStyles);

  const rightSection = (
    <div className={styles.rightSection}>
      <Stack direction={'row'} justifyContent={'flex-end'} alignItems={'center'}>
        <LogsQLSyntaxHelp />
        <QueryEditorHelp />
        <VmuiLink query={query} panelData={data} datasource={datasource} />
        <QueryEditorModeToggle mode={editorMode} onChange={onEditorModeChange} />
        {app !== CoreApp.Explore && app !== CoreApp.Correlations && (
          <Button
            variant={dataIsStale ? 'primary' : 'secondary'}
            size='sm'
            onClick={onRunQuery}
            icon={data?.state === LoadingState.Loading ? 'fa fa-spinner' : undefined}
            disabled={data?.state === LoadingState.Loading}
          >
            {queries && queries.length > 1 ? 'Run queries' : 'Run query'}
          </Button>
        )}
      </Stack>
    </div>
  );

  if (editorMode === QueryEditorMode.Builder) {
    return (
      <div className={styles.root}>
        {rightSection}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Stack direction={'row'} alignItems={'center'}>
        <QueryHintsExample onQueryChange={onQueryExprChange} query={query.expr} />
        {app === CoreApp.Explore && (
          <LevelQueryFilter logLevelRules={datasource.logLevelRules} query={query} onChange={onChange} />
        )}
      </Stack>
      {rightSection}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    minHeight: theme.spacing(4),
  }),
  rightSection: css({
    marginLeft: 'auto',
  }),
});
