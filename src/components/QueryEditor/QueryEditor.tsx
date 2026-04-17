import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { CoreApp, GrafanaTheme2 } from '@grafana/data';
import { ConfirmModal, useStyles2 } from '@grafana/ui';

import { getQueryExprVariableRegExp } from '../../LogsQL/regExpOperator';
import { isExprHasStatsPipeFunctions } from '../../LogsQL/statsPipeFunctions';
import { TEXT_FILTER_ALL_VALUE } from '../../constants';
import { Query, QueryEditorMode, QueryType, VictoriaLogsQueryEditorProps } from '../../types';
import QueryEditorStatsWarn from '../QueryEditorStatsWarn';

import { EditorHeader } from './EditorHeader';
import QueryCodeEditor from './QueryCodeEditor';
import { QueryEditorOptions } from './QueryEditorOptions';
import QueryEditorVariableRegexpError from './QueryEditorVariableRegexpError';
import TemplateQueryEditor from './TemplateBuilder/TemplateQueryEditor';
import { serializeQuery } from './TemplateBuilder/serialization';
import { DEFAULT_QUERY_EXPR, EXPLORE_GRAPH_STYLES } from './constants';
import { useDefaultExploreGraph } from './hooks/useDefaultExploreGraph';
import { useLogsSort } from './hooks/usePanelSort';
import { changeEditorMode, getQueryWithDefaults } from './state';

const QueryEditor = React.memo<VictoriaLogsQueryEditorProps>((props) => {
  const styles = useStyles2(getStyles);

  const { onChange, onRunQuery, data, app, queries, datasource, range: timeRange, onAddQuery } = props;
  const [dataIsStale, setDataIsStale] = useState(false);
  const [parseModalOpen, setParseModalOpen] = useState(false);
  useDefaultExploreGraph(app, EXPLORE_GRAPH_STYLES.BARS);

  const query = getQueryWithDefaults(props.query, app, data?.request?.panelPluginId);
  const editorMode = query.editorMode!;
  const isStatsQuery = query.queryType === QueryType.Stats || query.queryType === QueryType.StatsRange;
  const showStatsWarn = useMemo(() => {
    if (!isStatsQuery) {
      return false;
    }
    // In builder mode, derive the expression from the model to avoid stale/empty expr edge cases.
    if (editorMode === QueryEditorMode.Builder && query.templateBuilder) {
      return !isExprHasStatsPipeFunctions(serializeQuery(query.templateBuilder));
    }
    return !isExprHasStatsPipeFunctions(query.expr || '');
  }, [isStatsQuery, editorMode, query.templateBuilder, query.expr]);
  const varRegExp = useMemo(() => {
    return getQueryExprVariableRegExp(query.expr)?.[0] || null;
  }, [query.expr]);
  useLogsSort(app, query, onChange, onRunQuery);

  const onEditorModeChange = useCallback((newEditorMode: QueryEditorMode) => {
    if (newEditorMode === QueryEditorMode.Builder && query.expr) {
      // If expr matches the serialized builder state, the user hasn't modified the code manually —
      // switch to builder directly without showing the confirmation modal.
      const builderExpr = query.templateBuilder ? serializeQuery(query.templateBuilder) : '';
      if (query.expr !== TEXT_FILTER_ALL_VALUE && query.expr !== builderExpr) {
        setParseModalOpen(true);
        return;
      }
    }
    if (newEditorMode === QueryEditorMode.Code) {
      // Re-sync expr from templateBuilder in case it was cleared by the "switch to builder"
      // confirmation modal while templateBuilder still has pipes.
      const expr = query.templateBuilder ? serializeQuery(query.templateBuilder) : query.expr;
      onChange({ ...query, expr, editorMode: newEditorMode });
      return;
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
      });
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

  const onConfirmModal = () => {
    onChange({
      ...query,
      expr: '',
      editorMode: QueryEditorMode.Builder,
      templateBuilder: { pipes: [] },
    });
    setParseModalOpen(false);
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
        title='Switch to visual builder'
        body='Switching to visual builder will clear the current query. The query cannot be automatically converted to visual steps.'
        confirmText='Continue'
        onConfirm={onConfirmModal}
        onDismiss={() => setParseModalOpen(false)}
      />
      <div className={styles.wrapper}>
        <EditorHeader
          editorMode={editorMode}
          onEditorModeChange={onEditorModeChange}
          query={query}
          datasource={datasource}
          data={data}
          app={app}
          queries={queries}
          dataIsStale={dataIsStale}
          onRunQuery={onRunQuery}
          onQueryExprChange={onQueryExprChange}
          onChange={onChange}
        />
        <div className='flex-grow-1'>
          {editorMode === QueryEditorMode.Builder ? (
            <TemplateQueryEditor
              datasource={props.datasource}
              query={query}
              onChange={onChangeInternal}
              onRunQuery={onRunQuery}
              timeRange={timeRange}
              app={app}
            />
          ) : (
            <QueryCodeEditor {...props} query={query} onChange={onChangeInternal} showExplain={true} />
          )}
          {varRegExp && (<QueryEditorVariableRegexpError regExp={varRegExp} query={query} onChange={onChange} />)}
          {showStatsWarn && (<QueryEditorStatsWarn queryType={query.queryType} />)}
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
  );
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(0.5)};
    `,
  };
};

QueryEditor.displayName = 'QueryEditor';
export default QueryEditor;
