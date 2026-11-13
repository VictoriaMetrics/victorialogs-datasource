import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Stack, Text, useStyles2 } from '@grafana/ui';

import { victoriaLogsSupportCache, VictoriaLogsSupportCache, VictoriaLogsSupportSource } from '../../victoriaLogsCompat/victoriaLogsSupport';

interface Props {
  datasource: VictoriaLogsSupportSource;
  cache?: VictoriaLogsSupportCache;
}

/** Warning that the VictoriaLogs behind the datasource is older than this plugin version needs; rendered only then */
export const VictoriaLogsSupportAlert = ({ datasource, cache = victoriaLogsSupportCache }: Props) => {
  const styles = useStyles2(getStyles);
  const { value: support } = useAsync(() => cache.get(datasource), [cache, datasource]);

  if (!support || support.supported) {
    return null;
  }

  // the plugin backend itself could not be asked: nothing is known about VictoriaLogs
  if (!support.minVersion) {
    return (
      <div className={styles.row}>
        <Alert severity='warning' title='The VictoriaLogs version could not be checked' bottomSpacing={0}>
          <Text variant='bodySmall'>{support.reason}.</Text>
        </Alert>
      </div>
    );
  }

  // a version the backend could not read says nothing about the VictoriaLogs behind it
  const title = support.versionKnown
    ? `VictoriaLogs ${support.version} is not supported by this plugin version`
    : 'The VictoriaLogs version is unknown';
  const unmet = support.unmet ?? [];
  return (
    <div className={styles.row}>
      <Alert severity='warning' title={title} bottomSpacing={0}>
        <Stack direction='column' gap={1}>
          <Text variant='bodySmall'>
            This plugin version requires VictoriaLogs {support.minVersion} or newer. {support.reason}.
          </Text>
          {unmet.length > 0 && (
            <>
              <Text variant='bodySmall'>{support.versionKnown ? 'What does not work with it:' : 'What may not work with it:'}</Text>
              <ul className={styles.list}>
                {unmet.map((requirement) => (
                  <li key={requirement.feature}>
                    <Text variant='bodySmall'>
                      {requirement.feature} needs {requirement.needs} since VictoriaLogs {requirement.minVersion} (
                      <a className={styles.link} href={requirement.link} target='_blank' rel='noreferrer'>
                        details
                      </a>
                      )
                    </Text>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Stack>
      </Alert>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    marginBottom: theme.spacing(1),
  }),
  list: css({
    margin: 0,
    paddingLeft: theme.spacing(2),
  }),
  link: css({
    color: theme.colors.text.link,
    textDecoration: 'underline',
  }),
});
