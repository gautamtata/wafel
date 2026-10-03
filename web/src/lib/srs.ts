export type Grade = 0 | 1 | 2 | 3;

export type SrsState = { ease: number; intervalDays: number; reps: number; dueAt: Date };

const AGAIN = 0;
const HARD = 1;
const EASY = 3;

const INITIAL_EASE = 2.5;
const MIN_EASE = 1.3;
const RELEARN_MS = 10 * 60_000;
const DAY_MS = 86_400_000;

const adjustEase = (ease: number, delta: number) =>
  Math.max(MIN_EASE, Math.round((ease + delta) * 100) / 100);

const addMs = (date: Date, ms: number) => new Date(date.getTime() + ms);

function goodInterval({ reps, intervalDays, ease }: SrsState): number {
  if (reps === 0) return 1;
  if (reps === 1) return 6;
  return Math.round(intervalDays * ease);
}

export function initialState(now: Date = new Date()): SrsState {
  return { ease: INITIAL_EASE, intervalDays: 0, reps: 0, dueAt: now };
}

export function review(state: SrsState, grade: Grade, now: Date = new Date()): SrsState {
  if (grade === AGAIN) {
    return {
      ease: adjustEase(state.ease, -0.2),
      intervalDays: 0,
      reps: 0,
      dueAt: addMs(now, RELEARN_MS),
    };
  }

  const [ease, intervalDays] =
    grade === HARD
      ? [adjustEase(state.ease, -0.15), Math.max(1, Math.round(state.intervalDays * 1.2))]
      : grade === EASY
        ? [adjustEase(state.ease, 0.15), Math.round(goodInterval(state) * 1.3)]
        : [state.ease, goodInterval(state)];

  return { ease, intervalDays, reps: state.reps + 1, dueAt: addMs(now, intervalDays * DAY_MS) };
}
