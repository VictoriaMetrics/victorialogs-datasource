import { render, screen } from '@testing-library/react';
import React from 'react';

import { AdHocFilter } from '../../../../types';

import { FilterChip } from './FilterChip';

describe('FilterChip', () => {
  it('shows an empty single value as ""', () => {
    render(<FilterChip filter={{ key: 'app', operator: '=', value: '' }} onRemove={jest.fn()} />);

    expect(screen.getByText('""')).toBeInTheDocument();
  });

  it('shows every value of a multi-value filter, with an empty one as ""', () => {
    const filter: AdHocFilter = { key: 'app', operator: '=|', value: '', values: ['web', '', 'api'] };
    render(<FilterChip filter={filter} onRemove={jest.fn()} />);

    expect(screen.getByText('web, "", api')).toBeInTheDocument();
  });
});
