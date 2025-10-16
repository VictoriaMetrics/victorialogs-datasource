import { DataQueryRequest, DataQueryResponse, LogLevel } from "@grafana/data";

import { transformBackendResult } from './backendResultTransformer';
import { LogLevelRule, LogLevelRuleType } from "./configuration/LogLevelRules/types";
import { DerivedFieldConfig } from './types';

describe('transformBackendResult', () => {
  const labels = [
    {
      "_stream_id": "0000000000000000e934a84adb05276890d7f7bfcadabe92",
      "custom": "customValue",
      "environment": "dev",
      "level": "info",
      "version": "0.1"
    },
    {
      "_stream_id": "0000000000000000e934a84adb05276890d7f7bfcadabe92",
      "custom": "customValue",
      "environment": "dev",
      "level": "error",
      "version": "0.1"
    },
    {
      "_stream_id": "0000000000000000e934a84adb05276890d7f7bfcadabe92",
      "custom": "customValue",
      "environment": "dev",
      "level": "unknown",
      "version": "0.1"
    },
    {
      "_stream_id": "0000000000000000e934a84adb05276890d7f7bfcadabe92",
      "custom": "customValue",
      "environment": "dev",
      "level": "information",
      "version": "0.1"
    },
    {
      "_stream_id": "0000000000000000e934a84adb05276890d7f7bfcadabe92",
      "custom": "customValue",
      "environment": "dev",
      "level": "debug",
      "version": "0.1"
    },
    {
      "_stream_id": "0000000000000000e934a84adb05276890d7f7bfcadabe92",
      "cutom": "customValue",
      "environment": "dev",
      "level": "trace",
      "version": "0.1"
    },
  ];
  it('should parse level labels and delete origin level labels to avoid duplication', () => {
    const response = {
      "data": [
        {
          "refId": "A",
          "meta": {
            "typeVersion": [
              0,
              0
            ]
          },
          "fields": [
            {
              "name": "Time",
              "type": "time",
              "typeInfo": {
                "frame": "time.Time"
              },
              "config": {},
              "values": [
                1760598702731,
                1760598701836,
                1760598700825,
                1760598697696,
                1760598697034,
                1760598696367,
              ],
              "entities": {},
              "nanos": [
                713000,
                524000,
                282000,
                74000,
                506000,
                620000,
              ]
            },
            {
              "name": "Line",
              "type": "string",
              "typeInfo": {
                "frame": "string"
              },
              "config": {},
              "values": [
                "starting application",
                "starting application",
                "starting application",
                "starting application",
                "starting application",
                "starting application",
              ],
              "entities": {}
            },
            {
              "name": "labels",
              "type": "other",
              "typeInfo": {
                "frame": "json.RawMessage"
              },
              "config": {},
              "values": labels,
              "entities": {}
            }
          ],
          "length": 6
        }
      ],
      "state": "Done"
    } as DataQueryResponse;
    const request = {
      "app": "dashboard",
      "requestId": "SQR100",
      "timezone": "browser",
      "range": {
        "to": "2025-10-16T07:28:02.475Z",
        "from": "2025-10-16T01:28:02.475Z",
        "raw": {
          "from": "now-6h",
          "to": "now"
        }
      },
      "interval": "20s",
      "intervalMs": 20000,
      "targets": [
        {
          "datasource": {
            "type": "victoriametrics-logs-datasource",
            "uid": "bexw8wod6s4jke"
          },
          "editorMode": "code",
          "expr": "*",
          "queryType": "instant",
          "refId": "A",
          "maxLines": 1000
        }
      ],
      "maxDataPoints": 913,
      "scopedVars": {
        "__sceneObject": {
          "text": "__sceneObject"
        },
        "__interval": {
          "text": "20s",
          "value": "20s"
        },
        "__interval_ms": {
          "text": "20000",
          "value": 20000
        }
      },
      "startTime": 1760599682628,
      "rangeRaw": {
        "from": "now-6h",
        "to": "now"
      },
      "dashboardUID": "886b7b9f-97a7-47ee-93b6-9ec7342f6d3e",
      "panelId": 1,
      "panelName": "New panel",
      "panelPluginId": "table",
      "dashboardTitle": "double label info"
    } as unknown as DataQueryRequest;
    const derivedFieldConfigs: DerivedFieldConfig[] = [];
    const logLevelRules: LogLevelRule[] = [];
    const resultLabels = labels.map(({ level, ...rest }) => rest);
    const result = transformBackendResult(response, request, derivedFieldConfigs, logLevelRules);
    expect(result.data[0].fields[2].values).toStrictEqual(resultLabels);
    expect(result.data[0].fields[3].values).toStrictEqual([
      "info",
      "error",
      "unknown",
      "information",
      "debug",
      "trace",
    ]);
  });
  it('should parse level according to rules and left the origin level labels', () => {
    const response = {
      "data": [
        {
          "refId": "A",
          "meta": {
            "typeVersion": [
              0,
              0
            ]
          },
          "fields": [
            {
              "name": "Time",
              "type": "time",
              "typeInfo": {
                "frame": "time.Time"
              },
              "config": {},
              "values": [
                1760598702731,
                1760598701836,
                1760598700825,
                1760598697696,
                1760598697034,
                1760598696367,
              ],
              "entities": {},
              "nanos": [
                713000,
                524000,
                282000,
                74000,
                506000,
                620000,
              ]
            },
            {
              "name": "Line",
              "type": "string",
              "typeInfo": {
                "frame": "string"
              },
              "config": {},
              "values": [
                "starting application",
                "starting application",
                "starting application",
                "starting application",
                "starting application",
                "starting application",
              ],
              "entities": {}
            },
            {
              "name": "labels",
              "type": "other",
              "typeInfo": {
                "frame": "json.RawMessage"
              },
              "config": {},
              "values": labels,
              "entities": {}
            }
          ],
          "length": 6
        }
      ],
      "state": "Done"
    } as DataQueryResponse;
    const request = {
      "app": "dashboard",
      "requestId": "SQR100",
      "timezone": "browser",
      "range": {
        "to": "2025-10-16T07:28:02.475Z",
        "from": "2025-10-16T01:28:02.475Z",
        "raw": {
          "from": "now-6h",
          "to": "now"
        }
      },
      "interval": "20s",
      "intervalMs": 20000,
      "targets": [
        {
          "datasource": {
            "type": "victoriametrics-logs-datasource",
            "uid": "bexw8wod6s4jke"
          },
          "editorMode": "code",
          "expr": "*",
          "queryType": "instant",
          "refId": "A",
          "maxLines": 1000
        }
      ],
      "maxDataPoints": 913,
      "scopedVars": {
        "__sceneObject": {
          "text": "__sceneObject"
        },
        "__interval": {
          "text": "20s",
          "value": "20s"
        },
        "__interval_ms": {
          "text": "20000",
          "value": 20000
        }
      },
      "startTime": 1760599682628,
      "rangeRaw": {
        "from": "now-6h",
        "to": "now"
      },
      "dashboardUID": "886b7b9f-97a7-47ee-93b6-9ec7342f6d3e",
      "panelId": 1,
      "panelName": "New panel",
      "panelPluginId": "table",
      "dashboardTitle": "double label info"
    } as unknown as DataQueryRequest;
    const derivedFieldConfigs: DerivedFieldConfig[] = [];
    const logLevelRules: LogLevelRule[] = [{
      enabled: true,
      field: 'environment',
      operator: LogLevelRuleType.Equals,
      value: 'dev',
      level: LogLevel.critical
    }];
    const resultLabels = labels.map(({ level, ...rest }) => ({
      ...rest,
      __orig_level: level,
    }));
    const result = transformBackendResult(response, request, derivedFieldConfigs, logLevelRules);
    expect(result.data[0].fields[2].values).toStrictEqual(resultLabels);
    expect(result.data[0].fields[3].values).toStrictEqual([
      LogLevel.critical,
      LogLevel.critical,
      LogLevel.critical,
      LogLevel.critical,
      LogLevel.critical,
      LogLevel.critical,
    ]);
  });
});
