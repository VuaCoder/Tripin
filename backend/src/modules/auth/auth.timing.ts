import type { RequestContext } from './auth.types';

/** Timing only; never captures arguments, identities or credentials. */
export async function measureAuth<T>(context: RequestContext, stage: string, work: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await work();
  } finally {
    context.onTiming?.(stage, performance.now() - start);
  }
}
