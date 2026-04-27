import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../../datasource';
import { useFetchStreamFilters } from '../useFetchStreamFilters';

import { PopoverSearch } from './PopoverSearch';
import { ValuesList } from './ValuesList';
import { useFetchedValues } from './useFetchedValues';

const POPOVER_WIDTH = 320;
const POPOVER_MAX_HEIGHT = 320;

interface Props {
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryExpr?: string;
  label: string;
  selectedValues: string[];
  extraStreamFilters?: string;
  onToggle: (value: string) => void;
}

export const StreamValuesPopover: React.FC<Props> = ({
  datasource,
  timeRange,
  queryExpr,
  label,
  selectedValues,
  extraStreamFilters,
  onToggle,
}) => {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');

  const { loadStreamFieldValues } = useFetchStreamFilters({
    datasource,
    fieldName: label,
    timeRange,
    queryExpr,
    extraStreamFilters,
  });

  const { options, error } = useFetchedValues({ loadStreamFieldValues, search });

  return (
    <div className={styles.popover}>
      <PopoverSearch value={search} onChange={setSearch} />
      <ValuesList
        options={options}
        error={error}
        selectedValues={selectedValues}
        onToggle={onToggle}
      />
    </div>
  );
};

const getStyles = (_theme: GrafanaTheme2) => ({
  popover: css`
    width: ${POPOVER_WIDTH}px;
    max-height: ${POPOVER_MAX_HEIGHT}px;
    display: flex;
    flex-direction: column;
    // Pull the popover against the Toggletip's built-in container/body padding
    // so the visible gap between the Toggletip border and our content is ~4px.
    margin: -20px -12px;
  `,
});
