// good for workflows
export const miscLib = {
  isNil: (v: any) => v == null,
  isNumber: (v: any) => typeof v === "number",
  isString: (v: any) => typeof v === "string",
  isArray: (v: any) => Array.isArray(v),

  toNumber: (v: any) => Number(v),
  toString: (v: any) => String(v),
};
