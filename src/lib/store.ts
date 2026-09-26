import { useSyncExternalStore } from "react";
import type { AppState, Day, EntryType, Season } from "./types";

const STORAGE_KEY = "spu-scheduler:v3";

const DEFAULT_STATE: AppState = {
	// Our user is a DTA transfer; that pathway seeds her suggestions by default.
	entryType: "transfer",
	completed: [],
	dtaComplete: true,
	startSeason: "AUT",
	availableDays: ["M", "Tu", "W", "Th", "F"],
	placements: {},
	sectionChoices: {},
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

/** Remove a course id from every term, dropping any term left empty. Shared by
 *  add (which first detaches the course so it occupies exactly one term) and
 *  remove. */
function withoutCourse(
	placements: Record<string, string[]>,
	courseId: string,
): Record<string, string[]> {
	const next: Record<string, string[]> = {};
	for (const [key, ids] of Object.entries(placements)) {
		const kept = ids.filter((id) => id !== courseId);
		if (kept.length > 0) next[key] = kept;
	}
	return next;
}

export const actions = {
	/** Place a course in a term. A course lives in exactly one term, so this also
	 *  moves it if it was already placed elsewhere. */
	addCourse(courseId: string, termKey: string): void {
		setState((prev) => {
			const placements = withoutCourse(prev.placements, courseId);
			placements[termKey] = [...(placements[termKey] ?? []), courseId];
			return { ...prev, placements };
		});
	},

	/** Drop a course from the plan and forget any section override for it. */
	removeCourse(courseId: string): void {
		setState((prev) => {
			const { [courseId]: _dropped, ...sectionChoices } = prev.sectionChoices;
			return {
				...prev,
				placements: withoutCourse(prev.placements, courseId),
				sectionChoices,
			};
		});
	},

	/** Replace the whole plan — used to seed a suggested pathway. */
	setPlacements(placements: Record<string, string[]>): void {
		setState((prev) => ({ ...prev, placements, sectionChoices: {} }));
	},

	/** Pin a specific section (CRN) for a course in the published year. */
	chooseSection(courseId: string, crn: string): void {
		setState((prev) => ({
			...prev,
			sectionChoices: { ...prev.sectionChoices, [courseId]: crn },
		}));
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

	setEntryType(entryType: EntryType): void {
		setState((prev) => ({ ...prev, entryType }));
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

	clearPlan(): void {
		setState((prev) => ({ ...prev, placements: {}, sectionChoices: {} }));
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
