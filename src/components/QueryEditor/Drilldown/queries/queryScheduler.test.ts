import { Observable, of, Subject, throwError } from 'rxjs';

import { QueryScheduler } from './queryScheduler';

/** Factory whose start is observable: `started` counts subscriptions, `subject` drives completion */
const makeTask = () => {
  const subject = new Subject<number>();
  const started = jest.fn();
  const factory = () =>
    new Observable<number>((subscriber) => {
      started();
      const sub = subject.subscribe(subscriber);
      return () => sub.unsubscribe();
    });
  return { subject, started, factory };
};

describe('QueryScheduler', () => {
  it('runs tasks immediately while slots are free', () => {
    const scheduler = new QueryScheduler(2);
    const a = makeTask();
    const b = makeTask();

    scheduler.schedule(a.factory).subscribe();
    scheduler.schedule(b.factory).subscribe();

    expect(a.started).toHaveBeenCalledTimes(1);
    expect(b.started).toHaveBeenCalledTimes(1);
  });

  it('queues tasks beyond the cap and starts them as slots free up', () => {
    const scheduler = new QueryScheduler(1);
    const a = makeTask();
    const b = makeTask();

    scheduler.schedule(a.factory).subscribe();
    scheduler.schedule(b.factory).subscribe();

    expect(b.started).not.toHaveBeenCalled();

    a.subject.complete();

    expect(b.started).toHaveBeenCalledTimes(1);
  });

  it('frees the slot when a running task errors', () => {
    const scheduler = new QueryScheduler(1);
    const b = makeTask();

    scheduler.schedule(() => throwError(() => new Error('boom'))).subscribe({ error: () => {} });
    scheduler.schedule(b.factory).subscribe();

    expect(b.started).toHaveBeenCalledTimes(1);
  });

  it('frees the slot when the factory itself throws', () => {
    const scheduler = new QueryScheduler(1);
    const b = makeTask();

    scheduler
      .schedule(() => {
        throw new Error('sync boom');
      })
      .subscribe({ error: () => {} });
    scheduler.schedule(b.factory).subscribe();

    expect(b.started).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing a queued task removes it without starting it', () => {
    const scheduler = new QueryScheduler(1);
    const a = makeTask();
    const b = makeTask();
    const c = makeTask();

    scheduler.schedule(a.factory).subscribe();
    const queuedB = scheduler.schedule(b.factory).subscribe();
    scheduler.schedule(c.factory).subscribe();

    queuedB.unsubscribe();
    a.subject.complete();

    expect(b.started).not.toHaveBeenCalled();
    // the slot skipped the dequeued task and went to the next one
    expect(c.started).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing a running task cancels it and starts the next queued one', () => {
    const scheduler = new QueryScheduler(1);
    const a = makeTask();
    const b = makeTask();

    const runningA = scheduler.schedule(a.factory).subscribe();
    scheduler.schedule(b.factory).subscribe();

    runningA.unsubscribe();

    expect(a.subject.observed).toBe(false);
    expect(b.started).toHaveBeenCalledTimes(1);
  });

  it('does not release the slot twice when unsubscribed after completion', () => {
    const scheduler = new QueryScheduler(1);
    const a = makeTask();
    const b = makeTask();
    const c = makeTask();

    const subA = scheduler.schedule(a.factory).subscribe();
    scheduler.schedule(b.factory).subscribe();
    scheduler.schedule(c.factory).subscribe();

    a.subject.complete();
    // a's slot already moved to b; this must not free a second slot for c
    subA.unsubscribe();

    expect(b.started).toHaveBeenCalledTimes(1);
    expect(c.started).not.toHaveBeenCalled();
  });

  it('passes emissions and completion through', () => {
    const scheduler = new QueryScheduler(1);
    const values: number[] = [];
    let completed = false;

    scheduler.schedule(() => of(1, 2, 3)).subscribe({
      next: (v) => values.push(v),
      complete: () => {
        completed = true;
      },
    });

    expect(values).toEqual([1, 2, 3]);
    expect(completed).toBe(true);
  });
});
