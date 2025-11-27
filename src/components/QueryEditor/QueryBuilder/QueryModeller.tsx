import { QueryBuilderLabelFilter, QueryBuilderOperation } from "@grafana/plugin-ui";

import { VisualQuery } from "../../../types";

import { OperationDefinitions, VictoriaLogsOperationId } from "./Operations";
import { QueryModeller } from './QueryModellerClass';
import { VictoriaLogsQueryOperationCategory } from './VictoriaLogsQueryOperationCategory';
import { parseOperation, parseStatsOperation } from './utils/operationParser';
import { splitByOperator, splitByUnescapedPipe, splitString } from './utils/stringSplitter';

export function createQueryModellerWithDefaultField(defaultField: string, categories: VictoriaLogsQueryOperationCategory[]) {
  const queryModeller = new QueryModeller(new OperationDefinitions(defaultField).all(), categories);
  return queryModeller;
}

export function createQueryModellerForCategories(categories: VictoriaLogsQueryOperationCategory[] = Object.values(VictoriaLogsQueryOperationCategory)) {
  const queryModeller = new QueryModeller(new OperationDefinitions().all(), categories);
  return queryModeller;
}

export const buildVisualQueryToString = (query: VisualQuery, queryModeller?: QueryModeller): string => {
  if (!queryModeller) {
    queryModeller = createQueryModellerForCategories(Object.values(VictoriaLogsQueryOperationCategory));
  }
  return queryModeller.renderQuery(query);
}

const opIsLabelFilter = (operation: QueryBuilderOperation, queryModeller: QueryModeller) => {
  const opId = operation.id;
  const params = operation.params;
  switch (opId) {
    case VictoriaLogsOperationId.Exact: // = !=
      if (params[3]) { // Exact Prefix
        return false;
      }
      return true;
    case VictoriaLogsOperationId.Regexp: // =~ !~
      if (params[2]) { // Case Insensitive
        return false;
      }
      return true;
    case VictoriaLogsOperationId.AND:
      return true;
    case VictoriaLogsOperationId.NOT:
      return true;
    default:
      return false;
  }
}

function convertOpsToLabelFilters(ops: QueryBuilderOperation[]): QueryBuilderLabelFilter[] {
  const filters: QueryBuilderLabelFilter[] = []
  let negateNextFilter = false;
  while (ops.length > 0) {
    const op = ops.shift();
    if (!op) {
      break;
    }
    const params = op.params;
    switch (op.id) {
      case VictoriaLogsOperationId.AND:
        continue;
      case VictoriaLogsOperationId.Exact:
        const negated = params[2] === true;
        const operation: string = (negated !== negateNextFilter) ? "!=" : "=";
        filters.push({
          label: params[0] as string,
          value: params[1] as string,
          op: operation,
        })
        negateNextFilter = false;
        break;
      case VictoriaLogsOperationId.NOT:
        negateNextFilter = !negateNextFilter;
        break;
      case VictoriaLogsOperationId.Regexp:
        filters.push({
          label: params[0] as string,
          value: params[1] as string,
          op: negateNextFilter ? "!~" : "=~",
        })
        negateNextFilter = false;
        break;
    }
  }
  return filters;
}

export const parseExprToVisualQuery = (expr: string, defaultField = "_msg", queryModeller?: QueryModeller, parseLabels = false): { query: VisualQuery, errors: string[] } => {
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
  let beforeFirstPipe = parseLabels;
  const labels: QueryBuilderLabelFilter[] = [];
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
    if (beforeFirstPipe && operationList.length > 0) {
      if (!operationList.some(op => !opIsLabelFilter(op, operationQueryModeller))) {
        labels.push(...convertOpsToLabelFilters(operationList))
        operationList = [];
      }
    }
    beforeFirstPipe = false;
  }
  const query: VisualQuery = {
    labels,
    operations: operationList,
    expr: expr,
  };
  let errors: string[] = [];
  return { query, errors };
}
