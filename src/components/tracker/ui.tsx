import { Check, ExternalLink, Sparkles, Star } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { TaskStatus } from "#/lib/tracker/status";
import type { ChecklistItem, Concept, ConceptRef } from "#/lib/tracker/types";

export function Card({
	title,
	subtitle,
	right,
	children,
	className = "",
}: {
	title?: ReactNode;
	subtitle?: ReactNode;
	right?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section
			className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-rose-100 sm:p-6 ${className}`}
		>
			{title || right ? (
				<header className="mb-4 flex items-start justify-between gap-4">
					<div>
						{title ? (
							<h2 className="font-display text-xl font-semibold text-slate-900">
								{title}
							</h2>
						) : null}
						{subtitle ? (
							<p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
						) : null}
					</div>
					{right ? <div className="shrink-0">{right}</div> : null}
				</header>
			) : null}
			{children}
		</section>
	);
}

export const STATUS_META: Record<
	TaskStatus,
	{ label: string; pill: string; button: string }
> = {
	not_started: {
		label: "Not started",
		pill: "bg-slate-100 text-slate-600",
		button: "bg-slate-600 text-white",
	},
	in_progress: {
		label: "In progress",
		pill: "bg-sky-100 text-sky-800",
		button: "bg-sky-600 text-white",
	},
	stuck: {
		label: "Stuck",
		pill: "bg-amber-100 text-amber-800",
		button: "bg-amber-500 text-white",
	},
	done: {
		label: "Done",
		pill: "bg-emerald-100 text-emerald-800",
		button: "bg-emerald-600 text-white",
	},
};

export function StatusPill({ status }: { status: TaskStatus }) {
	const meta = STATUS_META[status];
	return (
		<span
			className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.pill}`}
		>
			{meta.label}
		</span>
	);
}

const LEVEL_LABEL = ["", "Easy", "Medium", "Hard", "Challenge"];

export function LevelStars({ level }: { level: number }) {
	return (
		<span
			className="inline-flex items-center gap-0.5"
			title={`${LEVEL_LABEL[level]} (${level}/4)`}
		>
			{[1, 2, 3, 4].map((n) => (
				<Star
					key={n}
					className={`h-3.5 w-3.5 ${n <= level ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
				/>
			))}
		</span>
	);
}

/** A tickable list. Stretch items are marked and styled lighter. */
export function Checklist({
	items,
	checked,
	onToggle,
	readOnly,
}: {
	items: ChecklistItem[];
	checked: ReadonlySet<string>;
	onToggle: (itemId: string, checked: boolean) => void;
	readOnly: boolean;
}) {
	return (
		<ul className="space-y-2">
			{items.map((item) => {
				const isChecked = checked.has(item.id);
				return (
					<li key={item.id}>
						<label
							className={`flex items-start gap-3 rounded-xl px-3 py-2 transition ${readOnly ? "" : "cursor-pointer hover:bg-rose-50"} ${item.stretch ? "bg-violet-50/60" : ""}`}
						>
							<input
								type="checkbox"
								className="peer sr-only"
								checked={isChecked}
								disabled={readOnly}
								onChange={(e) => onToggle(item.id, e.target.checked)}
							/>
							<span
								aria-hidden
								className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-rose-300 ${isChecked ? "border-rose-500 bg-rose-500 text-white" : "border-slate-300 bg-white"}`}
							>
								{isChecked ? <Check className="h-3.5 w-3.5" /> : null}
							</span>
							<span
								className={`whitespace-pre-line text-sm leading-relaxed ${isChecked ? "text-slate-400 line-through" : "text-slate-700"}`}
							>
								{item.stretch ? (
									<span className="mr-1.5 inline-flex items-center gap-0.5 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 no-underline">
										<Sparkles className="h-3 w-3" /> Stretch
									</span>
								) : null}
								{item.text}
							</span>
						</label>
					</li>
				);
			})}
		</ul>
	);
}

/** Concept chips; tapping one opens its plain-English card underneath. */
export function ConceptChips({
	refs,
	concepts,
	learned,
}: {
	refs: ConceptRef[];
	concepts: Map<string, Concept>;
	learned?: ReadonlySet<string>;
}) {
	const [open, setOpen] = useState<string | null>(null);
	const openConcept = open ? concepts.get(open) : undefined;
	if (refs.length === 0) return null;
	return (
		<div>
			<div className="flex flex-wrap gap-2">
				{refs.map((ref) => {
					const concept = concepts.get(ref.conceptId);
					if (!concept) return null;
					const active = open === ref.conceptId;
					return (
						<button
							type="button"
							key={ref.conceptId}
							onClick={() => setOpen(active ? null : ref.conceptId)}
							aria-expanded={active}
							className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ring-1 transition ${active ? "bg-rose-500 text-white ring-rose-500" : "bg-white text-slate-700 ring-rose-200 hover:bg-rose-50"}`}
						>
							{ref.isNew ? (
								<span
									className={`rounded px-1 text-[10px] font-bold ${active ? "bg-white/25" : "bg-rose-100 text-rose-700"}`}
								>
									NEW
								</span>
							) : null}
							{concept.name}
							{learned?.has(concept.id) ? (
								<Check className="h-3.5 w-3.5 text-emerald-500" />
							) : null}
						</button>
					);
				})}
			</div>
			{openConcept ? <ConceptCard concept={openConcept} /> : null}
		</div>
	);
}

export function ConceptCard({
	concept,
	footer,
}: {
	concept: Concept;
	footer?: ReactNode;
}) {
	const link = concept.learnMore?.startsWith("http") ? concept.learnMore : null;
	return (
		<div className="mt-3 rounded-xl bg-rose-50/70 p-4 text-sm ring-1 ring-rose-100">
			<div className="flex items-center gap-2">
				<h3 className="font-semibold text-slate-900">{concept.name}</h3>
				<span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500 ring-1 ring-rose-100">
					{concept.type}
				</span>
			</div>
			<p className="mt-2 text-slate-700">{concept.plain}</p>
			<dl className="mt-3 grid gap-2 sm:grid-cols-2">
				<div>
					<dt className="text-xs font-semibold uppercase tracking-wide text-rose-700/70">
						Everyday example
					</dt>
					<dd className="text-slate-600">{concept.example}</dd>
				</div>
				<div>
					<dt className="text-xs font-semibold uppercase tracking-wide text-rose-700/70">
						Why it matters
					</dt>
					<dd className="text-slate-600">{concept.why}</dd>
				</div>
			</dl>
			{concept.learnMore ? (
				<p className="mt-3 text-slate-600">
					{link ? (
						<a
							href={link}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1 font-medium text-rose-600 hover:underline"
						>
							Learn more <ExternalLink className="h-3.5 w-3.5" />
						</a>
					) : (
						concept.learnMore
					)}
				</p>
			) : null}
			{footer}
		</div>
	);
}

export function StatTile({
	label,
	value,
	hint,
}: {
	label: string;
	value: ReactNode;
	hint?: ReactNode;
}) {
	return (
		<div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-rose-100">
			<div className="text-2xl font-semibold text-slate-900">{value}</div>
			<div className="text-sm text-slate-600">{label}</div>
			{hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
		</div>
	);
}

export function ErrorNote({ error }: { error: unknown }) {
	if (!error) return null;
	return (
		<p role="alert" className="mt-2 text-sm text-red-600">
			{error instanceof Error ? error.message : "Something went wrong."}
		</p>
	);
}

/** Thin progress bar (0–1). */
export function Meter({
	value,
	className = "",
}: {
	value: number;
	className?: string;
}) {
	return (
		<div
			className={`h-2 w-full overflow-hidden rounded-full bg-rose-100 ${className}`}
		>
			<div
				className="h-full rounded-full bg-rose-500 transition-all"
				style={{
					width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`,
				}}
			/>
		</div>
	);
}
