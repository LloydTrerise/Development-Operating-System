import type { RetrievedSource } from '../retrieval/retrieved-source.js';

export interface AssembledContextSource extends RetrievedSource {
  authorityLevel: number;
}

export interface AssembledContext {
  sources: AssembledContextSource[];
}
