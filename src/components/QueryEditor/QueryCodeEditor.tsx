import { css } from "@emotion/css";
import React from "react";

import { GrafanaTheme2 } from "@grafana/data";
import { useStyles2 } from "@grafana/ui";

import { VictoriaLogsQueryEditorProps } from "../../types";

import { AdHocFiltersControl } from "./AdHocFiltersControl";
import QueryField from "./QueryField";

type Props = VictoriaLogsQueryEditorProps & {
  showExplain: boolean;
};

const QueryCodeEditor = (props: Props) => {
  const { query, datasource, range, onRunQuery, onChange, data, app, history } = props;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <QueryField
        datasource={datasource}
        query={query}
        range={range}
        onRunQuery={onRunQuery}
        onChange={onChange}
        history={history}
        data={data}
        app={app}
        ExtraFieldElement={
          query.extraFilters && (
            <AdHocFiltersControl
              query={query}
              app={app}
              onChange={onChange}
              onRunQuery={onRunQuery}
            />
          )
        }
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      max-width: 100%;
    `,
    buttonGroup: css`
      border: 1px solid ${theme.colors.border.medium};
      border-top: none;
      padding: ${theme.spacing(0.5, 0.5, 0.5, 0.5)};
      margin-bottom: ${theme.spacing(0.5)};
      display: flex;
      flex-grow: 1;
      justify-content: end;
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    hint: css`
      color: ${theme.colors.text.disabled};
      white-space: nowrap;
      cursor: help;
    `,
  };
};

export default QueryCodeEditor;
