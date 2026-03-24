import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ClipboardButton, useStyles2 } from '@grafana/ui';

import { StreamFilterState } from '../../../../types';
import { buildStreamExtraFilters } from '../components/StreamFilters/streamFilterUtils';

interface Props {
  expr: string;
  streamFilters?: StreamFilterState[];
}

const PipelineExpressionPreview = ({ expr, streamFilters }: Props) => {
  const styles = useStyles2(getStyles);

  const fullExpr = useMemo(() => {
    const streamPart = buildStreamExtraFilters(streamFilters ?? []);
    if (streamPart && expr) {
      return `${streamPart} | ${expr}`;
    }
    if (streamPart) {
      return streamPart;
    }
    return expr;
  }, [streamFilters, expr]);

  if (!fullExpr) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <pre className={styles.expression}>{fullExpr}</pre>
      <ClipboardButton
        variant='secondary'
        fill='text'
        icon='copy'
        size='sm'
        tooltip='Copy expression'
        getText={() => fullExpr}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(1)} ${theme.spacing(2)};
    border-top: 1px solid ${theme.colors.border.weak};
  `,
  expression: css`
    flex: 1;
    margin: 0;
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  `,
});

PipelineExpressionPreview.displayName = 'PipelineExpressionPreview';

export default PipelineExpressionPreview;
