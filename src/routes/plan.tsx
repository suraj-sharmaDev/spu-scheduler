import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
	Badge,
	CategoryBadge,
	OfferingBadges,
	SectionCard,
} from "#/components/ui";
import { degreeCourses, getCourse } from "#/lib/data";
import {
	creditsForQuarter,
	FULL_TIME_CREDITS,
	isEligible,
	MAX_CREDITS,
	type PlanWarning,
	plannedCourseIds,
	validatePlan,
} from "#/lib/planner";
import {
	generateTerms,
	parseTermKey,
	SEASON_LABEL,
	termIndex,
	termKey,
	termLabel,
} from "#/lib/quarters";
import { actions, useAppState } from "#/lib/store";
import type { Season, Term } from "#/lib/types";

export const Route = createFileRoute("/plan")({ component: Planner });

const SEASONS: Season[] = ["AUT", "WIN", "SPR", "SUM"];

function loadTone(credits: number): string {
	if (credits === 0) return "text-slate-400";
	if (credits > MAX_CREDITS) return "text-red-600";
	if (credits < FULL_TIME_CREDITS) return "text-amber-600";
	return "text-green-600";
}

function Planner() {
	const { plan, completed, startTerm, horizon } = useAppState();
	const completedSet = new Set(completed);
	const plannedSet = plannedCourseIds(plan);

	const terms = generateTerms(startTerm, horizon);
	const [selectedKey, setSelectedKey] = useState<string | null>(null);

	// Default to (and recover to) the first visible term.
	const selectedTerm: Term =
		terms.find((t) => termKey(t) === selectedKey) ?? terms[0];
	const selectedIdx = termIndex(selectedTerm);

	const warnings = validatePlan(plan, completedSet);
	const warningsByTerm = new Map<string, PlanWarning[]>();
	for (const w of warnings) {
		const list = warningsByTerm.get(w.termKey) ?? [];
		list.push(w);
		warningsByTerm.set(w.termKey, list);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-slate-900">Quarter planner</h1>
					<p className="mt-1 text-sm text-slate-500">
						Pick a quarter, then add eligible courses. We check prerequisites,
						offering season, and credit load as you go.
					</p>
				</div>
				<PlanSettings startTerm={startTerm} horizon={horizon} />
			</div>

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{terms.map((term) => {
					const key = termKey(term);
					const ids = plan[key] ?? [];
					const credits = creditsForQuarter(plan, key);
					const termWarnings = warningsByTerm.get(key) ?? [];
					const errors = termWarnings.filter((w) => w.level === "error").length;
					const selected = key === termKey(selectedTerm);
					return (
						<div
							key={key}
							className={`rounded-xl border bg-white p-4 transition-colors ${
								selected
									? "border-maroon-500 ring-2 ring-maroon-100"
									: "border-slate-200"
							}`}
						>
							<button
								type="button"
								onClick={() => setSelectedKey(key)}
								className="flex w-full items-center justify-between text-left"
							>
								<span className="font-semibold text-slate-900">
									{termLabel(term)}
								</span>
								<span className={`text-sm font-semibold ${loadTone(credits)}`}>
									{credits} cr
								</span>
							</button>

							{ids.length === 0 ? (
								<p className="mt-3 text-sm text-slate-400">
									{selected ? "Add courses below ↓" : "Empty"}
								</p>
							) : (
								<ul className="mt-3 space-y-1.5">
									{ids.map((id) => {
										const course = getCourse(id);
										return (
											<li key={id} className="flex items-center gap-2 text-sm">
												<span className="font-medium text-slate-700">{id}</span>
												<span className="truncate text-slate-500">
													{course?.title ?? "Unknown"}
												</span>
												<button
													type="button"
													onClick={() => actions.removeFromTerm(term, id)}
													className="ml-auto shrink-0 rounded px-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
													aria-label={`Remove ${id}`}
												>
													✕
												</button>
											</li>
										);
									})}
								</ul>
							)}

							{termWarnings.length > 0 ? (
								<div className="mt-3 flex gap-1.5">
									{errors > 0 ? (
										<Badge tone="red">
											{errors} prereq {errors === 1 ? "gap" : "gaps"}
										</Badge>
									) : null}
									{termWarnings.length - errors > 0 ? (
										<Badge tone="amber">
											{termWarnings.length - errors} notes
										</Badge>
									) : null}
								</div>
							) : null}
						</div>
					);
				})}
			</div>

			<AddCourses
				selectedTerm={selectedTerm}
				selectedIdx={selectedIdx}
				plan={plan}
				completedSet={completedSet}
				plannedSet={plannedSet}
			/>

			<ValidationPanel warnings={warnings} />
		</div>
	);
}

function PlanSettings({
	startTerm,
	horizon,
}: {
	startTerm: Term;
	horizon: number;
}) {
	return (
		<div className="flex flex-wrap items-end gap-3">
			<label className="text-sm">
				<span className="mb-1 block text-xs font-medium text-slate-500">
					Start
				</span>
				<select
					value={startTerm.season}
					onChange={(e) =>
						actions.setStartTerm({
							...startTerm,
							season: e.target.value as Season,
						})
					}
					className="rounded-lg border border-slate-300 px-2 py-1.5"
				>
					{SEASONS.map((s) => (
						<option key={s} value={s}>
							{SEASON_LABEL[s]}
						</option>
					))}
				</select>
			</label>
			<label className="text-sm">
				<span className="mb-1 block text-xs font-medium text-slate-500">
					Year
				</span>
				<input
					type="number"
					value={startTerm.year}
					onChange={(e) =>
						actions.setStartTerm({
							...startTerm,
							year: Number(e.target.value) || startTerm.year,
						})
					}
					className="w-20 rounded-lg border border-slate-300 px-2 py-1.5"
				/>
			</label>
			<label className="text-sm">
				<span className="mb-1 block text-xs font-medium text-slate-500">
					Quarters
				</span>
				<input
					type="number"
					min={1}
					max={16}
					value={horizon}
					onChange={(e) =>
						actions.setHorizon(
							Math.min(16, Math.max(1, Number(e.target.value) || horizon)),
						)
					}
					className="w-20 rounded-lg border border-slate-300 px-2 py-1.5"
				/>
			</label>
			<button
				type="button"
				onClick={() => actions.clearPlan()}
				className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
			>
				Clear plan
			</button>
		</div>
	);
}

function AddCourses({
	selectedTerm,
	selectedIdx,
	plan,
	completedSet,
	plannedSet,
}: {
	selectedTerm: Term;
	selectedIdx: number;
	plan: Record<string, string[]>;
	completedSet: ReadonlySet<string>;
	plannedSet: ReadonlySet<string>;
}) {
	const [query, setQuery] = useState("");

	// Courses available before the selected term (transferred + earlier terms).
	const plannedBefore = new Set(completedSet);
	for (const [k, ids] of Object.entries(plan)) {
		if (termIndex(parseTermKey(k)) < selectedIdx) {
			for (const id of ids) plannedBefore.add(id);
		}
	}

	const q = query.trim().toLowerCase();
	const candidates = degreeCourses
		.filter(
			(c) =>
				!completedSet.has(c.id) &&
				!plannedSet.has(c.id) &&
				(q === "" ||
					c.id.toLowerCase().includes(q) ||
					c.title.toLowerCase().includes(q)),
		)
		.map((course) => ({
			course,
			elig: isEligible(course, {
				completed: completedSet,
				plannedBefore,
				season: selectedTerm.season,
			}),
		}))
		.sort((a, b) => {
			// Eligible courses first, then by id.
			if (a.elig.eligible !== b.elig.eligible) return a.elig.eligible ? -1 : 1;
			return a.course.id.localeCompare(b.course.id);
		});

	return (
		<SectionCard
			title={`Add courses to ${termLabel(selectedTerm)}`}
			subtitle="Click a term card above to change the target quarter."
		>
			<input
				type="search"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Filter by course code or title…"
				className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-100"
			/>

			<ul className="divide-y divide-slate-100">
				{candidates.map(({ course, elig }) => (
					<li key={course.id} className="flex items-center gap-3 py-2 text-sm">
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<span className="font-medium text-slate-800">{course.id}</span>
								<span className="truncate text-slate-500">{course.title}</span>
							</div>
							<div className="mt-1 flex flex-wrap items-center gap-1">
								<CategoryBadge category={course.category} />
								<Badge tone="slate">{course.credits} cr</Badge>
								<OfferingBadges course={course} />
								{!elig.prereqsMet ? (
									<Badge tone="red">
										needs {elig.missingPrereqs.join(", ")}
									</Badge>
								) : null}
								{elig.offeredThisSeason === false ? (
									<Badge tone="amber">not offered {selectedTerm.season}</Badge>
								) : null}
							</div>
						</div>
						<button
							type="button"
							onClick={() => actions.addToTerm(selectedTerm, course.id)}
							className="shrink-0 rounded-lg bg-maroon-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-maroon-800"
						>
							Add
						</button>
					</li>
				))}
				{candidates.length === 0 ? (
					<li className="py-3 text-sm text-slate-400">
						Nothing left to add — every degree course is completed or planned.
					</li>
				) : null}
			</ul>
		</SectionCard>
	);
}

function ValidationPanel({ warnings }: { warnings: PlanWarning[] }) {
	if (warnings.length === 0) {
		return (
			<div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
				✓ No conflicts detected in the current plan.
			</div>
		);
	}
	return (
		<SectionCard title={`${warnings.length} things to review`}>
			<ul className="space-y-2">
				{warnings.map((w) => (
					<li
						key={`${w.termKey}-${w.level}-${w.courseId ?? ""}-${w.message}`}
						className="flex items-start gap-2 text-sm"
					>
						<Badge tone={w.level === "error" ? "red" : "amber"}>
							{termLabel(parseTermKey(w.termKey))}
						</Badge>
						<span className="text-slate-700">{w.message}</span>
					</li>
				))}
			</ul>
		</SectionCard>
	);
}
