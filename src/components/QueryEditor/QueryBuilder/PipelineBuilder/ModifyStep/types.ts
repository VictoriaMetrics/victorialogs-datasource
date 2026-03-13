export const MODIFY_TYPE = {
  Rename: 'rename',
  Delete: 'delete',
  Copy: 'copy',
  Keep: 'keep',
  Replace: 'replace',
  ReplaceRegexp: 'replace_regexp',
  Extract: 'extract',
  ExtractRegexp: 'extract_regexp',
  Format: 'format',
  PackJson: 'pack_json',
  PackLogfmt: 'pack_logfmt',
  UnpackJson: 'unpack_json',
  UnpackLogfmt: 'unpack_logfmt',
  DropEmptyFields: 'drop_empty_fields',
} as const;

export type ModifyType = (typeof MODIFY_TYPE)[keyof typeof MODIFY_TYPE];

export interface FieldPair {
  src: string;
  dst: string;
}

export interface ModifyRow {
  id: string;
  modifyType: ModifyType;
  fieldPairs?: FieldPair[];
  fieldList?: string[];
  oldValue?: string;
  newValue?: string;
  atField?: string;
  limit?: string;
  pattern?: string;
  fromField?: string;
  formatString?: string;
  resultField?: string;
  resultPrefix?: string;
  keepOriginalFields?: boolean;
  skipEmptyResults?: boolean;
  ifFilter?: string;
}

let modifyRowIdCounter = 0;

export const generateModifyRowId = (): string => {
  modifyRowIdCounter += 1;
  return `modify-row-${Date.now()}-${modifyRowIdCounter}`;
};

export const createModifyRow = (modifyType: ModifyType): ModifyRow => ({
  id: generateModifyRowId(),
  modifyType,
  fieldPairs: modifyType === MODIFY_TYPE.Rename || modifyType === MODIFY_TYPE.Copy ? [{ src: '', dst: '' }] : undefined,
  fieldList: modifyType === MODIFY_TYPE.Delete || modifyType === MODIFY_TYPE.Keep ? [] : undefined,
});
