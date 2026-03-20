import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getSharedStyles = (theme: GrafanaTheme2) => ({
  separator: css`
    display: inline-block;
    width: 2px;
    height: ${theme.spacing(4)};
    background-color: ${theme.colors.border.strong};
    margin: 0 ${theme.spacing(0.5)};
    flex-shrink: 0;
  `,
  removeButtonContainer: css`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    width: 23px;
    border: 1px solid ${theme.colors.border.medium};
    border-left: none;
    border-radius: 0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0;
  `,
  removeButton: css`
    margin: 0;
    width: 100%;
    height: 100%;
    &::before {
      width: 100%;
      height: 100%;
      border-radius: 0;
    }
  `,
  inputNoRightRadius: css`
    & * {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
  `,
});
