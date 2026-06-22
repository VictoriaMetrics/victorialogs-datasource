import { stripComments } from './stripComments';

describe('stripComments', () => {
  it('returns empty string unchanged', () => {
    expect(stripComments('')).toBe('');
  });

  it('returns text without comments unchanged', () => {
    expect(stripComments('_msg:error')).toBe('_msg:error');
  });

  it('drops a trailing line comment', () => {
    expect(stripComments('_msg:error # this is a comment')).toBe('_msg:error ');
  });

  it('drops a comment that spans to the end of input without a newline', () => {
    expect(stripComments('foo # bar')).toBe('foo ');
  });

  it('drops a comment occupying the whole line', () => {
    expect(stripComments('# just a comment')).toBe('');
  });

  it('keeps the newline that terminates a comment', () => {
    expect(stripComments('foo # comment\nbar')).toBe('foo \nbar');
  });

  it('strips comments on multiple lines independently', () => {
    expect(stripComments('foo # c1\nbar # c2\nbaz')).toBe('foo \nbar \nbaz');
  });

  describe('inside quoted spans', () => {
    it('keeps # inside double quotes', () => {
      expect(stripComments('_msg:"a # b"')).toBe('_msg:"a # b"');
    });

    it('keeps # inside single quotes', () => {
      expect(stripComments("_msg:'a # b'")).toBe("_msg:'a # b'");
    });

    it('keeps # inside backticks', () => {
      expect(stripComments('_msg:`a # b`')).toBe('_msg:`a # b`');
    });

    it('strips a comment that follows a closed quoted span', () => {
      expect(stripComments('"a # b" # real comment')).toBe('"a # b" ');
    });

    it('does not treat a # inside one quote type as ending another', () => {
      expect(stripComments('"a # b" \'c # d\'')).toBe('"a # b" \'c # d\'');
    });
  });

  describe('escaping', () => {
    it('does not close a double-quoted span on an escaped quote', () => {
      expect(stripComments('"a\\"# still in" # comment')).toBe('"a\\"# still in" ');
    });

    it('preserves the backslash-escaped pair verbatim', () => {
      expect(stripComments('"a\\nb"')).toBe('"a\\nb"');
    });

    it('treats backslash literally inside backticks (raw string)', () => {
      // The backtick closes at the first backtick; the backslash is not an escape
      expect(stripComments('`a\\` # comment')).toBe('`a\\` ');
    });
  });

  describe('edge cases', () => {
    it('copies an unterminated quoted span to the end', () => {
      expect(stripComments('"abc')).toBe('"abc');
    });

    it('handles a trailing backslash at end of input', () => {
      expect(stripComments('"abc\\')).toBe('"abc\\');
    });

    it('handles a # immediately at end of input', () => {
      expect(stripComments('foo#')).toBe('foo');
    });

    it('keeps an empty quoted span', () => {
      expect(stripComments('""')).toBe('""');
    });
  });
});
