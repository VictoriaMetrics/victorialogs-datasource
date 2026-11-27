import React, { useState } from 'react';

import { PanelData, TimeRange } from '@grafana/data';
import { IconButton } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { Query } from '../../../types';

import { ExportLogsModal } from './ExportLogsModal';
import { getExportBlock } from './exportBlock';

interface Props {
  datasource: VictoriaLogsDatasource;
  query: Query;
  panelData?: PanelData;
  timeRange?: TimeRange;
}

export const ExportLogsButton: React.FC<Props> = ({ datasource, query, panelData, timeRange }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const hasExpr = Boolean(query.expr?.trim());
  const exportBlock = getExportBlock(query, panelData);

  // The code editor saves its text on blur, so a click on the button can open the modal for a query that did not run
  if (isModalOpen && exportBlock !== undefined) {
    setIsModalOpen(false);
  }

  return (
    <>
      <IconButton
        name='download-alt'
        tooltip={exportBlock ?? 'Download logs'}
        disabled={!hasExpr || exportBlock !== undefined}
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
