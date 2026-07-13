import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Measures how much vertical viewport space remains below the referenced element,
 * so a panel can stretch to the bottom of the drawer instead of a fixed height.
 * Re-measures on window resize; never returns less than `minHeight`
 */
export function useRemainingHeight(minHeight = 300, bottomOffset = 24): [React.RefCallback<HTMLElement>, number] {
  const [height, setHeight] = useState(minHeight);
  const nodeRef = useRef<HTMLElement | null>(null);

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
      if (node) {
        measure();
      }
    },
    [measure]
  );

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return [ref, height];
}
