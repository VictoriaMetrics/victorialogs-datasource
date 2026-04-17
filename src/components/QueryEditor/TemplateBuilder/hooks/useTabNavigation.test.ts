import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';

import { placeholder, text } from '../segmentHelpers';
import { Pipe } from '../types';

import { useTabNavigation } from './useTabNavigation';

const makePipes = (): Pipe[] => [
  {
    id: 'p1',
    templateType: 'phrase',
    segments: [
      placeholder('a', { role: 'fieldName', displayHint: '', optionSource: 'fieldNames' }),
      text(':'),
      placeholder('b', { role: 'fieldValue', displayHint: '', optionSource: 'fieldValues' }),
    ],
    tabOrder: ['a', 'b'],
  },
  {
    id: 'p2',
    templateType: 'delete',
    segments: [
      text('delete '),
      placeholder('c', { role: 'fieldName', displayHint: '', optionSource: 'fieldNames' }),
    ],
    tabOrder: ['c'],
  },
];

// Wrapper that provides external activeId state to useTabNavigation
function useTestNav(pipes: Pipe[]) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const nav = useTabNavigation(pipes, activeId, setActiveId);
  return { activeId, setActiveId, ...nav };
}

describe('useTabNavigation', () => {
  it('starts with no active segment', () => {
    const { result } = renderHook(() => useTestNav(makePipes()));
    expect(result.current.activeId).toBeNull();
  });

  it('setActiveId sets activeId', () => {
    const { result } = renderHook(() => useTestNav(makePipes()));
    act(() => result.current.setActiveId('b'));
    expect(result.current.activeId).toBe('b');
  });

  it('activateNext moves to next placeholder', () => {
    const { result } = renderHook(() => useTestNav(makePipes()));
    act(() => result.current.setActiveId('a'));
    act(() => result.current.activateNext());
    expect(result.current.activeId).toBe('b');
  });

  it('activateNext crosses pipe boundary', () => {
    const { result } = renderHook(() => useTestNav(makePipes()));
    act(() => result.current.setActiveId('b'));
    act(() => result.current.activateNext());
    expect(result.current.activeId).toBe('c');
  });

  it('activateNext from last deactivates and returns false', () => {
    const { result } = renderHook(() => useTestNav(makePipes()));
    act(() => result.current.setActiveId('c'));
    let returned: boolean | undefined;
    act(() => { returned = result.current.activateNext(); });
    expect(result.current.activeId).toBeNull();
    expect(returned).toBe(false);
  });

  it('activateNext returns true when advanced', () => {
    const { result } = renderHook(() => useTestNav(makePipes()));
    act(() => result.current.setActiveId('a'));
    let returned: boolean | undefined;
    act(() => { returned = result.current.activateNext(); });
    expect(returned).toBe(true);
    expect(result.current.activeId).toBe('b');
  });

  it('activateLast activates last placeholder of given pipe', () => {
    const { result } = renderHook(() => useTestNav(makePipes()));
    act(() => result.current.activateLast('p1'));
    expect(result.current.activeId).toBe('b');
  });

  it('setActiveId(null) clears activeId', () => {
    const { result } = renderHook(() => useTestNav(makePipes()));
    act(() => result.current.setActiveId('a'));
    act(() => result.current.setActiveId(null));
    expect(result.current.activeId).toBeNull();
  });

  it('activateFirst activates first placeholder of given pipe', () => {
    const { result } = renderHook(() => useTestNav(makePipes()));
    act(() => result.current.activateFirst('p2'));
    expect(result.current.activeId).toBe('c');
  });
});
