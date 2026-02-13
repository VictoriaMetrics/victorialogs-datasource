import { DataQueryRequest, DataQueryResponse, dateTime, LogLevel } from '@grafana/data';

import { LogLevelRule, LogLevelRuleType } from '../configuration/LogLevelRules/types';
import { DerivedFieldConfig, Query, QueryType } from '../types';

import { transformBackendResult } from './transformBackendResult';

describe('transformBackendResult', () => {
  const labels = [
    {
      '_stream_id': '0000000000000000e934a84adb05276890d7f7bfcadabe92',
      'custom': 'customValue',
      'environment': 'dev',
      'level': 'info',
      'version': '0.1'
    },
    {
      '_stream_id': '0000000000000000e934a84adb05276890d7f7bfcadabe92',
      'custom': 'customValue',
      'environment': 'dev',
      'level': 'error',
      'version': '0.1'
    },
    {
      '_stream_id': '0000000000000000e934a84adb05276890d7f7bfcadabe92',
      'custom': 'customValue',
      'environment': 'dev',
      'level': 'unknown',
      'version': '0.1'
    },
    {
      '_stream_id': '0000000000000000e934a84adb05276890d7f7bfcadabe92',
      'custom': 'customValue',
      'environment': 'dev',
      'level': 'information',
      'version': '0.1'
    },
    {
      '_stream_id': '0000000000000000e934a84adb05276890d7f7bfcadabe92',
      'custom': 'customValue',
      'environment': 'dev',
      'level': 'debug',
      'version': '0.1'
    },
    {
      '_stream_id': '0000000000000000e934a84adb05276890d7f7bfcadabe92',
      'cutom': 'customValue',
      'environment': 'dev',
      'level': 'trace',
      'version': '0.1'
    },
  ];
  it('should parse level labels and delete origin level labels to avoid duplication', () => {
    const response = {
      'data': [
        {
          'refId': 'A',
          'meta': {
            'typeVersion': [
              0,
              0
            ]
          },
          'fields': [
            {
              'name': 'Time',
              'type': 'time',
              'typeInfo': {
                'frame': 'time.Time'
              },
              'config': {},
              'values': [
                1760598702731,
                1760598701836,
                1760598700825,
                1760598697696,
                1760598697034,
                1760598696367,
              ],
              'entities': {},
              'nanos': [
                713000,
                524000,
                282000,
                74000,
                506000,
                620000,
              ]
            },
            {
              'name': 'Line',
              'type': 'string',
              'typeInfo': {
                'frame': 'string'
              },
              'config': {},
              'values': [
                'starting application',
                'starting application',
                'starting application',
                'starting application',
                'starting application',
                'starting application',
              ],
              'entities': {}
            },
            {
              'name': 'labels',
              'type': 'other',
              'typeInfo': {
                'frame': 'json.RawMessage'
              },
              'config': {},
              'values': labels,
              'entities': {}
            }
          ],
          'length': 6
        }
      ],
      'state': 'Done'
    } as DataQueryResponse;
    const request = {
      'app': 'dashboard',
      'requestId': 'SQR100',
      'timezone': 'browser',
      'range': {
        'to': '2025-10-16T07:28:02.475Z',
        'from': '2025-10-16T01:28:02.475Z',
        'raw': {
          'from': 'now-6h',
          'to': 'now'
        }
      },
      'interval': '20s',
      'intervalMs': 20000,
      'targets': [
        {
          'datasource': {
            'type': 'victoriametrics-logs-datasource',
            'uid': 'bexw8wod6s4jke'
          },
          'editorMode': 'code',
          'expr': '*',
          'queryType': 'instant',
          'refId': 'A',
          'maxLines': 1000
        }
      ],
      'maxDataPoints': 913,
      'scopedVars': {
        '__sceneObject': {
          'text': '__sceneObject'
        },
        '__interval': {
          'text': '20s',
          'value': '20s'
        },
        '__interval_ms': {
          'text': '20000',
          'value': 20000
        }
      },
      'startTime': 1760599682628,
      'rangeRaw': {
        'from': 'now-6h',
        'to': 'now'
      },
      'dashboardUID': '886b7b9f-97a7-47ee-93b6-9ec7342f6d3e',
      'panelId': 1,
      'panelName': 'New panel',
      'panelPluginId': 'table',
      'dashboardTitle': 'double label info'
    } as unknown as DataQueryRequest<Query>;
    const derivedFieldConfigs: DerivedFieldConfig[] = [];
    const logLevelRules: LogLevelRule[] = [];
    const result = transformBackendResult(response, request, derivedFieldConfigs, logLevelRules);
    expect(result.data[0].fields[2].values).toStrictEqual(labels);
    expect(result.data[0].fields[3].name).toStrictEqual('detected_level');
    expect(result.data[0].fields[3].values).toStrictEqual([
      'info',
      'error',
      'unknown',
      'information',
      'debug',
      'trace',
    ]);
  });

  it('should parse level according to rules, apply the origin level labels then rule labels', () => {
    const extendedLabels = labels.map((l, index) => {
      if (index > 2) {
        return {
          ...l,
          level: 'Custom unknown level'
        };
      }
      return l;
    });
    const response = {
      'data': [
        {
          'refId': 'A',
          'meta': {
            'typeVersion': [
              0,
              0
            ]
          },
          'fields': [
            {
              'name': 'Time',
              'type': 'time',
              'typeInfo': {
                'frame': 'time.Time'
              },
              'config': {},
              'values': [
                1760598702731,
                1760598701836,
                1760598700825,
                1760598697696,
                1760598697034,
                1760598696367,
              ],
              'entities': {},
              'nanos': [
                713000,
                524000,
                282000,
                74000,
                506000,
                620000,
              ]
            },
            {
              'name': 'Line',
              'type': 'string',
              'typeInfo': {
                'frame': 'string'
              },
              'config': {},
              'values': [
                'starting application',
                'starting application',
                'starting application',
                'starting application',
                'starting application',
                'starting application',
              ],
              'entities': {}
            },
            {
              'name': 'labels',
              'type': 'other',
              'typeInfo': {
                'frame': 'json.RawMessage'
              },
              'config': {},
              'values': extendedLabels,
              'entities': {}
            }
          ],
          'length': 6
        }
      ],
      'state': 'Done'
    } as DataQueryResponse;
    const request = {
      'app': 'dashboard',
      'requestId': 'SQR100',
      'timezone': 'browser',
      'range': {
        'to': '2025-10-16T07:28:02.475Z',
        'from': '2025-10-16T01:28:02.475Z',
        'raw': {
          'from': 'now-6h',
          'to': 'now'
        }
      },
      'interval': '20s',
      'intervalMs': 20000,
      'targets': [
        {
          'datasource': {
            'type': 'victoriametrics-logs-datasource',
            'uid': 'bexw8wod6s4jke'
          },
          'editorMode': 'code',
          'expr': '*',
          'queryType': 'instant',
          'refId': 'A',
          'maxLines': 1000
        }
      ],
      'maxDataPoints': 913,
      'scopedVars': {
        '__sceneObject': {
          'text': '__sceneObject'
        },
        '__interval': {
          'text': '20s',
          'value': '20s'
        },
        '__interval_ms': {
          'text': '20000',
          'value': 20000
        }
      },
      'startTime': 1760599682628,
      'rangeRaw': {
        'from': 'now-6h',
        'to': 'now'
      },
      'dashboardUID': '886b7b9f-97a7-47ee-93b6-9ec7342f6d3e',
      'panelId': 1,
      'panelName': 'New panel',
      'panelPluginId': 'table',
      'dashboardTitle': 'double label info'
    } as unknown as DataQueryRequest<Query>;
    const derivedFieldConfigs: DerivedFieldConfig[] = [];
    const logLevelRules: LogLevelRule[] = [{
      enabled: true,
      field: 'environment',
      operator: LogLevelRuleType.Equals,
      value: 'dev',
      level: LogLevel.critical
    }];
    const result = transformBackendResult(response, request, derivedFieldConfigs, logLevelRules);
    expect(result.data[0].fields[2].values).toStrictEqual(extendedLabels);
    expect(result.data[0].fields[3].values).toStrictEqual([
      LogLevel.info,
      LogLevel.error,
      LogLevel.unknown,
      LogLevel.critical,
      LogLevel.critical,
      LogLevel.critical,
    ]);
  });

  it('should parse level from the _msg label according to rules', () => {
    const extendedLabels = labels.map((l, index) => {
      return {
        ...l,
        level: 'Custom unknown level'
      };
    });
    const response = {
      'data': [
        {
          'refId': 'A',
          'meta': {
            'typeVersion': [
              0,
              0
            ]
          },
          'fields': [
            {
              'name': 'Time',
              'type': 'time',
              'typeInfo': {
                'frame': 'time.Time'
              },
              'config': {},
              'values': [
                1760598702731,
                1760598701836,
                1760598700825,
                1760598697696,
                1760598697034,
                1760598696367,
              ],
              'entities': {},
              'nanos': [
                713000,
                524000,
                282000,
                74000,
                506000,
                620000,
              ]
            },
            {
              'name': 'Line',
              'type': 'string',
              'typeInfo': {
                'frame': 'string'
              },
              'config': {},
              'values': [
                'critical error',
                'starting application',
                'starting application',
                'starting application',
                'starting application',
                'starting application',
              ],
              'entities': {}
            },
            {
              'name': 'labels',
              'type': 'other',
              'typeInfo': {
                'frame': 'json.RawMessage'
              },
              'config': {},
              'values': extendedLabels,
              'entities': {}
            }
          ],
          'length': 6
        }
      ],
      'state': 'Done'
    } as DataQueryResponse;
    const request = {
      'app': 'dashboard',
      'requestId': 'SQR100',
      'timezone': 'browser',
      'range': {
        'to': '2025-10-16T07:28:02.475Z',
        'from': '2025-10-16T01:28:02.475Z',
        'raw': {
          'from': 'now-6h',
          'to': 'now'
        }
      },
      'interval': '20s',
      'intervalMs': 20000,
      'targets': [
        {
          'datasource': {
            'type': 'victoriametrics-logs-datasource',
            'uid': 'bexw8wod6s4jke'
          },
          'editorMode': 'code',
          'expr': '*',
          'queryType': 'instant',
          'refId': 'A',
          'maxLines': 1000
        }
      ],
      'maxDataPoints': 913,
      'scopedVars': {
        '__sceneObject': {
          'text': '__sceneObject'
        },
        '__interval': {
          'text': '20s',
          'value': '20s'
        },
        '__interval_ms': {
          'text': '20000',
          'value': 20000
        }
      },
      'startTime': 1760599682628,
      'rangeRaw': {
        'from': 'now-6h',
        'to': 'now'
      },
      'dashboardUID': '886b7b9f-97a7-47ee-93b6-9ec7342f6d3e',
      'panelId': 1,
      'panelName': 'New panel',
      'panelPluginId': 'table',
      'dashboardTitle': 'double label info'
    } as unknown as DataQueryRequest<Query>;
    const derivedFieldConfigs: DerivedFieldConfig[] = [];
    const logLevelRules: LogLevelRule[] = [{
      enabled: true,
      field: '_msg',
      operator: LogLevelRuleType.Regex,
      value: 'critical',
      level: LogLevel.critical
    }];
    const result = transformBackendResult(response, request, derivedFieldConfigs, logLevelRules);
    expect(result.data[0].fields[2].values).toStrictEqual(extendedLabels);
    expect(result.data[0].fields[3].values).toStrictEqual([
      LogLevel.critical,
      LogLevel.unknown,
      LogLevel.unknown,
      LogLevel.unknown,
      LogLevel.unknown,
      LogLevel.unknown,
    ]);
  });

  describe('processMetricRangeFrames', () => {
    const refId = 'A';
    const baseResponse = {
      'data': [
        {
          'refId': refId,
          'meta': {
            'typeVersion': [
              0,
              0
            ]
          },
          'fields': [
            {
              'name': 'Time',
              'type': 'time',
              'typeInfo': {
                'frame': 'time.Time'
              },
              'config': {},
              'values': [
                10,
                20,
                40,
                50,
                90,
              ],
              'entities': {},
            },
            {
              'name': 'Line',
              'type': 'number',
              'typeInfo': {
                'frame': 'string'
              },
              'config': {},
              'values': [
                1,
                2,
                3,
                4,
                5,
              ],
              'entities': {}
            },
          ],
          'length': 5
        }
      ],
      'state': 'Done'
    } as DataQueryResponse;

    const baseRequest = {
      'app': 'dashboard',
      'requestId': 'SQR100',
      'timezone': 'browser',
      'range': {
        'to': dateTime('1970-01-01T00:00:00.101Z'), //  101ms
        'from': dateTime('1970-01-01T00:00:00.005Z'), //  5ms
        'raw': {
          'from': 'now-6h',
          'to': 'now'
        }
      },
      'interval': '20s',
      'intervalMs': 20000,
      'targets': [
        {
          'datasource': {
            'type': 'victoriametrics-logs-datasource',
            'uid': 'bexw8wod6s4jke'
          },
          'editorMode': 'code',
          'expr': '*',
          'queryType': QueryType.StatsRange,
          'refId': refId,
          'maxLines': 1000,
          step: '10ms',
        }
      ],
      'maxDataPoints': 913,
      'scopedVars': {
        '__sceneObject': {
          'text': '__sceneObject'
        },
        '__interval': {
          'text': '20s',
          'value': '20s'
        },
        '__interval_ms': {
          'text': '20000',
          'value': 20000
        }
      },
      'startTime': 1760599682628,
      'rangeRaw': {
        'from': 'now-6h',
        'to': 'now'
      },
      'dashboardUID': '886b7b9f-97a7-47ee-93b6-9ec7342f6d3e',
      'panelId': 1,
      'panelName': 'New panel',
      'panelPluginId': 'table',
      'dashboardTitle': 'double label info'
    } as unknown as DataQueryRequest<Query>;

    it('should fill with null values skipped timestamps if fields is empty', () => {
      const response = {
        ...baseResponse,
        data: [
          {
            ...baseResponse.data[0],
            fields: [],
            length: 0
          }
        ]
      };
      const request = { ...baseRequest };
      const derivedFieldConfigs: DerivedFieldConfig[] = [];
      const logLevelRules: LogLevelRule[] = [];
      const result = transformBackendResult(response, request, derivedFieldConfigs, logLevelRules);
      expect(result.data[0].fields.length).toStrictEqual(0);
    });

    it('should fill with null values skipped timestamps', () => {
      const response = { ...baseResponse };
      const request = { ...baseRequest };
      const derivedFieldConfigs: DerivedFieldConfig[] = [];
      const logLevelRules: LogLevelRule[] = [];
      const result = transformBackendResult(response, request, derivedFieldConfigs, logLevelRules);
      expect(result.data[0].fields[0].values).toStrictEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
      expect(result.data[0].fields[1].values).toStrictEqual([1, 2, null, 3, 4, null, null, null, 5, null]);
    });
  });
});
