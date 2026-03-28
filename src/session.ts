import { ActionRegistry, WorkflowObserver } from "./types.js";
import { WorkflowDef } from "./workflow-composer.js";
import { executeWorkflow } from "./workflow-executor.js";

type ModuleFlows<Reg extends ActionRegistry> = Record<
  string,
  WorkflowDef<Reg, any, any>
>;

export class WorkflowSession<Reg extends ActionRegistry, Ctx> {
  private subscribers = new Set<(state: Partial<Ctx>) => void>();
  private running = false;
  private queue: Array<{ workflow: any; input: any }> = [];
  // public state: State; // session state & workflow context are the same object
  public observers: WorkflowObserver[] = [];

  constructor(
    public runtime: {
      run: any;
      getContext: () => Ctx;
    },
  ) {}

  subscribe(fn: (state: Partial<Ctx>) => void) {
    this.subscribers.add(fn);
    fn(this.runtime.getContext()); // immediately notify
    return () => this.subscribers.delete(fn);
  }

  private notify() {
    for (const fn of this.subscribers) fn(this.runtime.getContext());
  }

  /** Queue a workflow execution by key and input; state/context is automatically updated */
  dispatch(workflow: any, input: any) {
    this.queue.push({ workflow, input });
    if (!this.running) this.processQueue();
  }

  private async processQueue() {
    this.running = true;

    while (this.queue.length) {
      const { workflow, input } = this.queue.shift()!;
      await this.runtime.run(workflow, input);

      this.notify();
    }

    this.running = false;
  }
}
