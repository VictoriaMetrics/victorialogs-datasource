import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import store from '../store/store';

import { QuerySettings } from './QuerySettings';

jest.mock('../store/store', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

const mockedStore = store as jest.Mocked<typeof store>;

describe('QuerySettings — Maximum lines protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStore.get.mockReturnValue(null);
  });

  it('stores a safe typed value on change without opening the modal', () => {
    const onMaxLinedChange = jest.fn();

    render(<QuerySettings maxLines='' onMaxLinedChange={onMaxLinedChange} />);

    fireEvent.change(screen.getByPlaceholderText('1000'), { target: { value: '500' } });

    expect(onMaxLinedChange).toHaveBeenCalledWith('500');
    expect(screen.queryByText('Large line limit')).not.toBeInTheDocument();
  });

  it('does not open the modal on blur when the stored value is within the safe range', () => {
    render(<QuerySettings maxLines='500' onMaxLinedChange={jest.fn()} />);

    fireEvent.blur(screen.getByPlaceholderText('1000'));

    expect(screen.queryByText('Large line limit')).not.toBeInTheDocument();
  });

  it('opens the modal on blur when the stored value exceeds the warning threshold', async () => {
    const onMaxLinedChange = jest.fn();

    render(<QuerySettings maxLines='5000' onMaxLinedChange={onMaxLinedChange} />);

    fireEvent.blur(screen.getByPlaceholderText('1000'));

    const modal = screen.getByText('Large line limit').closest('[role="dialog"]') as HTMLElement;
    expect(modal).toBeInTheDocument();

    fireEvent.click(within(modal).getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(onMaxLinedChange).toHaveBeenCalledWith('5000');
    });
  });

  it('clamps to the hard cap on change when the typed value exceeds it', () => {
    const onMaxLinedChange = jest.fn();

    render(<QuerySettings maxLines='' onMaxLinedChange={onMaxLinedChange} />);

    fireEvent.change(screen.getByPlaceholderText('1000'), { target: { value: '50000' } });

    expect(onMaxLinedChange).toHaveBeenCalledWith('10000');
  });

  it('renders invalid state when the stored value still exceeds the hard cap', () => {
    render(<QuerySettings maxLines='50000' onMaxLinedChange={jest.fn()} />);

    expect(screen.getByText('Maximum value is 10000.')).toBeInTheDocument();
  });

  it('passes raw value through on empty input', () => {
    const onMaxLinedChange = jest.fn();

    render(<QuerySettings maxLines='500' onMaxLinedChange={onMaxLinedChange} />);

    fireEvent.change(screen.getByPlaceholderText('1000'), { target: { value: '' } });
    expect(onMaxLinedChange).toHaveBeenCalledWith('');
  });
});
