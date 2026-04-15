import { useCallback } from 'react';

import { getTabOrder, uniqueId } from '../segmentHelpers';
import { getTemplate } from '../templates/registry';
import { Pipe, PlaceholderSegment, TemplateQueryModel } from '../types';

function createPipeFromTemplate(templateType: string): Pipe | null {
  const config = getTemplate(templateType);
  if (!config) {
    return null;
  }
  let segments = config.createSegments();
  const activeExtensionKeys: string[] = [];

  // Auto-add default extensions (e.g. "by" for aggregate templates)
  const defaultExtensions = config.optionalExtensions?.filter((e) => e.addByDefault);
  if (defaultExtensions?.length) {
    for (const ext of defaultExtensions) {
      const extSegments = ext.createSegments();
      const idx = ext.insertionIndex;
      segments = idx !== undefined
        ? [...segments.slice(0, idx), ...extSegments, ...segments.slice(idx)]
        : [...segments, ...extSegments];
      activeExtensionKeys.push(ext.key);
    }
  }

  return {
    id: uniqueId('pipe'),
    templateType,
    segments,
    tabOrder: getTabOrder(segments),
    activeExtensionKeys,
  };
}

export function useTemplateActions(
  model: TemplateQueryModel,
  onChange: (model: TemplateQueryModel) => void,
) {
  const addPipe = useCallback(
    (templateType: string) => {
      const pipe = createPipeFromTemplate(templateType);
      if (!pipe) {
        return null;
      }
      onChange({ pipes: [...model.pipes, pipe] });
      return pipe.id;
    },
    [model, onChange]
  );

  const insertPipe = useCallback(
    (templateType: string, atIndex: number) => {
      const pipe = createPipeFromTemplate(templateType);
      if (!pipe) {
        return null;
      }
      const newPipes = [
        ...model.pipes.slice(0, atIndex),
        pipe,
        ...model.pipes.slice(atIndex),
      ];
      onChange({ pipes: newPipes });
      return pipe.id;
    },
    [model, onChange]
  );

  const deletePipe = useCallback(
    (pipeId: string) => {
      onChange({ pipes: model.pipes.filter((p) => p.id !== pipeId) });
    },
    [model, onChange]
  );

  const updateSegmentField = useCallback(
    (pipeId: string, segmentId: string, update: Partial<PlaceholderSegment>) => {
      const pipes = model.pipes.map((pipe) => {
        if (pipe.id !== pipeId) {
          return pipe;
        }
        const segments = pipe.segments.map((seg) => {
          if (seg.type !== 'placeholder' || seg.id !== segmentId) {
            return seg;
          }
          return { ...seg, ...update };
        });
        return { ...pipe, segments };
      });
      onChange({ pipes });
    },
    [model, onChange]
  );

  const updateSegment = useCallback(
    (pipeId: string, segmentId: string, value: string | null) => updateSegmentField(pipeId, segmentId, { value }),
    [updateSegmentField]
  );

  const updateMultiValues = useCallback(
    (pipeId: string, segmentId: string, multiValues: string[]) => updateSegmentField(pipeId, segmentId, { multiValues }),
    [updateSegmentField]
  );

  const addExtension = useCallback(
    (pipeId: string, extensionKey: string) => {
      const pipe = model.pipes.find((p) => p.id === pipeId);
      if (!pipe) {
        return;
      }
      const config = getTemplate(pipe.templateType);
      const extension = config?.optionalExtensions?.find((e) => e.key === extensionKey);
      if (!extension) {
        return;
      }
      const newSegments = extension.createSegments();
      const idx = extension.insertionIndex;
      const pipes = model.pipes.map((p) => {
        if (p.id !== pipeId) {
          return p;
        }
        const segments = idx !== undefined
          ? [...p.segments.slice(0, idx), ...newSegments, ...p.segments.slice(idx)]
          : [...p.segments, ...newSegments];
        const activeExtensionKeys = [...(p.activeExtensionKeys ?? []), extensionKey];
        return { ...p, segments, tabOrder: getTabOrder(segments), activeExtensionKeys };
      });
      onChange({ pipes });
    },
    [model, onChange]
  );

  const convertPipeToStream = useCallback(
    (pipeId: string, fieldName: string) => {
      const config = getTemplate('stream');
      if (!config) {
        return;
      }
      const segments = config.createSegments().map((seg) => {
        if (seg.type === 'placeholder' && seg.role === 'streamFieldName') {
          return { ...seg, value: fieldName };
        }
        return seg;
      });
      const pipes = model.pipes.map((p) => {
        if (p.id !== pipeId) {
          return p;
        }
        return { ...p, templateType: 'stream', segments, tabOrder: config.tabOrder(segments) };
      });
      onChange({ pipes });
    },
    [model, onChange]
  );

  const clearAll = useCallback(() => {
    onChange({ pipes: [] });
  }, [onChange]);

  return { addPipe, insertPipe, deletePipe, updateSegment, updateMultiValues, addExtension, convertPipeToStream, clearAll };
}
