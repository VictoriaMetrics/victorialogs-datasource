import { QueryBuilderOperation } from "@grafana/plugin-ui";

import { VisualQuery } from "../../../types";

import { OperationDefinitions } from "./Operations";
import { QueryModeller } from './QueryModellerClass';
import { VictoriaLogsQueryOperationCategory } from './VictoriaLogsQueryOperationCategory';
import { parseOperation } from './utils/operationParser';
import { splitByOperator, splitByUnescapedPipe, splitString } from './utils/stringSplitter';

export const operationDefinitions = new OperationDefinitions();

export const queryModeller = new QueryModeller(operationDefinitions.all());

export function createQueryModellerWithDefaultField(defaultField: string, categegories: VictoriaLogsQueryOperationCategory[]) {
  console.log("createQueryModeller: defaultField", defaultField);
  const queryModeller = new QueryModeller(new OperationDefinitions(defaultField).all(), categegories);
  return queryModeller;
}

export function createQueryModellerForCategories(categegories: VictoriaLogsQueryOperationCategory[] = Object.values(VictoriaLogsQueryOperationCategory)) {
  const queryModeller = new QueryModeller(operationDefinitions.all(), categegories);
  return queryModeller;
}

export const buildVisualQueryToString = (query: VisualQuery): string => {
  return queryModeller.renderQuery(query);
}

const handleExpression = (expr: string, defaultField = "_msg"): QueryBuilderOperation[] => {
  let operationList: QueryBuilderOperation[] = [];
  // first split by pipes then by operators
  let lastOpWasOperator = false;
  const fullSplitString = splitString(expr || "");
  let operationQueryModeller = queryModeller;
  if ( defaultField !== "_msg" ) {
    operationQueryModeller = createQueryModellerWithDefaultField(defaultField, Object.values(VictoriaLogsQueryOperationCategory))
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
      while (splitByOp.length > 0) {
        const parsedOperation = parseOperation(splitByOp, lastOpWasOperator, operationQueryModeller);
        if (parsedOperation) {
          operationList.push(parsedOperation.operation);
          splitByOp = splitByOp.slice(parsedOperation.length);
        } else {
          break;
        }
      }
      lastOpWasOperator = false;
    }
  }
  return operationList;
}

export const parseExprToVisualQuery = (expr: string, defaultField = "_msg"): {query: VisualQuery, errors: string[]} => {
  const newOperations = handleExpression(expr, defaultField);
  const query: VisualQuery = {
    labels: [],
    operations: newOperations,
    expr: expr,
  };
  let errors: string[] = [];
  return { query, errors };
}
