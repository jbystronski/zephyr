//
// import { readResult } from "./ast-compiler.js";
// import { composeObserver } from "./observer.js";
// import {
//   CompiledStep,
//   ExecutionFrame,
//   ExecutionPlan,
//   PipeMode,
//   ResultsArray,
//   StepRuntimeCtx,
//   WorkflowObserver,
// } from "./types.js";
//
// export function createExecutor(
//   plan: ExecutionPlan,
//   observers: WorkflowObserver[],
// ) {
//   if (observers.length === 0) return createFastExecutor(plan);
//   return createObservedExecutor(plan, observers);
// }
//
// function createFastExecutor(plan: ExecutionPlan) {
//   return async function executePlanFast(input: any, results: ResultsArray) {
//     const rootRt = {
//       input,
//       results,
//       observers: [],
//       frame: undefined,
//     };
//
//     for (const level of plan.levels) {
//       await Promise.all(
//         level.map(async (step) => {
//           if (!checkGuards(step.guards, rootRt)) {
//             results[step.idx] = undefined;
//             return;
//           }
//
//           const rt = {
//             ...rootRt,
//             frame: undefined,
//           };
//
//           results[step.idx] = await executeStep(step, rt);
//         }),
//       );
//     }
//
//     return results[plan.outputIndex ?? plan.exitIndexes?.[0] ?? 0];
//   };
// }
//
// function createObservedExecutor(
//   plan: ExecutionPlan,
//   observers: WorkflowObserver[],
// ) {
//   const observerFn = composeObserver(observers);
//
//   return async function executePlanObserved(
//     input: any,
//     results: ResultsArray,
//     extras: Record<string, unknown>,
//   ) {
//     const rootRt = {
//       input,
//       results,
//       observers,
//       frame: undefined,
//     };
//
//     for (const level of plan.levels) {
//       await Promise.all(
//         level.map(async (step) => {
//           const frame: ExecutionFrame = {
//             stepId: `${step.id}:${step.idx}`,
//             attempts: 0,
//             start: Date.now(),
//           };
//
//           const rt = {
//             ...rootRt,
//             frame,
//           };
//
//           if (!checkGuards(step.guards, rt)) {
//             results[step.idx] = undefined;
//             return;
//           }
//
//           const run = async () => {
//             frame.attempts++;
//
//             const value = await executeStep(step, rt);
//             results[step.idx] = value;
//
//             frame.value = value;
//             frame.end = Date.now();
//
//             return value;
//           };
//
//           try {
//             await observerFn(
//               {
//                 stepId: `${step.idx}`,
//                 input,
//                 results,
//                 extras,
//                 frame,
//               },
//               run,
//             );
//           } catch (err) {
//             frame.error = err;
//             frame.end = Date.now();
//             throw err;
//           }
//         }),
//       );
//     }
//
//     return results[plan.outputIndex ?? plan.exitIndexes?.[0] ?? 0];
//   };
// }
//
// async function runPipeWorkflow(
//   plan: ExecutionPlan,
//   input: any,
//   parentResults: ResultsArray,
//   observers: WorkflowObserver[],
// ) {
//   const results = new Array(plan.maxIndex + 1) as ResultsArray;
//
//   // IMPORTANT: preserve parent chain semantics
//   results.__parent = parentResults;
//
//   const rtBase: StepRuntimeCtx = {
//     input,
//     results,
//     observers,
//     frame: undefined,
//   };
//
//   for (const level of plan.levels) {
//     await Promise.all(
//       level.map(async (step) => {
//         if (!checkGuards(step.guards, rtBase)) {
//           results[step.idx] = undefined;
//           return;
//         }
//
//         const rt: StepRuntimeCtx = {
//           ...rtBase,
//           frame: undefined,
//         };
//
//         results[step.idx] = await executeStep(step, rt);
//       }),
//     );
//   }
//
//   return results[plan.outputIndex ?? plan.exitIndexes?.[0] ?? 0];
// }
//
// async function executeStep(step: CompiledStep, rt: StepRuntimeCtx) {
//   switch (step.spec) {
//     case "__init__": {
//       if (!step.resolve) {
//         return rt.input;
//       }
//
//       return step.resolve ? await step.resolve(rt) : undefined;
//     }
//
//     // case "__join__": {
//     //   return undefined;
//     // }
//
//     case "__pipe__": {
//       const items = step.resolve ? await step.resolve(rt) : [];
//       const list = Array.isArray(items) ? items : [];
//
//       let mode: PipeMode = step.pipe?.mode ?? "map";
//
//       switch (mode) {
//         case "map":
//           const res = await Promise.all(
//             // list.map((item, i) => runPipeItem(step, rt, item, i)),
//             list.map((item, i) =>
//               runPipeWorkflow(step.pipe?.plan!, item, rt.results, rt.observers),
//             ),
//           );
//
//           return res;
//
//         case "filter": {
//           const res = [];
//
//           for (let i = 0; i < list.length; i++) {
//             const out = await runPipeWorkflow(
//               step.pipe?.plan!,
//               list[i],
//               rt.results,
//               rt.observers,
//             );
//
//             // const out = await runPipeItem(step, rt, list[i], i);
//
//             if (out) {
//               res.push(list[i]);
//             }
//           }
//
//           return res;
//         }
//         case "find": {
//           for (let i = 0; i < list.length; i++) {
//             const out = await runPipeWorkflow(
//               step.pipe?.plan!,
//               list[i],
//               rt.results,
//               rt.observers,
//             );
//
//             // const out = await runPipeItem(step, rt, list[i], i);
//
//             if (out) {
//               return list[i];
//             }
//           }
//
//           return undefined;
//         }
//
//         case "some": {
//           for (let i = 0; i < list.length; i++) {
//             const out = await runPipeWorkflow(
//               step.pipe?.plan!,
//               list[i],
//               rt.results,
//               rt.observers,
//             );
//
//             // const out = await runPipeItem(step, rt, list[i], i);
//
//             if (out) {
//               return true;
//             }
//           }
//
//           return false;
//         }
//
//         case "every": {
//           for (let i = 0; i < list.length; i++) {
//             const out = await runPipeWorkflow(
//               step.pipe?.plan!,
//               list[i],
//               rt.results,
//               rt.observers,
//             );
//
//             // const out = await runPipeItem(step, rt, list[i], i);
//
//             if (!out) {
//               return false;
//             }
//           }
//
//           return true;
//         }
//
//         case "count": {
//           let count = 0;
//
//           for (let i = 0; i < list.length; i++) {
//             const out = await runPipeWorkflow(
//               step.pipe?.plan!,
//               list[i],
//               rt.results,
//               rt.observers,
//             );
//
//             // const out = await runPipeItem(step, rt, list[i], i);
//
//             if (out) count++;
//           }
//
//           return count;
//         }
//       }
//     }
//
//     default: {
//       return step.resolve ? await step.resolve(rt) : undefined;
//       // const out = await evalCompiled(step.resolve, rt);
//
//       // return out;
//     }
//   }
// }
//
// function checkGuards(guards: number[] | undefined, rt: StepRuntimeCtx) {
//   if (!guards?.length) {
//     return true;
//   }
//
//   for (const ref of guards) {
//     const res = readResult(rt.results, ref);
//
//     // const res = rt.results[ref];
//
//     if (res === undefined) {
//       throw new Error(`Unknown guard ref: ${ref}`);
//     }
//
//     if (res !== true) {
//       return false;
//     }
//   }
//
//   return true;
// }
//
// async function withTimeout<T>(promise: Promise<T>, ms?: number): Promise<T> {
//   if (!ms) {
//     return promise;
//   }
//
//   return Promise.race([
//     promise,
//
//     new Promise<T>((_, reject) =>
//       setTimeout(() => reject(new Error("Timeout")), ms),
//     ),
//   ]);
// }
//
// async function runWithRetry<T>(
//   fn: () => Promise<T>,
//   options?: {
//     retry?: number;
//     retryDelay?: number | ((attempt: number) => number);
//   },
// ): Promise<T> {
//   const maxRetries = options?.retry ?? 0;
//
//   let lastError: any;
//
//   for (let attempt = 0; attempt <= maxRetries; attempt++) {
//     try {
//       return await fn();
//     } catch (err) {
//       lastError = err;
//
//       if (attempt === maxRetries) {
//         break;
//       }
//
//       const delay = options?.retryDelay;
//
//       if (typeof delay === "number") {
//         await new Promise((r) => setTimeout(r, delay));
//       } else if (typeof delay === "function") {
//         await new Promise((r) => setTimeout(r, delay(attempt)));
//       }
//     }
//   }
//
//   throw lastError;
// }
//
// // export async function executePlan(
// //   plan: ExecutionPlan,
// //   input: any,
// //   results: ResultsArray,
// //   observers: WorkflowObserver[],
// // ) {
// //   const hasObservers = observers.length > 0;
// //
// //   const runWithObservers = hasObservers ? composeObserver(observers) : null;
// //
// //   const extras: Record<string, any> = {
// //     frames: {},
// //   };
// //
// //   // -----------------------------------
// //   // ROOT CONTEXT
// //   // -----------------------------------
// //
// //   const rootRt: StepRuntimeCtx = {
// //     input,
// //     results,
// //     observers,
// //     frame: undefined,
// //   };
// //
// //   // -----------------------------------
// //   // STEP SEMANTICS (THE IMPORTANT PART)
// //   // -----------------------------------
// //   // function createPipeResults(parent: ResultsArray, size: number): ResultsArray {
// //   //   const local = new Array(size) as ResultsArray;
// //   //   local.__parent = parent;
// //   //   return local;
// //   // }
// //   // function runPipeItem(
// //   //   step: CompiledStep,
// //   //   rt: StepRuntimeCtx,
// //   //   item: any,
// //   //   i: number,
// //   // ) {
// //   //   const localResults = createPipeResults(
// //   //     results,
// //   //     step.pipe!.plan.maxIndex + 1,
// //   //   );
// //   //
// //   //   // return executePlan(step.pipe?.plan!, item, [...rt.results], rt.observers);
// //   //   return executePlan(step.pipe?.plan!, item, localResults, rt.observers);
// //   // }
// //
// //   // -----------------------------------
// //   // EXECUTION LOOP
// //   // -----------------------------------
// //
// //   for (const level of plan.levels) {
// //     await Promise.all(
// //       level.map(async (step) => {
// //         const frame: ExecutionFrame | undefined = hasObservers
// //           ? {
// //               stepId: `${step.id}:${step.idx}`,
// //               attempts: 0,
// //               start: Date.now(),
// //             }
// //           : undefined;
// //
// //         const rt: StepRuntimeCtx = {
// //           ...rootRt,
// //           frame,
// //         };
// //
// //         // -----------------------------------
// //         // GUARDS
// //         // -----------------------------------
// //
// //         if (!checkGuards(step.guards, rt)) {
// //           results[step.idx] = undefined;
// //           return;
// //         }
// //
// //         if (frame) {
// //           extras.frames[step.idx] = frame;
// //         }
// //
// //         // -----------------------------------
// //         // EXECUTION WRAPPER
// //         // -----------------------------------
// //
// //         const execute = async () => {
// //           if (frame) frame.attempts++;
// //
// //           const value = await executeStep(step, rt);
// //           results[step.idx] = value;
// //
// //           if (frame) {
// //             frame.value = value;
// //             frame.end = Date.now();
// //           }
// //
// //           return value;
// //         };
// //
// //         try {
// //           await (runWithObservers
// //             ? runWithObservers(
// //                 {
// //                   stepId: `${step.idx}`,
// //                   input,
// //                   results,
// //                   extras,
// //                   frame,
// //                 },
// //                 execute,
// //               )
// //             : execute());
// //         } catch (err) {
// //           if (frame) {
// //             frame.error = err;
// //             frame.end = Date.now();
// //           }
// //           throw err;
// //         }
// //       }),
// //     );
// //   }
// //
// //   // -----------------------------------
// //   // OUTPUT
// //   // -----------------------------------
// //
// //   let output: any;
// //
// //   if (plan.outputIndex !== undefined) {
// //     output = results[plan.outputIndex];
// //   } else if (plan.exitIndexes?.length === 1) {
// //     output = results[plan.exitIndexes[0]];
// //   } else if (plan.exitIndexes?.length) {
// //     output = plan.exitIndexes.map((i) => results[i]);
// //   }
// //
// //   return output;
// // }
