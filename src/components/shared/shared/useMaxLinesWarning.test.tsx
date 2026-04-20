import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { NOT_SHOW_AGAIN_LOGS_LIMIT_WARNING_LOCAL_STORAGE_KEY } from '../../../constants';
import store from '../../../store/store';

import { useMaxLinesWarning } from './useMaxLinesWarning';

jest.mock('../../../store/store', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

const mockedStore = store as jest.Mocked<typeof store>;

const TestHost: React.FC<{ value: number; onAccept: (value: number) => void }> = ({ value, onAccept }) => {
  const { modal, requestConfirmation } = useMaxLinesWarning(onAccept);
  return (
    <>
      <button onClick={() => requestConfirmation(value)}>trigger</button>
      {modal}
    </>
  );
};

const getModal = () => screen.getByText('Large line limit').closest('[role="dialog"]') as HTMLElement;

describe('useMaxLinesWarning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStore.get.mockReturnValue(null);
  });

  it('calls onAccept immediately when value is at or below the warning threshold', () => {
    const onAccept = jest.fn();
    render(<TestHost value={500} onAccept={onAccept} />);

    fireEvent.click(screen.getByText('trigger'));

    expect(onAccept).toHaveBeenCalledWith(500);
    expect(screen.queryByText('Large line limit')).not.toBeInTheDocument();
  });

  it('opens the modal when value exceeds the warning threshold and flag is not set', () => {
    const onAccept = jest.fn();
    render(<TestHost value={5000} onAccept={onAccept} />);

    fireEvent.click(screen.getByText('trigger'));

    expect(onAccept).not.toHaveBeenCalled();
    expect(screen.getByText('Large line limit')).toBeInTheDocument();
  });

  it('calls onAccept immediately when the suppression flag is set', () => {
    mockedStore.get.mockReturnValue('true');
    const onAccept = jest.fn();
    render(<TestHost value={5000} onAccept={onAccept} />);

    fireEvent.click(screen.getByText('trigger'));

    expect(onAccept).toHaveBeenCalledWith(5000);
    expect(screen.queryByText('Large line limit')).not.toBeInTheDocument();
  });

  it('Confirm triggers onAccept with the pending value', async () => {
    const onAccept = jest.fn();
    render(<TestHost value={5000} onAccept={onAccept} />);

    fireEvent.click(screen.getByText('trigger'));
    fireEvent.click(within(getModal()).getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledWith(5000);
    });
  });

  it('Confirm persists the suppression flag only when dontShowAgain is checked', async () => {
    const onAccept = jest.fn();
    render(<TestHost value={5000} onAccept={onAccept} />);

    fireEvent.click(screen.getByText('trigger'));
    const modal = getModal();
    fireEvent.click(within(modal).getByLabelText("Don't show this warning again"));
    fireEvent.click(within(modal).getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(mockedStore.set).toHaveBeenCalledWith(NOT_SHOW_AGAIN_LOGS_LIMIT_WARNING_LOCAL_STORAGE_KEY, 'true');
    });
  });

  it('Confirm does not persist the flag when dontShowAgain is not checked', async () => {
    const onAccept = jest.fn();
    render(<TestHost value={5000} onAccept={onAccept} />);

    fireEvent.click(screen.getByText('trigger'));
    fireEvent.click(within(getModal()).getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledWith(5000);
    });
    expect(mockedStore.set).not.toHaveBeenCalled();
  });

  it('Dismiss clears state and never persists the flag even if dontShowAgain is checked', () => {
    const onAccept = jest.fn();
    render(<TestHost value={5000} onAccept={onAccept} />);

    fireEvent.click(screen.getByText('trigger'));
    const modal = getModal();
    fireEvent.click(within(modal).getByLabelText("Don't show this warning again"));
    fireEvent.click(within(modal).getByRole('button', { name: /Cancel/i }));

    expect(onAccept).not.toHaveBeenCalled();
    expect(mockedStore.set).not.toHaveBeenCalled();
    expect(screen.queryByText('Large line limit')).not.toBeInTheDocument();
  });
});
