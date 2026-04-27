import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { useFetchStreamFilters } from '../shared/useFetchStreamFilters';

import { useStreamFiltersContext } from './StreamFiltersContext';
import { StreamSearch } from './StreamSearch';
import { StreamValuesList } from './StreamValuesList';
import { useFetchedValues } from './useFetchedValues';

interface Props {
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryExpr?: string;
  label: string;
}

export const StreamValuesPanel: React.FC<Props> = ({
  datasource,
  timeRange,
  queryExpr,
  label,
}) => {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');
  const {
    selectedValuesForPopover,
    popoverExtraStreamFilters,
    handleToggleValue,
  } = useStreamFiltersContext();

  const { loadStreamFieldValues } = useFetchStreamFilters({
    datasource,
    fieldName: label,
    timeRange,
    queryExpr,
    extraStreamFilters: popoverExtraStreamFilters,
  });

  const { options, error } = useFetchedValues({ loadStreamFieldValues, search });

  return (
    <div className={styles.panel}>
      <StreamSearch placeholder='Search values' value={search} onChange={setSearch} />
      <StreamValuesList
        options={options}
        error={error}
        selectedValues={selectedValuesForPopover}
        onToggle={handleToggleValue}
      />
    </div>
  );
};

const getStyles = (_theme: GrafanaTheme2) => ({
  panel: css`
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
  `,
});
