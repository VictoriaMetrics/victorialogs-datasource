import { useEffect } from "react";

import { CoreApp } from "@grafana/data";

import { storeKeys } from "../../../store/constants";
import store from "../../../store/store";
import { EXPLORE_STYLE_GRAPH_STYLE } from "../constants";

export const useDefaultExploreGraph = (app: CoreApp | undefined, defaultGraph: EXPLORE_STYLE_GRAPH_STYLE) => {
  // set default graph style for explore app
  useEffect(() => {
    if (app === CoreApp.Explore) {
      const graphStyle = store.get(storeKeys.EXPLORE_STYLE_GRAPH);
      if (!graphStyle) {
        store.set(storeKeys.EXPLORE_STYLE_GRAPH, defaultGraph);
      }
    }
  }, [app, defaultGraph]);
}
