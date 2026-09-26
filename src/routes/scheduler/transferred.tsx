import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
	Badge,
	CategoryBadge,
	OfferingBadges,
	SectionCard,
} from "#/components/ui";
import { degreeCourses } from "#/lib/data";
import { totalCompletedCredits } from "#/lib/planner";
import { actions, useAppState } from "#/lib/store";
import type { Course, CourseCategory } from "#/lib/types";

export const Route = createFileRoute("/scheduler/transferred")({
	component: Transferred,
});

const CATEGORY_ORDER: CourseCategory[] = [
	"MATH",
	"CS_CORE",
	"CS_ELECTIVE",
	"OTHER",
];

function Transferred() {
	const { completed, dtaComplete } = useAppState();
	const completedSet = new Set(completed);
	const [query, setQuery] = useState("");

	const q = query.trim().toLowerCase();
	const matches = (c: Course) =>
		q === "" ||
		c.id.toLowerCase().includes(q) ||
		c.title.toLowerCase().includes(q);

	const byCategory = CATEGORY_ORDER.map((category) => ({
		category,
		courses: degreeCourses.filter((c) => c.category === category && matches(c)),
	})).filter((g) => g.courses.length > 0);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-slate-900">
					Transferred &amp; completed courses
				</h1>
				<p className="mt-1 text-sm text-slate-500">
					Mark what you've already finished (transfer credit or completed
					quarters). These unlock prerequisites and count toward progress.
				</p>
			</div>

			<SectionCard
				title="Common Curriculum (general education)"
				right={
					<button
						type="button"
						onClick={() => actions.setDtaComplete(!dtaComplete)}
						className={`rounded-full px-3 py-1 text-sm font-medium ${
							dtaComplete
								? "bg-green-100 text-green-800"
								: "bg-slate-100 text-slate-600"
						}`}
					>
						{dtaComplete ? "✓ DTA satisfies it" : "Not satisfied"}
					</button>
				}
			>
				<p className="text-sm text-slate-500">
					A completed DTA (Direct Transfer Agreement) satisfies SPU's
					general-education / Common Curriculum requirements, so they aren't
					tracked course-by-course here.
				</p>
			</SectionCard>

			<SectionCard
				title="Course credit"
				subtitle={`${completedSet.size} courses · ${totalCompletedCredits(
					completed,
				)} credits marked complete`}
				right={
					completedSet.size > 0 ? (
						<button
							type="button"
							onClick={() => actions.setCompleted([])}
							className="text-sm font-medium text-slate-500 hover:text-red-600"
						>
							Clear all
						</button>
					) : null
				}
			>
				<input
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Filter by course code or title…"
					className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-100"
				/>

				<div className="space-y-5">
					{byCategory.map(({ category, courses }) => (
						<div key={category}>
							<div className="mb-2 flex items-center gap-2">
								<CategoryBadge category={category} />
								<span className="text-xs text-slate-400">
									{courses.length} courses
								</span>
							</div>
							<ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
								{courses.map((course) => {
									const checked = completedSet.has(course.id);
									return (
										<li key={course.id}>
											<button
												type="button"
												onClick={() => actions.toggleCompleted(course.id)}
												className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
													checked ? "bg-green-50/60" : ""
												}`}
											>
												<span
													className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
														checked
															? "border-green-600 bg-green-600 text-white"
															: "border-slate-300 bg-white text-transparent"
													}`}
													aria-hidden
												>
													✓
												</span>
												<span className="font-medium text-slate-700">
													{course.id}
												</span>
												<span className="truncate text-slate-500">
													{course.title}
												</span>
												<span className="ml-auto flex shrink-0 items-center gap-1">
													<OfferingBadges course={course} />
													<Badge tone="slate">{course.credits} cr</Badge>
												</span>
											</button>
										</li>
									);
								})}
							</ul>
						</div>
					))}
					{byCategory.length === 0 ? (
						<p className="text-sm text-slate-400">
							No courses match “{query}”.
						</p>
					) : null}
				</div>
			</SectionCard>
		</div>
	);
}
