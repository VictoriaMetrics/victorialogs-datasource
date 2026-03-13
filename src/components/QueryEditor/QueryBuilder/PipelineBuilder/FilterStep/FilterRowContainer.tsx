import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import StepRowLayout from '../../components/StepRowLayout';

import FILTER_TYPE_CONFIG from './filterTypeConfig';
import { FilterRow } from './types';

interface Props {
  row: FilterRow;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  canDelete: boolean;
  onChange: (updatedRow: FilterRow) => void;
  onDelete: () => void;
}

const FilterRowContainer = memo<Props>(({ row, datasource, timeRange, canDelete, onChange, onDelete }) => {
  const styles = useStyles2(getStyles);
  const config = FILTER_TYPE_CONFIG[row.filterType];
  const { FieldComponent, OperatorComponent, ValueComponent, valueWrapper } = config;

  const handleFieldChange = useCallback(
    (value: string) => {
      onChange({ ...row, fieldName: value, values: [] });
    },
    [onChange, row]
  );

  const handleOperatorChange = useCallback(
    (value: string) => {
      onChange({ ...row, operator: value, values: [] });
    },
    [onChange, row]
  );

  const handleValueChange = useCallback(
    (values: string[]) => {
      onChange({ ...row, values });
    },
    [onChange, row]
  );

  return (
    <StepRowLayout
      onDelete={onDelete}
      canDelete={canDelete}
      disabledDeleteTooltip='At least one filter is required'
    >
      <FieldComponent
        value={row.fieldName}
        onChange={handleFieldChange}
        datasource={datasource}
        timeRange={timeRange}
      />
      <OperatorComponent value={row.operator} onChange={handleOperatorChange} />
      {valueWrapper && <span className={styles.wrapper}>{valueWrapper.open}</span>}
      <ValueComponent
        key={row.fieldName}
        values={row.values}
        onChange={handleValueChange}
        fieldName={row.fieldName}
        datasource={datasource}
        timeRange={timeRange}
      />
      {valueWrapper && <span className={styles.wrapper}>{valueWrapper.close}</span>}
    </StepRowLayout>
  );
});

FilterRowContainer.displayName = 'FilterRowContainer';

export default FilterRowContainer;

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
  `,
});
