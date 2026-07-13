import React from 'react';

import { AbsoluteTimeRange, TimeRange } from '@grafana/data';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { Query } from '../../../../types';
import { useFieldValuesHits } from '../queries/useVolumeQueries';

import { FieldValuesBreakdown } from './FieldValuesBreakdown';

interface FieldValuesSectionProps {
  datasource: VictoriaLogsDatasource;
  query: Query;
  field: string;
  range: TimeRange;
  onFilterClick: (field: string, value: string, operator: '=' | '!=') => void;
  onChangeTimeRange?: (range: AbsoluteTimeRange) => void;
}

/** Self-contained per-value breakdown for one field: runs the hits query and renders the rows */
export const FieldValuesSection: React.FC<FieldValuesSectionProps> = ({
  datasource,
  query,
  field,
  range,
  onFilterClick,
  onChangeTimeRange,
}) => {
  const values = useFieldValuesHits(datasource, query, field, range);

  return (
    <FieldValuesBreakdown
      field={field}
      top={values.top}
      totalValues={values.totalValues}
      loading={values.loading}
      error={values.error}
      range={range}
      datasource={datasource}
      query={query}
      onFilterClick={(value, operator) => onFilterClick(field, value, operator)}
      onChangeTimeRange={onChangeTimeRange}
      serverTruncated={values.serverTruncated}
    />
  );
};
