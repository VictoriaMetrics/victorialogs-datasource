import React, { useCallback, useEffect, useRef, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { getDataSourceSrv, HealthStatus } from '@grafana/runtime';

import { VictoriaLogsDatasource } from '../../datasource';
import { FilterFieldType } from '../../types';
import { PropsConfigEditor } from '../ConfigEditor';
import { HealthCheckStatus, useHealthCheck } from '../useHealthCheck';

import { runDetection } from './detection';
import { OpenTelemetryPreset as PresetState } from './types';

export const makePresetUpdater = (props: PropsConfigEditor) => (next: Partial<PresetState>) => {
  const current = props.options.jsonData.otelPreset ?? { enabled: false };
  props.onOptionsChange({
    ...props.options,
    jsonData: {
      ...props.options.jsonData,
      otelPreset: { ...current, ...next },
    },
  });
};

export interface OtelPresetHook {
  preset: PresetState;
  healthStatus: HealthCheckStatus;
  fieldNames: string[];
  isDetecting: boolean;
  error: string | null;
  isChangingSeverity: boolean;
  setIsChangingSeverity: (v: boolean) => void;
  onToggle: (e: React.FormEvent<HTMLInputElement>) => void;
  onTracesChange: (v: SelectableValue<string> | null) => void;
  onStartChangingSeverity: () => Promise<void>;
  detect: (severityField?: string) => Promise<void>;
}

export function useOtelPreset(props: PropsConfigEditor): OtelPresetHook {
  const { options } = props;
  const preset: PresetState = options.jsonData.otelPreset ?? { enabled: false };
  const update = makePresetUpdater(props);

  const { healthStatus } = useHealthCheck(options);
  const [fieldNames, setFieldNames] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChangingSeverity, setIsChangingSeverity] = useState(false);
  const detectionTriggeredRef = useRef(false);

  // Reset auto-detection trigger when the datasource is saved so detection can re-run.
  useEffect(() => {
    detectionTriggeredRef.current = false;
  }, [options.id, options.version]);

  const detect = useCallback(async (severityField?: string) => {
    setError(null);
    setIsDetecting(true);
    try {
      const ds = await getDataSourceSrv().get(options.uid) as VictoriaLogsDatasource;
      const [detection, fieldNames] = await runDetection(ds, { severityField });
      setFieldNames(fieldNames);
      update({ detection });
    } catch (e) {
      console.error('OTel preset detection failed:', e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsDetecting(false);
    }
  }, [options.uid, update]);

  useEffect(() => {
    if (
      preset.enabled &&
      healthStatus === HealthStatus.OK &&
      !preset.detection &&
      !detectionTriggeredRef.current &&
      !error
    ) {
      detectionTriggeredRef.current = true;
      void detect();
    }
    if (!preset.enabled) {
      detectionTriggeredRef.current = false;
    }
  }, [preset.enabled, preset.detection, healthStatus, error, detect]);

  const onToggle = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    update({ enabled: e.currentTarget.checked });
  }, [update]);

  const onTracesChange = useCallback((v: SelectableValue<string> | null) => {
    update({ tracesDatasourceUid: v?.value });
  }, [update]);

  const onStartChangingSeverity = useCallback(async () => {
    setIsChangingSeverity(true);
    if (fieldNames.length === 0) {
      try {
        const ds = await getDataSourceSrv().get(options.uid) as VictoriaLogsDatasource;
        const hits = await ds.languageProvider?.getFieldList({ type: FilterFieldType.FieldName });
        setFieldNames((hits ?? []).map(h => h.value));
      } catch {
        // field names unavailable — user will see empty dropdown
      }
    }
  }, [fieldNames.length, options.uid]);

  return {
    preset,
    healthStatus,
    fieldNames,
    isDetecting,
    error,
    isChangingSeverity,
    setIsChangingSeverity,
    onToggle,
    onTracesChange,
    onStartChangingSeverity,
    detect,
  };
}
