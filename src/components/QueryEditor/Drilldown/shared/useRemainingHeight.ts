import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Calls `onChange` whenever the layout around `node` resizes: the document itself, or the
 * node's parent, which grows or shrinks with the content above the node and so moves its top.
 * Returns undefined where ResizeObserver is unavailable, such as in jsdom
 */
function observeLayout(node: HTMLElement, onChange: () => void): ResizeObserver | undefined {
  if (typeof ResizeObserver === 'undefined') {
    return undefined;
  }
  const observer = new ResizeObserver(() => onChange());
  observer.observe(document.documentElement);
  if (node.parentElement) {
    observer.observe(node.parentElement);
  }
  return observer;
}

/**
 * Measures the viewport space left below the referenced element, so a panel can stretch to
 * the bottom of the drawer instead of taking a fixed height. It re-measures on window resize
 * and whenever the surrounding layout resizes
 */
export function useRemainingHeight(minHeight = 300, bottomOffset = 24): [React.RefCallback<HTMLElement>, number] {
  const [height, setHeight] = useState(minHeight);
  const nodeRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<ResizeObserver | undefined>(undefined);

  const measure = useCallback(() => {
    if (!nodeRef.current) {
      return;
    }
    const { top } = nodeRef.current.getBoundingClientRect();
    setHeight(Math.max(minHeight, window.innerHeight - top - bottomOffset));
  }, [minHeight, bottomOffset]);

  const ref = useCallback<React.RefCallback<HTMLElement>>(
    (node) => {
      nodeRef.current = node;
      observerRef.current?.disconnect();
      observerRef.current = undefined;
      if (node) {
        measure();
        observerRef.current = observeLayout(node, measure);
      }
    },
    [measure]
  );

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return [ref, height];
}
