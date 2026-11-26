import React, { useState } from 'react';

import { PanelData, TimeRange } from '@grafana/data';
import { IconButton } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { Query } from '../../../types';

import { ExportLogsModal } from './ExportLogsModal';

interface Props {
  datasource: VictoriaLogsDatasource;
  query: Query;
  panelData?: PanelData;
  timeRange?: TimeRange;
}

export const ExportLogsButton: React.FC<Props> = ({ datasource, query, panelData, timeRange }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const hasExpr = Boolean(query.expr?.trim());

  return (
    <>
      <IconButton
        name='download-alt'
        tooltip='Download logs'
        disabled={!hasExpr}
        onClick={() => setIsModalOpen(true)}
      />
      {isModalOpen && (
        <ExportLogsModal
          datasource={datasource}
          query={query}
          panelData={panelData}
          timeRange={timeRange}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
};
