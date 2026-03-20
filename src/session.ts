import { ActionRegistry, WorkflowObserver } from "./types.js";
import { WorkflowDef } from "./workflow-composer.js";
import { executeWorkflow } from "./workflow-executor.js";
import { createModule } from "./workflow-module.js";

type ModuleFlows<Reg extends ActionRegistry> = Record<
  string,
  WorkflowDef<Reg, any, any>
>;

export class WorkflowSession<
  Reg extends ActionRegistry,
  State extends Record<string, any>,
> {
  private subscribers = new Set<(state: Partial<State>) => void>();
  private running = false;
  private queue: Array<{ key: keyof ModuleFlows<Reg>; input: any }> = [];
  public state: State; // session state & workflow context are the same object
  public observers: WorkflowObserver[] = [];
  private moduleFlows: ModuleFlows<Reg>;

  /**
   * @param baseModule Module to extend (inherits workflows)
   * @param registry Action registry
   * @param initialContext Initial context (session state) — will be mutated in workflows
   */
  constructor(
    baseModule: ModuleFlows<Reg>,
    private registry: Reg,
    initialContext: State,
    observers: WorkflowObserver[],
  ) {
    // Use the same object for session state and module context
    this.state = initialContext;
    this.observers = observers;

    // Per-session module: inherits workflows, shares the same state/context object
    this.moduleFlows = createModule({
      registry: this.registry,
      context: this.state,
      use: [baseModule],
      define: () => ({}), // no new flows needed
    });
  }

  getState() {
    return this.state;
  }

  subscribe(fn: (state: Partial<State>) => void) {
    this.subscribers.add(fn);
    fn(this.state); // immediately notify
    return () => this.subscribers.delete(fn);
  }

  private notify() {
    for (const fn of this.subscribers) fn(this.state);
  }

  /** Queue a workflow execution by key and input; state/context is automatically updated */
  dispatch(key: keyof ModuleFlows<Reg>, input: any = {}) {
    this.queue.push({ key, input });
    if (!this.running) this.processQueue();
  }

  private async processQueue() {
    this.running = true;

    while (this.queue.length) {
      const { key, input } = this.queue.shift()!;
      const workflow = this.moduleFlows[key];

      if (!workflow) throw new Error(`Workflow ${String(key)} not found`);

      // state/context already lives on the module; no need to pass a separate context
      await executeWorkflow(workflow, this.registry, input, this.observers);

      // Notify subscribers after workflow mutates state
      this.notify();
    }

    this.running = false;
  }
}
