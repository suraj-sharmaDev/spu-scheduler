import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge, ProgressBar, SectionCard } from "#/components/ui";
import {
	dataNeedsVerification,
	getCourse,
	getSection,
	requirements,
} from "#/lib/data";
import {
	type RequirementStatus,
	remainingRequirements,
	totalCompletedCredits,
} from "#/lib/planner";
import { useAppState } from "#/lib/store";

export const Route = createFileRoute("/")({ component: Overview });

const STATUS_DOT: Record<RequirementStatus, string> = {
	completed: "bg-green-500",
	planned: "bg-blue-500",
	remaining: "bg-slate-300",
};

function Overview() {
	const { completed, selectedCrns, dtaComplete } = useAppState();
	const completedSet = new Set(completed);
	const plannedSet = new Set(
		selectedCrns
			.map((crn) => getSection(crn)?.courseId)
			.filter((id): id is string => Boolean(id)),
	);
	const progress = remainingRequirements(
		requirements,
		completedSet,
		plannedSet,
	);

	const completedCredits = totalCompletedCredits(completed);
	const plannedCredits = [...plannedSet].reduce(
		(sum, id) => sum + (getCourse(id)?.credits ?? 0),
		0,
	);
	const total = progress.totalCreditsForDegree;
	const remaining = Math.max(0, total - completedCredits - plannedCredits);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-slate-900">Degree progress</h1>
				<p className="mt-1 text-sm text-slate-500">
					BS in Computer Science · Catalog {requirements.catalogYear}
				</p>
			</div>

			{dataNeedsVerification ? (
				<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
					<span className="text-base">⚠</span>
					<p>
						<strong>Unverified data.</strong> Course requirements and
						prerequisites were scraped from the catalog and haven't been
						human-checked yet. Treat this as a planning aid — always confirm
						with an SPU advisor.
					</p>
				</div>
			) : null}

			<SectionCard
				title="Credits toward degree"
				right={
					<Badge tone={dtaComplete ? "green" : "amber"}>
						DTA {dtaComplete ? "complete" : "incomplete"}
					</Badge>
				}
			>
				<div className="space-y-3">
					<ProgressBar
						completed={completedCredits}
						planned={plannedCredits}
						total={total}
					/>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<Stat
							label="Completed"
							value={completedCredits}
							tone="text-maroon-700"
						/>
						<Stat
							label="Planned"
							value={plannedCredits}
							tone="text-maroon-400"
						/>
						<Stat label="Remaining" value={remaining} tone="text-slate-500" />
						<Stat label="Degree total" value={total} tone="text-slate-900" />
					</div>
				</div>
			</SectionCard>

			<div className="grid gap-4 md:grid-cols-2">
				{progress.groups.map((group) => (
					<SectionCard
						// Group names repeat in the scraped data; key on name + contents.
						key={`${group.name}|${group.creditsRequired}|${group.courses
							.map((c) => c.id)
							.join(",")}`}
						title={group.name}
						subtitle={group.selectionRule ?? undefined}
						right={
							group.creditsRequired != null ? (
								<span className="text-sm font-medium text-slate-500">
									{group.completedCredits + group.plannedCredits}/
									{group.creditsRequired} cr
								</span>
							) : null
						}
					>
						{group.courses.length === 0 ? (
							<p className="text-sm text-slate-400">
								{group.creditsRequired != null
									? `${group.creditsRequired} credits — satisfied by transfer / general courses.`
									: "No specific courses listed."}
							</p>
						) : (
							<ul className="space-y-1.5">
								{group.courses.map((c) => {
									const course = getCourse(c.id);
									return (
										<li key={c.id} className="flex items-center gap-2 text-sm">
											<span
												className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[c.status]}`}
												aria-hidden
											/>
											<span className="font-medium text-slate-700">{c.id}</span>
											<span className="truncate text-slate-500">
												{course?.title ?? "Unknown course"}
											</span>
											<span className="ml-auto shrink-0 text-xs text-slate-400">
												{c.credits} cr
											</span>
										</li>
									);
								})}
							</ul>
						)}
					</SectionCard>
				))}
			</div>

			<div className="flex flex-wrap gap-3 text-sm">
				<Link
					to="/plan"
					className="rounded-lg bg-maroon-700 px-4 py-2 font-medium text-white hover:bg-maroon-800"
				>
					Open quarter planner →
				</Link>
				<Link
					to="/transferred"
					className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
				>
					Edit transferred courses
				</Link>
			</div>
		</div>
	);
}

function Stat({
	label,
	value,
	tone,
}: {
	label: string;
	value: number;
	tone: string;
}) {
	return (
		<div className="rounded-lg bg-slate-50 px-3 py-2">
			<div className={`text-xl font-bold ${tone}`}>{value}</div>
			<div className="text-xs text-slate-500">{label}</div>
		</div>
	);
}
