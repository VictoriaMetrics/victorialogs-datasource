import { css } from '@emotion/css';
import React, { useCallback, useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  /** Current width in px; used as the starting size when drag begins. */
  currentWidth: number;
  /** Called continuously during drag with the new (unclamped) width in px. */
  onResize: (width: number) => void;
  /** Drag direction relative to the handle. 'right' grows when the user drags right. */
  direction?: 'right' | 'left';
  /** Accessible label for screen readers. */
  ariaLabel?: string;
}

interface DragState {
  startX: number;
  startWidth: number;
  abortController: AbortController;
}

export const ResizeHandle: React.FC<Props> = ({
  currentWidth,
  onResize,
  direction = 'right',
  ariaLabel,
}) => {
  const styles = useStyles2(getStyles);

  // Held in refs so handlePointerDown doesn't need currentWidth/onResize in
  // its dependency array — the resize handler reads the latest values at the
  // moment drag starts without forcing the callback to rebuild on every render.
  const currentWidthRef = useRef(currentWidth);
  const onResizeRef = useRef(onResize);
  useEffect(() => {
    currentWidthRef.current = currentWidth;
    onResizeRef.current = onResize;
  });

  const dragStateRef = useRef<DragState | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const abortController = new AbortController();
      const { signal } = abortController;
      const sign = direction === 'right' ? 1 : -1;

      dragStateRef.current = {
        startX: e.clientX,
        startWidth: currentWidthRef.current,
        abortController,
      };

      const handleMove = (event: PointerEvent) => {
        const drag = dragStateRef.current;
        if (!drag) {
          return;
        }
        onResizeRef.current(drag.startWidth + sign * (event.clientX - drag.startX));
      };

      const handleEnd = () => {
        dragStateRef.current = null;
        abortController.abort();
      };

      window.addEventListener('pointermove', handleMove, { signal });
      window.addEventListener('pointerup', handleEnd, { signal });
      window.addEventListener('pointercancel', handleEnd, { signal });
    },
    [direction]
  );

  // Defensive cleanup: if the host unmounts mid-drag (e.g. the parent collapses
  // a resizable sidebar), abort the drag so global listeners don't leak.
  useEffect(() => {
    return () => {
      dragStateRef.current?.abortController.abort();
      dragStateRef.current = null;
    };
  }, []);

  return (
    <div
      className={direction === 'left' ? styles.handleLeft : styles.handleRight}
      onPointerDown={handlePointerDown}
      role='separator'
      aria-orientation='vertical'
      aria-label={ariaLabel}
    />
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const base = css`
    position: absolute;
    top: 0;
    width: 4px;
    height: 100%;
    cursor: col-resize;
    background: transparent;
    transition: background 100ms ease;

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 2px;
      height: 24px;
      transform: translate(-50%, -50%);
      background: ${theme.colors.border.medium};
      border-radius: 1px;
      transition: opacity 100ms ease;
    }

    &:hover,
    &:active {
      background: ${theme.colors.border.medium};
    }

    &:hover::before,
    &:active::before {
      opacity: 0;
    }
  `;
  return {
    handleRight: css`
      ${base};
      right: 0;
    `,
    handleLeft: css`
      ${base};
      left: 0;
    `,
  };
};
