// import { StepDef } from "./types.js";
//
// export function buildLevels(steps: StepDef<any>[]): StepDef<any>[][] {
//   const remainingDeps = new Map<number, number>();
//   const dependents = new Map<number, number[]>();
//   const ready: number[] = [];
//
//   const stepByIdx = new Map(steps.map((s) => [s.idx, s]));
//
//   for (const step of steps) {
//     remainingDeps.set(step.idx, step.dependsOn.length);
//
//     if (step.dependsOn.length === 0) {
//       ready.push(step.idx);
//     }
//
//     for (const dep of step.dependsOn) {
//       if (!dependents.has(dep)) {
//         dependents.set(dep, []);
//       }
//
//       dependents.get(dep)!.push(step.idx);
//     }
//   }
//
//   const levels: StepDef<any>[][] = [];
//
//   while (ready.length > 0) {
//     const batch = ready.splice(0);
//
//     levels.push(batch.map((idx) => stepByIdx.get(idx)!));
//
//     for (const idx of batch) {
//       for (const child of dependents.get(idx) ?? []) {
//         const left = remainingDeps.get(child)! - 1;
//
//         remainingDeps.set(child, left);
//
//         if (left === 0) {
//           ready.push(child);
//         }
//       }
//     }
//   }
//
//   return levels;
// }

import { StepDef } from "./types.js";

export function buildLevels(steps: StepDef<any>[]): StepDef<any>[][] {
  const remainingDeps = new Map<number, number>();
  const dependents = new Map<number, number[]>();
  const ready: number[] = [];

  const stepByIdx = new Map(steps.map((s) => [s.idx, s]));

  // -----------------------------------
  // BUILD GRAPH
  // -----------------------------------

  for (const step of steps) {
    remainingDeps.set(step.idx, step.dependsOn.length);

    if (step.dependsOn.length === 0) {
      ready.push(step.idx);
    }

    for (const dep of step.dependsOn) {
      let arr = dependents.get(dep);

      if (!arr) {
        arr = [];
        dependents.set(dep, arr);
      }

      arr.push(step.idx);
    }
  }

  // -----------------------------------
  // TOPO WALK
  // -----------------------------------

  const levels: StepDef<any>[][] = [];

  while (ready.length > 0) {
    const batch = ready.splice(0);

    // IMPORTANT:
    // remove joins from runtime levels
    const runtimeBatch: StepDef<any>[] = [];

    for (const idx of batch) {
      const step = stepByIdx.get(idx)!;

      // prune join from runtime execution
      if (step.spec !== "__join__") {
        runtimeBatch.push(step);
      }
    }

    // only emit non-empty runtime levels
    if (runtimeBatch.length > 0) {
      levels.push(runtimeBatch);
    }

    // STILL PROCESS DEPENDENTS
    // joins still participate structurally
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
