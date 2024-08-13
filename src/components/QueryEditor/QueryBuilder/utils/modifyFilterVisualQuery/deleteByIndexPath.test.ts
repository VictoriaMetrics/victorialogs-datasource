import { FilterVisualQuery } from "../../../../../types";

import { deleteByIndexPath } from './deleteByIndexPath';

describe('deleteByIndexPath', () => {
  let obj: FilterVisualQuery;

  beforeEach(() => {
    obj = {
      operators: ['and'],
      values: [
        { operators: ['or', 'or'], values: ['_msg:error', '_msg:warn', '_msg:info'] },
        { operators: ['and', 'and', 'and'], values: ['_msg:cpu', '_msg:gpu', '_msg:hdd', '_msg:ssd'] }
      ]
    };
  });

  it('should delete _msg:error and the corresponding operator', () => {
    const indexPath = [0, 0];
    const newObj = deleteByIndexPath(obj, indexPath);
    expect(newObj).toEqual({
      operators: ['and'],
      values: [
        { operators: ['or'], values: ['_msg:warn', '_msg:info'] },
        { operators: ['and', 'and', 'and'], values: ['_msg:cpu', '_msg:gpu', '_msg:hdd', '_msg:ssd'] }
      ]
    });
  });

  it('should delete _msg:info and the corresponding operator', () => {
    const indexPath = [0, 2];
    const newObj = deleteByIndexPath(obj, indexPath);
    expect(newObj).toEqual({
      operators: ['and'],
      values: [
        { operators: ['or'], values: ['_msg:error', '_msg:warn'] },
        { operators: ['and', 'and', 'and'], values: ['_msg:cpu', '_msg:gpu', '_msg:hdd', '_msg:ssd'] }
      ]
    });
  });

  it('should delete _msg:ssd and the corresponding operator', () => {
    const indexPath = [1, 3];
    const newObj = deleteByIndexPath(obj, indexPath);
    expect(newObj).toEqual({
      operators: ['and'],
      values: [
        { operators: ['or', 'or'], values: ['_msg:error', '_msg:warn', '_msg:info'] },
        { operators: ['and', 'and'], values: ['_msg:cpu', '_msg:gpu', '_msg:hdd'] }
      ]
    });
  });

  it('should handle deleting from flat structures', () => {
    obj = {
      operators: ['or', 'or'],
      values: ['_msg:error', '_msg:warn', '_msg:info']
    };

    const indexPath = [1];
    const newObj = deleteByIndexPath(obj, indexPath);
    expect(newObj).toEqual({
      operators: ['or'],
      values: ['_msg:error', '_msg:info']
    });
  });

  it('should handle deleting from nested structures', () => {
    obj = {
      operators: ['and'],
      values: [
        {
          operators: ['or'],
          values: [
            { operators: ['and'], values: ['_msg:error', '_msg:warn'] },
            '_msg:info'
          ]
        },
        "_msg:cpu"
      ]
    };

    const indexPath = [0, 0, 0];
    const newObj = deleteByIndexPath(obj, indexPath);
    expect(newObj).toEqual({
      operators: ['and'],
      values: [
        {
          operators: ['or'],
          values: [
            { operators: [], values: ['_msg:warn'] },
            '_msg:info'
          ]
        },
        "_msg:cpu"
      ]
    });
  });
});
