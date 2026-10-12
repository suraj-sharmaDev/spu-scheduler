import { describe, expect, it } from "vitest";
import { getProject } from "./projects";
import {
	dueCards,
	INTERVALS,
	isDue,
	MAX_BOX,
	nextBox,
	recallCards,
} from "./recall";

const project = getProject("cpp-developer");
if (!project) throw new Error("cpp-developer missing");

describe("recallCards", () => {
	const cards = recallCards(project);

	it("uses lesson questions, with stable ids", () => {
		expect(cards[0]).toMatchObject({
			id: "l1.r0",
			taskId: "l1",
			q: "What does cout do?",
		});
	});

	it("gives older tasks one card per concept they introduce", () => {
		const s11 = cards.filter((c) => c.taskId === "s11").map((c) => c.id);
		expect(s11).toEqual(["c:testing", "c:boundary-value", "c:bug-report"]);
	});

	it("has unique ids", () => {
		expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
	});
});

describe("spacing", () => {
	it("asks new cards straight away", () => {
		expect(isDue(undefined, 0)).toBe(true);
	});

	it("waits longer the better a card is known", () => {
		expect(isDue({ box: 0, reviewedAt: 4 }, 5)).toBe(true);
		expect(isDue({ box: 1, reviewedAt: 4 }, 5)).toBe(false);
		expect(isDue({ box: 1, reviewedAt: 4 }, 6)).toBe(true);
		expect(isDue({ box: MAX_BOX, reviewedAt: 0 }, INTERVALS[MAX_BOX] - 1)).toBe(
			false,
		);
	});

	it("moves up on got it and back to the start on not yet", () => {
		expect(nextBox(undefined, true)).toBe(1);
		expect(nextBox(undefined, false)).toBe(0);
		expect(nextBox(2, true)).toBe(3);
		expect(nextBox(MAX_BOX, true)).toBe(MAX_BOX);
		expect(nextBox(3, false)).toBe(0);
	});
});

describe("dueCards", () => {
	it("only asks about sessions she has finished", () => {
		const due = dueCards(
			project,
			{ seenTaskIds: new Set(), reviews: {}, sessionsDone: 0 },
			3,
		);
		expect(due).toEqual([]);
	});

	it("puts new cards from the latest session first", () => {
		const due = dueCards(
			project,
			{
				seenTaskIds: new Set(["l1", "l2"]),
				reviews: {
					"l1.r0": { box: 1, reviewedAt: 1 },
					"l1.r1": { box: 0, reviewedAt: 1 },
					"l1.r2": { box: 1, reviewedAt: 1 },
				},
				sessionsDone: 2,
			},
			3,
		);
		expect(due.map((c) => c.id)).toEqual(["l2.r0", "l2.r1", "l2.r2"]);
	});

	it("brings missed cards back before well-known ones", () => {
		const due = dueCards(
			project,
			{
				seenTaskIds: new Set(["l1", "l2"]),
				reviews: {
					"l1.r0": { box: 1, reviewedAt: 1 },
					"l1.r1": { box: 0, reviewedAt: 2 },
					"l1.r2": { box: 1, reviewedAt: 1 },
					"l2.r0": { box: 1, reviewedAt: 2 },
					"l2.r1": { box: 1, reviewedAt: 2 },
					"l2.r2": { box: 1, reviewedAt: 2 },
				},
				sessionsDone: 3,
			},
			2,
		);
		// l1.r1 was missed (box 0, due after 1); l1.r0/r2 are due after 2.
		expect(due.map((c) => c.id)).toEqual(["l1.r1", "l1.r0"]);
	});
});
