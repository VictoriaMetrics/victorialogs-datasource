import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { IncrementalHitsLoadingController } from '../../logsVolume/IncrementalHitsLoadingController';
import { getIncrementalHitsLoadingRuns } from '../../logsVolume/incrementalHitsLoadingRuns';

import { IncrementalHitsLoadingStatus } from './IncrementalHitsLoadingStatus';

describe('IncrementalHitsLoadingStatus', () => {
  // a registry of its own per test: the registries are kept per datasource uid for the page lifetime
  let uid: string;
  beforeEach(() => {
    uid = `ds-${expect.getState().currentTestName}`;
  });

  /** A job of the pane: registered while it runs */
  const startJob = (requestId: string, totalBars: number, step = '1h') => {
    const controller = new IncrementalHitsLoadingController({ totalBars, step });
    let release!: () => void;
    act(() => {
      release = getIncrementalHitsLoadingRuns(uid).register(requestId, controller);
    });
    return { controller, finish: () => act(release) };
  };

  it('renders nothing while the pane has no bar-by-bar job', () => {
    const { container } = render(<IncrementalHitsLoadingStatus datasourceUid={uid} requestId='explore_a' />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the progress of the job of the pane and hides again when it is over', () => {
    render(<IncrementalHitsLoadingStatus datasourceUid={uid} requestId='explore_a' />);
    const job = startJob('explore_a', 12);
    act(() => {
      job.controller.barLoaded();
      job.controller.barLoaded();
    });
    expect(screen.getByText('Logs volume is loading incrementally: 2 / 12 bars')).toBeInTheDocument();
    job.finish();
    expect(screen.queryByText(/Logs volume/)).not.toBeInTheDocument();
  });

  it('shows the job of its own pane, not the one of another pane', () => {
    render(<IncrementalHitsLoadingStatus datasourceUid={uid} requestId='explore_a' />);
    startJob('explore_b', 5);
    expect(screen.queryByText(/Logs volume/)).not.toBeInTheDocument();
    startJob('explore_a', 3);
    expect(screen.getByText('Logs volume is loading incrementally: 0 / 3 bars')).toBeInTheDocument();
  });

  it('renders nothing before the pane has run a request', () => {
    render(<IncrementalHitsLoadingStatus datasourceUid={uid} requestId={undefined} />);
    startJob('explore_b', 5);
    expect(screen.queryByText(/Logs volume/)).not.toBeInTheDocument();
  });

  it('pauses and resumes the job', () => {
    render(<IncrementalHitsLoadingStatus datasourceUid={uid} requestId='explore_a' />);
    const { controller } = startJob('explore_a', 3);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(controller.state.status).toBe('paused');
    expect(screen.getByText(/paused/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(controller.state.status).toBe('running');
  });

  it('stops the job and hides once the job is over', () => {
    render(<IncrementalHitsLoadingStatus datasourceUid={uid} requestId='explore_a' />);
    const job = startJob('explore_a', 3);
    // the job: over as soon as it is stopped
    job.controller.stopped$.subscribe(() => job.finish());
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.queryByText(/Logs volume/)).not.toBeInTheDocument();
  });
});
