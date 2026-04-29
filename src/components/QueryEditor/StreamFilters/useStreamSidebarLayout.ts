import { useCallback, useState } from 'react';

import {
  STREAM_FILTERS_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY,
  STREAM_FILTERS_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY,
} from '../../../constants';
import store from '../../../store/store';

export const STREAM_FILTERS_SIDEBAR_MIN_WIDTH = 200;
export const STREAM_FILTERS_SIDEBAR_MAX_WIDTH = 480;
export const STREAM_FILTERS_SIDEBAR_DEFAULT_WIDTH = 280;

const clampWidth = (value: number): number => {
  if (Number.isNaN(value)) {
    return STREAM_FILTERS_SIDEBAR_DEFAULT_WIDTH;
  }
  return Math.min(
    STREAM_FILTERS_SIDEBAR_MAX_WIDTH,
    Math.max(STREAM_FILTERS_SIDEBAR_MIN_WIDTH, value)
  );
};

const readInitialWidth = (): number => {
  const raw = store.get(STREAM_FILTERS_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY);
  if (raw === null) {
    return STREAM_FILTERS_SIDEBAR_DEFAULT_WIDTH;
  }
  const parsed = Number(raw);
  if (
    Number.isNaN(parsed) ||
    parsed < STREAM_FILTERS_SIDEBAR_MIN_WIDTH ||
    parsed > STREAM_FILTERS_SIDEBAR_MAX_WIDTH
  ) {
    return STREAM_FILTERS_SIDEBAR_DEFAULT_WIDTH;
  }
  return parsed;
};

const readInitialCollapsed = (): boolean =>
  store.get(STREAM_FILTERS_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY) === 'true';

export interface StreamSidebarLayout {
  width: number;
  isCollapsed: boolean;
  setWidth: (width: number) => void;
  toggleCollapsed: () => void;
}

export function useStreamSidebarLayout(): StreamSidebarLayout {
  const [width, setWidthState] = useState<number>(readInitialWidth);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(readInitialCollapsed);

  const setWidth = useCallback((next: number) => {
    const clamped = clampWidth(next);
    setWidthState(clamped);
    store.set(STREAM_FILTERS_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY, String(clamped));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((current) => {
      const next = !current;
      store.set(STREAM_FILTERS_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return { width, isCollapsed, setWidth, toggleCollapsed };
}
