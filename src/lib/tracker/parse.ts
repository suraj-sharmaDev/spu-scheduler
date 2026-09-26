/**
 * Pure helpers that turn workbook cell text into project content. Used by the
 * importer script (run by Node with type stripping, so only type imports here).
 */
import type { ChecklistItem } from "./types";

const STRETCH = /^⭐\s*(stretch:?\s*)?/i;
const NUMBERED = /^(\d+)[.)]\s+/;

/** Lowercase, dash-separated id: "Variable & type" → "variable-type". */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/\+\+/g, "pp")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function lines(cell: string): string[] {
	return cell.split(/\r?\n/);
}

/**
 * Split a "What to do" cell into intro text and checklist steps.
 * - Numbered lines ("1. …") are steps; other lines after one continue it.
 * - Unnumbered lines before the first number are intro.
 * - If nothing is numbered, every line is a step.
 * - "⭐ Stretch: …" lines become stretch steps.
 */
export function splitWhatToDo(
	cell: string,
	idPrefix: string,
): { intro: string[]; steps: ChecklistItem[] } {
	const all = lines(cell);
	const hasNumbers = all.some((l) => NUMBERED.test(l.trim()));
	const intro: string[] = [];
	const texts: { text: string; stretch: boolean }[] = [];

	for (const raw of all) {
		const line = raw.trim();
		if (!line) continue;
		if (STRETCH.test(line)) {
			texts.push({ text: line.replace(STRETCH, ""), stretch: true });
		} else if (NUMBERED.test(line)) {
			texts.push({ text: line.replace(NUMBERED, ""), stretch: false });
		} else if (!hasNumbers) {
			texts.push({ text: line, stretch: false });
		} else if (texts.length === 0) {
			intro.push(line);
		} else {
			// Text after a numbered step (indented or not) continues that step.
			texts[texts.length - 1].text += `\n${line}`;
		}
	}

	return {
		intro,
		steps: texts.map((t, i) => ({ id: `${idPrefix}.${i}`, ...t })),
	};
}

/** One checklist item per non-empty line ("Done when…"). */
export function splitChecklist(
	cell: string,
	idPrefix: string,
): ChecklistItem[] {
	return lines(cell)
		.map((l) => l.trim())
		.filter(Boolean)
		.map((text, i) => ({ id: `${idPrefix}.${i}`, text, stretch: false }));
}

/** Non-empty lines, "-" meaning none. */
export function splitLines(cell: string): string[] {
	return lines(cell)
		.map((l) => l.trim())
		.filter((l) => l && l !== "-");
}

/** "🆕 Loop" → { name: "Loop", isNew: true }. "-" or empty lines are skipped. */
export function parseConceptCell(
	cell: string,
): { name: string; isNew: boolean }[] {
	return splitLines(cell).map((line) => {
		const isNew = line.startsWith("🆕");
		return { name: line.replace(/^🆕\s*/, "").trim(), isNew };
	});
}

/** "★★☆☆" → 2. Throws on anything without 1–4 filled stars. */
export function parseLevel(cell: string): number {
	const level = [...cell].filter((c) => c === "★").length;
	if (level < 1 || level > 4) throw new Error(`Invalid level "${cell}"`);
	return level;
}

/** "-" / empty → null. */
export function orNull(text: string): string | null {
	const t = text.trim();
	return t && t !== "-" ? t : null;
}
