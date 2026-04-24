import React, { useCallback, useEffect, useRef, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { getDataSourceSrv, HealthStatus } from '@grafana/runtime';

import { VictoriaLogsDatasource } from '../../datasource';
import { FilterFieldType } from '../../types';
import { PropsConfigEditor } from '../ConfigEditor';

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

export type HealthCheckStatus = Omit<HealthStatus, 'unknown'> | 'checking';

export interface OtelPresetHook {
  preset: PresetState;
  healthStatus: HealthCheckStatus;
  healthMessage: string | null;
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

  const [healthStatus, setHealthStatus] = useState<HealthCheckStatus>('checking');
  const [healthMessage, setHealthMessage] = useState<string | null>(null);
  const [fieldNames, setFieldNames] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChangingSeverity, setIsChangingSeverity] = useState(false);
  const detectionTriggeredRef = useRef(false);

  // Re-run health check when the datasource is saved (id/version change after "Save & test").
  useEffect(() => {
    detectionTriggeredRef.current = false;

    const check = async () => {
      try {
        const ds = await getDataSourceSrv().get(options.uid) as VictoriaLogsDatasource;
        const health = await ds.callHealthCheck();
        if (health.status === HealthStatus.OK) {
          setHealthStatus(HealthStatus.OK);
          setHealthMessage(null);
        } else {
          setHealthStatus(HealthStatus.Error);
          setHealthMessage(health.message || 'Save datasource changes first to detect format.');
        }
      } catch {
        setHealthStatus(HealthStatus.OK);
        setHealthMessage('Save datasource changes first to detect format.');
      }
    };
    void check();
  }, [options.id, options.version]);

  const detect = useCallback(async (severityField?: string) => {
    setError(null);
    setIsDetecting(true);
    try {
      const ds = await getDataSourceSrv().get(options.uid) as VictoriaLogsDatasource;
      const [detection, fieldNames] = await runDetection(ds as any, { severityField });
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
  };
}
