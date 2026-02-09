import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, TextLink, useTheme2 } from '@grafana/ui';

import { VICTORIA_LOGS_DOCS_HOST } from '../conf';
import { QueryType } from '../types';

import { queryTypeOptions } from './QueryEditor/QueryEditorOptions';

interface Props {
  queryType?: QueryType;
}

const QueryEditorStatsWarn = ({ queryType }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const queryTypeLabel = queryTypeOptions.find(option => option.value === queryType)?.label || 'unknown';

  const text = (
    <div>
      The query must include the `| stats ...` pipe for the `{queryTypeLabel}` query type to work correctly.
    </div>
  );

  return (
    <div className={styles.root}>
      <Badge
        icon={'info-circle'}
        color={'orange'}
        text={text}
      />
      <TextLink
        href={`${VICTORIA_LOGS_DOCS_HOST}/victorialogs/logsql/#stats-pipe`}
        icon='external-link-alt'
        variant={'bodySmall'}
        external
      >
        Learn more about stats pipe
      </TextLink>
    </div>
  );
};

export default QueryEditorStatsWarn;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    root: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      flexGrow: 1,
    }),
  };
};
