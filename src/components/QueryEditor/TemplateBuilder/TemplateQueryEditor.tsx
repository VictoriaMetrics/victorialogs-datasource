import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { TimeRange } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { VictoriaLogsDatasource } from '../../../datasource';
import { Query } from '../../../types';
import { PipelineContext } from '../shared/PipelineContext';
import { buildStreamExtraFilters } from '../shared/streamFilterUtils';

import { PipeList } from './PipeList';
import { PipeFieldLoadersProvider, PipeRenderer } from './PipeRenderer';
import { PipeTypeSearchMenu } from './PipeTypeSearchMenu';
import { usePopupManager } from './hooks/usePopupManager';
import { useTabNavigation } from './hooks/useTabNavigation';
import { useTemplateActions } from './hooks/useTemplateActions';
import { buildPipeQueryContext, serializeQuery } from './serialization';
import { getStyles } from './styles';
import { Pipe, TemplateQueryModel } from './types';

interface Props {
  datasource: VictoriaLogsDatasource;
  query: Query;
  onChange: (query: Query) => void;
  onRunQuery: () => void;
  timeRange?: TimeRange;
  app?: string;
}

const TemplateQueryEditor: React.FC<Props> = ({
  datasource,
  query,
  onChange,
  onRunQuery,
  timeRange,
}) => {
  const styles = useStyles2(getStyles);
  const popup = usePopupManager();
  const { setActiveId, openAddMenu } = popup;
  const editorRef = useRef<HTMLDivElement>(null);

  // Holds pipeId waiting to be activated once model.pipes updates with the new pipe
  const pendingActivatePipeId = useRef<string | null>(null);
  // After stream conversion the field is pre-filled — activate the second placeholder (values)
  const pendingActivateSecondPipeId = useRef<string | null>(null);

  const model: TemplateQueryModel = useMemo(
    () => query.templateBuilder ?? { pipes: [] },
    [query.templateBuilder]
  );

  const handleModelChange = useCallback(
    (newModel: TemplateQueryModel) => {
      const expr = serializeQuery(newModel);
      onChange({ ...query, expr, templateBuilder: newModel });
    },
    [query, onChange]
  );

  const { addPipe, insertPipe, deletePipe, updateSegment, updateMultiValues, addExtension, convertPipeToStream, clearAll } = useTemplateActions(model, handleModelChange);
  const { activateNext, activateFirst } = useTabNavigation(model.pipes, popup.activeId, setActiveId);

  // Once model.pipes contains the pending pipe, activate its first placeholder.
  // If the pipe has no placeholders (e.g. count()), open the add menu instead.
  useEffect(() => {
    const pipeId = pendingActivatePipeId.current;
    if (pipeId && model.pipes.some((p) => p.id === pipeId)) {
      pendingActivatePipeId.current = null;
      const pipe = model.pipes.find((p) => p.id === pipeId);
      if (pipe && pipe.tabOrder.length === 0) {
        openAddMenu();
      } else {
        activateFirst(pipeId);
      }
    }
  }, [model.pipes, activateFirst, openAddMenu]);

  // After stream conversion the field is pre-filled — activate the second placeholder (values).
  useEffect(() => {
    const secondPipeId = pendingActivateSecondPipeId.current;
    if (secondPipeId) {
      const pipe = model.pipes.find((p) => p.id === secondPipeId);
      if (pipe) {
        pendingActivateSecondPipeId.current = null;
        if (pipe.tabOrder.length > 1) {
          setActiveId(pipe.tabOrder[1]);
        }
      }
    }
  }, [model.pipes, setActiveId]);

  const extraStreamFilters = useMemo(
    () => buildStreamExtraFilters(query.streamFilters ?? []) || undefined,
    [query.streamFilters]
  );
  const pipelineContextValue = useMemo(
    () => ({ extraStreamFilters }),
    [extraStreamFilters]
  );

  const handleAddPipe = useCallback(
    (templateType: string) => {
      const pipeId = popup.insertAtIndex !== null
        ? insertPipe(templateType, popup.insertAtIndex)
        : addPipe(templateType);
      popup.closeAll();
      if (pipeId) {
        pendingActivatePipeId.current = pipeId;
      }
    },
    [addPipe, insertPipe, popup]
  );

  const handleInsertAt = useCallback(
    (index: number, buttonEl: HTMLButtonElement) => {
      popup.openInsertMenu(index, buttonEl);
    },
    [popup]
  );

  // Close dropdowns on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (editorRef.current && !editorRef.current.contains(target)) {
        // Ignore clicks inside portal-rendered floating elements (dropdowns, menus)
        if (target.closest?.('[data-floating-portal]')) {
          return;
        }
        popup.closeAll();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [popup]);

  // Global Shift+Enter to run query
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        popup.closeAll();
        onRunQuery();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onRunQuery, popup]);

  const handleDeactivate = useCallback(() => {
    popup.closeAll();
  }, [popup]);

  const handleConfirm = useCallback(() => {
    const advanced = activateNext();
    if (!advanced) {
      popup.openAddMenu();
    }
  }, [activateNext, popup]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        popup.closeAll();
      }
    },
    [popup]
  );

  const renderPipe = useCallback(
    (pipe: Pipe, index: number) => (
      <PipeFieldLoadersProvider
        key={pipe.id}
        datasource={datasource}
        timeRange={timeRange}
        queryContext={buildPipeQueryContext(model, index)}
        extraStreamFilters={extraStreamFilters}
      >
        <PipeRenderer
          pipe={pipe}
          activeId={popup.activeId}
          onActivate={popup.setActiveId}
          onValueChange={(segId, val) => updateSegment(pipe.id, segId, val)}
          onMultiValuesChange={(segId, vals) => updateMultiValues(pipe.id, segId, vals)}
          onConfirm={handleConfirm}
          onDeactivate={handleDeactivate}
          onDelete={() => deletePipe(pipe.id)}
          onAddExtension={(key) => addExtension(pipe.id, key)}
          onExtensionVisibleChange={(visible) => popup.handleExtensionVisibleChange(pipe.id, visible)}
          onStreamFieldSelected={(fieldName) => {
            convertPipeToStream(pipe.id, fieldName);
            pendingActivateSecondPipeId.current = pipe.id;
          }}
        />
      </PipeFieldLoadersProvider>
    ),
    [popup, updateSegment, updateMultiValues, handleConfirm, handleDeactivate, deletePipe, addExtension, convertPipeToStream, datasource, timeRange, model, extraStreamFilters]
  );

  return (
    <PipelineContext.Provider value={pipelineContextValue}>
      <div ref={editorRef} className={styles.editor} onKeyDown={handleKeyDown}>
        <PipeList pipes={model.pipes} renderPipe={renderPipe} onInsertAt={handleInsertAt} />
        <PipeTypeSearchMenu
          isOpen={popup.addMenuOpen}
          onAdd={handleAddPipe}
          onOpenMenu={popup.openAddMenu}
          onClose={popup.closeAddMenu}
          anchorEl={popup.insertAnchorEl}
        />
        {model.pipes.length > 0 && (
          <IconButton
            className={styles.clearButton}
            name='trash-alt'
            size='sm'
            tooltip='Clear query'
            onClick={clearAll}
          />
        )}
      </div>
    </PipelineContext.Provider>
  );
};

export default TemplateQueryEditor;
