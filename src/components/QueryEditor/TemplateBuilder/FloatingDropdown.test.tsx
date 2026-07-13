import { render, screen } from '@testing-library/react';
import React from 'react';

import { FloatingDropdown } from './FloatingDropdown';

describe('FloatingDropdown', () => {
  it('portals above the Grafana Drawer modal layer (zIndex.modal = 1060)', () => {
    render(
      <FloatingDropdown floatingRef={() => {}} floatingStyles={{}}>
        <span>option</span>
      </FloatingDropdown>
    );

    const portalEl = screen.getByText('option').closest('[data-floating-portal]');
    expect(portalEl).toBeInTheDocument();
    // rendered directly under document.body, not under the test's own render container
    expect(portalEl?.parentElement).toBe(document.body);
    const zIndex = Number((portalEl as HTMLElement).style.zIndex);
    expect(zIndex).toBeGreaterThanOrEqual(1061);
  });
});
