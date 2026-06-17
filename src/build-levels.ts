import { StepDef } from "./types.js";

export function buildLevels(steps: StepDef[]): StepDef[][] {
  const remainingDeps = new Map<number, number>();
  const dependents = new Map<number, number[]>();
  const ready: number[] = [];

  const stepByIdx = new Map(steps.map((s) => [s.idx, s]));

  // BUILD GRAPH
  for (const step of steps) {
    remainingDeps.set(step.idx, step.deps.length);

    if (step.deps.length === 0) {
      ready.push(step.idx);
    }

    for (const dep of step.deps) {
      if (dep === undefined || dep === null) continue; // Handle undefined deps
      let arr = dependents.get(dep);
      if (!arr) {
        arr = [];
        dependents.set(dep, arr);
      }
      arr.push(step.idx);
    }
  }

  // TOPO WALK
  const levels: StepDef[][] = [];

  while (ready.length > 0) {
    const batch = ready.splice(0);

    // Collect steps for this level
    const currentLevel: StepDef[] = [];
    for (const idx of batch) {
      const step = stepByIdx.get(idx)!;
      currentLevel.push(step);
    }

    if (currentLevel.length > 0) {
      levels.push(currentLevel);
    }

    // Process dependents
    for (const idx of batch) {
      for (const child of dependents.get(idx) ?? []) {
        const left = remainingDeps.get(child)! - 1;
        remainingDeps.set(child, left);
        if (left === 0) {
          ready.push(child);
        }
      }
    }
  }

  return levels;
}
