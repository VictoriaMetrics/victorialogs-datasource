import { useCallback } from 'react';

import { PipelineStepPatch } from '../types';

interface UseRowManagementOptions<TRow extends { id: string }> {
  rows: TRow[];
  stepId: string;
  onStepChange: (id: string, patch: PipelineStepPatch) => void;
}

interface UseRowManagementResult<TRow> {
  handleRowChange: (updatedRow: TRow) => void;
  handleRowDelete: (rowId: string) => void;
  handleAddRow: (newRow: TRow) => void;
}

export const useRowManagement = <TRow extends { id: string }>({
  rows,
  stepId,
  onStepChange,
}: UseRowManagementOptions<TRow>): UseRowManagementResult<TRow> => {
  const handleRowChange = useCallback(
    (updatedRow: TRow) => {
      const newRows = rows.map((r) => (r.id === updatedRow.id ? updatedRow : r));
      onStepChange(stepId, { rows: newRows } as PipelineStepPatch);
    },
    [rows, onStepChange, stepId]
  );

  const handleRowDelete = useCallback(
    (rowId: string) => {
      const newRows = rows.filter((r) => r.id !== rowId);
      onStepChange(stepId, { rows: newRows } as PipelineStepPatch);
    },
    [rows, onStepChange, stepId]
  );

  const handleAddRow = useCallback(
    (newRow: TRow) => {
      onStepChange(stepId, { rows: [...rows, newRow] } as PipelineStepPatch);
    },
    [rows, onStepChange, stepId]
  );

  return { handleRowChange, handleRowDelete, handleAddRow };
};
