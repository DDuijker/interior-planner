/**
 * Undo/redo over immutable snapshots. Because the model uses structural
 * sharing, keeping hundreds of snapshots costs little memory.
 *
 * A transaction (e.g. dragging) updates `present` live but becomes a single
 * undo step when committed.
 */
export interface History<T> {
  past: readonly T[];
  present: T;
  future: readonly T[];
  /** Snapshot from before the open transaction, if any. */
  pending: T | null;
  limit: number;
}

export const DEFAULT_HISTORY_LIMIT = 200;

export function createHistory<T>(present: T, limit = DEFAULT_HISTORY_LIMIT): History<T> {
  if (limit < 1) throw new RangeError("History limit must be at least 1");
  return { past: [], present, future: [], pending: null, limit };
}

function trim<T>(past: readonly T[], limit: number): readonly T[] {
  return past.length > limit ? past.slice(past.length - limit) : past;
}

/** Record a new state as one step. Ignored when nothing changed. */
export function push<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  if (h.pending !== null) return { ...h, present: next };
  return { ...h, past: trim([...h.past, h.present], h.limit), present: next, future: [] };
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0;
}

export function undo<T>(h: History<T>): History<T> {
  const base = commit(h);
  const prev = base.past[base.past.length - 1];
  if (prev === undefined) return base;
  return {
    ...base,
    past: base.past.slice(0, -1),
    present: prev,
    future: [base.present, ...base.future],
  };
}

export function redo<T>(h: History<T>): History<T> {
  const base = commit(h);
  const [next, ...rest] = base.future;
  if (next === undefined) return base;
  return {
    ...base,
    past: trim([...base.past, base.present], base.limit),
    present: next,
    future: rest,
  };
}

/** Start a transaction. Nested begins are ignored. */
export function begin<T>(h: History<T>): History<T> {
  return h.pending !== null ? h : { ...h, pending: h.present };
}

/** Close the transaction as one undo step (or none if nothing changed). */
export function commit<T>(h: History<T>): History<T> {
  if (h.pending === null) return h;
  if (h.pending === h.present) return { ...h, pending: null };
  return { ...h, past: trim([...h.past, h.pending], h.limit), future: [], pending: null };
}

/** Abort the transaction and restore the state from before it. */
export function cancel<T>(h: History<T>): History<T> {
  if (h.pending === null) return h;
  return { ...h, present: h.pending, pending: null };
}

/** Replace the present without recording a step (e.g. after loading). */
export function reset<T>(h: History<T>, present: T): History<T> {
  return createHistory(present, h.limit);
}
