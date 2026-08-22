export interface QueueJob<TPayload = unknown> {
  id: string;
  type: string;
  payload: TPayload;
}

export interface Queue {
  enqueue: (job: QueueJob) => Promise<void>;
  dequeue: () => Promise<QueueJob | undefined>;
  size: () => number;
}

export function createInMemoryQueue(): Queue {
  const jobs: QueueJob[] = [];

  return {
    enqueue: async (job) => {
      jobs.push(job);
    },
    dequeue: async () => jobs.shift(),
    size: () => jobs.length,
  };
}
