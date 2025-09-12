import { css } from "@emotion/css";
import { isEqual } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';

import { CoreApp, GrafanaTheme2, LoadingState } from '@grafana/data';
import { Button, ConfirmModal, useStyles2 } from '@grafana/ui';

import { isExprHasStatsPipeFunctions } from "../../LogsQL/statsPipeFunctions";
import { Query, QueryEditorMode, QueryType, VictoriaLogsQueryEditorProps } from "../../types";
import QueryEditorStatsWarn from "../QueryEditorStatsWarn";

import { EditorHeader } from "./EditorHeader";
import { QueryBuilderContainer } from "./QueryBuilder/QueryBuilderContainer";
import { QueryEditorModeToggle } from "./QueryBuilder/QueryEditorModeToggle";
import { buildVisualQueryFromString } from "./QueryBuilder/utils/parseFromString";
import QueryCodeEditor from "./QueryCodeEditor";
import { QueryEditorOptions } from "./QueryEditorOptions";
import VmuiLink from "./VmuiLink";
import { changeEditorMode, getQueryWithDefaults } from "./state";

const QueryEditor = React.memo<VictoriaLogsQueryEditorProps>((props) => {
  const styles = useStyles2(getStyles);

  const { onChange, onRunQuery, data, app, queries, datasource, range: timeRange } = props;
  const [dataIsStale, setDataIsStale] = useState(false);
  const [parseModalOpen, setParseModalOpen] = useState(false);

  const query = getQueryWithDefaults(props.query, app, data?.request?.panelPluginId);
  const editorMode = query.editorMode!;
  const isStatsQuery = query.queryType === QueryType.Stats || query.queryType === QueryType.StatsRange;
  const showStatsWarn = isStatsQuery && !isExprHasStatsPipeFunctions(query.expr || '');

  const onEditorModeChange = useCallback((newEditorMode: QueryEditorMode) => {
      if (newEditorMode === QueryEditorMode.Builder) {
        const result = buildVisualQueryFromString(query.expr || '');
        if (result.errors.length) {
          setParseModalOpen(true);
          return;
        }
      }
      changeEditorMode(query, newEditorMode, onChange);
    },
    [query, onChange]
  );

  useEffect(() => {
    setDataIsStale(false);
  }, [data]);

  const onChangeInternal = (query: Query) => {
    if (!isEqual(query, props.query)) {
      setDataIsStale(true);
    }
    onChange(query);
  };

  return (
    <>
      <ConfirmModal
        isOpen={parseModalOpen}
        title="Query parsing"
        body="There were errors while trying to parse the query. Continuing to visual builder may lose some parts of the query."
        confirmText="Continue"
        onConfirm={() => {
          onChange({ ...query, editorMode: QueryEditorMode.Builder });
          setParseModalOpen(false);
        }}
        onDismiss={() => setParseModalOpen(false)}
      />
      <div className={styles.wrapper}>
        <EditorHeader>
          {showStatsWarn && (<QueryEditorStatsWarn queryType={query.queryType}/>)}
          <VmuiLink
            query={query}
            panelData={data}
            datasource={datasource}
          />
          <QueryEditorModeToggle mode={editorMode} onChange={onEditorModeChange}/>
          {app !== CoreApp.Explore && app !== CoreApp.Correlations && (
            <Button
              variant={dataIsStale ? 'primary' : 'secondary'}
              size="sm"
              onClick={onRunQuery}
              icon={data?.state === LoadingState.Loading ? 'fa fa-spinner' : undefined}
              disabled={data?.state === LoadingState.Loading}
            >
              {queries && queries.length > 1 ? `Run queries` : `Run query`}
            </Button>
          )}
        </EditorHeader>
        <div className="flex-grow-1">
          {editorMode === QueryEditorMode.Builder ? (
            <QueryBuilderContainer
              datasource={props.datasource}
              query={query}
              onChange={onChangeInternal}
              onRunQuery={props.onRunQuery}
              timeRange={timeRange}
            />
          ) : (
            <QueryCodeEditor {...props} query={query} onChange={onChangeInternal} showExplain={true}/>
          )}
          <QueryEditorOptions
            query={query}
            onChange={onChange}
            onRunQuery={onRunQuery}
            app={app}
            maxLines={datasource.maxLines}
          />
        </div>
      </div>
    </>
  )
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(0.5)};
    `
  };
};

QueryEditor.displayName = 'QueryEditor';
export default QueryEditor
