import { css } from "@emotion/css";
import { isEqual } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { CoreApp, GrafanaTheme2, LoadingState } from '@grafana/data';
import { Button, ConfirmModal, Stack, useStyles2 } from '@grafana/ui';

import { getQueryExprVariableRegExp } from "../../LogsQL/regExpOperator";
import { isExprHasStatsPipeFunctions } from "../../LogsQL/statsPipeFunctions";
import { LevelQueryFilter } from "../../configuration/LogLevelRules/LevelQueryFilter/LeveQueryFilter";
import { Query, QueryEditorMode, QueryType, VictoriaLogsQueryEditorProps } from "../../types";
import QueryEditorStatsWarn from "../QueryEditorStatsWarn";

import { EditorHeader } from "./EditorHeader";
import { QueryBuilderContainer } from "./QueryBuilder/QueryBuilderContainer";
import { QueryEditorModeToggle } from "./QueryBuilder/QueryEditorModeToggle";
import { buildVisualQueryFromString } from "./QueryBuilder/utils/parseFromString";
import QueryCodeEditor from "./QueryCodeEditor";
import { QueryEditorHelp } from "./QueryEditorHelp";
import { QueryEditorOptions } from "./QueryEditorOptions";
import QueryEditorVariableRegexpError from "./QueryEditorVariableRegexpError";
import { QueryHintsExample } from "./QueryHints";
import VmuiLink from "./VmuiLink";
import { DEFAULT_QUERY_EXPR, EXPLORE_GRAPH_STYLES } from "./constants";
import { useDefaultExploreGraph } from "./hooks/useDefaultExploreGraph";
import { useLogsSort } from "./hooks/usePanelSort";
import { changeEditorMode, getQueryWithDefaults } from "./state";

const QueryEditor = React.memo<VictoriaLogsQueryEditorProps>((props) => {
  const styles = useStyles2(getStyles);

  const { onChange, onRunQuery, data, app, queries, datasource, range: timeRange, onAddQuery } = props;
  const [dataIsStale, setDataIsStale] = useState(false);
  const [parseModalOpen, setParseModalOpen] = useState(false);
  useDefaultExploreGraph(app, EXPLORE_GRAPH_STYLES.BARS);

  const query = getQueryWithDefaults(props.query, app, data?.request?.panelPluginId);
  const editorMode = query.editorMode!;
  const isStatsQuery = query.queryType === QueryType.Stats || query.queryType === QueryType.StatsRange;
  const showStatsWarn = isStatsQuery && !isExprHasStatsPipeFunctions(query.expr || '');
  const varRegExp = useMemo(() => {
    return getQueryExprVariableRegExp(query.expr)?.[0] || null;
  }, [query.expr]);
  useLogsSort(app, query, onChange, onRunQuery);

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

  const onQueryExprChange = useCallback((newExpr: string, newQuery?: boolean) => {
    if (newQuery) {
      onAddQuery?.({
        expr: newExpr,
        refId: '' // if empty, refId will be assigned in onAddQuery automatically
      })
    } else {
      onChange({ ...query, expr: newExpr });
    }
  }, [onAddQuery, onChange, query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDataIsStale(false);
  }, [data]);

  const onChangeInternal = (query: Query) => {
    if (!isEqual(query, props.query)) {
      setDataIsStale(true);
    }
    onChange(query);
  };

  useEffect(() => {
    if (!query.expr && app === CoreApp.Explore) {
      onChange({ ...query, expr: DEFAULT_QUERY_EXPR });
      onRunQuery();
    }
  }, []);

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
          <Stack direction={"row"} alignItems={"center"}>
            <QueryHintsExample onQueryChange={onQueryExprChange} query={query.expr}/>
            {app === CoreApp.Explore &&
            <LevelQueryFilter logLevelRules={datasource.logLevelRules} query={query} onChange={onChange}/>}
          </Stack>
          <Stack direction={"row"} justifyContent={"flex-end"} alignItems={"center"}>
            {showStatsWarn && (<QueryEditorStatsWarn queryType={query.queryType}/>)}
            <QueryEditorHelp/>
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
          </Stack>
        </EditorHeader>
        <div className="flex-grow-1">
          {editorMode === QueryEditorMode.Builder ? (
            <QueryBuilderContainer
              datasource={props.datasource}
              query={query}
              app={app}
              onChange={onChangeInternal}
              onRunQuery={props.onRunQuery}
              timeRange={timeRange}
            />
          ) : (
            <QueryCodeEditor {...props} query={query} onChange={onChangeInternal} showExplain={true}/>
          )}
          {varRegExp && (<QueryEditorVariableRegexpError regExp={varRegExp} query={query} onChange={onChange}/>)}
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
