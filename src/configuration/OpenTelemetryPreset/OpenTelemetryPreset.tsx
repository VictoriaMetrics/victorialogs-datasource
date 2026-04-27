import React from 'react';

import { getDataSourceSrv, HealthStatus } from '@grafana/runtime';
import { InlineField, InlineSwitch, Select, Stack, Text } from '@grafana/ui';

import { PropsConfigEditor } from '../ConfigEditor';

import { DetectedFormatCard } from './DetectedFormatCard';
import { DetectionErrorCard } from './DetectionErrorCard';
import { useOtelPreset } from './useOtelPreset';

const tracesDatasourceOptions = () =>
  getDataSourceSrv().getList({ tracing: true }).map(ds => ({ label: `${ds.name} (${ds.uid})`, value: ds.uid }));

export const OpenTelemetryPreset = (props: PropsConfigEditor) => {
  const {
    preset,
    healthStatus,
    healthMessage,
    fieldNames,
    isDetecting,
    error,
    isChangingSeverity,
    setIsChangingSeverity,
    onToggle,
    onTracesChange,
    onStartChangingSeverity,
    detect,
  } = useOtelPreset(props);

  const isReady = healthStatus === HealthStatus.OK;

  const onSeverityChoice = (v: { value?: string } | null) => {
    if (!v?.value) {
      return;
    }
    setIsChangingSeverity(false);
    void detect(v.value);
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <Stack direction='column' gap={2}>
        <div>
          <Text variant='h4'>OpenTelemetry preset</Text>
          <Text variant='bodySmall' color='disabled' element='p'>
            Auto-generate derived fields for trace/span IDs and log level rules for OTel severity.
            Your own derived fields and log level rules are preserved.
          </Text>
          {healthStatus === HealthStatus.Error && healthMessage && (
            <Text variant='bodySmall' color='warning' element='p'>
              To use the OpenTelemetry preset, need to set the datasource url first and save the datasource configuration
            </Text>
          )}
        </div>

        <InlineField label='Enable OpenTelemetry preset' labelWidth={32} disabled={!isReady}>
          <InlineSwitch disabled={!isReady} value={preset.enabled} onChange={onToggle} />
        </InlineField>

        {isReady && preset.enabled && (
          <>
            <InlineField label='Traces datasource' labelWidth={32} tooltip='Optional — used as the link target for trace_id / span_id derived fields.'>
              <Select
                placeholder='Select a traces datasource (optional)'
                isClearable
                options={tracesDatasourceOptions()}
                value={preset.tracesDatasourceUid ?? null}
                onChange={onTracesChange}
                width={40}
              />
            </InlineField>

            {error && (
              <DetectionErrorCard
                error={error}
                isDetecting={isDetecting}
                onRedetect={() => void detect()}
              />
            )}

            {!error && preset.detection && (
              <DetectedFormatCard
                detection={preset.detection}
                fieldNames={fieldNames}
                isDetecting={isDetecting}
                isChangingSeverity={isChangingSeverity}
                onRedetect={() => void detect()}
                onSeverityChoice={onSeverityChoice}
                onStartChangingSeverity={() => void onStartChangingSeverity()}
                onCancelChangingSeverity={() => setIsChangingSeverity(false)}
              />
            )}
          </>
        )}
      </Stack>
    </div>
  );
};
