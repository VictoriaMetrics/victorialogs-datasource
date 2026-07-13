import { useCallback, useEffect, useRef, useState } from 'react';

/** Reports whether the element has entered the viewport at least once */
export function useInView(): [React.RefCallback<HTMLElement>, boolean] {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | undefined>(undefined);

  const ref = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    if (!node) {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      // environments without IntersectionObserver load eagerly
      setInView(true);
      return;
    }
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setInView(true);
        observerRef.current?.disconnect();
      }
    });
    observerRef.current.observe(node);
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return [ref, inView];
}
