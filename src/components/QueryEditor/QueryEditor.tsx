import { css } from "@emotion/css";
import { isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';

import { CoreApp, GrafanaTheme2, LoadingState } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

import { Query, VictoriaLogsQueryEditorProps } from "../../types";

import QueryCodeEditor from "./QueryCodeEditor";
import { getQueryWithDefaults } from "./state";

const QueryEditor = React.memo<VictoriaLogsQueryEditorProps>((props) => {
  const styles = useStyles2(getStyles);

  const { onChange, onRunQuery, data, app, queries } = props;
  const [dataIsStale, setDataIsStale] = useState(false);

  const query = getQueryWithDefaults(props.query);

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
    <div className={styles.wrapper}>
      <div className="flex-grow-1">
        <QueryCodeEditor {...props} query={query} onChange={onChangeInternal} showExplain={true}/>
      </div>
      <div>
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
      </div>
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      display: flex;
      align-items: flex-start;
      gap: ${theme.spacing(1)};
    `
  };
};

QueryEditor.displayName = 'QueryEditor';
export default QueryEditor
