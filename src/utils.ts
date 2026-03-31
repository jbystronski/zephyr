export function generateWorkflowId(name: string) {
  // Short random + timestamp for practically unique ID
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${name}-${time}-${random}`;
}
