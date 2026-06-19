import { useSyncExternalStore } from "react";
import { termKey } from "./quarters";
import type { AppState, Term } from "./types";

const STORAGE_KEY = "spu-scheduler:v1";

const DEFAULT_STATE: AppState = {
	completed: [],
	dtaComplete: true,
	startTerm: { season: "AUT", year: 2026 },
	horizon: 8,
	plan: {},
};

// --- module-level store -----------------------------------------------------

let state: AppState = DEFAULT_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate(): void {
	if (hydrated || typeof window === "undefined") return;
	hydrated = true;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as Partial<AppState>;
			state = { ...DEFAULT_STATE, ...parsed };
		}
	} catch {
		// Corrupt or unavailable storage — fall back to defaults.
	}
}

function persist(): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Ignore quota / private-mode errors.
	}
}

function emit(): void {
	for (const listener of listeners) listener();
}

function setState(update: (prev: AppState) => AppState): void {
	state = update(state);
	persist();
	emit();
}

function subscribe(callback: () => void): () => void {
	// First subscriber (always on the client) pulls in persisted state.
	hydrate();
	listeners.add(callback);
	return () => listeners.delete(callback);
}

// --- actions ----------------------------------------------------------------

export const actions = {
	addToTerm(term: Term, courseId: string): void {
		setState((prev) => {
			const key = termKey(term);
			const current = prev.plan[key] ?? [];
			if (current.includes(courseId)) return prev;
			// A course lives in exactly one term — move it if already placed.
			const plan: AppState["plan"] = {};
			for (const [k, ids] of Object.entries(prev.plan)) {
				const filtered = ids.filter((id) => id !== courseId);
				if (filtered.length > 0) plan[k] = filtered;
			}
			plan[key] = [...(plan[key] ?? []), courseId];
			return { ...prev, plan };
		});
	},

	removeFromTerm(term: Term, courseId: string): void {
		setState((prev) => {
			const key = termKey(term);
			const filtered = (prev.plan[key] ?? []).filter((id) => id !== courseId);
			const plan = { ...prev.plan };
			if (filtered.length > 0) plan[key] = filtered;
			else delete plan[key];
			return { ...prev, plan };
		});
	},

	toggleCompleted(courseId: string): void {
		setState((prev) => {
			const set = new Set(prev.completed);
			if (set.has(courseId)) set.delete(courseId);
			else set.add(courseId);
			return { ...prev, completed: [...set] };
		});
	},

	setCompleted(ids: string[]): void {
		setState((prev) => ({ ...prev, completed: [...new Set(ids)] }));
	},

	setDtaComplete(value: boolean): void {
		setState((prev) => ({ ...prev, dtaComplete: value }));
	},

	setStartTerm(term: Term): void {
		setState((prev) => ({ ...prev, startTerm: term }));
	},

	setHorizon(horizon: number): void {
		setState((prev) => ({ ...prev, horizon }));
	},

	clearPlan(): void {
		setState((prev) => ({ ...prev, plan: {} }));
	},

	resetAll(): void {
		setState(() => DEFAULT_STATE);
	},
};

// --- hooks ------------------------------------------------------------------

export function useAppState(): AppState {
	return useSyncExternalStore(
		subscribe,
		() => state,
		() => DEFAULT_STATE,
	);
}

/** True once the client has read localStorage; useful to avoid flashing
 *  default state as if it were saved data. */
export function useHydrated(): boolean {
	return useSyncExternalStore(
		subscribe,
		() => hydrated,
		() => false,
	);
}
