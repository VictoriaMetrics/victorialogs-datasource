import React, { memo, useCallback } from 'react';

import { AutoSizeInput } from '@grafana/ui';

import StepRowLayout from '../../components/StepRowLayout';
import { StepContentProps } from '../shared/types';
import { CustomStep } from '../types';

const CustomStepContent = memo(function CustomStepContent({ step, onStepChange, onDeleteStep }: StepContentProps) {
  const customStep = step as CustomStep;

  const handleCommit = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      onStepChange(step.id, { expression: e.currentTarget.value });
    },
    [onStepChange, step.id]
  );

  return (
    <StepRowLayout onDelete={() => onDeleteStep(step.id)} canDelete={true}>
      <AutoSizeInput
        defaultValue={customStep.expression ?? ''}
        minWidth={20}
        placeholder='custom pipe expression'
        onCommitChange={handleCommit}
      />
    </StepRowLayout>
  );
});

export default CustomStepContent;
