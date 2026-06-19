import type { Day, Section } from "./types";

/** Weekdays in attend-order. Saturday exists in the schema but SPU rarely uses
 *  it; it's offered as a chip only if a real section needs it. */
export const WEEKDAYS: Day[] = ["M", "Tu", "W", "Th", "F"];
export const ALL_DAYS: Day[] = ["M", "Tu", "W", "Th", "F", "Sa"];

export const DAY_LABEL: Record<Day, string> = {
	M: "Mon",
	Tu: "Tue",
	W: "Wed",
	Th: "Thu",
	F: "Fri",
	Sa: "Sat",
};

/** Compact, unambiguous meeting-days string, e.g. "M W F" or "Tu Th". The raw
 *  tokens already distinguish Tue/Thu, so we keep them rather than initials. */
export function formatDays(days: Day[]): string {
	return days.length > 0 ? days.join(" ") : "—";
}

/** Does this section fit a student available only on `available`? A section
 *  fits when every one of its meeting days is a day she's free. Fully-arranged
 *  sections (no fixed days) impose no constraint and always fit. */
export function fitsDays(
	section: Section,
	available: ReadonlySet<Day>,
): boolean {
	if (section.days.length === 0) return true;
	return section.days.every((d) => available.has(d));
}

/** "9:00–11:00 AM" style label from a section, or a word for arranged ones. */
export function timeLabel(section: Section): string {
	if (section.startMin == null) return "Arranged";
	return section.timeRaw || "Arranged";
}

/** Two sections clash if they share a meeting day and their time ranges overlap.
 *  Arranged sections (no fixed time) can't clash on the clock. */
export function sectionsClash(a: Section, b: Section): boolean {
	if (a.startMin == null || b.startMin == null) return false;
	if (a.endMin == null || b.endMin == null) return false;
	const sharesDay = a.days.some((d) => b.days.includes(d));
	if (!sharesDay) return false;
	return a.startMin < b.endMin && b.startMin < a.endMin;
}

export interface SectionConflict {
	a: Section;
	b: Section;
}

/** All pairwise time clashes among sections sharing a quarter. */
export function findConflicts(sections: Section[]): SectionConflict[] {
	const conflicts: SectionConflict[] = [];
	for (let i = 0; i < sections.length; i++) {
		for (let j = i + 1; j < sections.length; j++) {
			if (sectionsClash(sections[i], sections[j])) {
				conflicts.push({ a: sections[i], b: sections[j] });
			}
		}
	}
	return conflicts;
}
