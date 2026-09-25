import { renderHook } from '@testing-library/react';
import { act } from 'react';

import { useRemainingHeight } from './useRemainingHeight';

/** A node whose top edge sits at the returned setter's value */
const makeNode = () => {
  const parent = document.createElement('div');
  const node = document.createElement('div');
  parent.appendChild(node);
  let top = 100;
  node.getBoundingClientRect = () => ({ top }) as DOMRect;
  return { node, parent, setTop: (value: number) => (top = value) };
};

describe('useRemainingHeight', () => {
  const originalResizeObserver = global.ResizeObserver;
  let resizeCallback: () => void;
  const observe = jest.fn();
  const disconnect = jest.fn();

  beforeAll(() => {
    global.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) {
        resizeCallback = cb as unknown as () => void;
      }
      observe = observe;
      unobserve = jest.fn();
      disconnect = disconnect;
    } as unknown as typeof ResizeObserver;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
  });

  afterAll(() => {
    global.ResizeObserver = originalResizeObserver;
  });

  beforeEach(() => {
    observe.mockClear();
    disconnect.mockClear();
  });

  it('measures the space below the node when the ref attaches', () => {
    const { result } = renderHook(() => useRemainingHeight(300, 24));
    const { node } = makeNode();

    act(() => result.current[0](node));

    expect(result.current[1]).toBe(1000 - 100 - 24);
  });

  it('never goes below the minimum height', () => {
    const { result } = renderHook(() => useRemainingHeight(300, 24));
    const { node, setTop } = makeNode();
    setTop(900);

    act(() => result.current[0](node));

    expect(result.current[1]).toBe(300);
  });

  it('observes only the parent, and re-measures when the layout resizes', () => {
    const { result } = renderHook(() => useRemainingHeight(300, 24));
    const { node, parent, setTop } = makeNode();

    act(() => result.current[0](node));
    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(parent);

    // content above the node grew, pushing it down without any window resize
    setTop(200);
    act(() => resizeCallback());

    expect(result.current[1]).toBe(1000 - 200 - 24);
  });

  it('re-measures on window resize', () => {
    const { result } = renderHook(() => useRemainingHeight(300, 24));
    const { node, setTop } = makeNode();
    act(() => result.current[0](node));

    setTop(150);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current[1]).toBe(1000 - 150 - 24);
  });

  it('disconnects the observer when the ref detaches and on unmount', () => {
    const { result, unmount } = renderHook(() => useRemainingHeight());
    const { node } = makeNode();

    act(() => result.current[0](node));
    act(() => result.current[0](null));
    expect(disconnect).toHaveBeenCalledTimes(1);

    act(() => result.current[0](node));
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });
});
