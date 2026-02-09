import { css } from "@emotion/css";
import React from "react";

import { GrafanaTheme2 } from "@grafana/data";
import { Button, Card, ClipboardButton, Stack, TextLink, useStyles2 } from "@grafana/ui";

import { VICTORIA_LOGS_DOCS_HOST } from "../../../conf";

import { QueryHint } from "./hints/types";

interface HintItemComponentProps {
  hint: QueryHint;
  query: string;
  onQueryChange: (query: string, isAddQuery?: boolean) => void;
}

export const HintItem = ({ hint, query, onQueryChange }: HintItemComponentProps) => {
  const styles = useStyles2(getStyles);

  // add existing query to the hint as a filter before the pipe operator
  const handleAppendQuery = () => {
    let prevQuery = query.trim();
    if (prevQuery.endsWith("|")) {
      prevQuery = prevQuery.slice(0, -1);
    }
    let hintExpr = hint.example;
    if (prevQuery && hintExpr.startsWith("*") && hintExpr.includes("|")) {
      hintExpr = hintExpr.split("|").slice(1).join("|").trim();
    }
    prevQuery = prevQuery ? `${prevQuery} | ${hintExpr}` : hintExpr;
    onQueryChange(prevQuery);
  };

  const handleReplaceQuery = () => {
    onQueryChange(hint.example);
  };

  const handleCreateNewQuery = () => {
    onQueryChange(hint.example, true);
  };

  return (
    <Card className={styles.card}>
      <Card.Heading className={styles.cardHeader}>
        <h5 className={styles.title}>
          {hint.title}
          {hint.id && (
            <>
              <TextLink
                href={`${VICTORIA_LOGS_DOCS_HOST}/victorialogs/logsql/#${hint.id}`}
                icon="external-link-alt"
                variant={"body"}
                external
              >Documentation</TextLink>
            </>
          )}
        </h5>
        <div className={styles.content}>
          {hint.description && (
            <div className={styles.description}>
              {hint.description}:
            </div>
          )}
          <code className={styles.queryExpr}>{hint.queryExpr}</code>
        </div>
      </Card.Heading>
      <Card.Description>
        <Stack direction={"column"} justifyContent={"space-between"}>
          Example:
          <code className={styles.code}>{hint.example}</code>
          <Card.Actions>
            <Button
              size="sm"
              variant="primary"
              onClick={handleReplaceQuery}
              aria-label="Replace current query with this example"
              tooltip="Replace current query with this example"
            >
              Replace
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAppendQuery}
              aria-label="Append this example to current query"
              tooltip="Append this example to current query as a pipe"
            >
              Append
            </Button>
            <div className={styles.divider} />
            <ClipboardButton
              icon="copy"
              getText={() => hint.example}
              size="sm"
              aria-label="Copy this example to clipboard"
              tooltip="Copy this example to clipboard"
              variant="secondary"
            >
              Copy
            </ClipboardButton>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCreateNewQuery}
              aria-label="Add this example as a new query"
              tooltip="Add this example as a new query"
            >
              Add new query
            </Button>
          </Card.Actions>
        </Stack>
      </Card.Description>
    </Card>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    card: css`
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    `,
    cardHeader: css`
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    `,
    content: css`
      margin-bottom: 8px;
    `,
    title: css`
      display: flex;
      direction: row;
      justify-content: space-between;
      margin-bottom: 4px;
      width: 100%;
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.text.primary};
    `,
    description: css`
      font-size: 12px;
      color: ${theme.colors.text.secondary};
      margin-bottom: 8px;
    `,
    queryExpr: css`
      white-space: pre-wrap;
    `,
    code: css`
      width: 100%;
      display: block;
      padding: 8px;
      font-size: 14px;
      white-space: pre-wrap;
      word-break: break-all;
    `,
    divider: css`
      width: 1px;
      height: 24px;
      background: ${theme.colors.border.medium};
      margin: 0 4px;
    `,
  };
};
