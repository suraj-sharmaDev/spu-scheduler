/**
 * The guided-session model: which steps a task's session has, and a pausable
 * timer. Pure functions; the open session itself is stored on the server.
 */
import type { Task } from "./types";

export type StepKind =
	| "read"
	| "words"
	| "research"
	| "plan"
	| "build"
	| "check";

export interface SessionStep {
	kind: StepKind;
	title: string;
	/** Suggested time, shown as a hint. */
	minutes: string;
	hint: string;
}

// Mirrors the "How to do one session" routine in the plan's Start Here guide.
const STEPS: Record<StepKind, Omit<SessionStep, "kind">> = {
	read: {
		title: "Read",
		minutes: "5 min",
		hint: "Get the whole picture before you start. What are you building, and how will you know it's done?",
	},
	words: {
		title: "Learn the words",
		minutes: "5 min",
		hint: "Read any concept you don't know yet. NEW means you're meeting it for the first time.",
	},
	research: {
		title: "Look things up",
		minutes: "5–10 min",
		hint: "Answer the questions in your own words. Short answers and links are perfect.",
	},
	plan: {
		title: "Plan",
		minutes: "5 min",
		hint: "For anything tricky, write the steps in plain English before you code. Skip this if it's simple.",
	},
	build: {
		title: "Build",
		minutes: "20–40 min",
		hint: "Work through the steps. Tick each one as you finish it. Stretch goals are only for days with extra time.",
	},
	check: {
		title: "Check",
		minutes: "5 min",
		hint: "Go through each check honestly. Tick it only when it's really true.",
	},
};

/** The steps for a task, skipping ones with nothing to show. */
export function sessionSteps(task: Task): SessionStep[] {
	const kinds: StepKind[] = ["read"];
	if (task.concepts.length > 0) kinds.push("words");
	if (task.thinkAbout.length > 0) kinds.push("research");
	kinds.push("plan", "build");
	if (task.doneWhen.length > 0) kinds.push("check");
	return kinds.map((kind) => ({ kind, ...STEPS[kind] }));
}

// --- timer --------------------------------------------------------------------

export interface TimerState {
	/** Epoch ms when the current running stretch began; null while paused. */
	runningSince: number | null;
	/** Time banked from earlier running stretches. */
	bankedMs: number;
}

export function elapsedMs(t: TimerState, now: number): number {
	return (
		t.bankedMs +
		(t.runningSince === null ? 0 : Math.max(0, now - t.runningSince))
	);
}

export function pauseTimer(t: TimerState, now: number): TimerState {
	if (t.runningSince === null) return t;
	return { runningSince: null, bankedMs: elapsedMs(t, now) };
}

export function resumeTimer(t: TimerState, now: number): TimerState {
	if (t.runningSince !== null) return t;
	return { ...t, runningSince: now };
}

/** Whole minutes for the log: at least 1 once started, capped at a day. */
export function sessionMinutes(ms: number): number {
	return Math.min(1440, Math.max(1, Math.round(ms / 60_000)));
}

/** "12:05", or "1:02:05" past an hour. */
export function formatElapsed(ms: number): string {
	const total = Math.floor(ms / 1000);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
	return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Timer state from a stored session (ISO timestamps from the server). */
export function timerOf(session: {
	runningSince: string | null;
	bankedMs: number;
}): TimerState {
	return {
		runningSince: session.runningSince
			? Date.parse(session.runningSince)
			: null,
		bankedMs: session.bankedMs,
	};
}
