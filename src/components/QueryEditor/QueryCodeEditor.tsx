import { css } from '@emotion/css';
import React from 'react';

import { CoreApp, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VictoriaLogsQueryEditorProps } from '../../types';

import { AdHocFiltersControl } from './AdHocFiltersControl';
import QueryField from './QueryField';
import { SelectedStreamFiltersChips } from './StreamFilters/SelectedStreamFiltersChips';
import { StreamFiltersSidebar } from './StreamFilters/StreamFiltersSidebar';
import { useStreamFilters } from './StreamFilters/useStreamFilters';

type Props = VictoriaLogsQueryEditorProps & {
  showExplain: boolean;
};

const QueryCodeEditor = (props: Props) => {
  const { query, datasource, range: timeRange, onRunQuery, onChange, data, app, history } = props;
  const styles = useStyles2(getStyles);

  const streamFilters = useStreamFilters({ query, onChange, onRunQuery });
  const showStreamFilters = app === CoreApp.Explore;

  return (
    <div className={styles.wrapper}>
      {showStreamFilters && (
        <StreamFiltersSidebar
          datasource={datasource}
          timeRange={timeRange}
          queryExpr={query.expr}
          popoverLabel={streamFilters.popoverLabel}
          selectedValuesForPopover={streamFilters.selectedValuesForPopover}
          sidebarExtraStreamFilters={streamFilters.sidebarExtraStreamFilters}
          popoverExtraStreamFilters={streamFilters.popoverExtraStreamFilters}
          hasActiveFilters={streamFilters.streamFilters.length > 0}
          onLabelClick={streamFilters.handleLabelClick}
          onToggleValue={streamFilters.handleToggleValue}
          onClosePopover={streamFilters.closePopover}
          onClearAll={streamFilters.clearAll}
        />
      )}
      <div className={styles.content}>
        <QueryField
          datasource={datasource}
          query={query}
          range={timeRange}
          onRunQuery={onRunQuery}
          onChange={onChange}
          history={history}
          data={data}
          app={app}
          ExtraFieldElement={
            <>
              {showStreamFilters && (
                <SelectedStreamFiltersChips
                  filters={streamFilters.streamFilters}
                  onRemoveValue={streamFilters.handleRemoveValue}
                />
              )}
              {query.extraFilters && (
                <AdHocFiltersControl
                  query={query}
                  app={app}
                  onChange={onChange}
                  onRunQuery={onRunQuery}
                />
              )}
            </>
          }
        />
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: ${theme.spacing(1)};
    max-width: 100%;
  `,
  content: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(0.5)};
    flex: 1 1 auto;
    min-width: 0;
  `,
});

export default QueryCodeEditor;
