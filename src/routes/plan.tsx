import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
	Badge,
	OfferingBadges,
	ProgressBar,
	SectionCard,
} from "#/components/ui";
import {
	courses,
	degreeCourseIds,
	degreeSections,
	getCourse,
	getPathway,
	requirements,
	SCHEDULE_YEAR_LABEL,
	scheduleTerm,
} from "#/lib/data";
import {
	buildPlanView,
	FULL_TIME_CREDITS,
	MAX_CREDITS,
	type PlannedCourse,
	type PlannedTerm,
	type PlanView,
	remainingRequirements,
	suggestPlan,
	termForOffset,
	totalCompletedCredits,
} from "#/lib/planner";
import { SEASON_LABEL, termKey, termLabel } from "#/lib/quarters";
import { DAY_LABEL, formatDays, timeLabel, WEEKDAYS } from "#/lib/schedule";
import { actions, useAppState } from "#/lib/store";
import type { Course, Day, EntryType, Season } from "#/lib/types";

export const Route = createFileRoute("/plan")({ component: Planner });

const SEASONS: Season[] = ["AUT", "WIN", "SPR", "SUM"];

const ENTRY_TYPES: { value: EntryType; label: string }[] = [
	{ value: "transfer", label: "Transfer" },
	{ value: "freshman", label: "Freshman" },
];

/** A 4-year academic walk's worth of terms — every slot a course can be added
 *  to, even before the plan has anything in it. */
const PLAN_TERM_COUNT = 12;

/** Courses she can add to the plan: everything the degree names, plus anything
 *  that actually runs this year (electives/gen-ed like CSC2330 the program page
 *  never lists individually but she still has to take). */
const sectionCourseIds = new Set(degreeSections.map((s) => s.courseId));
const addableCourses: Course[] = courses.filter(
	(c) => degreeCourseIds.has(c.id) || sectionCourseIds.has(c.id),
);

function loadTone(credits: number): string {
	if (credits === 0) return "text-slate-400";
	if (credits > MAX_CREDITS) return "text-red-600";
	if (credits < FULL_TIME_CREDITS) return "text-amber-600";
	return "text-green-600";
}

// --- fuzzy course search ----------------------------------------------------

// A lowercased blob worth searching for one course: the unspaced id ("csc1007")
// and the spaced subject+number form ("csc 1007") so either way matches, plus
// the title.
function courseHaystack(c: Course): string {
	return [c.id, `${c.subject} ${c.number}`, c.title].join(" ").toLowerCase();
}

// Levenshtein distance, capped: bails out as soon as the best possible result
// exceeds `max`, so a miss costs almost nothing. Used only as a typo fallback.
function withinEditDistance(a: string, b: string, max: number): boolean {
	if (Math.abs(a.length - b.length) > max) return false;
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const curr = [i];
		let rowMin = i;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			const d = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
			curr[j] = d;
			if (d < rowMin) rowMin = d;
		}
		if (rowMin > max) return false; // no cell in this row can recover
		prev = curr;
	}
	return prev[b.length] <= max;
}

// True if every char of `needle` appears in `hay` in order (allowing gaps).
// This is what makes abbreviations work: "genr" ⊂ "general", "strct" ⊂ "structures".
function isSubsequence(needle: string, hay: string): boolean {
	let i = 0;
	for (let j = 0; j < hay.length && i < needle.length; j++) {
		if (needle[i] === hay[j]) i++;
	}
	return i === needle.length;
}

// One query word matches if it's a substring of the blob (precise) or, failing
// that, fuzzily matches some word in it — either as an in-order abbreviation
// ("genr"→general) or a near-miss typo ("genral"→general). Tokens under 4 chars
// stay exact: codes like "cs" shouldn't fuzzily match everything.
function tokenMatches(hay: string, words: string[], token: string): boolean {
	if (hay.includes(token)) return true;
	if (token.length < 4) return false;
	const max = token.length <= 6 ? 1 : 2;
	return words.some(
		(w) =>
			w.length >= 3 &&
			(isSubsequence(token, w) || withinEditDistance(token, w, max)),
	);
}

function Planner() {
	const {
		entryType,
		startSeason,
		availableDays,
		placements,
		sectionChoices,
		completed,
	} = useAppState();
	const [alreadyDone, setAlreadyDone] = useState<string[] | null>(null);

	const completedSet = useMemo(() => new Set(completed), [completed]);
	const dayset = useMemo(() => new Set(availableDays), [availableDays]);
	const startTerm = scheduleTerm(startSeason);

	const view = useMemo(
		() =>
			buildPlanView(
				placements,
				completedSet,
				dayset,
				sectionChoices,
				degreeSections,
			),
		[placements, completedSet, dayset, sectionChoices],
	);

	// Every term a course can be dropped into — a 4-year academic walk from the
	// chosen start, regardless of what's already placed.
	const termOptions = useMemo(
		() =>
			Array.from({ length: PLAN_TERM_COUNT }, (_, i) =>
				termForOffset(startTerm, i),
			),
		[startTerm],
	);

	const plannedIds = useMemo(
		() => new Set(Object.values(placements).flat()),
		[placements],
	);

	const handleSuggest = () => {
		const pathway = getPathway(entryType);
		if (!pathway) return;
		const result = suggestPlan(pathway, completedSet, startTerm);
		actions.setPlacements(result.placements);
		setAlreadyDone(result.alreadyDone);
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold text-slate-900">Build your plan</h1>
					<p className="mt-1 text-sm text-slate-500">
						Lay out the recommended sequence, then adjust quarter by quarter.
						Times and clashes are checked for {SCHEDULE_YEAR_LABEL}; later years
						are a roadmap until SPU posts their schedules.
					</p>
				</div>
				<Badge tone="maroon">{SCHEDULE_YEAR_LABEL} schedule</Badge>
			</div>

			<CriteriaBar
				entryType={entryType}
				startSeason={startSeason}
				availableDays={availableDays}
				onSuggest={handleSuggest}
				hasPlan={view.terms.length > 0}
			/>

			{alreadyDone ? <SuggestionNote alreadyDone={alreadyDone} /> : null}

			<StatusBanner view={view} />

			<div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
				<Roadmap view={view} />
				<div className="space-y-4 lg:sticky lg:top-4">
					<AddPanel
						termOptions={termOptions}
						defaultTermKey={termKey(termOptions[0])}
						plannedIds={plannedIds}
						completedSet={completedSet}
					/>
					<DegreeProgress
						plannedSet={plannedIds}
						completedSet={completedSet}
						totalPlannedCredits={view.totalCredits}
					/>
				</div>
			</div>
		</div>
	);
}

function CriteriaBar({
	entryType,
	startSeason,
	availableDays,
	onSuggest,
	hasPlan,
}: {
	entryType: EntryType;
	startSeason: Season;
	availableDays: Day[];
	onSuggest: () => void;
	hasPlan: boolean;
}) {
	const days = new Set(availableDays);
	return (
		<div className="flex flex-wrap items-end gap-x-8 gap-y-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
			<div>
				<div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
					1 · I'm a
				</div>
				<div className="flex gap-1">
					{ENTRY_TYPES.map((t) => (
						<button
							key={t.value}
							type="button"
							onClick={() => actions.setEntryType(t.value)}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
								t.value === entryType
									? "bg-maroon-700 text-white"
									: "bg-slate-100 text-slate-600 hover:bg-slate-200"
							}`}
						>
							{t.label}
						</button>
					))}
				</div>
			</div>

			<div>
				<div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
					2 · Start quarter
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
					3 · Days I can attend
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

			<div className="ml-auto flex items-center gap-2">
				{hasPlan ? (
					<button
						type="button"
						onClick={() => actions.clearPlan()}
						className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-red-600"
					>
						Clear
					</button>
				) : null}
				<button
					type="button"
					onClick={onSuggest}
					className="rounded-lg bg-maroon-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-maroon-800"
				>
					Suggest a plan
				</button>
			</div>
		</div>
	);
}

/** What the pathway seed skipped because she's already done it. */
function SuggestionNote({ alreadyDone }: { alreadyDone: string[] }) {
	return (
		<div className="space-y-1 rounded-xl border border-maroon-200 bg-maroon-50 px-5 py-4 text-sm">
			<div className="font-semibold text-maroon-800">
				Laid out the recommended sequence across the years.{" "}
				<span className="font-normal text-maroon-700">
					Adjust any quarter below — this is a starting point, not a lock.
				</span>
			</div>
			{alreadyDone.length > 0 ? (
				<p className="text-slate-600">
					<span className="font-medium">Already done / covered:</span>{" "}
					{alreadyDone.join(", ")}
				</p>
			) : null}
		</div>
	);
}

function StatusBanner({ view }: { view: PlanView }) {
	if (view.terms.length === 0) {
		return (
			<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
				Hit <span className="font-medium">Suggest a plan</span> to lay out the
				recommended sequence, or add courses from the panel on the right.
			</div>
		);
	}
	if (view.problems === 0) {
		return (
			<div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
				✓ {view.totalCredits} credits planned — no prerequisite gaps or time
				clashes.
			</div>
		);
	}
	const n = view.problems;
	return (
		<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
			✕ {n} {n === 1 ? "problem" : "problems"} to fix (prerequisite gaps or time
			clashes).
		</div>
	);
}

function Roadmap({ view }: { view: PlanView }) {
	if (view.terms.length === 0) {
		return (
			<SectionCard title="Your plan">
				<p className="py-8 text-center text-sm text-slate-400">
					No courses planned yet.
				</p>
			</SectionCard>
		);
	}
	return (
		<div className="space-y-4">
			{view.terms.map((term) => (
				<TermCard key={term.key} term={term} />
			))}
		</div>
	);
}

function TermCard({ term }: { term: PlannedTerm }) {
	return (
		<SectionCard
			title={
				<span className="flex items-center gap-2">
					{termLabel(term.term)}
					{term.schedulable ? null : (
						<Badge tone="slate">sections posted later</Badge>
					)}
				</span>
			}
			right={
				<span className={`text-sm font-semibold ${loadTone(term.credits)}`}>
					{term.credits} cr
				</span>
			}
		>
			<ul className="divide-y divide-slate-100">
				{term.courses.map((c) => (
					<PlannedCourseRow
						key={c.courseId}
						course={c}
						season={term.term.season}
					/>
				))}
			</ul>
		</SectionCard>
	);
}

function PlannedCourseRow({
	course,
	season,
}: {
	course: PlannedCourse;
	season: Season;
}) {
	const catalog = getCourse(course.courseId);
	return (
		<li className="flex items-start gap-3 py-2 text-sm">
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="font-medium text-slate-800">{course.courseId}</span>
					{course.clash ? <Badge tone="red">clash</Badge> : null}
					{course.missingPrereqs.length > 0 ? (
						<Badge tone="red">needs {course.missingPrereqs.join(", ")}</Badge>
					) : null}
					{course.offeredThisSeason === false ? (
						<Badge tone="amber">rarely offered in {SEASON_LABEL[season]}</Badge>
					) : null}
				</div>
				<div className="truncate text-slate-500">{course.title}</div>

				{course.schedulable ? (
					course.section ? (
						course.candidates.length > 1 ? (
							<SectionPicker course={course} />
						) : (
							<div className="mt-0.5 text-xs text-slate-400">
								{formatDays(course.section.days)} · {timeLabel(course.section)}
								{course.section.instructor
									? ` · ${course.section.instructor}`
									: ""}
							</div>
						)
					) : (
						<div className="mt-0.5 text-xs text-amber-600">
							No section fits your days this quarter — widen your days or move
							it.
						</div>
					)
				) : (
					<div className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
						<span>Sections posted later · usually</span>
						{catalog ? <OfferingBadges course={catalog} /> : null}
					</div>
				)}
			</div>

			<div className="flex shrink-0 items-center gap-2">
				<span className="text-slate-500">{course.credits} cr</span>
				<button
					type="button"
					onClick={() => actions.removeCourse(course.courseId)}
					className="rounded px-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
					aria-label={`Remove ${course.courseId}`}
				>
					✕
				</button>
			</div>
		</li>
	);
}

/** Swap between the fitting sections of a published-year course (different
 *  times) to resolve a clash or pick a better slot. */
function SectionPicker({ course }: { course: PlannedCourse }) {
	const current = course.section;
	return (
		<select
			value={current?.crn ?? ""}
			onChange={(e) => actions.chooseSection(course.courseId, e.target.value)}
			className="mt-0.5 max-w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-500 outline-none focus:border-maroon-400"
		>
			{course.candidates.map((s) => (
				<option key={s.crn} value={s.crn}>
					{formatDays(s.days)} · {timeLabel(s)}
					{s.instructor ? ` · ${s.instructor}` : ""}
				</option>
			))}
		</select>
	);
}

function AddPanel({
	termOptions,
	defaultTermKey,
	plannedIds,
	completedSet,
}: {
	termOptions: { season: Season; year: number }[];
	defaultTermKey: string;
	plannedIds: ReadonlySet<string>;
	completedSet: ReadonlySet<string>;
}) {
	const [query, setQuery] = useState("");
	const [target, setTarget] = useState<string | null>(null);
	// Stay valid if the start quarter (and so the option keys) changes.
	const targetKey =
		target && termOptions.some((t) => termKey(t) === target)
			? target
			: defaultTermKey;

	const tokens = useMemo(
		() => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
		[query],
	);
	const haystacks = useMemo(() => {
		const m = new Map<string, { text: string; words: string[] }>();
		for (const c of addableCourses) {
			const text = courseHaystack(c);
			m.set(c.id, { text, words: text.split(/\s+/).filter(Boolean) });
		}
		return m;
	}, []);

	const rows = useMemo(
		() =>
			addableCourses
				.filter((c) => {
					if (completedSet.has(c.id) || plannedIds.has(c.id)) return false;
					if (tokens.length === 0) return true;
					const entry = haystacks.get(c.id);
					if (!entry) return false;
					return tokens.every((t) => tokenMatches(entry.text, entry.words, t));
				})
				.slice(0, 60),
		[tokens, haystacks, completedSet, plannedIds],
	);

	return (
		<SectionCard title="Add a course">
			<label className="mb-2 block text-xs font-medium text-slate-500">
				Add to
				<select
					value={targetKey}
					onChange={(e) => setTarget(e.target.value)}
					className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-maroon-500"
				>
					{termOptions.map((t) => (
						<option key={termKey(t)} value={termKey(t)}>
							{termLabel(t)}
						</option>
					))}
				</select>
			</label>

			<input
				type="search"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Search by code or title…"
				className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-100"
			/>

			<div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
				{rows.map((c) => (
					<button
						key={c.id}
						type="button"
						onClick={() => actions.addCourse(c.id, targetKey)}
						className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
					>
						<span className="font-medium text-slate-700">{c.id}</span>
						<span className="truncate text-slate-500">{c.title}</span>
						<span className="ml-auto shrink-0 text-xs text-slate-400">
							{c.credits} cr
						</span>
					</button>
				))}
				{rows.length === 0 ? (
					<p className="px-3 py-6 text-center text-sm text-slate-400">
						No courses match — they may already be planned or completed.
					</p>
				) : null}
			</div>
		</SectionCard>
	);
}

function DegreeProgress({
	plannedSet,
	completedSet,
	totalPlannedCredits,
}: {
	plannedSet: ReadonlySet<string>;
	completedSet: ReadonlySet<string>;
	totalPlannedCredits: number;
}) {
	const progress = remainingRequirements(
		requirements,
		completedSet,
		plannedSet,
	);
	const completedCredits = totalCompletedCredits(completedSet);
	const total = progress.totalCreditsForDegree;
	const remaining = Math.max(0, total - completedCredits - totalPlannedCredits);

	return (
		<SectionCard title="Degree progress">
			<div className="space-y-2">
				<ProgressBar
					completed={completedCredits}
					planned={totalPlannedCredits}
					total={total}
				/>
				<div className="flex justify-between text-xs text-slate-500">
					<span>{completedCredits} done</span>
					<span>{totalPlannedCredits} planned</span>
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
	);
}
