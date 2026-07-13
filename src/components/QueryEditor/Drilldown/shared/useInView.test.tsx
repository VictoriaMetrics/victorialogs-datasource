import { renderHook } from '@testing-library/react';
import { act } from 'react';

import { useInView } from './useInView';

describe('useInView', () => {
  let intersectionCallback: (entries: Array<{ isIntersecting: boolean }>) => void;
  const observe = jest.fn();
  const disconnect = jest.fn();

  beforeAll(() => {
    global.IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) {
        intersectionCallback = cb as unknown as typeof intersectionCallback;
      }
      observe = observe;
      unobserve = jest.fn();
      disconnect = disconnect;
    } as unknown as typeof IntersectionObserver;
  });

  it('reports false until the element intersects, then true', () => {
    const { result } = renderHook(() => useInView());
    const [ref] = result.current;
    act(() => ref(document.createElement('div')));
    expect(result.current[1]).toBe(false);
    act(() => intersectionCallback([{ isIntersecting: true }]));
    expect(result.current[1]).toBe(true);
    // once visible the observer is released — the flag never flips back
    expect(disconnect).toHaveBeenCalled();
  });
});
