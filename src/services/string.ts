export const stringLib = {
  isEmail: (str: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  },
  lower: (s: string) => s.toLowerCase(),
  upper: (s: string) => s.toUpperCase(),
  trim: (s: string) => s.trim(),
  trimWhitespace: (str: string) => str.replace(/\/+$/g, ""),

  includes: (s: string, sub: string) => s.includes(sub),
  startsWith: (s: string, sub: string) => s.startsWith(sub),
  endsWith: (s: string, sub: string) => s.endsWith(sub),

  slice: (s: string, start?: number, end?: number) => s.slice(start, end),

  replace: (s: string, search: string, value: string) =>
    s.replace(search, value),

  split: (s: string, sep: string) => s.split(sep),
  join: (arr: string[], sep: string) => arr.join(sep),

  length: (s: string) => s.length,

  toKebabCase: (str: string): string => {
    return str
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
      .replace(/^([A-Z])/, "-$1")
      .toLowerCase();
  },

  capitalize: (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  toUrl: (input: string, separator: "-" | "_" = "-"): string => {
    return input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, separator);
  },
};
