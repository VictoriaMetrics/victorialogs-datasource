import { extractMsgSearchWords } from './extractMsgSearchWords';

describe('extractMsgSearchWords', () => {
  it('highlights a bare word as a literal _msg term', () => {
    expect(extractMsgSearchWords('error')).toEqual(['error']);
  });
  it('returns empty array for empty or match-all query', () => {
    expect(extractMsgSearchWords('')).toEqual([]);
    expect(extractMsgSearchWords('*')).toEqual([]);
  });
  it('strips trailing * from a prefix filter', () => {
    expect(extractMsgSearchWords('error*')).toEqual(['error']);
  });
  it('skips the {...} stream selector block', () => {
    expect(extractMsgSearchWords('error {app="x"}')).toEqual(['error']);
  });
  it('highlights a quoted phrase as a literal term', () => {
    expect(extractMsgSearchWords('"error message"')).toEqual(['error message']);
  });
  it('handles escaped quotes inside a phrase', () => {
    expect(extractMsgSearchWords('"he said \\"hi\\""')).toEqual(['he said "hi"']);
  });
  it('highlights the value of an explicit _msg filter', () => {
    expect(extractMsgSearchWords('_msg:error')).toEqual(['error']);
  });
  it('highlights a quoted _msg value', () => {
    expect(extractMsgSearchWords('_msg:"exact val"')).toEqual(['exact val']);
  });
  it('skips values of non-_msg fields', () => {
    expect(extractMsgSearchWords('level:error host:foo')).toEqual([]);
  });
  it('treats a _msg regexp filter as a raw regex term', () => {
    expect(extractMsgSearchWords('_msg:~"err.*"')).toEqual(['err.*']);
  });
  it('treats a bare regexp filter as a raw regex term', () => {
    expect(extractMsgSearchWords('~"err.*"')).toEqual(['err.*']);
  });
  it('treats a bare exact filter as a literal term', () => {
    expect(extractMsgSearchWords('="exact val"')).toEqual(['exact val']);
  });
  it('keeps terms joined by AND / OR', () => {
    expect(extractMsgSearchWords('error AND warn')).toEqual(['error', 'warn']);
    expect(extractMsgSearchWords('error OR warn')).toEqual(['error', 'warn']);
  });
  it('excludes a NOT-negated term', () => {
    expect(extractMsgSearchWords('error NOT debug')).toEqual(['error']);
  });
  it('excludes a dash-negated term', () => {
    expect(extractMsgSearchWords('-debug warn')).toEqual(['warn']);
  });
  it('excludes a bang-negated term', () => {
    expect(extractMsgSearchWords('!debug warn')).toEqual(['warn']);
  });
  it('skips a negated group', () => {
    expect(extractMsgSearchWords('warn NOT (debug OR trace)')).toEqual(['warn']);
  });
  it('escapes regex special characters in literal terms', () => {
    expect(extractMsgSearchWords('a.b+c')).toEqual(['a\\.b\\+c']);
  });
  it('excludes a negated _msg value', () => {
    expect(extractMsgSearchWords('_msg:-foo')).toEqual([]);
    expect(extractMsgSearchWords('_msg:!foo')).toEqual([]);
  });
  it('preserves backslash escapes in a regexp term', () => {
    expect(extractMsgSearchWords('_msg:~"\\d+"')).toEqual(['\\d+']);
    expect(extractMsgSearchWords('~"\\d+"')).toEqual(['\\d+']);
  });
  it('matches the _msg field exactly, not as a prefix or substring', () => {
    expect(extractMsgSearchWords('_msg2:foo')).toEqual([]);
    expect(extractMsgSearchWords('my_msg:foo')).toEqual([]);
  });
  it('still highlights a normal _msg regexp without escapes', () => {
    expect(extractMsgSearchWords('_msg:~"err.*"')).toEqual(['err.*']);
  });

  describe('function-style filters', () => {
    it('does not highlight the filter function name', () => {
      expect(extractMsgSearchWords('i(error)')).toEqual(['error']);
      expect(extractMsgSearchWords('exact(error)')).toEqual(['error']);
    });
    it('does not highlight the function name of an explicit _msg filter', () => {
      expect(extractMsgSearchWords('_msg:i(error)')).toEqual(['error']);
      expect(extractMsgSearchWords('_msg: i(error)')).toEqual(['error']);
      expect(extractMsgSearchWords('_msg:exact(error)')).toEqual(['error']);
    });
    it('skips a function-style filter on a non-_msg field', () => {
      expect(extractMsgSearchWords('app:i(error)')).toEqual([]);
    });
    it('skips a negated function-style filter entirely', () => {
      expect(extractMsgSearchWords('-i(debug) warn')).toEqual(['warn']);
      expect(extractMsgSearchWords('NOT exact(debug) warn')).toEqual(['warn']);
    });
    it('skips a negated _msg function-style filter without leaking inner terms', () => {
      expect(extractMsgSearchWords('-_msg:i(error)')).toEqual([]);
      expect(extractMsgSearchWords('!_msg:i(error)')).toEqual([]);
      expect(extractMsgSearchWords('NOT _msg:i(error)')).toEqual([]);
      expect(extractMsgSearchWords('NOT _msg:i(error) warn')).toEqual(['warn']);
    });
  });

  describe('grouped values after a field', () => {
    it('skips a grouped value of a non-_msg field', () => {
      expect(extractMsgSearchWords('app:(buggy_app OR foobar)')).toEqual([]);
      expect(extractMsgSearchWords('level:(error OR warn)')).toEqual([]);
    });
    it('still highlights a grouped value of the _msg field', () => {
      expect(extractMsgSearchWords('_msg:(a OR b)')).toEqual(['a', 'b']);
    });
    it('handles a space before the grouped value', () => {
      expect(extractMsgSearchWords('app: (buggy_app OR foobar)')).toEqual([]);
    });
    it('skips a negated grouped value of a non-_msg field', () => {
      expect(extractMsgSearchWords('-app:(buggy_app) warn')).toEqual(['warn']);
    });
    it('skips a negated _msg grouped value without leaking inner terms', () => {
      expect(extractMsgSearchWords('-_msg:(a OR b)')).toEqual([]);
      expect(extractMsgSearchWords('!_msg:(a OR b)')).toEqual([]);
      expect(extractMsgSearchWords('NOT _msg:(a OR b)')).toEqual([]);
      expect(extractMsgSearchWords('-_msg:(a OR b) warn')).toEqual(['warn']);
    });
  });

  describe('comments', () => {
    it('strips a trailing comment', () => {
      expect(extractMsgSearchWords('error # debug')).toEqual(['error']);
    });
    it('strips a comment but keeps the next line', () => {
      expect(extractMsgSearchWords('error # debug\nwarn')).toEqual(['error', 'warn']);
    });
    it('does not treat a # inside a quoted value as a comment', () => {
      expect(extractMsgSearchWords('_msg:"a#b"')).toEqual(['a#b']);
      expect(extractMsgSearchWords('"a # b"')).toEqual(['a # b']);
    });
  });

  describe('segments after the first pipe', () => {
    it('does not highlight bare words inside non-filter pipes', () => {
      expect(extractMsgSearchWords('* | stats count()')).toEqual([]);
      expect(extractMsgSearchWords('error | fields foo')).toEqual(['error']);
      expect(extractMsgSearchWords('* | sort by (_time) | fields foo')).toEqual([]);
    });
    it('highlights a bare word value of a filter pipe', () => {
      expect(extractMsgSearchWords('* | filter warn')).toEqual(['warn']);
    });
    it('highlights a quoted value of a filter pipe', () => {
      expect(extractMsgSearchWords('* | filter "io timeout"')).toEqual(['io timeout']);
    });
    it('applies the full filter logic inside a filter pipe', () => {
      expect(extractMsgSearchWords('* | filter error AND warn NOT debug')).toEqual(['error', 'warn']);
      expect(extractMsgSearchWords('* | filter _msg:~"err.*"')).toEqual(['err.*']);
      expect(extractMsgSearchWords('* | filter level:error')).toEqual([]);
    });
    it('matches the filter keyword only as a whole word', () => {
      expect(extractMsgSearchWords('* | filterX foo')).toEqual([]);
    });
    it('treats a segment starting with a quoted phrase as a filter', () => {
      expect(extractMsgSearchWords('* | "value1" value2')).toEqual(['value1', 'value2']);
    });
    it('treats a segment starting with an explicit _msg filter as a filter', () => {
      expect(extractMsgSearchWords('* | _msg:error value2')).toEqual(['error', 'value2']);
      expect(extractMsgSearchWords('* | _msg:"exact"')).toEqual(['exact']);
    });
    it('does not highlight quoted patterns of non-filter pipes', () => {
      expect(extractMsgSearchWords('* | extract "ip=<ip>"')).toEqual([]);
      expect(extractMsgSearchWords('* | format "<a> <b>"')).toEqual([]);
    });
    it('collects terms across the first segment and later filter pipes', () => {
      expect(extractMsgSearchWords('error | stats count() | filter warn')).toEqual(['error', 'warn']);
    });
    it('treats a segment starting with any field filter as a filter', () => {
      expect(extractMsgSearchWords('* | otherField: value _msg: value2')).toEqual(['value2']);
      expect(extractMsgSearchWords('* | otherField:value _msg:value2')).toEqual(['value2']);
    });
  });

  describe('spaces after a field colon bind the value to its field', () => {
    it('does not highlight a non-_msg field value written with a space', () => {
      expect(extractMsgSearchWords('level: error')).toEqual([]);
    });
    it('highlights an _msg value written with a space', () => {
      expect(extractMsgSearchWords('_msg: error')).toEqual(['error']);
      expect(extractMsgSearchWords('_msg: "exact val"')).toEqual(['exact val']);
    });
  });

  describe('newlines are treated as whitespace', () => {
    it('handles a newline between the filter keyword and its value', () => {
      expect(extractMsgSearchWords('* | filter\nvalue')).toEqual(['value']);
      expect(extractMsgSearchWords('* | filter\n"io timeout"')).toEqual(['io timeout']);
    });
    it('handles a newline before a top-level pipe', () => {
      expect(extractMsgSearchWords('error\n| filter warn')).toEqual(['error', 'warn']);
    });
    it('treats a newline as a term separator', () => {
      expect(extractMsgSearchWords('error\nwarn')).toEqual(['error', 'warn']);
    });
    it('handles a newline after a field colon', () => {
      expect(extractMsgSearchWords('_msg:\nvalue')).toEqual(['value']);
    });
  });
});
