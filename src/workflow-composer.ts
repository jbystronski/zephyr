// import { ActionRegistry } from "../registry/types.js";
//
// type StepResult<
//   Reg extends ActionRegistry,
//   ActionName extends keyof Reg,
// > = Awaited<ReturnType<Reg[ActionName]>>;
//
// export type StepDef<
//   Reg extends ActionRegistry,
//   ID extends string = string,
//   ActionName extends keyof Reg = any,
// > = {
//   id: ID;
//   action: ActionName;
//   dependsOn: string[];
//   resolve: (ctx: any) => Parameters<Reg[ActionName]>[0];
//   when?: (ctx: any) => boolean;
// };
//
// export type WorkflowDef<
//   Reg extends ActionRegistry,
//   Input,
//   Results,
//   Steps extends StepDef<Reg, any, any>[] = StepDef<Reg, any, any>[],
// > = {
//   name: string;
//   steps: Steps;
//   entrySteps: StepDef<Reg>[];
//   endSteps: StepDef<Reg>[];
//   input: Input;
//   results: Results;
// };
//
// type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
//   k: infer I,
// ) => void
//   ? I
//   : never;
//
// export class WorkflowBuilder<
//   Reg extends ActionRegistry,
//   Input = unknown,
//   Steps extends StepDef<Reg, any, any>[] = [],
//   Results = {},
// > {
//   private steps: StepDef<Reg, any, any>[] = [];
//   private frontier: string[] = [];
//
//   constructor(
//     private name: string,
//     private registry: Reg,
//   ) {}
//
//   /* ------------------------------------------------ */
//   /* Base Step                                         */
//   /* ------------------------------------------------ */
//
//   step<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//     }) => Parameters<Reg[ActionName]>[0],
//     dependsOn?: string[],
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     [...Steps, StepDef<Reg, ID, ActionName>],
//     Results & { [K in ID]: StepResult<Reg, ActionName> }
//   > {
//     const deps = dependsOn ?? [...this.frontier];
//
//     this.steps.push({
//       id,
//       action,
//       resolve,
//       dependsOn: deps,
//     });
//
//     this.frontier = [id];
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Sequential shortcut                               */
//   /* ------------------------------------------------ */
//
//   seq<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//     }) => Parameters<Reg[ActionName]>[0],
//   ) {
//     return this.step(id, action, resolve);
//   }
//
//   /* ------------------------------------------------ */
//   /* Parallel branches                                 */
//   /* ------------------------------------------------ */
//
//   parallel<Branches extends WorkflowBuilder<Reg, Input, any, any>[]>(
//     ...branches: {
//       [K in keyof Branches]: (
//         builder: WorkflowBuilder<Reg, Input, [], Results>,
//       ) => Branches[K];
//     }
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     [
//       ...Steps,
//       ...(Branches[number] extends WorkflowBuilder<Reg, any, infer S, any>
//         ? S
//         : never),
//     ],
//     Results &
//       (Branches[number] extends WorkflowBuilder<Reg, any, any, infer R>
//         ? UnionToIntersection<R>
//         : {})
//   > {
//     const parentFrontier = [...this.frontier];
//     const branchEnds: string[] = [];
//
//     branches.forEach((branch) => {
//       const b = new WorkflowBuilder<Reg, Input, [], Results>(
//         this.name,
//         this.registry,
//       );
//
//       b.frontier = parentFrontier;
//
//       branch(b);
//
//       branchEnds.push(...b.frontier);
//
//       this.steps.push(...(b as any).steps);
//     });
//
//     this.frontier = branchEnds;
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Join helper                                       */
//   /* ------------------------------------------------ */
//
//   join<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//     }) => Parameters<Reg[ActionName]>[0],
//   ) {
//     return this.step(id, action, resolve, [...this.frontier]);
//   }
//
//   /* ------------------------------------------------ */
//   /* Subflow                                           */
//   /* ------------------------------------------------ */
//
//   subflow<
//     Prefix extends string,
//     SubInput,
//     SubResults,
//     SubSteps extends StepDef<Reg, any, any>[],
//   >(
//     prefix: Prefix,
//     workflow: WorkflowDef<Reg, SubInput, SubResults, SubSteps>,
//     resolveInput: (ctx: { input: Input; results: Results }) => SubInput,
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     [...Steps, ...SubSteps],
//     Results & { [K in Prefix]: SubResults }
//   > {
//     const idMap = new Map<string, string>();
//
//     workflow.steps.forEach((step) => {
//       idMap.set(step.id, `${prefix}.${step.id}`);
//     });
//
//     workflow.steps.forEach((step) => {
//       const newStep = {
//         ...step,
//
//         id: idMap.get(step.id)!,
//
//         dependsOn: step.dependsOn.map((d) => idMap.get(d)!),
//
//         resolve: (ctx: any) => {
//           const subInput = resolveInput(ctx);
//
//           return step.resolve({
//             input: subInput,
//             results: ctx.results,
//           });
//         },
//       };
//
//       if (workflow.entrySteps.find((e) => e.id === step.id)) {
//         newStep.dependsOn = [...this.frontier];
//       }
//
//       this.steps.push(newStep);
//     });
//
//     this.frontier = workflow.endSteps.map((e) => idMap.get(e.id)!);
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Build                                             */
//   /* ------------------------------------------------ */
//
//   build(): WorkflowDef<Reg, Input, Results, Steps> {
//     this.validateDependencies();
//
//     return {
//       name: this.name,
//
//       steps: this.steps as Steps,
//
//       entrySteps: this.steps.filter((s) => s.dependsOn.length === 0),
//
//       endSteps: this.getEndSteps(),
//
//       input: {} as Input,
//
//       results: {} as Results,
//     };
//   }
//
//   /* ------------------------------------------------ */
//
//   private validateDependencies() {
//     const stepIds = new Set(this.steps.map((s) => s.id));
//
//     for (const step of this.steps) {
//       for (const dep of step.dependsOn) {
//         if (!stepIds.has(dep)) {
//           throw new Error(`Step ${step.id} depends on unknown step ${dep}`);
//         }
//       }
//     }
//   }
//
//   private getEndSteps() {
//     const hasDependents = new Set<string>();
//
//     for (const step of this.steps) {
//       for (const dep of step.dependsOn) {
//         hasDependents.add(dep);
//       }
//     }
//
//     return this.steps.filter((s) => !hasDependents.has(s.id));
//   }
// }
//
// // export function createWorkflow<Reg extends ActionRegistry, Input = unknown>(
// //   registry: Reg,
// // ) {
// //   return (name: string) => new WorkflowBuilder<Reg, Input>(name, registry);
// // }
//
// export function createWorkflow<Reg extends ActionRegistry>(registry: Reg) {
//   return function workflow<Input = unknown>(name: string) {
//     return new WorkflowBuilder<Reg, Input>(name, registry);
//   };
// }
//
//////////////////////////////////////////////////////////////
// import { ActionRegistry } from "./types.js";
//
// type StepResult<
//   Reg extends ActionRegistry,
//   ActionName extends keyof Reg,
// > = Awaited<ReturnType<Reg[ActionName]>>;
//
// export type StepDef<
//   Reg extends ActionRegistry,
//   ID extends string = string,
//   ActionName extends keyof Reg = any,
// > = {
//   id: ID;
//   action: ActionName;
//   dependsOn: string[];
//   resolve: (ctx: any) => Parameters<Reg[ActionName]>[0];
//   when?: (ctx: any) => boolean;
// };
//
// export type WorkflowDef<
//   Reg extends ActionRegistry,
//   Input,
//   Results,
//   Steps extends StepDef<Reg, any, any>[] = StepDef<Reg, any, any>[],
//   Output = undefined,
// > = {
//   name: string;
//   steps: Steps;
//   entrySteps: StepDef<Reg>[];
//   endSteps: StepDef<Reg>[];
//   input: Input;
//   results: Results;
//   outputResolver?: (ctx: any) => Output;
// };
//
// type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
//   k: infer I,
// ) => void
//   ? I
//   : never;
//
// export class WorkflowBuilder<
//   Reg extends ActionRegistry,
//   Input = unknown,
//   Steps extends StepDef<Reg, any, any>[] = [],
//   Results = {},
// > {
//   private steps: StepDef<Reg, any, any>[] = [];
//   private frontier: string[] = [];
//
//   private outputResolver?: (ctx: any) => any;
//   constructor(
//     private name: string,
//     private registry: Reg,
//   ) {}
//
//   /* ------------------------------------------------ */
//   /* Base Step                                         */
//   /* ------------------------------------------------ */
//
//   step<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//     }) => Parameters<Reg[ActionName]>[0],
//     dependsOn?: string[],
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     [...Steps, StepDef<Reg, ID, ActionName>],
//     Results & { [K in ID]: StepResult<Reg, ActionName> }
//   > {
//     const deps = dependsOn ?? [...this.frontier];
//
//     this.steps.push({
//       id,
//       action,
//       resolve,
//       dependsOn: deps,
//     });
//
//     this.frontier = [id];
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Sequential shortcut                               */
//   /* ------------------------------------------------ */
//
//   seq<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//     }) => Parameters<Reg[ActionName]>[0],
//   ) {
//     return this.step(id, action, resolve);
//   }
//
//   /* ------------------------------------------------ */
//   /* Parallel branches                                 */
//   parallel<Branches extends WorkflowBuilder<Reg, Input, any, any>[]>(
//     ...branches: {
//       [K in keyof Branches]: (
//         builder: WorkflowBuilder<Reg, Input, [], Results>,
//       ) => Branches[K];
//     }
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     [
//       ...Steps,
//       ...(Branches[number] extends WorkflowBuilder<Reg, any, infer S, any>
//         ? S
//         : never),
//     ],
//     Results &
//       (Branches[number] extends WorkflowBuilder<Reg, any, any, infer R>
//         ? UnionToIntersection<R>
//         : {})
//   > {
//     const parentFrontier = [...this.frontier];
//     const branchEnds: string[] = [];
//
//     branches.forEach((branch) => {
//       const b = new WorkflowBuilder<Reg, Input, [], Results>(
//         this.name,
//         this.registry,
//       );
//
//       b.frontier = parentFrontier;
//
//       branch(b);
//
//       branchEnds.push(...b.frontier);
//
//       this.steps.push(...(b as any).steps);
//     });
//
//     this.frontier = branchEnds;
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Join helper                                       */
//   /* ------------------------------------------------ */
//
//   join<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//     }) => Parameters<Reg[ActionName]>[0],
//   ) {
//     return this.step(id, action, resolve, [...this.frontier]);
//   }
//
//   /* ------------------------------------------------ */
//   /* Subflow                                           */
//   /* ------------------------------------------------ */
//
//   subflow<
//     Prefix extends string,
//     SubInput,
//     SubResults,
//     SubSteps extends StepDef<Reg, any, any>[],
//   >(
//     prefix: Prefix,
//     workflow: WorkflowDef<Reg, SubInput, SubResults, SubSteps>,
//     resolveInput: (ctx: { input: Input; results: Results }) => SubInput,
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     [...Steps, ...SubSteps],
//     Results & { [K in Prefix]: SubResults }
//   > {
//     const idMap = new Map<string, string>();
//
//     workflow.steps.forEach((step) => {
//       idMap.set(step.id, `${prefix}.${step.id}`);
//     });
//
//     workflow.steps.forEach((step) => {
//       const newStep = {
//         ...step,
//
//         id: idMap.get(step.id)!,
//
//         dependsOn: step.dependsOn.map((d) => idMap.get(d)!),
//
//         resolve: (ctx: any) => {
//           const subInput = resolveInput(ctx);
//
//           return step.resolve({
//             input: subInput,
//             results: ctx.results,
//           });
//         },
//       };
//
//       if (workflow.entrySteps.find((e) => e.id === step.id)) {
//         newStep.dependsOn = [...this.frontier];
//       }
//
//       this.steps.push(newStep);
//     });
//
//     this.frontier = workflow.endSteps.map((e) => idMap.get(e.id)!);
//
//     return this as any;
//   }
//
//   output<Output>(
//     fn: (ctx: { input: Input; results: Results }) => Output,
//   ): WorkflowDef<Reg, Input, Results, Steps, Output> {
//     this.outputResolver = fn;
//     return this.build() as WorkflowDef<Reg, Input, Results, Steps, Output>;
//   }
//   /* ------------------------------------------------ */
//   /* Build                                             */
//   /* ------------------------------------------------ */
//   build(): WorkflowDef<Reg, Input, Results, Steps> {
//     this.validateDependencies();
//
//     return {
//       name: this.name,
//       steps: this.steps as Steps,
//       entrySteps: this.steps.filter((s) => s.dependsOn.length === 0),
//       endSteps: this.getEndSteps(),
//       input: {} as Input,
//       results: {} as Results,
//       outputResolver: this.outputResolver,
//     };
//   }
//
//   /* ------------------------------------------------ */
//
//   private validateDependencies() {
//     const stepIds = new Set(this.steps.map((s) => s.id));
//
//     for (const step of this.steps) {
//       for (const dep of step.dependsOn) {
//         if (!stepIds.has(dep)) {
//           throw new Error(`Step ${step.id} depends on unknown step ${dep}`);
//         }
//       }
//     }
//   }
//
//   private getEndSteps() {
//     const hasDependents = new Set<string>();
//
//     for (const step of this.steps) {
//       for (const dep of step.dependsOn) {
//         hasDependents.add(dep);
//       }
//     }
//
//     return this.steps.filter((s) => !hasDependents.has(s.id));
//   }
// }

// export function createWorkflow<Reg extends ActionRegistry, Input = unknown>(
//   registry: Reg,
// ) {
//   return (name: string) => new WorkflowBuilder<Reg, Input>(name, registry);
// }

// export function createWorkflow<Reg extends ActionRegistry>(registry: Reg) {
//   return function workflow<Input = unknown>(name: string) {
//     return new WorkflowBuilder<Reg, Input>(name, registry);
//   };
// }

///////////////////////////////////////////// WITH RESOURCE CTX
// import { ActionRegistry } from "./types.js";
//
// type StepResult<
//   Reg extends ActionRegistry,
//   ActionName extends keyof Reg,
// > = Awaited<ReturnType<Reg[ActionName]>>;
//
// export type StepDef<
//   Reg extends ActionRegistry,
//   ID extends string = string,
//   ActionName extends keyof Reg = any,
// > = {
//   id: ID;
//   action: ActionName;
//   dependsOn: string[];
//   resolve: (ctx: any) => Parameters<Reg[ActionName]>[0];
//   when?: (ctx: any) => boolean;
// };
//
// export type WorkflowDef<
//   Reg extends ActionRegistry,
//   Input,
//   Results,
//   Steps extends StepDef<Reg, any, any>[] = StepDef<Reg, any, any>[],
//   Output = undefined,
// > = {
//   name: string;
//   steps: Steps;
//   entrySteps: StepDef<Reg>[];
//   endSteps: StepDef<Reg>[];
//   input: Input;
//   results: Results;
//   outputResolver?: (ctx: any) => Output;
// };
//
// type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
//   k: infer I,
// ) => void
//   ? I
//   : never;
//
// export class WorkflowBuilder<
//   Reg extends ActionRegistry,
//   Input = unknown,
//   Context extends Record<string, any> = {},
//   Steps extends StepDef<Reg, any, any>[] = [],
//   Results = {},
// > {
//   private steps: StepDef<Reg, any, any>[] = [];
//   private frontier: string[] = [];
//
//   private outputResolver?: (ctx: any) => any;
//   constructor(
//     private name: string,
//     private registry: Reg,
//     private context: Context,
//   ) {}
//
//   /* ------------------------------------------------ */
//   /* Base Step                                         */
//   /* ------------------------------------------------ */
//
//   step<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//       context: Context;
//     }) => Parameters<Reg[ActionName]>[0],
//     dependsOn?: string[],
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     Context,
//     [...Steps, StepDef<Reg, ID, ActionName>],
//     Results & { [K in ID]: StepResult<Reg, ActionName> }
//   > {
//     const deps = dependsOn ?? [...this.frontier];
//
//     this.steps.push({
//       id,
//       action,
//       resolve,
//       dependsOn: deps,
//     });
//
//     this.frontier = [id];
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Sequential shortcut                               */
//   /* ------------------------------------------------ */
//
//   seq<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//       context: Context;
//     }) => Parameters<Reg[ActionName]>[0],
//   ) {
//     return this.step(id, action, resolve);
//   }
//
//   /* ------------------------------------------------ */
//   /* Parallel branches                                 */
//   parallel<Branches extends WorkflowBuilder<Reg, Input, Context, any, any>[]>(
//     ...branches: {
//       [K in keyof Branches]: (
//         builder: WorkflowBuilder<Reg, Input, Context, [], Results>,
//       ) => Branches[K];
//     }
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     Context,
//     [
//       ...Steps,
//       ...(Branches[number] extends WorkflowBuilder<Reg, any, any, infer S, any>
//         ? S
//         : never),
//     ],
//     Results &
//       (Branches[number] extends WorkflowBuilder<Reg, any, any, any, infer R>
//         ? UnionToIntersection<R>
//         : {})
//   > {
//     const parentFrontier = [...this.frontier];
//     const branchEnds: string[] = [];
//
//     branches.forEach((branch) => {
//       const b = new WorkflowBuilder<Reg, Input, Context, [], Results>(
//         this.name,
//         this.registry,
//         this.context,
//       );
//
//       b.frontier = parentFrontier;
//
//       branch(b);
//
//       branchEnds.push(...b.frontier);
//
//       this.steps.push(...(b as any).steps);
//     });
//
//     this.frontier = branchEnds;
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Join helper                                       */
//   /* ------------------------------------------------ */
//
//   join<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//     }) => Parameters<Reg[ActionName]>[0],
//   ) {
//     return this.step(id, action, resolve, [...this.frontier]);
//   }
//
//   /* ------------------------------------------------ */
//   /* Subflow                                           */
//   /* ------------------------------------------------ */
//
//   subflow<
//     Prefix extends string,
//     SubInput,
//     SubResults,
//     SubSteps extends StepDef<any, any, any>[],
//   >(
//     prefix: Prefix,
//     workflow: WorkflowDef<any, SubInput, SubResults, SubSteps>,
//     resolveInput: (ctx: {
//       input: Input;
//       results: Results;
//       context: Context;
//     }) => SubInput,
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     Context,
//     [...Steps, ...SubSteps],
//     Results & { [K in Prefix]: SubResults }
//   > {
//     const idMap = new Map<string, string>();
//
//     workflow.steps.forEach((step) => {
//       idMap.set(step.id, `${prefix}.${step.id}`);
//     });
//
//     workflow.steps.forEach((step) => {
//       const newStep = {
//         ...step,
//
//         id: idMap.get(step.id)!,
//
//         dependsOn: step.dependsOn.map((d) => idMap.get(d)!),
//
//         resolve: (ctx: any) => {
//           const subInput = resolveInput(ctx);
//
//           return step.resolve({
//             input: subInput,
//             results: ctx.results,
//             context: ctx.context,
//           });
//         },
//       };
//
//       if (workflow.entrySteps.find((e) => e.id === step.id)) {
//         newStep.dependsOn = [...this.frontier];
//       }
//
//       this.steps.push(newStep);
//     });
//
//     this.frontier = workflow.endSteps.map((e) => idMap.get(e.id)!);
//
//     return this as any;
//   }
//
//   output<Output>(
//     fn: (ctx: { input: Input; results: Results; context: Context }) => Output,
//   ): WorkflowDef<Reg, Input, Results, Steps, Output> {
//     this.outputResolver = fn;
//     return this.build() as WorkflowDef<Reg, Input, Results, Steps, Output>;
//   }
//   /* ------------------------------------------------ */
//   /* Build                                             */
//   /* ------------------------------------------------ */
//   build(): WorkflowDef<Reg, Input, Results, Steps> {
//     this.validateDependencies();
//
//     return {
//       name: this.name,
//       steps: this.steps as Steps,
//       entrySteps: this.steps.filter((s) => s.dependsOn.length === 0),
//       endSteps: this.getEndSteps(),
//       input: {} as Input,
//       results: {} as Results,
//       outputResolver: this.outputResolver,
//     };
//   }
//
//   /* ------------------------------------------------ */
//
//   private validateDependencies() {
//     const stepIds = new Set(this.steps.map((s) => s.id));
//
//     for (const step of this.steps) {
//       for (const dep of step.dependsOn) {
//         if (!stepIds.has(dep)) {
//           throw new Error(`Step ${step.id} depends on unknown step ${dep}`);
//         }
//       }
//     }
//   }
//
//   private getEndSteps() {
//     const hasDependents = new Set<string>();
//
//     for (const step of this.steps) {
//       for (const dep of step.dependsOn) {
//         hasDependents.add(dep);
//       }
//     }
//
//     return this.steps.filter((s) => !hasDependents.has(s.id));
//   }
// }
//
// export function createWorkflow<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any> = {},
// >(registry: Reg, context?: Context) {
//   return function workflow<Input = unknown>(name: string) {
//     return new WorkflowBuilder<Reg, Input, Context>(
//       name,
//       registry,
//       context || ({} as Context),
//     );
//   };
// }

// typing subflow output

// import { ActionRegistry } from "./types.js";
// type SubflowResult<SubResults, SubOutput> = SubOutput extends undefined
//   ? SubResults
//   : SubOutput;
// type StepResult<
//   Reg extends ActionRegistry,
//   ActionName extends keyof Reg,
// > = Awaited<ReturnType<Reg[ActionName]>>;
//
// export type StepDef<
//   Reg extends ActionRegistry,
//   ID extends string = string,
//   ActionName extends keyof Reg = any,
// > = {
//   id: ID;
//   action: ActionName;
//   dependsOn: string[];
//   resolve: (ctx: any) => Parameters<Reg[ActionName]>[0];
//   when?: (ctx: any) => boolean;
// };
//
// export type WorkflowDef<
//   Reg extends ActionRegistry,
//   Input,
//   Results,
//   Steps extends StepDef<Reg, any, any>[] = StepDef<Reg, any, any>[],
//   Output = undefined,
// > = {
//   name: string;
//   steps: Steps;
//   entrySteps: StepDef<Reg>[];
//   endSteps: StepDef<Reg>[];
//   input: Input;
//   results: Results;
//   outputResolver?: (ctx: any) => Output;
// };
//
// type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
//   k: infer I,
// ) => void
//   ? I
//   : never;
//
// export class WorkflowBuilder<
//   Reg extends ActionRegistry,
//   Input = unknown,
//   Context extends Record<string, any> = {},
//   Steps extends StepDef<Reg, any, any>[] = [],
//   Results = {},
//   Output = undefined,
// > {
//   private steps: StepDef<Reg, any, any>[] = [];
//   private frontier: string[] = [];
//
//   private outputResolver?: (ctx: any) => any;
//   constructor(
//     private name: string,
//     private registry: Reg,
//     private context: Context,
//   ) {}
//
//   /* ------------------------------------------------ */
//   /* Base Step                                         */
//   /* ------------------------------------------------ */
//
//   step<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//       context: Context;
//     }) => Parameters<Reg[ActionName]>[0],
//     dependsOn?: string[],
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     Context,
//     [...Steps, StepDef<Reg, ID, ActionName>],
//     Results & { [K in ID]: StepResult<Reg, ActionName> }
//   > {
//     const deps = dependsOn ?? [...this.frontier];
//
//     this.steps.push({
//       id,
//       action,
//       resolve,
//       dependsOn: deps,
//     });
//
//     this.frontier = [id];
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Sequential shortcut                               */
//   /* ------------------------------------------------ */
//
//   seq<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//       context: Context;
//     }) => Parameters<Reg[ActionName]>[0],
//   ) {
//     return this.step(id, action, resolve);
//   }
//
//   /* ------------------------------------------------ */
//   /* Parallel branches                                 */
//   parallel<Branches extends WorkflowBuilder<Reg, Input, Context, any, any>[]>(
//     ...branches: {
//       [K in keyof Branches]: (
//         builder: WorkflowBuilder<Reg, Input, Context, [], Results>,
//       ) => Branches[K];
//     }
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     Context,
//     [
//       ...Steps,
//       ...(Branches[number] extends WorkflowBuilder<Reg, any, any, infer S, any>
//         ? S
//         : never),
//     ],
//     Results &
//       (Branches[number] extends WorkflowBuilder<Reg, any, any, any, infer R>
//         ? UnionToIntersection<R>
//         : {})
//   > {
//     const parentFrontier = [...this.frontier];
//     const branchEnds: string[] = [];
//
//     branches.forEach((branch) => {
//       const b = new WorkflowBuilder<Reg, Input, Context, [], Results>(
//         this.name,
//         this.registry,
//         this.context,
//       );
//
//       b.frontier = parentFrontier;
//
//       branch(b);
//
//       branchEnds.push(...b.frontier);
//
//       this.steps.push(...(b as any).steps);
//     });
//
//     this.frontier = branchEnds;
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Join helper                                       */
//   /* ------------------------------------------------ */
//
//   join<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve: (ctx: {
//       input: Input;
//       results: Results;
//     }) => Parameters<Reg[ActionName]>[0],
//   ) {
//     return this.step(id, action, resolve, [...this.frontier]);
//   }
//
//   /* ------------------------------------------------ */
//   /* Subflow                                           */
//   /* ------------------------------------------------ */
//
//   subflow<
//     Prefix extends string,
//     SubInput,
//     SubResults,
//     SubSteps extends StepDef<Reg, any, any>[],
//     SubOutput,
//   >(
//     prefix: Prefix,
//     workflow: WorkflowDef<Reg, SubInput, SubResults, SubSteps, SubOutput>,
//     resolveInput: (ctx: {
//       input: Input;
//       results: Results;
//       context: Context;
//     }) => SubInput,
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     Context,
//     [...Steps, ...SubSteps],
//     Results & { [K in Prefix]: SubflowResult<SubResults, SubOutput> }
//   > {
//     const idMap = new Map<string, string>();
//
//     workflow.steps.forEach((step) => {
//       idMap.set(step.id, `${prefix}.${step.id}`);
//     });
//
//     workflow.steps.forEach((step) => {
//       const newStep = {
//         ...step,
//
//         id: idMap.get(step.id)!,
//
//         dependsOn: step.dependsOn.map((d) => idMap.get(d)!),
//
//         resolve: (ctx: any) => {
//           const subInput = resolveInput(ctx);
//
//           return step.resolve({
//             input: subInput,
//             results: ctx.results,
//             context: ctx.context,
//           });
//         },
//       };
//
//       if (workflow.entrySteps.find((e) => e.id === step.id)) {
//         newStep.dependsOn = [...this.frontier];
//       }
//
//       this.steps.push(newStep);
//     });
//
//     this.frontier = workflow.endSteps.map((e) => idMap.get(e.id)!);
//
//     return this as any;
//   }
//
//   output<Output>(
//     fn: (ctx: { input: Input; results: Results; context: Context }) => Output,
//   ): WorkflowDef<Reg, Input, Results, Steps, Output> {
//     this.outputResolver = fn;
//     return this.build() as WorkflowDef<Reg, Input, Results, Steps, Output>;
//   }
//   /* ------------------------------------------------ */
//   /* Build                                             */
//   /* ------------------------------------------------ */
//   build(): WorkflowDef<Reg, Input, Results, Steps> {
//     this.validateDependencies();
//
//     return {
//       name: this.name,
//       steps: this.steps as Steps,
//       entrySteps: this.steps.filter((s) => s.dependsOn.length === 0),
//       endSteps: this.getEndSteps(),
//       input: {} as Input,
//       results: {} as Results,
//       outputResolver: this.outputResolver,
//     };
//   }
//
//   /* ------------------------------------------------ */
//
//   private validateDependencies() {
//     const stepIds = new Set(this.steps.map((s) => s.id));
//
//     for (const step of this.steps) {
//       for (const dep of step.dependsOn) {
//         if (!stepIds.has(dep)) {
//           throw new Error(`Step ${step.id} depends on unknown step ${dep}`);
//         }
//       }
//     }
//   }
//
//   private getEndSteps() {
//     const hasDependents = new Set<string>();
//
//     for (const step of this.steps) {
//       for (const dep of step.dependsOn) {
//         hasDependents.add(dep);
//       }
//     }
//
//     return this.steps.filter((s) => !hasDependents.has(s.id));
//   }
// }
//
// export function createWorkflow<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any> = {},
// >(registry: Reg, context?: Context) {
//   return function workflow<Input = unknown>(name: string) {
//     return new WorkflowBuilder<Reg, Input, Context>(
//       name,
//       registry,
//       context || ({} as Context),
//     );
//   };
// }
//
//
// workflow-composer.ts

// import { ActionRegistry } from "./types.js";
//
// type SubflowResult<SubResults, SubOutput> = SubOutput extends undefined
//   ? SubResults
//   : SubOutput;
//
// type StepResult<
//   Reg extends ActionRegistry,
//   ActionName extends keyof Reg,
// > = Awaited<ReturnType<Reg[ActionName]>>;
//
// export type StepDef<
//   Reg extends ActionRegistry,
//   ID extends string = string,
//   ActionName extends keyof Reg = any,
// > = {
//   id: ID;
//   action: ActionName;
//   dependsOn: string[];
//   resolve: (ctx: any) => Parameters<Reg[ActionName]>[0];
//   when?: (ctx: any) => boolean;
// };
//
// export type WorkflowDef<
//   Reg extends ActionRegistry,
//   Input,
//   Results,
//   Steps extends StepDef<Reg, any, any>[] = StepDef<Reg, any, any>[],
//   Output = undefined,
// > = {
//   name: string;
//   steps: Steps;
//   entrySteps: StepDef<Reg>[];
//   endSteps: StepDef<Reg>[];
//   input: Input;
//   results: Results;
//   outputResolver?: (ctx: any) => Output;
// };
//
// type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
//   k: infer I,
// ) => void
//   ? I
//   : never;
//
// export class WorkflowBuilder<
//   Reg extends ActionRegistry,
//   Input = unknown,
//   Context extends Record<string, any> = {},
//   Steps extends StepDef<Reg, any, any>[] = [],
//   Results = {},
//   Output = undefined,
// > {
//   private steps: StepDef<Reg, any, any>[] = [];
//   private frontier: string[] = [];
//   private outputResolver?: (ctx: any) => any;
//
//   constructor(
//     private name: string,
//     private registry: Reg,
//     private context: Context,
//   ) {}
//
//   /* ------------------------------------------------ */
//   /* Base Step                                         */
//   /* ------------------------------------------------ */
//   step<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve?: Parameters<Reg[ActionName]>[0] extends undefined
//       ? (ctx?: {
//           input: Input;
//           results: Results;
//           context: Context;
//         }) => undefined
//       : (ctx: {
//           input: Input;
//           results: Results;
//           context: Context;
//         }) => Parameters<Reg[ActionName]>[0],
//     dependsOn?: string[],
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     Context,
//     [...Steps, StepDef<Reg, ID, ActionName>],
//     Results & { [K in ID]: StepResult<Reg, ActionName> }
//   > {
//     const deps = dependsOn ?? [...this.frontier];
//
//     this.steps.push({
//       id,
//       action,
//       resolve: resolve ?? (() => undefined as any),
//       dependsOn: deps,
//     });
//
//     this.frontier = [id];
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Sequential shortcut                               */
//   /* ------------------------------------------------ */
//   seq<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve?: Parameters<Reg[ActionName]>[0] extends undefined
//       ? (ctx?: {
//           input: Input;
//           results: Results;
//           context: Context;
//         }) => undefined
//       : (ctx: {
//           input: Input;
//           results: Results;
//           context: Context;
//         }) => Parameters<Reg[ActionName]>[0],
//   ) {
//     return this.step(id, action, resolve);
//   }
//
//   /* ------------------------------------------------ */
//   /* Parallel branches                                 */
//   parallel<Branches extends WorkflowBuilder<Reg, Input, Context, any, any>[]>(
//     ...branches: {
//       [K in keyof Branches]: (
//         builder: WorkflowBuilder<Reg, Input, Context, [], Results>,
//       ) => Branches[K];
//     }
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     Context,
//     [
//       ...Steps,
//       ...(Branches[number] extends WorkflowBuilder<Reg, any, any, infer S, any>
//         ? S
//         : never),
//     ],
//     Results &
//       (Branches[number] extends WorkflowBuilder<Reg, any, any, any, infer R>
//         ? UnionToIntersection<R>
//         : {})
//   > {
//     const parentFrontier = [...this.frontier];
//     const branchEnds: string[] = [];
//
//     branches.forEach((branch) => {
//       const b = new WorkflowBuilder<Reg, Input, Context, [], Results>(
//         this.name,
//         this.registry,
//         this.context,
//       );
//
//       b.frontier = parentFrontier;
//
//       branch(b);
//
//       branchEnds.push(...b.frontier);
//
//       this.steps.push(...(b as any).steps);
//     });
//
//     this.frontier = branchEnds;
//
//     return this as any;
//   }
//
//   /* ------------------------------------------------ */
//   /* Join helper                                       */
//   /* ------------------------------------------------ */
//   join<ID extends string, ActionName extends keyof Reg & string>(
//     id: ID,
//     action: ActionName,
//     resolve?: Parameters<Reg[ActionName]>[0] extends undefined
//       ? (ctx?: { input: Input; results: Results }) => undefined
//       : (ctx: {
//           input: Input;
//           results: Results;
//         }) => Parameters<Reg[ActionName]>[0],
//   ) {
//     return this.step(id, action, resolve, [...this.frontier]);
//   }
//
//   /* ------------------------------------------------ */
//   /* Subflow                                           */
//   /* ------------------------------------------------ */
//
//   subflow<
//     Prefix extends string,
//     SubInput,
//     SubResults,
//     SubSteps extends StepDef<Reg, any, any>[],
//     SubOutput,
//   >(
//     prefix: Prefix,
//     workflow: WorkflowDef<Reg, SubInput, SubResults, SubSteps, SubOutput>,
//     resolveInput?: (ctx: {
//       input: Input;
//       results: Results;
//       context: Context;
//     }) => [SubInput] extends [never]
//       ? any
//       : SubInput & Record<Exclude<keyof SubInput, keyof any>, never>,
//     // resolveInput: (ctx: {
//     //   input: Input;
//     //   results: Results;
//     //   context: Context;
//     // }) => SubInput,
//   ): WorkflowBuilder<
//     Reg,
//     Input,
//     Context,
//     [...Steps, ...SubSteps],
//     Results & { [K in Prefix]: SubflowResult<SubResults, SubOutput> }
//   > {
//     const idMap = new Map<string, string>();
//
//     workflow.steps.forEach((step: StepDef<Reg, any, any>) => {
//       idMap.set(step.id, `${prefix}.${step.id}`);
//     });
//
//     workflow.steps.forEach((step: StepDef<Reg, any, any>) => {
//       const newStep: StepDef<Reg, any, any> = {
//         ...step,
//         id: idMap.get(step.id)!,
//         dependsOn: step.dependsOn.map((d: string) => idMap.get(d)!),
//         resolve: (ctx: any) => {
//           const subInput = resolveInput ? resolveInput(ctx) : undefined;
//           // const subInput = resolveInput(ctx);
//           return step.resolve({
//             input: subInput,
//             results: ctx.results,
//             context: ctx.context,
//           });
//         },
//       };
//
//       if (workflow.entrySteps.find((e) => e.id === step.id)) {
//         newStep.dependsOn = [...this.frontier];
//       }
//
//       this.steps.push(newStep);
//     });
//
//     this.frontier = workflow.endSteps.map(
//       (e: StepDef<Reg, any, any>) => idMap.get(e.id)!,
//     );
//
//     return this as any;
//   }
//
//   output<Output>(
//     fn: (ctx: { input: Input; results: Results; context: Context }) => Output,
//   ): WorkflowDef<Reg, Input, Results, Steps, Output> {
//     this.outputResolver = fn;
//     return this.build() as WorkflowDef<Reg, Input, Results, Steps, Output>;
//   }
//
//   build(): WorkflowDef<Reg, Input, Results, Steps> {
//     this.validateDependencies();
//
//     return {
//       name: this.name,
//       steps: this.steps as Steps,
//       entrySteps: this.steps.filter((s) => s.dependsOn.length === 0),
//       endSteps: this.getEndSteps(),
//       input: {} as Input,
//       results: {} as Results,
//       outputResolver: this.outputResolver,
//     };
//   }
//
//   private validateDependencies() {
//     const stepIds = new Set(this.steps.map((s) => s.id));
//     for (const step of this.steps) {
//       for (const dep of step.dependsOn) {
//         if (!stepIds.has(dep)) {
//           throw new Error(`Step ${step.id} depends on unknown step ${dep}`);
//         }
//       }
//     }
//   }
//
//   private getEndSteps() {
//     const hasDependents = new Set<string>();
//     for (const step of this.steps) {
//       for (const dep of step.dependsOn) {
//         hasDependents.add(dep);
//       }
//     }
//     return this.steps.filter((s) => !hasDependents.has(s.id));
//   }
// }
//
// export function createWorkflow<
//   Reg extends ActionRegistry,
//   Context extends Record<string, any> = {},
// >(registry: Reg, context?: Context) {
//   return function workflow<Input = unknown>(name: string) {
//     return new WorkflowBuilder<Reg, Input, Context>(
//       name,
//       registry,
//       context || ({} as Context),
//     );
//   };
// }
//
import { ActionRegistry, ActionParams, ActionReturn } from "./types.js";

type SubflowResult<SubResults, SubOutput> = SubOutput extends undefined
  ? SubResults
  : SubOutput;

type StepResult<
  Reg extends ActionRegistry,
  ActionName extends keyof Reg,
> = ActionReturn<Reg, ActionName>;

export type StepDef<
  Reg extends ActionRegistry,
  ID extends string = string,
  ActionName extends keyof Reg = any,
> = {
  id: ID;
  action: ActionName;
  dependsOn: string[];
  // 👇 resolve can return any shape that matches the action's parameters
  resolve: (ctx: any) => ActionParams<Reg, ActionName>;
  when?: (ctx: any) => boolean;
};

export type WorkflowDef<
  Reg extends ActionRegistry,
  Input,
  Results,
  Steps extends StepDef<Reg, any, any>[] = StepDef<Reg, any, any>[],
  Output = undefined,
> = {
  name: string;
  steps: Steps;
  entrySteps: StepDef<Reg>[];
  endSteps: StepDef<Reg>[];
  input: Input;
  results: Results;
  outputResolver?: (ctx: any) => Output;
  __context?: any;
};

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export class WorkflowBuilder<
  Reg extends ActionRegistry,
  Input = unknown,
  Context extends Record<string, any> = {},
  Steps extends StepDef<Reg, any, any>[] = [],
  Results = {},
  Output = undefined,
> {
  private steps: StepDef<Reg, any, any>[] = [];
  private frontier: string[] = [];
  private outputResolver?: (ctx: any) => any;

  constructor(
    private name: string,
    private registry: Reg,
    private context: Context,
  ) {}

  /* ------------------------------------------------ */
  /* Base Step                                         */
  /* ------------------------------------------------ */
  step<ID extends string, ActionName extends keyof Reg & string>(
    id: ID,
    action: ActionName,
    // 👇 resolve returns whatever the action expects (tuple, object, single value, etc.)
    resolve?: ActionParams<Reg, ActionName> extends []
      ? (ctx?: {
          input: Input;
          results: Results;
          context: Context;
        }) => undefined
      : (ctx: {
          input: Input;
          results: Results;
          context: Context;
        }) => ActionParams<Reg, ActionName>,
    dependsOn?: string[],
  ): WorkflowBuilder<
    Reg,
    Input,
    Context,
    [...Steps, StepDef<Reg, ID, ActionName>],
    Results & { [K in ID]: StepResult<Reg, ActionName> }
  > {
    const deps = dependsOn ?? [...this.frontier];

    this.steps.push({
      id,
      action,
      resolve: (resolve ?? (() => undefined)) as any,
      dependsOn: deps,
    });

    this.frontier = [id];

    return this as any;
  }

  /* ------------------------------------------------ */
  /* Sequential shortcut                               */
  /* ------------------------------------------------ */
  seq<ID extends string, ActionName extends keyof Reg & string>(
    id: ID,
    action: ActionName,
    resolve?: ActionParams<Reg, ActionName> extends []
      ? (ctx?: {
          input: Input;
          results: Results;
          context: Context;
        }) => undefined
      : (ctx: {
          input: Input;
          results: Results;
          context: Context;
        }) => ActionParams<Reg, ActionName>,
  ) {
    return this.step(id, action, resolve);
  }

  /* ------------------------------------------------ */
  /* Parallel branches                                 */
  parallel<Branches extends WorkflowBuilder<Reg, Input, Context, any, any>[]>(
    ...branches: {
      [K in keyof Branches]: (
        builder: WorkflowBuilder<Reg, Input, Context, [], Results>,
      ) => Branches[K];
    }
  ): WorkflowBuilder<
    Reg,
    Input,
    Context,
    [
      ...Steps,
      ...(Branches[number] extends WorkflowBuilder<Reg, any, any, infer S, any>
        ? S
        : never),
    ],
    Results &
      (Branches[number] extends WorkflowBuilder<Reg, any, any, any, infer R>
        ? UnionToIntersection<R>
        : {})
  > {
    const parentFrontier = [...this.frontier];
    const branchEnds: string[] = [];

    branches.forEach((branch) => {
      const b = new WorkflowBuilder<Reg, Input, Context, [], Results>(
        this.name,
        this.registry,
        this.context,
      );

      b.frontier = parentFrontier;

      branch(b);

      branchEnds.push(...b.frontier);

      this.steps.push(...(b as any).steps);
    });

    this.frontier = branchEnds;

    return this as any;
  }

  /* ------------------------------------------------ */
  /* Join helper                                       */
  /* ------------------------------------------------ */
  join<ID extends string, ActionName extends keyof Reg & string>(
    id: ID,
    action: ActionName,
    resolve?: ActionParams<Reg, ActionName> extends []
      ? (ctx?: {
          input: Input;
          results: Results;
          context: Context;
        }) => undefined
      : (ctx: {
          input: Input;
          results: Results;
          context: Context;
        }) => ActionParams<Reg, ActionName>,
  ) {
    return this.step(id, action, resolve, [...this.frontier]);
  }

  /* ------------------------------------------------ */
  /* Subflow                                           */
  /* ------------------------------------------------ */

  subflow<
    Prefix extends string,
    SubInput,
    SubResults,
    SubSteps extends StepDef<Reg, any, any>[],
    SubOutput,
  >(
    prefix: Prefix,
    workflow: WorkflowDef<Reg, SubInput, SubResults, SubSteps, SubOutput>,
    resolveInput?: (ctx: {
      input: Input;
      results: Results;
      context: Context;
    }) => [SubInput] extends [never]
      ? any
      : SubInput & Record<Exclude<keyof SubInput, keyof any>, never>,
  ): WorkflowBuilder<
    Reg,
    Input,
    Context,
    [...Steps, ...SubSteps],
    Results & { [K in Prefix]: SubflowResult<SubResults, SubOutput> }
  > {
    const idMap = new Map<string, string>();

    workflow.steps.forEach((step: StepDef<Reg, any, any>) => {
      idMap.set(step.id, `${prefix}.${step.id}`);
    });

    workflow.steps.forEach((step: StepDef<Reg, any, any>) => {
      const newStep: StepDef<Reg, any, any> = {
        ...step,
        id: idMap.get(step.id)!,
        dependsOn: step.dependsOn.map((d: string) => idMap.get(d)!),
        resolve: (ctx: any) => {
          const subInput = resolveInput ? resolveInput(ctx) : undefined;
          return step.resolve({
            input: subInput,
            results: ctx.results,
            context: ctx.context,
          });
        },
      };

      if (workflow.entrySteps.find((e) => e.id === step.id)) {
        newStep.dependsOn = [...this.frontier];
      }

      this.steps.push(newStep);
    });

    this.frontier = workflow.endSteps.map(
      (e: StepDef<Reg, any, any>) => idMap.get(e.id)!,
    );

    return this as any;
  }

  when(
    predicate: (ctx: {
      input: Input;
      results: Results;
      context: Context;
    }) => boolean,
  ): this {
    const lastStep = this.steps[this.steps.length - 1];
    if (!lastStep) {
      throw new Error("when() must follow a step");
    }
    lastStep.when = predicate;
    return this;
  }

  output<Output>(
    fn: (ctx: { input: Input; results: Results; context: Context }) => Output,
  ): WorkflowDef<Reg, Input, Results, Steps, Output> {
    this.outputResolver = fn;
    return this.build() as WorkflowDef<Reg, Input, Results, Steps, Output>;
  }

  build(): WorkflowDef<Reg, Input, Results, Steps> {
    this.validateDependencies();

    return {
      name: this.name,
      steps: this.steps as Steps,
      entrySteps: this.steps.filter((s) => s.dependsOn.length === 0),
      endSteps: this.getEndSteps(),
      input: {} as Input,
      results: {} as Results,
      outputResolver: this.outputResolver,
      __context: this.context,
    };
  }

  private validateDependencies() {
    const stepIds = new Set(this.steps.map((s) => s.id));
    for (const step of this.steps) {
      for (const dep of step.dependsOn) {
        if (!stepIds.has(dep)) {
          throw new Error(`Step ${step.id} depends on unknown step ${dep}`);
        }
      }
    }
  }

  private getEndSteps() {
    const hasDependents = new Set<string>();
    for (const step of this.steps) {
      for (const dep of step.dependsOn) {
        hasDependents.add(dep);
      }
    }
    return this.steps.filter((s) => !hasDependents.has(s.id));
  }
}

export function createWorkflow<
  Reg extends ActionRegistry,
  Context extends Record<string, any> = {},
>(registry: Reg, context?: Context) {
  return function workflow<Input = unknown>(name: string) {
    return new WorkflowBuilder<Reg, Input, Context>(
      name,
      registry,
      context || ({} as Context),
    );
  };
}
