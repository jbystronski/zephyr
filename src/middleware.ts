import { eventStream } from "./event-stream.js";
import { ActionRegistry, WorkflowMiddleware } from "./types.js";

export function composeMiddleware<Reg extends ActionRegistry>(
  middleware: WorkflowMiddleware<Reg>[],
  ctx: Parameters<WorkflowMiddleware<Reg>>[0],
  core: () => Promise<any>,
) {
  let index = -1;

  async function dispatch(i: number): Promise<any> {
    if (i <= index) throw new Error("next() called multiple times");
    index = i;
    const fn = middleware[i];
    if (!fn) return core();
    return fn(ctx, () => dispatch(i + 1));
  }

  return () => dispatch(0);
}

export function useLog(): WorkflowMiddleware {
  return async ({ frame, stepId }, next) => {
    eventStream.emit({
      type: "node_start",
      node: stepId,
      timestamp: frame.start,
      input: frame.input,
    });

    try {
      const res = await next();

      eventStream.emit({
        type: "node_success",
        node: stepId,
        output: frame.output,
        duration: frame.end! - frame.start,
        attempts: frame.attempts,
        timestamp: Date.now(),
      });

      return res;
    } catch (err) {
      eventStream.emit({
        type: "node_fail",
        node: stepId,
        error: frame.error,
        timestamp: Date.now(),
        attempts: frame.attempts,
      });

      throw err;
    }
  };
}

export function useMetrics(): WorkflowMiddleware {
  return async ({ stepId, extras }, next) => {
    if (!extras?.metrics) {
      extras.metrics = {};
    }

    const start = Date.now();
    try {
      const res = await next();
      extras.metrics[stepId] = {
        status: "success",
        duration: Date.now() - start,
      };
      return res;
    } catch (err) {
      extras.metrics[stepId] = {
        status: "fail",
        duration: Date.now() - start,
      };
      throw err;
    }
  };
}
