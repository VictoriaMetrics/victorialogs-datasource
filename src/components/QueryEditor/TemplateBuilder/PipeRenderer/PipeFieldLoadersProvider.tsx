import React, { useMemo } from 'react';

import { TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { useFetchStreamFilters } from '../../shared/useFetchStreamFilters';
import { useFieldFetch } from '../../shared/useFieldFetch';
import { FieldLoadersProvider } from '../FieldLoadersContext';

interface Props {
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryContext: string;
  extraStreamFilters?: string;
  children: React.ReactNode;
}

/**
 * Per-pipe wrapper that creates field/stream loaders scoped to the pipe's queryContext
 * and exposes them through FieldLoadersContext. Keeps PipeRenderer free of datasource-level props.
 */
export const PipeFieldLoadersProvider: React.FC<Props> = ({
  datasource,
  timeRange,
  queryContext,
  extraStreamFilters,
  children,
}) => {
  const { loadFieldNames, loadFieldValuesForField } = useFieldFetch({ datasource, timeRange, queryContext });
  const { loadStreamFieldNames, loadStreamFieldValuesForField } = useFetchStreamFilters({
    datasource, timeRange, queryExpr: queryContext, extraStreamFilters,
  });

  const loaders = useMemo(
    () => ({ loadFieldNames, loadFieldValuesForField, loadStreamFieldNames, loadStreamFieldValuesForField }),
    [loadFieldNames, loadFieldValuesForField, loadStreamFieldNames, loadStreamFieldValuesForField]
  );

  return <FieldLoadersProvider value={loaders}>{children}</FieldLoadersProvider>;
};
