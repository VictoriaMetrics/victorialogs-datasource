import { useCallback, useMemo } from 'react';

import { Pipe } from './types';

export function useTabNavigation(
  pipes: Pipe[],
  activeId: string | null,
  setActiveId: (id: string | null) => void
) {
  const allIds = useMemo(
    () => pipes.flatMap((p) => p.tabOrder),
    [pipes]
  );

  /** Returns true if moved to next placeholder, false if was at the last one (deactivated). */
  const activateNext = useCallback((): boolean => {
    if (!activeId) {
      return false;
    }
    const idx = allIds.indexOf(activeId);
    if (idx < allIds.length - 1) {
      setActiveId(allIds[idx + 1]);
      return true;
    }
    setActiveId(null);
    return false;
  }, [activeId, allIds, setActiveId]);

  const activatePrev = useCallback(() => {
    if (!activeId) {
      return;
    }
    const idx = allIds.indexOf(activeId);
    if (idx > 0) {
      setActiveId(allIds[idx - 1]);
    }
  }, [activeId, allIds, setActiveId]);

  const activateFirst = useCallback(
    (pipeId: string) => {
      const pipe = pipes.find((p) => p.id === pipeId);
      if (pipe && pipe.tabOrder.length > 0) {
        setActiveId(pipe.tabOrder[0]);
      }
    },
    [pipes, setActiveId]
  );

  const activateLast = useCallback(
    (pipeId: string) => {
      const pipe = pipes.find((p) => p.id === pipeId);
      if (pipe && pipe.tabOrder.length > 0) {
        setActiveId(pipe.tabOrder[pipe.tabOrder.length - 1]);
      }
    },
    [pipes, setActiveId]
  );

  return { activateNext, activatePrev, activateFirst, activateLast };
}
