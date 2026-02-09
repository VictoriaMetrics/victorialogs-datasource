import { store as grafanaStore } from "@grafana/data";

type LocalStorage = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
};
type Store = typeof grafanaStore;
// need to wrap the grafana store because it doesn't exist in the grafana version 10.x.x'
const store: Store | LocalStorage = grafanaStore || {};
if (!store?.get) {
  store.get = localStorage.getItem.bind(localStorage);
}
if (!store?.set) {
  store.set = localStorage.setItem.bind(localStorage);
}

export default store;
