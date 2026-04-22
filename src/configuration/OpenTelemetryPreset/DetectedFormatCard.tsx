import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, Card, Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { SeverityRow } from './SeverityRow'; 
import { TRACE_FIELD_CANDIDATES } from './constants';
import { OpenTelemetryPresetDetection } from './types';

const TraceFieldTooltip = () => (
  <div>
    <div>Detection priority:</div>
    {TRACE_FIELD_CANDIDATES.map((f, i) => (
      <div key={f}>{i + 1}. {f}</div>
    ))}
  </div>
);

interface DetectedFormatCardProps {
  detection: OpenTelemetryPresetDetection;
  fieldNames: string[];
  isDetecting: boolean;
  isChangingSeverity: boolean;
  onRedetect: () => void;
  onSeverityChoice: (v: SelectableValue<string> | null) => void;
  onStartChangingSeverity: () => void;
  onCancelChangingSeverity: () => void;
}

export const DetectedFormatCard = ({
  detection,
  fieldNames,
  isDetecting,
  isChangingSeverity,
  onRedetect,
  onSeverityChoice,
  onStartChangingSeverity,
  onCancelChangingSeverity,
}: DetectedFormatCardProps) => {
  const styles = useStyles2(getStyles);

  return(
    <Card>
      <Stack direction='column' gap={1}>
        <Text variant='bodySmall'><strong>Detected format</strong></Text>
        <Text variant='bodySmall'>
          <strong>Trace field</strong>
          <Tooltip content={<TraceFieldTooltip />} placement='top'>
            <Icon name='info-circle' size='sm' className={styles.infoIcon} />
          </Tooltip>
          : {detection.traceIdField}
        </Text>
        <SeverityRow
          severity={detection.severity}
          isChanging={isChangingSeverity}
          fieldNames={fieldNames}
          onChoice={onSeverityChoice}
          onStartChanging={onStartChangingSeverity}
          onCancelChanging={onCancelChangingSeverity}
        />
        <div>
          <Button variant='secondary' size='sm' onClick={onRedetect} disabled={isDetecting}>
            {isDetecting ? 'Detecting…' : 'Re-detect'}
          </Button>
        </div>
      </Stack>
    </Card>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    infoIcon: css`
      margin-left: ${theme.spacing(1)};
      margin-right: ${theme.spacing(1)};
      cursor: help;
    `,
  };
};
