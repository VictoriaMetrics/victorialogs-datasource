import React, { Suspense, useState } from 'react';

import { TimeRange } from '@grafana/data';
import { Button } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { Query } from '../../../types';

// lazy: keep the drawer (PanelRenderer and friends) out of the main editor bundle
const DrilldownDrawer = React.lazy(() => import('./DrilldownDrawer'));

interface DrilldownButtonProps {
  datasource: VictoriaLogsDatasource;
  query: Query;
  range?: TimeRange;
  onChange: (query: Query) => void;
  onRunQuery: () => void;
}

/** Opens the drilldown drawer for the current query */
export const DrilldownButton: React.FC<DrilldownButtonProps> = ({ datasource, query, range, onChange, onRunQuery }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant='secondary'
        size='sm'
        icon='compass'
        onClick={() => setOpen(true)}
        tooltip='Explore field values of the current query'
      >
        Drilldown
      </Button>
      {open && (
        <Suspense fallback={null}>
          <DrilldownDrawer
            datasource={datasource}
            query={query}
            range={range}
            onChange={onChange}
            onRunQuery={onRunQuery}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
};
