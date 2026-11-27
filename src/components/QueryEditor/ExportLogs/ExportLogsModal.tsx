import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { GrafanaTheme2, PanelData, TimeRange } from '@grafana/data';
import { Alert, Button, Field, LinkButton, Modal, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { Query } from '../../../types';

import { ReadOnlyField } from './ReadOnlyField';
import { DEFAULT_EXPORT_FORMAT, FORMAT_OPTIONS } from './constants';
import { resolveExportQuery } from './exportQuery';
import { resolveExportRange } from './exportRange';
import { buildExportUrl } from './exportUrl';
import { ExportFormat } from './types';
import { useUnmetCsvExport } from './useUnmetCsvExport';

const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const CSV_FORMAT: ExportFormat = 'csv';

interface Props {
  datasource: VictoriaLogsDatasource;
  query: Query;
  panelData?: PanelData;
  timeRange?: TimeRange;
  onClose: () => void;
}

export const ExportLogsModal: React.FC<Props> = ({ datasource, query, panelData, timeRange, onClose }) => {
  const styles = useStyles2(getStyles);
  const [format, setFormat] = useState<ExportFormat>(DEFAULT_EXPORT_FORMAT);
  const [range] = useState(() => resolveExportRange(panelData, timeRange));
  const unmetCsvExport = useUnmetCsvExport(datasource);
  const exportQuery = useMemo(() => resolveExportQuery(datasource, query, panelData), [datasource, query, panelData]);

  const exportUrl = buildExportUrl({
    datasourceUid: datasource.uid,
    exportQuery,
    startMs: range.from.valueOf(),
    endMs: range.to.valueOf(),
    format,
  });
  const formatDescription = unmetCsvExport
    ? `The CSV format needs VictoriaLogs ${unmetCsvExport.minVersion} or newer.`
    : undefined;

  return (
    <Modal title='Download logs' isOpen onDismiss={onClose}>
      <div className={styles.content}>
        <Alert title='The line limit does not apply to the download' severity='info' bottomSpacing={0}>
          The file contains every log that matches the query in the time range. VictoriaLogs does not sort the logs.
          To sort them, add <code>| sort by (_time)</code> to the query.
        </Alert>
        <Field label='Format' description={formatDescription}>
          <RadioButtonGroup
            options={FORMAT_OPTIONS}
            value={format}
            onChange={setFormat}
            disabledOptions={unmetCsvExport ? [CSV_FORMAT] : []}
          />
        </Field>
        <ReadOnlyField label='Time range' value={`${range.from.format(TIME_FORMAT)} to ${range.to.format(TIME_FORMAT)}`} />
        <ReadOnlyField label='Query' value={exportQuery.expr} />
        {exportQuery.extraStreamFilters && (
          <ReadOnlyField label='Stream filters' value={exportQuery.extraStreamFilters} />
        )}
        {exportQuery.extraFilters && <ReadOnlyField label='Filters' value={exportQuery.extraFilters} />}
        <div className={styles.actions}>
          <Button variant='secondary' onClick={onClose}>
            Cancel
          </Button>
          <LinkButton
            variant='primary'
            icon='download-alt'
            href={exportUrl}
            target='_blank'
            onClick={onClose}
          >
            Download
          </LinkButton>
        </div>
      </div>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  actions: css({
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
  }),
});
