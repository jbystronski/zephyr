export const dateLib = {
  now: () => new Date(),

  from: (input: string | number | Date) => new Date(input),
  safeFrom: (input: any): Date | null => {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  },

  toISO: (d: Date) => d.toISOString(),
  toTimestamp: (d: Date) => d.getTime(),

  convert: (
    timestampMs: number,
    to: "ms" | "seconds" | "minutes" | "hours" | "days",
  ): number => {
    switch (to) {
      case "ms":
        return timestampMs;
      case "seconds":
        return Math.floor(timestampMs / 1000);
      case "minutes":
        return Math.floor(timestampMs / (1000 * 60));
      case "hours":
        return Math.floor(timestampMs / (1000 * 60 * 60));
      case "days":
        return Math.floor(timestampMs / (1000 * 60 * 60 * 24));
      default:
        throw new Error(`Invalid conversion target: ${to}`);
    }
  },

  // Convert from any unit to milliseconds
  toMs: (
    value: number,
    from: "ms" | "seconds" | "minutes" | "hours" | "days",
  ): number => {
    switch (from) {
      case "ms":
        return value;
      case "seconds":
        return value * 1000;
      case "minutes":
        return value * 60 * 1000;
      case "hours":
        return value * 60 * 60 * 1000;
      case "days":
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Invalid conversion source: ${from}`);
    }
  },

  // Convert duration between units
  convertDuration: (
    value: number,
    from: "ms" | "seconds" | "minutes" | "hours" | "days",
    to: "ms" | "seconds" | "minutes" | "hours" | "days",
  ): number => {
    const inMs = dateLib.toMs(value, from);
    return dateLib.convert(inMs, to);
  },

  durationFromNow: (
    futureDate: Date,
    unit: "ms" | "seconds" | "minutes" | "hours" | "days",
  ): number => {
    const now = new Date();
    const diffMs = futureDate.getTime() - now.getTime();
    return dateLib.convert(diffMs, unit);
  },

  isDateExpired: (dateString: string) =>
    new Date(dateString).getTime() < Date.now(),

  add: (
    d: Date,
    opts: {
      ms?: number;
      seconds?: number;
      minutes?: number;
      hours?: number;
      days?: number;
    },
  ) => {
    let t = d.getTime();
    if (opts.ms) t += opts.ms;
    if (opts.seconds) t += opts.seconds * 1000;
    if (opts.minutes) t += opts.minutes * 60_000;
    if (opts.hours) t += opts.hours * 3_600_000;
    if (opts.days) t += opts.days * 86_400_000;
    return new Date(t);
  },

  sub: (
    d: Date,
    opts: {
      ms?: number;
      seconds?: number;
      minutes?: number;
      hours?: number;
      days?: number;
    },
  ) => {
    let t = d.getTime();
    if (opts.ms) t -= opts.ms;
    if (opts.seconds) t -= opts.seconds * 1000;
    if (opts.minutes) t -= opts.minutes * 60_000;
    if (opts.hours) t -= opts.hours * 3_600_000;
    if (opts.days) t -= opts.days * 86_400_000;
    return new Date(t);
  },

  startOfDay: (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  },

  endOfDay: (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  },

  compare: (a: Date, b: Date) => a.getTime() - b.getTime(),
  isBefore: (a: Date, b: Date) => a.getTime() < b.getTime(),
  isAfter: (a: Date, b: Date) => a.getTime() > b.getTime(),
};
