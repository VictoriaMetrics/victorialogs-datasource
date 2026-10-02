import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { IncrementalHitsLoadingController } from '../../logsVolume/IncrementalHitsLoadingController';

import { IncrementalHitsLoadingStatus } from './IncrementalHitsLoadingStatus';

describe('IncrementalHitsLoadingStatus', () => {
  it('renders nothing while no bar-by-bar job runs', () => {
    const { container } = render(<IncrementalHitsLoadingStatus controller={new IncrementalHitsLoadingController()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the progress of a running job and hides again when it finishes', () => {
    const controller = new IncrementalHitsLoadingController();
    render(<IncrementalHitsLoadingStatus controller={controller} />);
    act(() => {
      controller.start(12);
      controller.barLoaded();
      controller.barLoaded();
    });
    expect(screen.getByText('Logs volume: 2 / 12 bars')).toBeInTheDocument();
    act(() => controller.finish());
    expect(screen.queryByText(/Logs volume/)).not.toBeInTheDocument();
  });

  it('pauses and resumes the job', () => {
    const controller = new IncrementalHitsLoadingController();
    render(<IncrementalHitsLoadingStatus controller={controller} />);
    act(() => controller.start(3));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(controller.state.status).toBe('paused');
    expect(screen.getByText(/paused/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(controller.state.status).toBe('running');
  });

  it('stops the job and hides once the job has finished', () => {
    const controller = new IncrementalHitsLoadingController();
    // the job: finishes as soon as it is stopped
    controller.stopped$.subscribe(() => controller.finish());
    render(<IncrementalHitsLoadingStatus controller={controller} />);
    act(() => controller.start(3));
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.queryByText(/Logs volume/)).not.toBeInTheDocument();
  });
});
