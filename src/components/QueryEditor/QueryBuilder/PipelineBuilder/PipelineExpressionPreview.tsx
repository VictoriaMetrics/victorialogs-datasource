import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ClipboardButton, Divider, Stack, useStyles2 } from '@grafana/ui';

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
    <>
      <Divider />
      <Stack direction='row' gap={1} alignItems='center' >
        <pre className={styles.expression}>{fullExpr}</pre>
        <ClipboardButton
          variant='secondary'
          fill='text'
          icon='copy'
          size='md'
          tooltip='Copy expression'
          getText={() => fullExpr}
        >Copy</ClipboardButton>
      </Stack>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
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
