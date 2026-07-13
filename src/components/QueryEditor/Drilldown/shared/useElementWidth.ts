import { useCallback, useEffect, useRef, useState } from 'react';

/** Tracks the rendered width of an element via ResizeObserver */
export function useElementWidth(): [React.RefCallback<HTMLDivElement>, number] {
  const [width, setWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | undefined>(undefined);

  const ref = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!node) {
      return;
    }
    setWidth(node.getBoundingClientRect().width);
    observerRef.current = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observerRef.current.observe(node);
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return [ref, width];
}
