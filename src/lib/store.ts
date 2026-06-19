import { useSyncExternalStore } from "react";
import { getSection } from "./data";
import type { AppState, Day, Season } from "./types";

const STORAGE_KEY = "spu-scheduler:v2";

const DEFAULT_STATE: AppState = {
	completed: [],
	dtaComplete: true,
	startSeason: "AUT",
	availableDays: ["M", "Tu", "W", "Th", "F"],
	selectedCrns: [],
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
	/** Pick (or unpick) a section. Selecting a section for a course that already
	 *  has one chosen swaps it — a course occupies exactly one slot. */
	toggleSection(crn: string): void {
		setState((prev) => {
			if (prev.selectedCrns.includes(crn)) {
				return {
					...prev,
					selectedCrns: prev.selectedCrns.filter((c) => c !== crn),
				};
			}
			const courseId = getSection(crn)?.courseId;
			const kept = prev.selectedCrns.filter(
				(c) => getSection(c)?.courseId !== courseId,
			);
			return { ...prev, selectedCrns: [...kept, crn] };
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

	setStartSeason(season: Season): void {
		setState((prev) => ({ ...prev, startSeason: season }));
	},

	toggleDay(day: Day): void {
		setState((prev) => {
			const has = prev.availableDays.includes(day);
			const availableDays = has
				? prev.availableDays.filter((d) => d !== day)
				: [...prev.availableDays, day];
			return { ...prev, availableDays };
		});
	},

	clearSelection(): void {
		setState((prev) => ({ ...prev, selectedCrns: [] }));
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
