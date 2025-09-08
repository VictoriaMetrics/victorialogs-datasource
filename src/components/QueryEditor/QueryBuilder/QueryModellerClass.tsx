import { QueryBuilderLabelFilter, QueryBuilderOperation, VisualQueryModeller } from "@grafana/plugin-ui";

import { VisualQuery } from "../../../types";

import { VictoriaLogsOperationId, VictoriaQueryBuilderOperationDefinition, OperationDefinitions } from "./Operations";
import { VictoriaLogsQueryOperationCategory } from "./VictoriaLogsQueryOperationCategory";

declare abstract class VictoriaVisualQueryModeller implements VisualQueryModeller {
  innerQueryPlaceholder: string;
  constructor(operationDefinitions: VictoriaQueryBuilderOperationDefinition[], innerQueryPlaceholder?: string);
  abstract renderOperations(queryString: string, operations: QueryBuilderOperation[]): string;
  abstract renderLabels(labels: QueryBuilderLabelFilter[]): string;
  abstract renderQuery(query: VisualQuery, nested?: boolean): string;
  getOperationsForCategory(category: string): VictoriaQueryBuilderOperationDefinition[];
  getAlternativeOperations(key: string): VictoriaQueryBuilderOperationDefinition[];
  getCategories(): string[];
  getOperationDefinition(id: string): VictoriaQueryBuilderOperationDefinition | undefined;
}

export class QueryModeller implements VictoriaVisualQueryModeller {
  innerQueryPlaceholder = '<q> ';
  operationDefinitions: VictoriaQueryBuilderOperationDefinition[];
  mappedDefinitions: Record<VictoriaLogsOperationId, VictoriaQueryBuilderOperationDefinition>;
  categories: string[];
  onlyStats: boolean;
  constructor(operationDefinitions: VictoriaQueryBuilderOperationDefinition[], categories: string[] = Object.values(VictoriaLogsQueryOperationCategory)) {
    if (operationDefinitions.length === 0) {
      operationDefinitions = new OperationDefinitions().all();
    }
    this.onlyStats = categories.includes(VictoriaLogsQueryOperationCategory.Stats) && categories.length === 1;
    this.operationDefinitions = operationDefinitions.filter(op => {
      return categories.some(category => op.category === category);
    });
    this.categories = this.operationDefinitions.reduce(
      (acc, operation: VictoriaQueryBuilderOperationDefinition) => {
        if (!acc.includes(operation.category)) {
          acc.push(operation.category);
        }
        return acc;
      },
      [] as string[]
    );
    this.mappedDefinitions = this.operationDefinitions.reduce(
      (acc, operation: VictoriaQueryBuilderOperationDefinition) => {
        acc[operation.id as VictoriaLogsOperationId] = operation;
        return acc;
      },
      {} as Record<VictoriaLogsOperationId, VictoriaQueryBuilderOperationDefinition>
    );
  }

  getOperationsForCategory(category: string): VictoriaQueryBuilderOperationDefinition[] {
    return this.operationDefinitions.filter((operation: VictoriaQueryBuilderOperationDefinition) => {
      return operation.category === category;
    });
  }

  getAlternativeOperations(key: string): VictoriaQueryBuilderOperationDefinition[] {
    if (key === undefined) {
      return [];
    }
    return this.operationDefinitions.filter((operation: VictoriaQueryBuilderOperationDefinition) => {
      return operation.alternativesKey === key;
    });
  }

  getCategories(): string[] {
    return this.categories;
  }

  getOperationDefinition(id: string) {
    return this.mappedDefinitions[id as VictoriaLogsOperationId];
  }

  renderOperations(queryString: string, operations: QueryBuilderOperation[]): string {
    let opDefs = [];
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      if (operation.disabled) {
        continue;
      }
      const operationDef = this.getOperationDefinition(operation.id);
      opDefs.push(operationDef);
      if (!operationDef) {
        continue;
      }

      if (this.onlyStats) {
        if (queryString !== "") {
          queryString += ", ";
        }
        queryString += operationDef.renderer(operation, operationDef, "");
      } else if (i > 0 && checkIsFilter(opDefs[i - 1]) && checkIsFilter(operationDef)) {
        queryString += " " + operationDef.renderer(operation, operationDef, "");
      } else if (operationDef.id === VictoriaLogsOperationId.Comment) {
        queryString += operationDef.renderer(operation, operationDef, "");
      } else if (operationDef.category === VictoriaLogsQueryOperationCategory.Operators) {
        if (i > 0 && !checkIsFilter(opDefs[i - 1])) {
          queryString += " |" + operationDef.renderer(operation, operationDef, "");
        }
      } else {
        queryString = operationDef.renderer(operation, operationDef, queryString);
      }
    }
    return queryString.trim();
  }

  renderQuery(query: { operations: QueryBuilderOperation[] }, nested?: boolean): string {
    const queryString = this.renderOperations("", query.operations);
    return queryString;
  }

  renderLabels(labels: QueryBuilderLabelFilter[]): string {
    return '';
  }
}

function checkIsFilter(def: VictoriaQueryBuilderOperationDefinition | undefined): boolean {
  if (!def) {
    return false;
  }
  return def.category === VictoriaLogsQueryOperationCategory.Filters || def.category === VictoriaLogsQueryOperationCategory.Operators;
}
