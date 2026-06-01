export const extendedJsonLib = {
  oid: (
    value: string | string[],
    fallback: any = null,
  ): { $oid: string } | { $oid: string }[] => {
    if (!value || (typeof value === "string" && value.trim() === ""))
      return fallback;

    if (Array.isArray(value)) {
      if (!value.length) return [];

      return value.map((v) => ({
        $oid: v,
      }));
    }

    return { $oid: value };
  },

  numberDecimal: (value: any | any[], fallback: string | number = 0) => {
    if (Array.isArray(value)) {
      if (!value.length) return [];

      return value.map((v) => ({
        $numberDecimal: v ?? fallback,
      }));
    }

    return { $numberDecimal: value ?? fallback };
  },

  numberInt: (value: any | any[], fallback: string | number = 0) => {
    if (Array.isArray(value)) {
      if (!value.length) return [];

      return value.map((v) => ({
        $numberInt: v ?? fallback,
      }));
    }

    return { $numberInt: value ?? fallback };
  },

  numberLong: (value: any | any[], fallback: string | number = 0) => {
    if (Array.isArray(value)) {
      if (!value.length) return [];

      return value.map((v) => ({
        $numberLong: v ?? fallback,
      }));
    }

    return { $numberLong: value ?? fallback };
  },

  date: (value: any | any[], fallback?: any) => {
    if (Array.isArray(value)) {
      if (!value.length) return [];

      return value.map((v) => ({
        $date: v ?? fallback,
      }));
    }

    return { $date: value ?? fallback };
  },
};
