import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Modal, Text, TextLink, useStyles2 } from '@grafana/ui';

import { VICTORIA_LOGS_DOCS_HOST } from '../../conf';

const LOGSQL_DOCS_URL = `${VICTORIA_LOGS_DOCS_HOST}/victorialogs/logsql/`;

/**
 * LogsQL Syntax Help component - provides syntax tooltips and quick reference
 * Addresses GitHub Issue #21: [feature request] LogsQL syntax tooltips
 */
export const LogsQLSyntaxHelp = () => {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(false);

  const syntaxContent = useMemo(() => (
    <div className={styles.content}>
      <section className={styles.section}>
        <Text variant='h5'>Basic Queries</Text>
        <div className={styles.examples}>
          <code>error</code> - Match logs containing &#34;error&#34;<br />
          <code>&#34;exact phrase&#34;</code> - Match exact phrase<br />
          <code>_time:5m error</code> - Logs with &#34;error&#34; from last 5 minutes<br />
          <code>error AND warning</code> - Both words must match<br />
          <code>error OR warning</code> - Either word matches<br />
          <code>NOT error</code> - Exclude logs with &#34;error&#34;
        </div>
      </section>

      <section className={styles.section}>
        <Text variant='h5'>Filters</Text>
        <div className={styles.examples}>
          <code>field:value</code> - Field contains value<br />
          <code>field:=&#34;exact&#34;</code> - Exact match<br />
          <code>field:~&#34;regex&#34;</code> - Regexp match<br />
          <code>field:*</code> - Field exists (any value)<br />
          <code>field:&#34;&#34;</code> - Field is empty<br />
          <code>field:&gt;100</code> - Numeric comparison<br />
          <code>_stream:{'{'}app=&#34;nginx&#34;{'}'}</code> - Stream filter
        </div>
      </section>

      <section className={styles.section}>
        <Text variant='h5'>Common Pipes</Text>
        <div className={styles.examples}>
          <code>| limit 100</code> - Limit results<br />
          <code>| sort by (_time desc)</code> - Sort results<br />
          <code>| fields _time, _msg</code> - Select fields<br />
          <code>| filter field:value</code> - Post-filter<br />
          <code>| stats count() as cnt</code> - Aggregate stats<br />
          <code>| stats by (field) count()</code> - Group by<br />
          <code>| uniq by (field)</code> - Unique values
        </div>
      </section>

      <section className={styles.section}>
        <Text variant='h5'>Stats Functions</Text>
        <div className={styles.examples}>
          <code>count()</code> - Count logs<br />
          <code>sum(field)</code> - Sum numeric field<br />
          <code>avg(field)</code> - Average<br />
          <code>min(field)</code> / <code>max(field)</code><br />
          <code>count_uniq(field)</code> - Unique count
        </div>
      </section>

      <section className={styles.section}>
        <Text variant='h5'>Time Filters</Text>
        <div className={styles.examples}>
          <code>_time:5m</code> - Last 5 minutes<br />
          <code>_time:1h</code> - Last 1 hour<br />
          <code>_time:1d</code> - Last 1 day<br />
          <code>_time:[2024-01-01, 2024-01-31]</code> - Date range
        </div>
      </section>

      <div className={styles.footer}>
        <TextLink
          external
          href={LOGSQL_DOCS_URL}
          variant='bodySmall'
        >
          View full LogsQL documentation →
        </TextLink>
      </div>
    </div>
  ), [styles]);

  return (
    <>
      <button
        type='button'
        className={styles.helpButton}
        onClick={() => setIsOpen(true)}
        title='LogsQL Syntax Help'
        aria-label='Open LogsQL Syntax Help'
      >
        <Icon name='question-circle' size='md' />
        <span className={styles.buttonText}>Syntax</span>
      </button>

      <Modal
        title='LogsQL Syntax Reference'
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
      >
        {syntaxContent}
      </Modal>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  helpButton: css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.spacing(0.5)};
    padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
    background: transparent;
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    color: ${theme.colors.text.secondary};
    cursor: pointer;
    font-size: ${theme.typography.bodySmall.fontSize};
    transition: all 0.15s ease-in-out;

    &:hover {
      background: ${theme.colors.action.hover};
      border-color: ${theme.colors.border.medium};
      color: ${theme.colors.text.primary};
    }
  `,
  buttonText: css`
    @media (max-width: 600px) {
      display: none;
    }
  `,
  content: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(2)};
    max-height: 70vh;
    overflow-y: auto;
  `,
  section: css`
    border-bottom: 1px solid ${theme.colors.border.weak};
    padding-bottom: ${theme.spacing(1.5)};

    &:last-of-type {
      border-bottom: none;
    }
  `,
  examples: css`
    margin-top: ${theme.spacing(1)};
    line-height: 1.8;
    font-size: ${theme.typography.bodySmall.fontSize};

    code {
      background: ${theme.colors.background.secondary};
      padding: ${theme.spacing(0.25)} ${theme.spacing(0.5)};
      border-radius: ${theme.shape.radius.default};
      font-family: ${theme.typography.fontFamilyMonospace};
      font-size: 0.9em;
      color: ${theme.colors.text.primary};
    }
  `,
  footer: css`
    padding-top: ${theme.spacing(1)};
    text-align: center;
  `,
});
