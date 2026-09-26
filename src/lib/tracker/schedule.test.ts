import { describe, expect, it } from "vitest";
import {
	type AttendanceLike,
	allWeeks,
	classifyCheckIn,
	localDate,
	nextSlot,
	openSlot,
	relativeDay,
	slotStreak,
	slotsBetween,
	slotsInWeek,
	weekStartOf,
	weekSummary,
	zonedToUtc,
} from "./schedule";

const at = (iso: string) => new Date(iso);
const MIN = 60_000;

// 2026-09-27 is a Sunday; Seattle is on PDT (UTC-7) until 2026-11-01.
const SUN_SLOT = at("2026-09-28T03:30:00Z"); // Sun 20:30 PDT

describe("timezone conversion", () => {
	it("converts Pacific wall-clock to UTC in summer and winter", () => {
		expect(zonedToUtc("2026-09-27", "20:30")).toEqual(SUN_SLOT);
		expect(zonedToUtc("2026-12-06", "20:30")).toEqual(
			at("2026-12-07T04:30:00Z"),
		);
	});

	it("handles the fall-back Sunday (2026-11-01)", () => {
		expect(zonedToUtc("2026-11-01", "20:30")).toEqual(
			at("2026-11-02T04:30:00Z"),
		);
	});

	it("handles the spring-forward Sunday (2027-03-14)", () => {
		expect(zonedToUtc("2027-03-14", "20:30")).toEqual(
			at("2027-03-15T03:30:00Z"),
		);
	});

	it("reports the local date, not the UTC date", () => {
		expect(localDate(SUN_SLOT)).toBe("2026-09-27");
	});
});

describe("slots", () => {
	it("lists the 5 weekly slots, Sun-Sat", () => {
		const week = slotsInWeek("2026-09-27");
		expect(week.map((s) => s.date)).toEqual([
			"2026-09-27",
			"2026-09-28",
			"2026-09-30",
			"2026-10-02",
			"2026-10-03",
		]);
		// Wednesday is the morning slot.
		expect(week[2].start).toEqual(at("2026-09-30T18:00:00Z"));
		expect(week[2].end.getTime() - week[2].start.getTime()).toBe(45 * MIN);
	});

	it("ignores slots before the tracker start date", () => {
		expect(slotsInWeek("2026-09-20")).toEqual([]);
		expect(
			slotsBetween(at("2026-09-20T00:00:00Z"), at("2026-09-28T00:00:00Z")),
		).toEqual([]);
	});

	it("groups weeks starting on Sunday", () => {
		expect(weekStartOf("2026-10-03")).toBe("2026-09-27");
		expect(weekStartOf("2026-10-04")).toBe("2026-10-04");
	});
});

describe("check-in window", () => {
	const start = SUN_SLOT.getTime();

	it("opens 10 minutes before the start", () => {
		expect(openSlot(new Date(start - 11 * MIN))).toBeNull();
		expect(openSlot(new Date(start - 10 * MIN))?.start).toEqual(SUN_SLOT);
	});

	it("stays open until the end, then closes", () => {
		expect(openSlot(new Date(start + 45 * MIN))?.start).toEqual(SUN_SLOT);
		expect(openSlot(new Date(start + 46 * MIN))).toBeNull();
	});

	it("is late after 10 minutes", () => {
		const slot = slotsInWeek("2026-09-27")[0];
		expect(classifyCheckIn(new Date(start - 5 * MIN), slot)).toBe("present");
		expect(classifyCheckIn(new Date(start + 10 * MIN), slot)).toBe("present");
		expect(classifyCheckIn(new Date(start + 11 * MIN), slot)).toBe("late");
	});

	it("finds the next slot when none is open", () => {
		const next = nextSlot(new Date(start + 60 * MIN));
		if (!next) throw new Error("expected a next slot");
		expect(next.date).toBe("2026-09-28");
		expect(relativeDay(next, new Date(start + 60 * MIN))).toBe("tomorrow");
	});
});

describe("weekly summary", () => {
	const week = slotsInWeek("2026-09-27");
	const rows: AttendanceLike[] = [
		{ kind: "scheduled", slotStart: week[0].start, checkedInAt: week[0].start },
		{
			kind: "scheduled",
			slotStart: week[1].start,
			checkedInAt: new Date(week[1].start.getTime() + 20 * MIN),
		},
		{
			kind: "makeup",
			slotStart: null,
			checkedInAt: at("2026-10-01T02:00:00Z"),
		},
	];

	it("classifies each slot and counts make-ups", () => {
		// Thursday evening: Wed missed, Fri/Sat upcoming.
		const s = weekSummary("2026-09-27", rows, at("2026-10-02T03:00:00Z"));
		expect(s.slots.map((x) => x.state)).toEqual([
			"present",
			"late",
			"missed",
			"upcoming",
			"upcoming",
		]);
		expect(s.makeups).toBe(1);
		expect(s.attended).toBe(3);
		expect(s.missed).toBe(1);
		expect(s.target).toBe(5);
	});

	it("marks the slot open inside its window", () => {
		const s = weekSummary(
			"2026-09-27",
			[],
			new Date(week[0].start.getTime() - 5 * MIN),
		);
		expect(s.slots[0].state).toBe("open");
	});

	it("counts the streak back to the last missed slot", () => {
		const late = [
			...rows,
			{
				kind: "scheduled" as const,
				slotStart: week[3].start,
				checkedInAt: week[3].start,
			},
		];
		// Saturday before the slot: present, late, missed, present, upcoming.
		const weeks = allWeeks(late, at("2026-10-03T20:00:00Z"));
		expect(slotStreak(weeks)).toBe(1);
		expect(slotStreak(allWeeks(rows, at("2026-09-29T12:00:00Z")))).toBe(2);
	});
});
