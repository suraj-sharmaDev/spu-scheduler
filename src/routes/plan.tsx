import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge, ProgressBar, SectionCard } from "#/components/ui";
import {
	degreeSections,
	getCourse,
	getSection,
	requirements,
	SCHEDULE_YEAR_LABEL,
	scheduleTerm,
} from "#/lib/data";
import {
	checkPlan,
	FULL_TIME_CREDITS,
	MAX_CREDITS,
	type PlanCheck,
	remainingRequirements,
	totalCompletedCredits,
} from "#/lib/planner";
import {
	compareTerms,
	SEASON_LABEL,
	termIndex,
	termLabel,
} from "#/lib/quarters";
import {
	DAY_LABEL,
	fitsDays,
	formatDays,
	timeLabel,
	WEEKDAYS,
} from "#/lib/schedule";
import { actions, useAppState } from "#/lib/store";
import type { Day, Season, Section } from "#/lib/types";

export const Route = createFileRoute("/plan")({ component: Planner });

const SEASONS: Season[] = ["AUT", "WIN", "SPR", "SUM"];

function loadTone(credits: number): string {
	if (credits === 0) return "text-slate-400";
	if (credits > MAX_CREDITS) return "text-red-600";
	if (credits < FULL_TIME_CREDITS) return "text-amber-600";
	return "text-green-600";
}

function Planner() {
	const { startSeason, availableDays, selectedCrns, completed } = useAppState();
	const [query, setQuery] = useState("");

	const completedSet = useMemo(() => new Set(completed), [completed]);
	const selectedSet = useMemo(() => new Set(selectedCrns), [selectedCrns]);
	const dayset = useMemo(() => new Set(availableDays), [availableDays]);

	const selectedSections = useMemo(
		() =>
			selectedCrns
				.map((crn) => getSection(crn))
				.filter((s): s is Section => Boolean(s)),
		[selectedCrns],
	);
	// Course ids that already have a section chosen (used to flag sibling rows).
	const chosenCourseIds = useMemo(
		() => new Set(selectedSections.map((s) => s.courseId)),
		[selectedSections],
	);

	const startTerm = scheduleTerm(startSeason);
	const startIdx = termIndex(startTerm);

	const q = query.trim().toLowerCase();
	const rows = useMemo(
		() =>
			degreeSections
				.filter((s) => {
					if (completedSet.has(s.courseId)) return false; // already have credit
					if (termIndex({ season: s.season, year: s.year }) < startIdx)
						return false;
					if (!fitsDays(s, dayset)) return false;
					if (q === "") return true;
					const c = getCourse(s.courseId);
					return (
						s.courseId.toLowerCase().includes(q) ||
						(c?.title.toLowerCase().includes(q) ?? false) ||
						s.instructor.toLowerCase().includes(q)
					);
				})
				.sort(
					(a, b) =>
						compareTerms(
							{ season: a.season, year: a.year },
							{ season: b.season, year: b.year },
						) || a.courseId.localeCompare(b.courseId),
				),
		[completedSet, dayset, q, startIdx],
	);

	const check = useMemo(
		() => checkPlan(selectedSections, completedSet),
		[selectedSections, completedSet],
	);

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold text-slate-900">Build your plan</h1>
					<p className="mt-1 text-sm text-slate-500">
						Pick when you start and the days you can attend, choose the classes
						you like, and we'll check the schedule works.
					</p>
				</div>
				<Badge tone="maroon">{SCHEDULE_YEAR_LABEL} schedule</Badge>
			</div>

			<CriteriaBar startSeason={startSeason} availableDays={availableDays} />

			<div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
				<CourseTable
					rows={rows}
					query={query}
					setQuery={setQuery}
					selectedSet={selectedSet}
					chosenCourseIds={chosenCourseIds}
					startLabel={termLabel(startTerm)}
				/>
				<PlanPanel
					check={check}
					selectedSections={selectedSections}
					completedSet={completedSet}
				/>
			</div>
		</div>
	);
}

function CriteriaBar({
	startSeason,
	availableDays,
}: {
	startSeason: Season;
	availableDays: Day[];
}) {
	const days = new Set(availableDays);
	return (
		<div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
			<div>
				<div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
					1 · Start quarter
				</div>
				<div className="flex gap-1">
					{SEASONS.map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => actions.setStartSeason(s)}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
								s === startSeason
									? "bg-maroon-700 text-white"
									: "bg-slate-100 text-slate-600 hover:bg-slate-200"
							}`}
						>
							{SEASON_LABEL[s]}
						</button>
					))}
				</div>
			</div>

			<div>
				<div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
					2 · Days I can attend
				</div>
				<div className="flex gap-1">
					{WEEKDAYS.map((d) => {
						const on = days.has(d);
						return (
							<button
								key={d}
								type="button"
								onClick={() => actions.toggleDay(d)}
								aria-pressed={on}
								className={`w-12 rounded-lg py-1.5 text-sm font-medium transition-colors ${
									on
										? "bg-maroon-700 text-white"
										: "bg-slate-100 text-slate-400 hover:bg-slate-200"
								}`}
							>
								{DAY_LABEL[d]}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function CourseTable({
	rows,
	query,
	setQuery,
	selectedSet,
	chosenCourseIds,
	startLabel,
}: {
	rows: Section[];
	query: string;
	setQuery: (v: string) => void;
	selectedSet: ReadonlySet<string>;
	chosenCourseIds: ReadonlySet<string>;
	startLabel: string;
}) {
	return (
		<SectionCard
			title="3 · Available classes"
			subtitle={`Offered from ${startLabel} onward on your selected days — ${rows.length} section${
				rows.length === 1 ? "" : "s"
			}.`}
		>
			<input
				type="search"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Search by code, title, or instructor…"
				className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-100"
			/>

			<div className="h-[26rem] overflow-y-auto rounded-lg border border-slate-200">
				<table className="w-full border-collapse text-sm">
					<thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
						<tr>
							<th className="w-8 px-2 py-2" />
							<th className="px-2 py-2">Course</th>
							<th className="px-2 py-2">Quarter</th>
							<th className="px-2 py-2">Days</th>
							<th className="px-2 py-2">Time</th>
							<th className="px-2 py-2 text-right">Cr</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((s) => {
							const course = getCourse(s.courseId);
							const checked = selectedSet.has(s.crn);
							const siblingChosen = !checked && chosenCourseIds.has(s.courseId);
							return (
								<tr
									key={s.crn}
									onClick={() => actions.toggleSection(s.crn)}
									className={`cursor-pointer border-t border-slate-100 transition-colors ${
										checked ? "bg-maroon-50" : "hover:bg-slate-50"
									}`}
								>
									<td className="px-2 py-2 align-top">
										<span
											className={`grid h-5 w-5 place-items-center rounded border text-white ${
												checked
													? "border-maroon-700 bg-maroon-700"
													: "border-slate-300 bg-white text-transparent"
											}`}
											aria-hidden
										>
											✓
										</span>
									</td>
									<td className="px-2 py-2 align-top">
										<div className="font-medium text-slate-800">
											{s.courseId}
										</div>
										<div className="text-slate-500">
											{course?.title ?? "Unknown course"}
										</div>
										{siblingChosen ? (
											<span className="text-xs text-amber-600">
												another section selected
											</span>
										) : s.instructor ? (
											<div className="text-xs text-slate-400">
												{s.instructor}
											</div>
										) : null}
									</td>
									<td className="px-2 py-2 align-top whitespace-nowrap text-slate-600">
										{termLabel({ season: s.season, year: s.year })}
									</td>
									<td className="px-2 py-2 align-top whitespace-nowrap text-slate-600">
										<span className={s.days.length ? "" : "text-slate-400"}>
											{formatDays(s.days)}
										</span>
									</td>
									<td className="px-2 py-2 align-top whitespace-nowrap text-slate-600">
										{timeLabel(s)}
									</td>
									<td className="px-2 py-2 align-top text-right text-slate-600">
										{s.credits}
									</td>
								</tr>
							);
						})}
						{rows.length === 0 ? (
							<tr>
								<td
									colSpan={6}
									className="px-3 py-10 text-center text-sm text-slate-400"
								>
									No classes match these filters. Try adding more days or an
									earlier start quarter.
								</td>
							</tr>
						) : null}
					</tbody>
				</table>
			</div>
		</SectionCard>
	);
}

function PlanPanel({
	check,
	selectedSections,
	completedSet,
}: {
	check: PlanCheck;
	selectedSections: Section[];
	completedSet: ReadonlySet<string>;
}) {
	const plannedSet = useMemo(
		() => new Set(selectedSections.map((s) => s.courseId)),
		[selectedSections],
	);
	const progress = remainingRequirements(
		requirements,
		completedSet,
		plannedSet,
	);
	const completedCredits = totalCompletedCredits(completedSet);
	const total = progress.totalCreditsForDegree;
	const remaining = Math.max(
		0,
		total - completedCredits - progress.plannedCredits,
	);

	return (
		<div className="space-y-4 lg:sticky lg:top-4">
			<StatusBanner check={check} hasSelection={selectedSections.length > 0} />

			{check.quarters.length > 0 ? (
				<SectionCard title="4 · Your plan">
					<div className="space-y-4">
						{check.quarters.map((q) => {
							const conflictIds = new Set(
								q.conflicts.flatMap((c) => [c.a.crn, c.b.crn]),
							);
							return (
								<div key={q.key}>
									<div className="mb-1.5 flex items-center justify-between">
										<span className="text-sm font-semibold text-slate-800">
											{termLabel(q.term)}
										</span>
										<span
											className={`text-sm font-semibold ${loadTone(q.credits)}`}
										>
											{q.credits} cr
										</span>
									</div>
									<ul className="space-y-1">
										{q.sections.map((s) => (
											<li
												key={s.crn}
												className="flex items-center gap-2 text-sm"
											>
												<span className="font-medium text-slate-700">
													{s.courseId}
												</span>
												<span className="truncate text-xs text-slate-400">
													{formatDays(s.days)} · {timeLabel(s)}
												</span>
												{conflictIds.has(s.crn) ? (
													<Badge tone="red">clash</Badge>
												) : null}
												<button
													type="button"
													onClick={() => actions.toggleSection(s.crn)}
													className="ml-auto shrink-0 rounded px-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
													aria-label={`Remove ${s.courseId}`}
												>
													✕
												</button>
											</li>
										))}
									</ul>
								</div>
							);
						})}
					</div>
				</SectionCard>
			) : null}

			{check.problems.length > 0 || check.notes.length > 0 ? (
				<SectionCard title="What to review">
					<ul className="space-y-2">
						{[...check.problems, ...check.notes].map((w) => (
							<li
								key={`${w.termKey}-${w.level}-${w.courseId ?? ""}-${w.message}`}
								className="flex items-start gap-2 text-sm"
							>
								<Badge tone={w.level === "error" ? "red" : "amber"}>
									{w.level === "error" ? "Fix" : "Note"}
								</Badge>
								<span className="text-slate-700">{w.message}</span>
							</li>
						))}
					</ul>
				</SectionCard>
			) : null}

			<SectionCard title="Degree progress">
				<div className="space-y-2">
					<ProgressBar
						completed={completedCredits}
						planned={progress.plannedCredits}
						total={total}
					/>
					<div className="flex justify-between text-xs text-slate-500">
						<span>{completedCredits} done</span>
						<span>{progress.plannedCredits} planned</span>
						<span>
							{remaining} left of {total}
						</span>
					</div>
					<Link
						to="/"
						className="mt-1 inline-block text-sm font-medium text-maroon-700 hover:text-maroon-800"
					>
						See full requirement breakdown →
					</Link>
				</div>
			</SectionCard>
		</div>
	);
}

function StatusBanner({
	check,
	hasSelection,
}: {
	check: PlanCheck;
	hasSelection: boolean;
}) {
	if (!hasSelection) {
		return (
			<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
				Select classes from the table to start building your plan.
			</div>
		);
	}
	if (check.success) {
		return (
			<div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
				✓ This plan works — {check.totalCredits} credits, no prerequisite gaps
				or time clashes.
			</div>
		);
	}
	const n = check.problems.length;
	return (
		<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
			✕ {n} {n === 1 ? "problem" : "problems"} to fix before this plan works.
		</div>
	);
}
