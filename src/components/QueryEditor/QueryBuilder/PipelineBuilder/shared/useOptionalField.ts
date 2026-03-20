import React, { useCallback } from 'react';

interface OptionalFieldHandlers {
  isActive: boolean;
  handleAdd: () => void;
  handleRemove: () => void;
  handleChange: (e: React.FormEvent<HTMLInputElement>) => void;
}

/**
 * Manages an optional string field.
 * Works at both step-level and row-level — just pass the appropriate update function.
 *
 * Step-level: useOptionalField(sortStep.offset, (v) => updateStep({ offset: v }))
 * Row-level:  useOptionalField(row.limit, (v) => onChange({ ...row, limit: v }))
 */
export const useOptionalField = (
  value: string | undefined,
  update: (value: string | undefined) => void
): OptionalFieldHandlers => {
  const isActive = value !== undefined;

  const handleAdd = useCallback(() => update(''), [update]);
  const handleRemove = useCallback(() => update(undefined), [update]);
  const handleChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => update(e.currentTarget.value),
    [update]
  );

  return { isActive, handleAdd, handleRemove, handleChange };
};
