import { render, screen } from '@testing-library/react';
import React from 'react';

import { NoDataPlaceholder } from './NoDataPlaceholder';

describe('NoDataPlaceholder', () => {
  it('renders "No data" at the given fixed height', () => {
    render(<NoDataPlaceholder height={140} />);
    const text = screen.getByText('No data');
    expect(text).toBeInTheDocument();
    expect(text.parentElement).toHaveStyle({ height: '140px' });
  });
});
