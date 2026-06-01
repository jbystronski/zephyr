export const errLib = {
  fatal: (...msgParts: any[]) => {
    throw new Error(msgParts.join(""));
  },
};
