import { createHandlerRegistry, type JobHandler } from './handlers.js';
import { createInMemoryQueue, type QueueJob } from './queue.js';

export type WorkerStatus = 'ready' | 'running' | 'stopping' | 'stopped';

export interface JobResult {
  jobId: string;
  type: string;
  outcome: 'succeeded' | 'failed';
  error?: string;
}

export interface Worker {
  status: () => WorkerStatus;
  registerHandler: (type: string, handler: JobHandler) => void;
  enqueue: (job: QueueJob) => Promise<void>;
  processNext: () => Promise<JobResult | undefined>;
  start: () => void;
  stop: () => Promise<void>;
}

export interface WorkerOptions {
  pollIntervalMs?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createWorker(options: WorkerOptions = {}): Worker {
  const queue = createInMemoryQueue();
  const handlers = createHandlerRegistry();
  const pollIntervalMs = options.pollIntervalMs ?? 25;

  let status: WorkerStatus = 'ready';
  let stopRequested = false;
  let loopPromise: Promise<void> | undefined;

  async function processNext(): Promise<JobResult | undefined> {
    const job = await queue.dequeue();
    if (!job) return undefined;

    const handler = handlers.resolve(job.type);
    if (!handler) {
      return {
        jobId: job.id,
        type: job.type,
        outcome: 'failed',
        error: `No handler registered for job type "${job.type}".`,
      };
    }

    try {
      await handler(job.payload);
      return { jobId: job.id, type: job.type, outcome: 'succeeded' };
    } catch (error) {
      return {
        jobId: job.id,
        type: job.type,
        outcome: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error.',
      };
    }
  }

  async function loop(): Promise<void> {
    while (!stopRequested) {
      const result = await processNext();
      if (!result) await delay(pollIntervalMs);
    }
    status = 'stopped';
  }

  function start(): void {
    if (status !== 'ready') return;
    status = 'running';
    stopRequested = false;
    loopPromise = loop();
  }

  async function stop(): Promise<void> {
    if (status !== 'running') return;
    status = 'stopping';
    stopRequested = true;
    await loopPromise;
  }

  return {
    status: () => status,
    registerHandler: handlers.register,
    enqueue: queue.enqueue,
    processNext,
    start,
    stop,
  };
}
