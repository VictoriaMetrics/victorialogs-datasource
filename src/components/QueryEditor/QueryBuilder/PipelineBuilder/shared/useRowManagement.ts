import { useCallback } from 'react';

import { PipelineStepItem } from '../types';

interface UseRowManagementOptions<TRow extends { id: string }> {
  rows: TRow[];
  stepId: string;
  rowsKey: string;
  onStepChange: (id: string, patch: Partial<Omit<PipelineStepItem, 'id' | 'type'>>) => void;
}

interface UseRowManagementResult<TRow> {
  handleRowChange: (updatedRow: TRow) => void;
  handleRowDelete: (rowId: string) => void;
  handleAddRow: (newRow: TRow) => void;
}

export const useRowManagement = <TRow extends { id: string }>({
  rows,
  stepId,
  rowsKey,
  onStepChange,
}: UseRowManagementOptions<TRow>): UseRowManagementResult<TRow> => {
  const handleRowChange = useCallback(
    (updatedRow: TRow) => {
      const newRows = rows.map((r) => (r.id === updatedRow.id ? updatedRow : r));
      onStepChange(stepId, { [rowsKey]: newRows });
    },
    [rows, onStepChange, stepId, rowsKey]
  );

  const handleRowDelete = useCallback(
    (rowId: string) => {
      if (rows.length <= 1) {
        return;
      }
      const newRows = rows.filter((r) => r.id !== rowId);
      onStepChange(stepId, { [rowsKey]: newRows });
    },
    [rows, onStepChange, stepId, rowsKey]
  );

  const handleAddRow = useCallback(
    (newRow: TRow) => {
      onStepChange(stepId, { [rowsKey]: [...rows, newRow] });
    },
    [rows, onStepChange, stepId, rowsKey]
  );

  return { handleRowChange, handleRowDelete, handleAddRow };
};
