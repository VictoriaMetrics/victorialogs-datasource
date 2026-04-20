import React, { useCallback, useState } from 'react';

import { Checkbox, ConfirmModal, Stack } from '@grafana/ui';

import { LOGS_LIMIT_WARNING_THRESHOLD, NOT_SHOW_AGAIN_LOGS_LIMIT_WARNING_LOCAL_STORAGE_KEY } from '../../../constants';
import store from '../../../store/store';

export function useMaxLinesWarning(onAccept: (value: number) => void) {
  const [pendingValue, setPendingValue] = useState<number | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const requestConfirmation = useCallback(
    (value: number) => {
      if (value <= LOGS_LIMIT_WARNING_THRESHOLD) {
        onAccept(value);
        return;
      }
      if (store.get(NOT_SHOW_AGAIN_LOGS_LIMIT_WARNING_LOCAL_STORAGE_KEY) === 'true') {
        onAccept(value);
        return;
      }
      setPendingValue(value);
    },
    [onAccept]
  );

  const onConfirm = useCallback(() => {
    if (dontShowAgain) {
      store.set(NOT_SHOW_AGAIN_LOGS_LIMIT_WARNING_LOCAL_STORAGE_KEY, 'true');
    }
    if (pendingValue !== null) {
      onAccept(pendingValue);
    }
    setPendingValue(null);
    setDontShowAgain(false);
  }, [dontShowAgain, pendingValue, onAccept]);

  const onDismiss = useCallback(() => {
    setPendingValue(null);
    setDontShowAgain(false);
  }, []);

  const modal = (
    <ConfirmModal
      isOpen={pendingValue !== null}
      title='Large line limit'
      body={
        <Stack direction='column' gap={2}>
          <div>
            {`You're about to set a line limit of ${pendingValue ?? ''}. `}
            {`Values over ${LOGS_LIMIT_WARNING_THRESHOLD} may cause browser or backend performance issues. Continue?`}
          </div>
          <div>
            <Checkbox
              label="Don't show this warning again"
              value={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.currentTarget.checked)}
            />
          </div>
        </Stack>
      }
      confirmText='Continue'
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />
  );

  return { modal, requestConfirmation };
}
