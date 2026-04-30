import { act, renderHook } from '@testing-library/react';

import {
  STREAM_FILTERS_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY,
  STREAM_FILTERS_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY,
} from '../../../constants';
import store from '../../../store/store';

import { useStreamSidebarLayout } from './useStreamSidebarLayout';

jest.mock('../../../store/store', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

const mockedStore = store as jest.Mocked<typeof store>;

describe('useStreamSidebarLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStore.get.mockReturnValue(null);
  });

  it('returns defaults when store is empty', () => {
    const { result } = renderHook(() => useStreamSidebarLayout());

    expect(result.current.width).toBe(280);
    expect(result.current.isCollapsed).toBe(false);
  });

  it('reads persisted width from store', () => {
    mockedStore.get.mockImplementation((key) =>
      key === STREAM_FILTERS_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY ? '320' : null
    );
    const { result } = renderHook(() => useStreamSidebarLayout());

    expect(result.current.width).toBe(320);
  });

  it('falls back to default width when stored value is not a number', () => {
    mockedStore.get.mockImplementation((key) =>
      key === STREAM_FILTERS_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY ? 'abc' : null
    );
    const { result } = renderHook(() => useStreamSidebarLayout());

    expect(result.current.width).toBe(280);
  });

  it('falls back to default width when stored value is below the minimum', () => {
    mockedStore.get.mockImplementation((key) =>
      key === STREAM_FILTERS_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY ? '50' : null
    );
    const { result } = renderHook(() => useStreamSidebarLayout());

    expect(result.current.width).toBe(280);
  });

  it('falls back to default width when stored value is above the maximum', () => {
    mockedStore.get.mockImplementation((key) =>
      key === STREAM_FILTERS_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY ? '10000' : null
    );
    const { result } = renderHook(() => useStreamSidebarLayout());

    expect(result.current.width).toBe(280);
  });

  it('reads persisted collapsed flag from store', () => {
    mockedStore.get.mockImplementation((key) =>
      key === STREAM_FILTERS_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY ? 'true' : null
    );
    const { result } = renderHook(() => useStreamSidebarLayout());

    expect(result.current.isCollapsed).toBe(true);
  });

  it('clamps setWidth to the minimum and persists', () => {
    const { result } = renderHook(() => useStreamSidebarLayout());

    act(() => result.current.setWidth(50));

    expect(result.current.width).toBe(200);
    expect(mockedStore.set).toHaveBeenCalledWith(
      STREAM_FILTERS_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY,
      '200'
    );
  });

  it('clamps setWidth to the maximum and persists', () => {
    const { result } = renderHook(() => useStreamSidebarLayout());

    act(() => result.current.setWidth(9999));

    expect(result.current.width).toBe(480);
    expect(mockedStore.set).toHaveBeenCalledWith(
      STREAM_FILTERS_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY,
      '480'
    );
  });

  it('persists in-range setWidth as is', () => {
    const { result } = renderHook(() => useStreamSidebarLayout());

    act(() => result.current.setWidth(350));

    expect(result.current.width).toBe(350);
    expect(mockedStore.set).toHaveBeenCalledWith(
      STREAM_FILTERS_SIDEBAR_WIDTH_LOCAL_STORAGE_KEY,
      '350'
    );
  });

  it('toggleCollapsed flips the flag and persists', () => {
    const { result } = renderHook(() => useStreamSidebarLayout());

    act(() => result.current.toggleCollapsed());

    expect(result.current.isCollapsed).toBe(true);
    expect(mockedStore.set).toHaveBeenCalledWith(
      STREAM_FILTERS_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY,
      'true'
    );

    act(() => result.current.toggleCollapsed());

    expect(result.current.isCollapsed).toBe(false);
    expect(mockedStore.set).toHaveBeenCalledWith(
      STREAM_FILTERS_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY,
      'false'
    );
  });
});
