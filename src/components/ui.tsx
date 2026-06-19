import type { ReactNode } from "react";
import { offeringInfo } from "#/lib/planner";
import { SEASON_LABEL } from "#/lib/quarters";
import type { Course, CourseCategory } from "#/lib/types";

type BadgeTone =
	| "slate"
	| "green"
	| "blue"
	| "amber"
	| "red"
	| "maroon"
	| "violet";

const TONE_CLASSES: Record<BadgeTone, string> = {
	slate: "bg-slate-100 text-slate-700 ring-slate-200",
	green: "bg-green-100 text-green-800 ring-green-200",
	blue: "bg-blue-100 text-blue-800 ring-blue-200",
	amber: "bg-amber-100 text-amber-800 ring-amber-200",
	red: "bg-red-100 text-red-800 ring-red-200",
	maroon: "bg-maroon-100 text-maroon-800 ring-maroon-200",
	violet: "bg-violet-100 text-violet-800 ring-violet-200",
};

export function Badge({
	tone = "slate",
	children,
	title,
}: {
	tone?: BadgeTone;
	children: ReactNode;
	title?: string;
}) {
	return (
		<span
			title={title}
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[tone]}`}
		>
			{children}
		</span>
	);
}

const CATEGORY_META: Record<
	CourseCategory,
	{ label: string; tone: BadgeTone }
> = {
	CS_CORE: { label: "CS Core", tone: "maroon" },
	CS_ELECTIVE: { label: "CS Elective", tone: "violet" },
	MATH: { label: "Math", tone: "blue" },
	OTHER: { label: "Other", tone: "slate" },
};

export function CategoryBadge({ category }: { category: CourseCategory }) {
	const meta = CATEGORY_META[category];
	return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/** Offering tags (seasons / alternate-years / unknown) for a course. */
export function OfferingBadges({ course }: { course: Course }) {
	const { seasons, alternateYears, unknown } = offeringInfo(course);
	if (unknown) {
		return <Badge tone="amber">offering unknown</Badge>;
	}
	return (
		<>
			{seasons.map((s) => (
				<Badge key={s} tone="slate" title={SEASON_LABEL[s]}>
					{s}
				</Badge>
			))}
			{alternateYears ? <Badge tone="amber">alt years</Badge> : null}
		</>
	);
}

/** Shown when scraped data hasn't been human-verified yet. */
export function UnverifiedBadge() {
	return (
		<Badge tone="amber" title="Scraped data not yet human-verified">
			⚠ unverified
		</Badge>
	);
}

/** A horizontal progress bar with a solid "completed" segment and a lighter
 *  "planned" segment stacked on top. */
export function ProgressBar({
	completed,
	planned,
	total,
}: {
	completed: number;
	planned: number;
	total: number;
}) {
	const safeTotal = total > 0 ? total : 1;
	const completedPct = Math.min(100, (completed / safeTotal) * 100);
	const plannedPct = Math.min(100 - completedPct, (planned / safeTotal) * 100);
	return (
		<div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
			<div className="flex h-full">
				<div
					className="h-full bg-maroon-600"
					style={{ width: `${completedPct}%` }}
				/>
				<div
					className="h-full bg-maroon-300"
					style={{ width: `${plannedPct}%` }}
				/>
			</div>
		</div>
	);
}

export function SectionCard({
	title,
	subtitle,
	right,
	children,
}: {
	title?: ReactNode;
	subtitle?: ReactNode;
	right?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="rounded-xl border border-slate-200 bg-white shadow-sm">
			{(title || right) && (
				<header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
					<div>
						{title ? (
							<h2 className="font-semibold text-slate-900">{title}</h2>
						) : null}
						{subtitle ? (
							<p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
						) : null}
					</div>
					{right ? <div className="shrink-0">{right}</div> : null}
				</header>
			)}
			<div className="px-5 py-4">{children}</div>
		</section>
	);
}
