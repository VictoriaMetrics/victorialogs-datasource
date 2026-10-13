import { LogsHandOff, LogsOutcome } from './logsHandOff';

describe('LogsHandOff', () => {
  it('reports whether a volume was waiting when the logs settle', () => {
    const waiting = new LogsHandOff();
    waiting.outcome$.subscribe();
    expect(waiting.settle('fast')).toBe(true);

    expect(new LogsHandOff().settle('fast')).toBe(false);
  });

  it('keeps the first outcome and replays it to a late volume', () => {
    const handOff = new LogsHandOff();
    handOff.settle('slow');
    expect(handOff.settle('failed')).toBe(false);
    const seen: LogsOutcome[] = [];
    handOff.outcome$.subscribe((o) => seen.push(o));
    expect(seen).toEqual(['slow']);
  });

  it('replays the finished volume to logs that start waiting later', () => {
    const handOff = new LogsHandOff();
    handOff.finishVolume();
    let done = false;
    handOff.volumeDone$.subscribe(() => (done = true));
    expect(done).toBe(true);
  });
});
