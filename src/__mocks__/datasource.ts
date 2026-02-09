import { DataSourceInstanceSettings, PluginType } from "@grafana/data";
import { TemplateSrv } from "@grafana/runtime";

import { VictoriaLogsDatasource } from "../datasource";
import { Options } from "../types";

const defaultTemplateSrvMock = {
  replace: (input: string) => input,
};

export function createDatasource(
  templateSrvMock: Partial<TemplateSrv> = defaultTemplateSrvMock,
  settings: Partial<DataSourceInstanceSettings<Options>> = {}
): VictoriaLogsDatasource {
  const customSettings: DataSourceInstanceSettings<Options> = {
    url: "myloggingurl",
    id: 0,
    uid: "",
    type: "",
    name: "",
    meta: {
      id: "id",
      name: "name",
      type: PluginType.datasource,
      module: "",
      baseUrl: "",
      info: {
        author: {
          name: "Test",
        },
        description: "",
        links: [],
        logos: {
          large: "",
          small: "",
        },
        screenshots: [],
        updated: "",
        version: "",
      },
    },
    readOnly: false,
    jsonData: {
      maxLines: "20",
    },
    access: "direct",
    ...settings,
  };

  return new VictoriaLogsDatasource(customSettings, templateSrvMock as TemplateSrv);
}
