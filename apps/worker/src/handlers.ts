export type JobHandler<TPayload = unknown> = (payload: TPayload) => Promise<void> | void;

export interface HandlerRegistry {
  register: (type: string, handler: JobHandler) => void;
  resolve: (type: string) => JobHandler | undefined;
}

export function createHandlerRegistry(): HandlerRegistry {
  const handlers = new Map<string, JobHandler>();

  return {
    register: (type, handler) => {
      handlers.set(type, handler);
    },
    resolve: (type) => handlers.get(type),
  };
}
