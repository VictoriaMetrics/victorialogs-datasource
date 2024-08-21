import { FilterVisualQuery } from "../../../../../types";

import { updateValueByIndexPath, updateOperatorByIndexPath } from './updateByIndexPath';

describe('updateValueByIndexPath', () => {
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

  it('should update _msg:error to _msg:critical', () => {
    const indexPath = [0, 0];
    const newObj = updateValueByIndexPath(obj, indexPath, '_msg:critical');
    expect(newObj).toEqual({
      operators: ['and'],
      values: [
        { operators: ['or', 'or'], values: ['_msg:critical', '_msg:warn', '_msg:info'] },
        { operators: ['and', 'and', 'and'], values: ['_msg:cpu', '_msg:gpu', '_msg:hdd', '_msg:ssd'] }
      ]
    });
  });

  it('should update _msg:info to _msg:notification', () => {
    const indexPath = [0, 2];
    const newObj = updateValueByIndexPath(obj, indexPath, '_msg:notification');
    expect(newObj).toEqual({
      operators: ['and'],
      values: [
        { operators: ['or', 'or'], values: ['_msg:error', '_msg:warn', '_msg:notification'] },
        { operators: ['and', 'and', 'and'], values: ['_msg:cpu', '_msg:gpu', '_msg:hdd', '_msg:ssd'] }
      ]
    });
  });

  it('should update _msg:ssd to _msg:nvme', () => {
    const indexPath = [1, 3];
    const newObj = updateValueByIndexPath(obj, indexPath, '_msg:nvme');
    expect(newObj).toEqual({
      operators: ['and'],
      values: [
        { operators: ['or', 'or'], values: ['_msg:error', '_msg:warn', '_msg:info'] },
        { operators: ['and', 'and', 'and'], values: ['_msg:cpu', '_msg:gpu', '_msg:hdd', '_msg:nvme'] }
      ]
    });
  });

  it('should handle updating in flat structures', () => {
    obj = {
      operators: ['or', 'or'],
      values: ['_msg:error', '_msg:warn', '_msg:info']
    };

    const indexPath = [1];
    const newObj = updateValueByIndexPath(obj, indexPath, '_msg:alert');
    expect(newObj).toEqual({
      operators: ['or', 'or'],
      values: ['_msg:error', '_msg:alert', '_msg:info']
    });
  });

  it('should handle updating in nested structures', () => {
    obj = {
      operators: ['and'],
      values: [
        {
          operators: ['or'],
          values: [
            { operators: ['and'], values: ['_msg:error', '_msg:warn'] },
            '_msg:info'
          ]
        }
      ]
    };

    const indexPath = [0, 0, 0];
    const newObj = updateValueByIndexPath(obj, indexPath, '_msg:critical');
    expect(newObj).toEqual({
      operators: ['and'],
      values: [
        {
          operators: ['or'],
          values: [
            { operators: ['and'], values: ['_msg:critical', '_msg:warn'] },
            '_msg:info'
          ]
        }
      ]
    });
  });
});

describe('updateOperatorByIndexPath', () => {
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

  it('should update operator or to and between _msg:error and _msg:warn', () => {
    const indexPath = [0, 0];
    const newObj = updateOperatorByIndexPath(obj, indexPath, 'and');
    expect(newObj).toEqual({
      operators: ['and'],
      values: [
        { operators: ['and', 'or'], values: ['_msg:error', '_msg:warn', '_msg:info'] },
        { operators: ['and', 'and', 'and'], values: ['_msg:cpu', '_msg:gpu', '_msg:hdd', '_msg:ssd'] }
      ]
    });
  });

  it('should update operator and to or between _msg:cpu and _msg:gpu', () => {
    const indexPath = [1, 1];
    const newObj = updateOperatorByIndexPath(obj, indexPath, 'or');
    expect(newObj).toEqual({
      operators: ['and'],
      values: [
        { operators: ['or', 'or'], values: ['_msg:error', '_msg:warn', '_msg:info'] },
        { operators: ['and', 'or', 'and'], values: ['_msg:cpu', '_msg:gpu', '_msg:hdd', '_msg:ssd'] }
      ]
    });
  });

  it('should handle updating operators in nested structures', () => {
    obj = {
      operators: ['and'],
      values: [
        {
          operators: ['or'],
          values: [
            { operators: ['and'], values: ['_msg:error', '_msg:warn'] },
            '_msg:info'
          ]
        }
      ]
    };

    const indexPath = [0, 0, 0];
    const newObj = updateOperatorByIndexPath(obj, indexPath, 'or');
    expect(newObj).toEqual({
      operators: ['and'],
      values: [
        {
          operators: ['or'],
          values: [
            { operators: ['or'], values: ['_msg:error', '_msg:warn'] },
            '_msg:info'
          ]
        }
      ]
    });
  });
});
