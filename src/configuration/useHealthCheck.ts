import { useEffect, useState } from 'react';

import { getDataSourceSrv, HealthStatus } from '@grafana/runtime';

import { VictoriaLogsDatasource } from '../datasource';

export type HealthCheckStatus = Omit<HealthStatus, 'unknown'> | 'checking';

export interface HealthCheckResult {
  healthStatus: HealthCheckStatus;
  healthMessage: string | null;
}

export interface UseHealthCheckArgs {
  uid: string;
  // id/version trigger a re-check after "Save & test"
  id?: number;
  version?: number;
}

export function useHealthCheck({ uid, id, version }: UseHealthCheckArgs): HealthCheckResult {
  const [healthStatus, setHealthStatus] = useState<HealthCheckStatus>('checking');
  const [healthMessage, setHealthMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- useEffect doesn't depend on healthStatus or healthMessage
    setHealthStatus('checking');
    setHealthMessage(null);
    const check = async () => {
      try {
        const ds = await getDataSourceSrv().get(uid) as VictoriaLogsDatasource;
        const health = await ds.callHealthCheck();
        if (cancelled) {
          return;
        }
        if (health.status === HealthStatus.OK) {
          setHealthStatus(HealthStatus.OK);
          setHealthMessage(null);
        } else {
          setHealthStatus(HealthStatus.Error);
          setHealthMessage(health.message || null);
        }
      } catch {
        if (!cancelled) {
          setHealthStatus(HealthStatus.Error);
          setHealthMessage(null);
        }
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [uid, id, version]);

  return { healthStatus, healthMessage };
}
