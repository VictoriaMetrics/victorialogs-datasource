import React, { useMemo } from 'react';

import { TimeRange } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { useFetchStreamFilters } from '../shared/useFetchStreamFilters';
import { useFieldFetch } from '../shared/useFieldFetch';

import { FieldLoadersProvider } from './FieldLoadersContext';
import { OptionalExtensionMenu } from './OptionalExtensionMenu';
import { SegmentRenderer } from './SegmentRenderer';
import { getStyles } from './styles';
import { getTemplate } from './templates/registry';
import { Pipe } from './types';

interface Props {
  pipe: Pipe;
  activeId: string | null;
  onActivate: (id: string) => void;
  onValueChange: (segmentId: string, value: string | null) => void;
  onMultiValuesChange: (segmentId: string, values: string[]) => void;
  onConfirm: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onAddExtension: (key: string) => void;
  onExtensionVisibleChange?: (visible: boolean) => void;
  onStreamFieldSelected?: (fieldName: string) => void;
  datasource: VictoriaLogsDatasource;
  timeRange?: TimeRange;
  queryContext: string;
  extraStreamFilters?: string;
}

export const PipeRenderer: React.FC<Props> = ({
  pipe,
  activeId,
  onActivate,
  onValueChange,
  onMultiValuesChange,
  onConfirm,
  onDeactivate,
  onDelete,
  onAddExtension,
  onExtensionVisibleChange,
  onStreamFieldSelected,
  datasource,
  timeRange,
  queryContext,
  extraStreamFilters,
}) => {
  const styles = useStyles2(getStyles);

  const { loadFieldNames, loadFieldValuesForField } = useFieldFetch({ datasource, timeRange, queryContext });
  const { loadStreamFieldNames, loadStreamFieldValuesForField } = useFetchStreamFilters({
    datasource, timeRange, queryExpr: queryContext, extraStreamFilters,
  });

  const templateConfig = useMemo(() => getTemplate(pipe.templateType), [pipe.templateType]);
  const extensions = templateConfig?.optionalExtensions;
  const activeKeys = useMemo(() => new Set(pipe.activeExtensionKeys ?? []), [pipe.activeExtensionKeys]);

  return (
    <FieldLoadersProvider value={{ loadFieldNames, loadFieldValuesForField, loadStreamFieldNames, loadStreamFieldValuesForField }}>
      <span className={`${styles.pipeGroup} pipe-group`}>
        <SegmentRenderer
          segments={pipe.segments}
          activeId={activeId}
          onActivate={onActivate}
          onValueChange={onValueChange}
          onMultiValuesChange={onMultiValuesChange}
          onConfirm={onConfirm}
          onDeactivate={onDeactivate}
          onStreamFieldSelected={onStreamFieldSelected}
        />
        {extensions && extensions.length > 0 && (
          <OptionalExtensionMenu
            extensions={extensions}
            activeKeys={activeKeys}
            onAdd={onAddExtension}
            onVisibleChange={onExtensionVisibleChange}
          />
        )}
        <IconButton
          className={styles.deleteButton}
          name='times'
          size='sm'
          tooltip='Remove pipe'
          onClick={onDelete}
        />
      </span>
    </FieldLoadersProvider>
  );
};
