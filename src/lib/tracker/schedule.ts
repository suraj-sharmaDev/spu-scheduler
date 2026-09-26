/**
 * Weekly study slots and attendance rules. Everything is expressed in the
 * learner's timezone; conversions go through Intl so DST is handled without a
 * date library. Pure functions only — the server and the UI share them.
 */

export const TZ = "America/Los_Angeles";

/** 0 = Sunday … 6 = Saturday, times are local "HH:MM" (24h). */
export interface SlotDef {
	day: number;
	start: string;
	end: string;
}

export const SLOTS: readonly SlotDef[] = [
	{ day: 0, start: "20:30", end: "21:15" },
	{ day: 1, start: "21:00", end: "21:45" },
	{ day: 3, start: "11:00", end: "11:45" },
	{ day: 5, start: "21:00", end: "21:45" },
	{ day: 6, start: "21:00", end: "21:45" },
];

export const WEEKLY_TARGET = SLOTS.length;

/** Slots on local dates before this never count as missed. */
export const TRACKER_START_DATE = "2026-09-27";

/** Check-in opens this many minutes before a slot starts. */
export const EARLY_MINUTES = 10;
/** Checking in more than this many minutes after the start counts as late. */
export const LATE_AFTER_MINUTES = 10;

const MINUTE = 60_000;

export interface Slot {
	start: Date;
	end: Date;
	/** Local calendar date of the slot, "YYYY-MM-DD". */
	date: string;
}

export interface AttendanceLike {
	kind: "scheduled" | "makeup";
	slotStart: Date | null;
	checkedInAt: Date;
}

export type SlotState = "present" | "late" | "missed" | "open" | "upcoming";

// --- timezone helpers --------------------------------------------------------

const partsFormatter = new Intl.DateTimeFormat("en-US", {
	timeZone: TZ,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hourCycle: "h23",
});

function zonedParts(date: Date) {
	const out: Record<string, number> = {};
	for (const p of partsFormatter.formatToParts(date)) {
		if (p.type !== "literal") out[p.type] = Number(p.value);
	}
	return out as {
		year: number;
		month: number;
		day: number;
		hour: number;
		minute: number;
		second: number;
	};
}

/** Milliseconds the zone is ahead of UTC at the given instant. */
function offsetAt(date: Date): number {
	const p = zonedParts(date);
	const asUtc = Date.UTC(
		p.year,
		p.month - 1,
		p.day,
		p.hour,
		p.minute,
		p.second,
	);
	return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

/** Local calendar date ("YYYY-MM-DD") of an instant. */
export function localDate(date: Date): string {
	const p = zonedParts(date);
	return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The instant at which the local wall-clock reads `date` `time`. */
export function zonedToUtc(date: string, time: string): Date {
	const [y, m, d] = date.split("-").map(Number);
	const [hh, mm] = time.split(":").map(Number);
	const guess = Date.UTC(y, m - 1, d, hh, mm);
	// Two passes settle the offset even when the guess lands across a DST edge.
	let ts = guess - offsetAt(new Date(guess));
	ts = guess - offsetAt(new Date(ts));
	return new Date(ts);
}

export function addDays(date: string, days: number): string {
	const [y, m, d] = date.split("-").map(Number);
	const t = new Date(Date.UTC(y, m - 1, d + days));
	return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function weekday(date: string): number {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Local date of the Sunday that starts the week containing `date`. */
export function weekStartOf(date: string): string {
	return addDays(date, -weekday(date));
}

// --- slots --------------------------------------------------------------------

function slotsOnDate(date: string): Slot[] {
	const day = weekday(date);
	return SLOTS.filter((s) => s.day === day).map((s) => ({
		start: zonedToUtc(date, s.start),
		end: zonedToUtc(date, s.end),
		date,
	}));
}

/** Tracked slots (on/after TRACKER_START_DATE) overlapping [from, to), by start. */
export function slotsBetween(from: Date, to: Date): Slot[] {
	const out: Slot[] = [];
	const last = addDays(localDate(to), 1);
	for (let d = addDays(localDate(from), -1); d <= last; d = addDays(d, 1)) {
		if (d < TRACKER_START_DATE) continue;
		for (const slot of slotsOnDate(d)) {
			if (slot.end > from && slot.start < to) out.push(slot);
		}
	}
	return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Slots whose local date falls in the Sun–Sat week starting `weekStart`. */
export function slotsInWeek(weekStart: string): Slot[] {
	const out: Slot[] = [];
	for (let i = 0; i < 7; i++) {
		const d = addDays(weekStart, i);
		if (d >= TRACKER_START_DATE) out.push(...slotsOnDate(d));
	}
	return out;
}

/** The slot currently accepting check-ins, if any. */
export function openSlot(now: Date): Slot | null {
	const window = EARLY_MINUTES * MINUTE;
	for (const slot of slotsBetween(
		new Date(now.getTime() - 2 * 60 * MINUTE),
		new Date(now.getTime() + 2 * 60 * MINUTE),
	)) {
		if (now.getTime() >= slot.start.getTime() - window && now <= slot.end) {
			return slot;
		}
	}
	return null;
}

/** The open slot, or else the next one to start. Looks up to 8 days ahead. */
export function nextSlot(now: Date): Slot | null {
	const open = openSlot(now);
	if (open) return open;
	const upcoming = slotsBetween(
		now,
		new Date(now.getTime() + 8 * 24 * 60 * MINUTE),
	);
	return upcoming.find((s) => s.start > now) ?? null;
}

export function classifyCheckIn(
	checkedInAt: Date,
	slot: Slot,
): "present" | "late" {
	return checkedInAt.getTime() >
		slot.start.getTime() + LATE_AFTER_MINUTES * MINUTE
		? "late"
		: "present";
}

// --- summaries --------------------------------------------------------------------

function slotState(slot: Slot, rows: AttendanceLike[], now: Date): SlotState {
	const row = rows.find(
		(r) =>
			r.kind === "scheduled" && r.slotStart?.getTime() === slot.start.getTime(),
	);
	if (row) return classifyCheckIn(row.checkedInAt, slot);
	if (now > slot.end) return "missed";
	if (now.getTime() >= slot.start.getTime() - EARLY_MINUTES * MINUTE)
		return "open";
	return "upcoming";
}

export interface WeekSummary {
	weekStart: string;
	slots: { slot: Slot; state: SlotState }[];
	makeups: number;
	/** present + late + make-ups. */
	attended: number;
	missed: number;
	target: number;
}

export function weekSummary(
	weekStart: string,
	rows: AttendanceLike[],
	now: Date,
): WeekSummary {
	const slots = slotsInWeek(weekStart).map((slot) => ({
		slot,
		state: slotState(slot, rows, now),
	}));
	const weekEnd = addDays(weekStart, 7);
	const makeups = rows.filter((r) => {
		if (r.kind !== "makeup") return false;
		const d = localDate(r.checkedInAt);
		return d >= weekStart && d < weekEnd;
	}).length;
	const onTime = slots.filter(
		(s) => s.state === "present" || s.state === "late",
	).length;
	return {
		weekStart,
		slots,
		makeups,
		attended: onTime + makeups,
		missed: slots.filter((s) => s.state === "missed").length,
		target: WEEKLY_TARGET,
	};
}

/** Week summaries from the tracker start through the week containing `now`, oldest first. */
export function allWeeks(rows: AttendanceLike[], now: Date): WeekSummary[] {
	const first = weekStartOf(TRACKER_START_DATE);
	const current = weekStartOf(localDate(now));
	const out: WeekSummary[] = [];
	for (let w = first; w <= current; w = addDays(w, 7)) {
		out.push(weekSummary(w, rows, now));
	}
	return out;
}

/**
 * Consecutive scheduled slots attended, counting back from the most recent
 * finished (or already attended) slot. A missed slot ends the streak.
 */
export function slotStreak(weeks: WeekSummary[]): number {
	const states = weeks
		.flatMap((w) => w.slots.map((s) => s.state))
		.filter((s) => s !== "upcoming" && s !== "open");
	let n = 0;
	for (let i = states.length - 1; i >= 0; i--) {
		if (states[i] === "missed") break;
		n++;
	}
	return n;
}

// --- formatting --------------------------------------------------------------------

const slotFormatter = new Intl.DateTimeFormat("en-US", {
	timeZone: TZ,
	weekday: "short",
	hour: "numeric",
	minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
	timeZone: TZ,
	hour: "numeric",
	minute: "2-digit",
});

/** "Fri 9:00 PM" */
export function formatSlot(slot: Slot): string {
	return slotFormatter.format(slot.start);
}

/** "9:00 PM" */
export function formatTime(date: Date): string {
	return timeFormatter.format(date);
}

/** "today", "tomorrow", "in 3 days" relative to local dates. */
export function relativeDay(slot: Slot, now: Date): string {
	const [a, b] = [localDate(now), slot.date].map((d) => {
		const [y, m, dd] = d.split("-").map(Number);
		return Date.UTC(y, m - 1, dd);
	});
	const days = Math.round((b - a) / (24 * 60 * MINUTE));
	if (days <= 0) return "today";
	if (days === 1) return "tomorrow";
	return `in ${days} days`;
}

/** Local hour (0–23) in the learner's timezone. */
export function localHour(date: Date): number {
	return zonedParts(date).hour;
}
