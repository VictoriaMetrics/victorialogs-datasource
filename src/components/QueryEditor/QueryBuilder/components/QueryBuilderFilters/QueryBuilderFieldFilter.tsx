import { css } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { IconButton, Label, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../../datasource';
import { escapeLabelValueInExactSelector } from '../../../../../languageUtils';
import { normalizeKey } from '../../../../../modifyQuery';
import { VisualQuery } from '../../../../../types';
import { CompatibleCombobox } from '../../../../CompatibleCombobox';
import { deleteByIndexPath } from '../../utils/modifyFilterVisualQuery/deleteByIndexPath';
import { updateValueByIndexPath } from '../../utils/modifyFilterVisualQuery/updateByIndexPath';
import { DEFAULT_FIELD } from '../../utils/parseToString';

import { useFetchFilters } from './useFetchFilters';

interface Props {
  datasource: VictoriaLogsDatasource;
  filter: string;
  query: VisualQuery;
  indexPath: number[];
  timeRange?: TimeRange;
  onChange: (query: VisualQuery) => void;
}

const QueryBuilderFieldFilter = ({ datasource, filter, query, indexPath, timeRange, onChange }: Props) => {
  const styles = useStyles2(getStyles);

  const { field, fieldValue } = useMemo(() => {
    const regex = /("[^"]*"|'[^']*'|\S+)\s*:\s*("[^"]*"|'[^']*'|\S+)?|\S+/i;
    const matches = filter.match(regex);
    if (!matches || matches.length < 1) {
      return {};
    }
    const field = matches[1] || DEFAULT_FIELD;
    let fieldValue = matches[2] ?? (matches[1] ? '' : matches[0]);

    // Remove surrounding quotes from fieldValue
    if (
      fieldValue &&
      ((fieldValue.startsWith('"') && fieldValue.endsWith('"')) ||
        (fieldValue.startsWith("'") && fieldValue.endsWith("'")))
    ) {
      fieldValue = fieldValue.slice(1, -1);
    }

    return { field, fieldValue };
  }, [filter]);

  const { loadFieldNames, loadFieldValues } = useFetchFilters({
    datasource,
    query,
    field,
    indexPath,
    timeRange,
  });

  const handleRemoveFilter = useCallback(() => {
    onChange({
      ...query,
      filters: deleteByIndexPath(query.filters, indexPath),
    });
  }, [onChange, query, indexPath]);

  const handleSelectFieldName = useCallback(
    (option: { value?: string; label?: string } | null) => {
      if (!option || !option.value) {
        return;
      }
      // Clear field value when field name changes
      const fullFilter = `${option.value}: `;

      onChange({
        ...query,
        filters: updateValueByIndexPath(query.filters, indexPath, fullFilter),
      });
    },
    [onChange, query, indexPath]
  );

  const handleSelectFieldValue = useCallback(
    (option: { value?: string; label?: string } | null) => {
      if (!option || !option.value) {
        return;
      }
      const fullFilter = `${normalizeKey(field || '')}: ${field === '_stream' ? option.value : `"${escapeLabelValueInExactSelector(option.value || '')}"`} `;

      onChange({
        ...query,
        filters: updateValueByIndexPath(query.filters, indexPath, fullFilter),
      });
    },
    [onChange, query, indexPath, field]
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <Label>Filter</Label>
        <IconButton name={'times'} tooltip={'Remove filter'} size='sm' onClick={handleRemoveFilter} />
      </div>
      <div className={styles.content}>
        <CompatibleCombobox
          placeholder='Select field name'
          value={field ? { label: field, value: field } : null}
          options={loadFieldNames}
          onChange={handleSelectFieldName}
          width={'auto'}
          minWidth={10}
          createCustomValue
        />
        <span>:</span>
        <CompatibleCombobox
          key={field}
          placeholder='Select field value'
          value={fieldValue ? { label: fieldValue, value: fieldValue } : null}
          options={loadFieldValues}
          onChange={handleSelectFieldValue}
          width={'auto'}
          minWidth={10}
          createCustomValue
        />
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      display: grid;
      gap: ${theme.spacing(0.5)};
      width: max-content;
      border: 1px solid ${theme.colors.border.strong};
      background-color: ${theme.colors.background.secondary};
      padding: ${theme.spacing(1)};
    `,
    header: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
    `,
    content: css`
      display: flex;
      align-items: center;
      justify-content: center;
      gap: ${theme.spacing(0.5)};
    `,
  };
};

export default QueryBuilderFieldFilter;
