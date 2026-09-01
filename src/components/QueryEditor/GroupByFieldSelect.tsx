import React, { useCallback } from 'react';

import { TimeRange } from '@grafana/data';
import { ComboboxOption } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../datasource';
import { CompatibleCombobox } from '../CompatibleCombobox';

import { useFieldFetch } from './shared/useFieldFetch';

interface Props {
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryContext?: string;
  value?: string;
  onChange: (field?: string) => void;
}

/** Single log field selector used to group hits query results by the field value */
export const GroupByFieldSelect = ({ datasource, timeRange, queryContext, value, onChange }: Props) => {
  const { loadFieldNames } = useFieldFetch({ datasource, timeRange, queryContext });

  const handleChange = useCallback(
    (option: ComboboxOption<string> | null) => {
      onChange(option?.value || undefined);
    },
    [onChange]
  );

  return (
    <CompatibleCombobox
      placeholder='none'
      isClearable
      width={20}
      value={value ?? null}
      options={loadFieldNames}
      onChange={handleChange}
    />
  );
};
