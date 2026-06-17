import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, LogRowModel } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';

import { ToggleChip } from '../../components/shared/Chip/ToggleChip';
import type { LogContextProvider } from '../LogContextProvider';

interface Props {
  provider: LogContextProvider;
  row: LogRowModel;
  runContextQuery?: () => void;
}

/**
 * Stream selector for the "Show context" modal: every stream label of
 * the log row is rendered as a compact toggleable chip. Toggling a label off
 * widens the context search from the exact `_stream_id` to a `_stream:{...}`
 * selector built from the labels that are still enabled.
 */
export const LogContextUI = ({ provider, row, runContextQuery }: Props) => {
  const styles = useStyles2(getStyles);
  const streamId = provider.getRowStreamId(row);
  const pairs = useMemo(() => Object.entries(provider.getStreamLabels(row)), [provider, row]);
  // the toggle state lives on the provider instance; bump a local counter to re-render
  const [, setVersion] = useState(0);

  // reset toggles when the modal closes, so selections don't persist between openings
  useEffect(() => {
    return () => provider.resetStreamLabels(streamId);
  }, [provider, streamId]);

  if (!pairs.length) {
    return null;
  }

  const enabledCount = pairs.filter(([key]) => provider.isStreamLabelEnabled(streamId, key)).length;

  const onToggle = (key: string) => {
    const isEnabled = provider.isStreamLabelEnabled(streamId, key);
    // keep at least one stream label enabled, otherwise the context query is unbounded
    if (isEnabled && enabledCount <= 1) {
      return;
    }
    provider.toggleStreamLabel(streamId, key);
    setVersion((v) => v + 1);
    runContextQuery?.();
  };

  return (
    <Stack direction='row' wrap='wrap' alignItems='center' gap={0.5}>
      <span>{'{'}</span>
      {pairs.map(([key, value], index) => {
        const isEnabled = provider.isStreamLabelEnabled(streamId, key);
        const isLastEnabled = isEnabled && enabledCount <= 1;
        const isLastElement = index >= pairs.length - 1;
        const tooltip = isLastEnabled
          ? 'At least one label must stay enabled to filter the context'
          : isEnabled
            ? `Click to exclude "${key}" from the context filter`
            : `Click to include "${key}" in the context filter`;
        return (
          <span key={key} className={styles.item}>
            <ToggleChip active={isEnabled} tooltip={tooltip} onToggle={() => onToggle(key)}>
              {`${key}="${value}"`}
            </ToggleChip>
            {!isLastElement && ','}
          </span>
        );
      })}
      <span>{'}'}</span>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  item: css({
    display: 'inline-flex',
    alignItems: 'center',
    color: theme.colors.text.secondary,
  }),
});
