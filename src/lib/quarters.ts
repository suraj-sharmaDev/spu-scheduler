import type { Season, Term } from "./types";

/** Chronological order of quarters *within the flow of time*:
 *  Winter → Spring → Summer → Autumn → (next year) Winter. */
const SEASON_FLOW: Season[] = ["WIN", "SPR", "SUM", "AUT"];

export const SEASON_LABEL: Record<Season, string> = {
	AUT: "Autumn",
	WIN: "Winter",
	SPR: "Spring",
	SUM: "Summer",
};

export const SEASON_SHORT: Record<Season, string> = {
	AUT: "AUT",
	WIN: "WIN",
	SPR: "SPR",
	SUM: "SUM",
};

/** Stable string key for a term, e.g. "AUT-2026". */
export function termKey(term: Term): string {
	return `${term.season}-${term.year}`;
}

export function parseTermKey(key: string): Term {
	const [season, year] = key.split("-");
	return { season: season as Season, year: Number(year) };
}

/** A monotonically increasing index so terms sort chronologically. */
export function termIndex(term: Term): number {
	return term.year * SEASON_FLOW.length + SEASON_FLOW.indexOf(term.season);
}

export function compareTerms(a: Term, b: Term): number {
	return termIndex(a) - termIndex(b);
}

export function nextTerm(term: Term): Term {
	const i = SEASON_FLOW.indexOf(term.season);
	if (i === SEASON_FLOW.length - 1) {
		return { season: "WIN", year: term.year + 1 };
	}
	return { season: SEASON_FLOW[i + 1], year: term.year };
}

/** Generate `count` consecutive terms starting at `start` (inclusive). */
export function generateTerms(start: Term, count: number): Term[] {
	const terms: Term[] = [];
	let current = start;
	for (let i = 0; i < count; i++) {
		terms.push(current);
		current = nextTerm(current);
	}
	return terms;
}

/** Human label, e.g. "Autumn 2026". */
export function termLabel(term: Term): string {
	return `${SEASON_LABEL[term.season]} ${term.year}`;
}
