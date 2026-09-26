import { describe, expect, it } from "vitest";
import { getProject } from "./projects";
import {
	elapsedMs,
	formatElapsed,
	pauseTimer,
	resumeTimer,
	sessionMinutes,
	sessionSteps,
	type TimerState,
	timerOf,
} from "./session";

const project = getProject("cpp-developer");
if (!project) throw new Error("cpp-developer missing");

describe("sessionSteps", () => {
	it("follows the six-step routine", () => {
		const s1 = project.tasks[0];
		expect(sessionSteps(s1).map((s) => s.kind)).toEqual([
			"read",
			"words",
			"research",
			"plan",
			"build",
			"check",
		]);
	});

	it("skips steps with nothing to show", () => {
		const bare = {
			...project.tasks[0],
			concepts: [],
			thinkAbout: [],
			doneWhen: [],
		};
		expect(sessionSteps(bare).map((s) => s.kind)).toEqual([
			"read",
			"plan",
			"build",
		]);
	});
});

describe("session timer", () => {
	it("counts only running time across pauses", () => {
		let t: TimerState = { runningSince: 0, bankedMs: 0 };
		expect(elapsedMs(t, 60_000)).toBe(60_000);
		t = pauseTimer(t, 60_000);
		expect(elapsedMs(t, 600_000)).toBe(60_000);
		t = resumeTimer(t, 600_000);
		expect(elapsedMs(t, 660_000)).toBe(120_000);
	});

	it("ignores double pause / resume", () => {
		const t = pauseTimer({ runningSince: 0, bankedMs: 0 }, 1000);
		expect(pauseTimer(t, 5000)).toBe(t);
		const r = resumeTimer(t, 2000);
		expect(resumeTimer(r, 9000)).toBe(r);
	});

	it("rounds to whole minutes, at least one", () => {
		expect(sessionMinutes(10_000)).toBe(1);
		expect(sessionMinutes(89_000)).toBe(1);
		expect(sessionMinutes(91_000)).toBe(2);
		expect(sessionMinutes(45 * 60_000)).toBe(45);
		expect(sessionMinutes(3 * 24 * 3600_000)).toBe(1440);
	});

	it("formats elapsed time", () => {
		expect(formatElapsed(5_000)).toBe("0:05");
		expect(formatElapsed(12 * 60_000 + 40_000)).toBe("12:40");
		expect(formatElapsed(3600_000 + 2 * 60_000 + 5_000)).toBe("1:02:05");
	});
});

describe("timerOf", () => {
	it("reads a running and a paused server session", () => {
		const running = timerOf({
			runningSince: "2026-09-27T04:00:00.000Z",
			bankedMs: 5000,
		});
		expect(elapsedMs(running, Date.parse("2026-09-27T04:01:00.000Z"))).toBe(
			65_000,
		);
		const paused = timerOf({ runningSince: null, bankedMs: 5000 });
		expect(elapsedMs(paused, Date.parse("2030-01-01T00:00:00.000Z"))).toBe(
			5000,
		);
	});
});
