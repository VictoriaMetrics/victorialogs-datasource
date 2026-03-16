import { css } from '@emotion/css';
import React, { memo, useCallback } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../../datasource';
import FieldNameSelect from '../../shared/FieldNameSelect';
import { FilterRow } from '../types';

import { OperatorComponentProps } from './StaticOperatorLabel';
import { ValueComponentProps } from './TextValueInput';

export interface FilterRowContentProps {
  row: FilterRow;
  onChange: (updatedRow: FilterRow) => void;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
}

interface ValueWrapper {
  open: string;
  close: string;
}

const getWrapperStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
  `,
});

export const createStandardFilterContent = (
  OperatorComponent: React.FC<OperatorComponentProps>,
  ValueComponent: React.FC<ValueComponentProps>,
  valueWrapper?: ValueWrapper
): React.FC<FilterRowContentProps> => {
  const Component = memo<FilterRowContentProps>(function StandardFilterContent({ row, onChange, datasource, timeRange }) {
    const styles = useStyles2(getWrapperStyles);

    const handleFieldChange = useCallback(
      (value: string) => onChange({ ...row, fieldName: value, values: [] }),
      [onChange, row]
    );

    const handleOperatorChange = useCallback(
      (value: string) => onChange({ ...row, operator: value, values: [] }),
      [onChange, row]
    );

    const handleValueChange = useCallback(
      (values: string[]) => onChange({ ...row, values }),
      [onChange, row]
    );

    return (
      <>
        <FieldNameSelect value={row.fieldName} onChange={handleFieldChange} datasource={datasource} timeRange={timeRange} />
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
      </>
    );
  });

  return Component;
};
