/**
 * Pieces of a worked-example lesson: the labelled example, step hints, the
 * put-it-in-order puzzle and recall cards. Each shows one thing at a time.
 */
import {
	BookOpen,
	Check,
	Eye,
	Lightbulb,
	RotateCcw,
	ThumbsUp,
	Undo2,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type { RecallCard } from "#/lib/tracker/recall";
import type { Example, Hint, OrderPuzzle } from "#/lib/tracker/types";
import { Modal } from "./Modal";

export function CodeBlock({ code }: { code: string }) {
	return (
		<pre className="overflow-x-auto rounded-xl bg-slate-900 px-4 py-3 font-mono text-sm leading-relaxed text-slate-100">
			<code>{code}</code>
		</pre>
	);
}

/** Tap to see the answer. Used for predictions and recall cards. */
function Reveal({
	answer,
	label = "Show answer",
}: {
	answer: string;
	label?: string;
}) {
	const [shown, setShown] = useState(false);
	return shown ? (
		<p className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900">
			{answer}
		</p>
	) : (
		<button
			type="button"
			onClick={() => setShown(true)}
			className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
		>
			<Eye className="h-4 w-4" /> {label}
		</button>
	);
}

/**
 * The labelled example. `stepwise` reveals one piece at a time (first viewing,
 * so she isn't handed the whole program at once); otherwise everything shows.
 */
export function ExampleView({
	example,
	stepwise = false,
	footer,
}: {
	example: Example;
	stepwise?: boolean;
	/** Shown once every piece is visible. */
	footer?: ReactNode;
}) {
	const [shown, setShown] = useState(stepwise ? 1 : example.blocks.length);
	const allShown = shown >= example.blocks.length;
	return (
		<div className="space-y-5">
			<p className="font-medium text-slate-800">{example.title}</p>
			{example.blocks.slice(0, shown).map((block) => (
				<div key={block.label}>
					<p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700/80">
						{block.label}
					</p>
					<CodeBlock code={block.code} />
				</div>
			))}
			{!allShown ? (
				<button
					type="button"
					onClick={() => setShown((n) => n + 1)}
					className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
				>
					Next piece ({shown + 1} of {example.blocks.length})
				</button>
			) : null}
			{allShown && example.predict ? (
				<div className="space-y-3 rounded-2xl bg-amber-50/80 p-4">
					<p className="text-sm font-semibold text-amber-900">
						Guess before you run it
					</p>
					<p className="text-slate-800">{example.predict.question}</p>
					<Reveal answer={example.predict.answer} />
				</div>
			) : null}
			{allShown ? footer : null}
		</div>
	);
}

/** "See the example" button that opens it in a modal. */
export function ExampleButton({ example }: { example: Example }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
			>
				<BookOpen className="h-4 w-4" /> See the example
			</button>
			<Modal open={open} onClose={() => setOpen(false)} title="The example">
				<ExampleView example={example} />
			</Modal>
		</>
	);
}

export function HintButton({ hint }: { hint: Hint }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-50"
			>
				<Lightbulb className="h-4 w-4" /> Need a hint?
			</button>
			<Modal open={open} onClose={() => setOpen(false)} title="Hint">
				<div className="space-y-4">
					{hint.text ? (
						<p className="text-lg text-slate-800">{hint.text}</p>
					) : null}
					{hint.code ? <CodeBlock code={hint.code} /> : null}
				</div>
			</Modal>
		</>
	);
}

/** Same shuffle every time for the same puzzle, so a reload doesn't reshuffle. */
export function shuffled(count: number, seed: string): number[] {
	let h = 2166136261;
	for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	const next = () => {
		h = Math.imul(h ^ (h >>> 15), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		h ^= h >>> 16;
		return (h >>> 0) / 4294967296;
	};
	const out = Array.from({ length: count }, (_, i) => i);
	for (let i = count - 1; i > 0; i--) {
		const j = Math.floor(next() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	// Never hand out the puzzle already solved.
	if (count > 1 && out.every((v, i) => v === i)) out.push(out.shift() ?? 0);
	return out;
}

/**
 * Index of the first wrong line, or -1 when every line is right. Lines are
 * compared by text, so two identical "}" lines are interchangeable.
 */
export function firstWrongLine(lines: string[], picked: number[]): number {
	return picked.findIndex((p, i) => lines[p] !== lines[i]);
}

export function OrderPuzzleView({
	puzzle,
	seed,
}: {
	puzzle: OrderPuzzle;
	seed: string;
}) {
	const pool = useMemo(
		() => shuffled(puzzle.lines.length, seed),
		[puzzle.lines.length, seed],
	);
	const [picked, setPicked] = useState<number[]>([]);
	const [checked, setChecked] = useState(false);
	const left = pool.filter((i) => !picked.includes(i));
	const complete = left.length === 0;
	const wrong = firstWrongLine(puzzle.lines, picked);
	const solved = complete && wrong === -1;

	const pick = (i: number) => {
		setChecked(false);
		setPicked((p) => [...p, i]);
	};
	const undo = () => {
		setChecked(false);
		setPicked((p) => p.slice(0, -1));
	};

	return (
		<div className="space-y-5">
			<p className="text-lg text-slate-800">{puzzle.prompt}</p>

			<ol
				aria-label="Your program"
				className="min-h-16 space-y-1 rounded-2xl bg-slate-900 p-3 font-mono text-sm text-slate-100"
			>
				{picked.length === 0 ? (
					<li className="px-2 py-1 font-sans text-slate-400">
						Tap the lines below in order.
					</li>
				) : null}
				{picked.map((p, i) => (
					<li
						key={p}
						className={`whitespace-pre rounded px-2 py-1 ${checked && i === wrong ? "bg-amber-500/30 ring-1 ring-amber-400" : solved ? "bg-emerald-500/20" : ""}`}
					>
						{puzzle.lines[p]}
					</li>
				))}
			</ol>

			{left.length > 0 ? (
				<ul className="flex flex-col gap-2" aria-label="Lines to place">
					{left.map((i) => (
						<li key={i}>
							<button
								type="button"
								onClick={() => pick(i)}
								className="w-full whitespace-pre rounded-xl bg-white px-3 py-2 text-left font-mono text-sm text-slate-800 ring-1 ring-slate-200 hover:bg-rose-50 hover:ring-rose-300"
							>
								{puzzle.lines[i].trimStart()}
							</button>
						</li>
					))}
				</ul>
			) : null}

			<div className="flex flex-wrap items-center gap-3">
				{picked.length > 0 && !solved ? (
					<button
						type="button"
						onClick={undo}
						className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
					>
						<Undo2 className="h-4 w-4" /> Undo
					</button>
				) : null}
				{complete && !solved ? (
					<button
						type="button"
						onClick={() => setChecked(true)}
						className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
					>
						Check it
					</button>
				) : null}
				{picked.length > 0 ? (
					<button
						type="button"
						onClick={() => {
							setPicked([]);
							setChecked(false);
						}}
						className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
					>
						<RotateCcw className="h-4 w-4" /> Start again
					</button>
				) : null}
			</div>

			{solved ? (
				<p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
					<Check className="h-5 w-5" /> That's it! Every line is in the right
					place.
				</p>
			) : checked ? (
				<p className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
					Line {wrong + 1} isn't right yet. Undo back to it and try again.
				</p>
			) : null}
		</div>
	);
}

/**
 * One card at a time: question, tap to reveal, then "Got it" or "Not yet".
 * The list is fixed when the step opens, so answering doesn't reshuffle it.
 */
export function RecallDeck({
	cards,
	onAnswer,
	readOnly,
}: {
	cards: RecallCard[];
	onAnswer: (cardId: string, gotIt: boolean) => void;
	readOnly: boolean;
}) {
	const [index, setIndex] = useState(0);
	const [shown, setShown] = useState(false);
	const card = cards[index];

	if (!card) {
		return (
			<p className="rounded-2xl bg-emerald-50 px-4 py-6 text-center text-lg text-emerald-900">
				All done. Nice remembering!
			</p>
		);
	}

	const answer = (gotIt: boolean) => {
		if (!readOnly) onAnswer(card.id, gotIt);
		setShown(false);
		setIndex((i) => i + 1);
	};

	return (
		<div className="space-y-6">
			<p className="text-sm text-slate-500">
				Question {index + 1} of {cards.length}
			</p>
			<p className="font-display text-2xl leading-snug text-slate-900">
				{card.q}
			</p>
			{shown ? (
				<>
					<p className="rounded-2xl bg-emerald-50 px-5 py-4 text-lg text-emerald-900">
						{card.a}
					</p>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							onClick={() => answer(true)}
							className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
						>
							<ThumbsUp className="h-5 w-5" /> I knew it
						</button>
						<button
							type="button"
							onClick={() => answer(false)}
							className="rounded-xl px-5 py-3 font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
						>
							Not yet
						</button>
					</div>
				</>
			) : (
				<button
					type="button"
					onClick={() => setShown(true)}
					className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-3 font-semibold text-white hover:bg-rose-600"
				>
					<Eye className="h-5 w-5" /> Show answer
				</button>
			)}
		</div>
	);
}
