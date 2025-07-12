import { QueryBuilderOperation } from "@grafana/plugin-ui";

import { VisualQuery } from "../../../types";

import { OperationDefinitions } from "./Operations";
import { QueryModeller } from './QueryModellerClass';
import { VictoriaLogsQueryOperationCategory } from './VictoriaLogsQueryOperationCategory';
import { parseOperation, parseStatsOperation } from './utils/operationParser';
import { splitByOperator, splitByUnescapedPipe, splitString } from './utils/stringSplitter';

export function createQueryModellerWithDefaultField(defaultField: string, categegories: VictoriaLogsQueryOperationCategory[]) {
  const queryModeller = new QueryModeller(new OperationDefinitions(defaultField).all(), categegories);
  return queryModeller;
}

export function createQueryModellerForCategories(categegories: VictoriaLogsQueryOperationCategory[] = Object.values(VictoriaLogsQueryOperationCategory)) {
  const queryModeller = new QueryModeller(new OperationDefinitions().all(), categegories);
  return queryModeller;
}

export const buildVisualQueryToString = (query: VisualQuery, queryModeller?: QueryModeller): string => {
  if (!queryModeller) {
    queryModeller = createQueryModellerForCategories(Object.values(VictoriaLogsQueryOperationCategory));
  }
  return queryModeller.renderQuery(query);
}

const handleExpression = (expr: string, defaultField = "_msg", queryModeller?: QueryModeller): QueryBuilderOperation[] => {
  let operationList: QueryBuilderOperation[] = [];
  // first split by pipes then by operators
  let lastOpWasOperator = false;
  const fullSplitString = splitString(expr || "");
  let operationQueryModeller = queryModeller;
  if (defaultField !== "_msg" || queryModeller === undefined) {
    operationQueryModeller = createQueryModellerWithDefaultField(defaultField, Object.values(VictoriaLogsQueryOperationCategory))
  } else {
    operationQueryModeller = queryModeller;
  }
  for (const splitByPipes of splitByUnescapedPipe(fullSplitString)) {
    for (let splitByOp of splitByOperator(splitByPipes)) {
      if (splitByOp.length > 0 && splitByOp[0].type === "space") {
        if (["and", "or", "not"].includes(splitByOp[0].value.toLowerCase())) {
          operationList.push({
            id: splitByOp[0].value.toLowerCase(),
            params: [],
          })
          lastOpWasOperator = true;
          continue;
        }
      }
      const comments = splitByOp.filter(part => part.type === "comment");
      if (comments.length > 0) {
        splitByOp = splitByOp.filter(part => part.type !== "comment");
      }
      while (splitByOp.length > 0) {
        const parsedOperation = parseOperation(splitByOp, lastOpWasOperator, operationQueryModeller);
        if (parsedOperation) {
          operationList.push(parsedOperation.operation);
          splitByOp = splitByOp.slice(parsedOperation.length);
          if (operationQueryModeller.getOperationDefinition(parsedOperation.operation.id).category === VictoriaLogsQueryOperationCategory.Stats) {
            while (splitByOp.length > 0 && splitByOp[0].value === ",") {
              splitByOp = splitByOp.slice(1);
              let statsOperation = parseStatsOperation(splitByOp, operationQueryModeller);
              if (statsOperation) {
                operationList.push(statsOperation.operation);
                splitByOp = splitByOp.slice(statsOperation.length);
              }
            }
          }
        } else {
          break;
        }
      }
      while (comments.length > 0) {
        const comment = comments.shift();
        if (comment) {
          operationList.push({
            id: "comment",
            params: [comment.value],
          });
        }
      }
      lastOpWasOperator = false;
    }
  }
  return operationList;
}

export const parseExprToVisualQuery = (expr: string, defaultField = "_msg"): { query: VisualQuery, errors: string[] } => {
  const newOperations = handleExpression(expr, defaultField);
  const query: VisualQuery = {
    labels: [],
    operations: newOperations,
    expr: expr,
  };
  let errors: string[] = [];
  return { query, errors };
}
