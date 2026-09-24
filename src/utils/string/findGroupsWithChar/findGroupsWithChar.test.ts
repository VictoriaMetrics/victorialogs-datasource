import { findGroupsWithChar } from './findGroupsWithChar';

const find = (s: string) => [...findGroupsWithChar(s, '(', ')', '|')];

describe('findGroupsWithChar', () => {
  it('marks a group holding the needle', () => {
    expect(find('(a | b)')).toEqual([0]);
    expect(find('(a, b)')).toEqual([]);
  });

  it('handles an empty block', () => {
    expect(find('()')).toEqual([]);
  });

  it('marks only the innermost group enclosing the needle', () => {
    expect(find('(a (b | c) d)')).toEqual([3]);
    expect(find('(((a | b)))')).toEqual([2]);
  });

  it('marks every group that holds the needle at its own level', () => {
    expect(find('(a | b) (c | d)')).toEqual([0, 8]);
    expect(find('(a | (b | c))')).toEqual([0, 5]);
  });

  it('ignores a needle outside any group', () => {
    expect(find('a | b')).toEqual([]);
    expect(find('(a) | (b)')).toEqual([]);
  });

  it('ignores a needle inside quoted strings', () => {
    expect(find('("a|b")')).toEqual([]);
    expect(find("('a|b')")).toEqual([]);
    expect(find('(`a|b`)')).toEqual([]);
  });

  it('ignores a needle inside an escaped quote span', () => {
    expect(find('("a\\"|b")')).toEqual([]);
  });

  it('tolerates unmatched brackets', () => {
    expect(find('(a | b')).toEqual([0]);
    expect(find('a | b)')).toEqual([]);
    expect(find('(a) | b)')).toEqual([]);
  });
});
