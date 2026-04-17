import React, { useCallback } from 'react';

import { InlineField, Input } from '@grafana/ui';

import { useMaxLinesWarning } from '../components/shared/shared/useMaxLinesWarning';
import { LOGS_LIMIT_HARD_CAP, LOGS_LIMIT_WARNING_THRESHOLD } from '../constants';

type Props = {
  maxLines: string;
  onMaxLinedChange: (value: string) => void;
};

export const QuerySettings = (props: Props) => {
  const { maxLines, onMaxLinedChange } = props;
  const numeric = parseInt(maxLines, 10);
  const isOverCap = !isNaN(numeric) && numeric > LOGS_LIMIT_HARD_CAP;

  const applyMaxLines = useCallback((value: number) => {
    onMaxLinedChange(value.toString());
  }, [onMaxLinedChange]);

  const { modal: maxLinesWarningModal, requestConfirmation } = useMaxLinesWarning(applyMaxLines);

  const onChange = (event: React.FormEvent<HTMLInputElement>) => {
    const raw = event.currentTarget.value;
    const parsed = parseInt(raw, 10);

    if (raw === '' || isNaN(parsed)) {
      onMaxLinedChange(raw);
      return;
    }

    if (parsed > LOGS_LIMIT_HARD_CAP) {
      onMaxLinedChange(String(LOGS_LIMIT_HARD_CAP));
      return;
    }

    onMaxLinedChange(raw);
  };

  const onBlur = () => {
    if (!isNaN(numeric) && numeric > LOGS_LIMIT_WARNING_THRESHOLD) {
      requestConfirmation(numeric);
    }
  };

  return (
    <div className='gf-form-inline'>
      {maxLinesWarningModal}
      <InlineField
        label='Maximum lines'
        labelWidth={28}
        tooltip={
          <>
            VictoriaLogs queries must contain a limit of the maximum number of lines returned (default: 1000).
            Maximum allowed value is {LOGS_LIMIT_HARD_CAP}. Decrease this limit if your browser becomes sluggish
            when displaying the log results.
          </>
        }
        invalid={isOverCap}
        error={`Maximum value is ${LOGS_LIMIT_HARD_CAP}.`}
      >
        <Input
          className='width-8'
          type='number'
          min={0}
          max={LOGS_LIMIT_HARD_CAP}
          value={maxLines}
          onChange={onChange}
          onBlur={onBlur}
          placeholder='1000'
          spellCheck={false}
        />
      </InlineField>
    </div>
  );
};
