/** A VictoriaLogs API a plugin feature relies on; the list lives in pkg/vlcompat/requirements.go */
export interface VictoriaLogsRequirement {
  /** What the plugin does with the API */
  feature: string;
  /** The VictoriaLogs API the feature relies on */
  needs: string;
  /** Where VictoriaLogs added the API */
  link: string;
  /** The plugin release that started relying on the API */
  pluginVersion: string;
  /** The oldest VictoriaLogs release that provides the API */
  minVersion: string;
}

/** The answer of the backend `victorialogs/support` resource; see `checkVictoriaLogsSupport` in pkg/plugin/victorialogs_version.go */
export interface VictoriaLogsSupport {
  /** The version VictoriaLogs reports; empty when the backend could not obtain it */
  version: string;
  /** Whether the version names a release the requirements were matched against */
  versionKnown: boolean;
  /** The oldest VictoriaLogs release the plugin works with; empty when the plugin itself could not be asked */
  minVersion: string;
  supported: boolean;
  /** Why the version is not supported */
  reason?: string;
  /** The requirements the VictoriaLogs does not meet; every requirement when its version is unknown */
  unmet?: VictoriaLogsRequirement[];
}

export const VICTORIA_LOGS_SUPPORT_RESOURCE = 'victorialogs/support';

/** What the cache needs of a datasource instance */
export interface VictoriaLogsSupportSource {
  getResource<T>(path: string): Promise<T>;
}

/** The message of a failed backend call: a FetchError of Grafana is a plain object, not an Error */
export const describeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const { data, statusText, status } = error as { data?: { message?: string }; statusText?: string; status?: number };
    return data?.message || statusText || (status ? `status ${status}` : 'unknown error');
  }
  return String(error);
};

/**
 * The support answers of the backend, requested once per datasource instance: Grafana creates a new
 * instance when the data source is saved with other settings, so an answer never outlives them.
 * Only an answer with a known VictoriaLogs version is kept: a failed call or a version the backend
 * could not obtain (VictoriaLogs down, URL being edited) is asked again by the next editor
 */
export class VictoriaLogsSupportCache {
  private readonly answers = new WeakMap<VictoriaLogsSupportSource, Promise<VictoriaLogsSupport>>();

  get(datasource: VictoriaLogsSupportSource): Promise<VictoriaLogsSupport> {
    const cached = this.answers.get(datasource);
    if (cached) {
      return cached;
    }
    const answer = datasource
      .getResource<VictoriaLogsSupport>(VICTORIA_LOGS_SUPPORT_RESOURCE)
      .then((support) => {
        if (!support.versionKnown) {
          this.answers.delete(datasource);
        }
        return support;
      })
      .catch((error: unknown): VictoriaLogsSupport => {
        this.answers.delete(datasource);
        return { version: '', versionKnown: false, minVersion: '', supported: false, reason: describeError(error) };
      });
    this.answers.set(datasource, answer);
    return answer;
  }
}

export const victoriaLogsSupportCache = new VictoriaLogsSupportCache();
