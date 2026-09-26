import { Check, CloudOff, Loader2 } from "lucide-react";
import type { Template } from "#/lib/tracker/types";
import type { SaveStatus } from "#/lib/tracker/useSession";

/** Notes textarea with one-tap templates and a save indicator (saving is automatic). */
export function NotesBox({
	text,
	onChange,
	onBlur,
	status,
	templates,
	readOnly,
	rows = 8,
	placeholder = "Short answers, links you found, pseudocode…",
	label,
}: {
	text: string;
	onChange: (text: string) => void;
	onBlur?: () => void;
	status: SaveStatus;
	templates: Template[];
	readOnly: boolean;
	rows?: number;
	placeholder?: string;
	label?: string;
}) {
	const insert = (body: string) =>
		onChange(text.trim() ? `${text.trimEnd()}\n\n${body}` : body);

	return (
		<div>
			<div className="mb-2 flex flex-wrap items-center gap-2">
				{label ? (
					<span className="mr-auto text-sm font-medium text-slate-700">
						{label}
					</span>
				) : null}
				{!readOnly
					? templates.map((t) => (
							<button
								key={t.name}
								type="button"
								onClick={() => insert(t.body)}
								className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
							>
								+ {t.name} template
							</button>
						))
					: null}
			</div>
			<textarea
				value={text}
				readOnly={readOnly}
				onChange={(e) => onChange(e.target.value)}
				onBlur={onBlur}
				rows={rows}
				placeholder={placeholder}
				className="w-full rounded-xl border border-rose-200 px-3 py-2 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-300"
			/>
			{!readOnly ? (
				<p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
					{status === "error" ? (
						<span className="flex items-center gap-1 text-red-600">
							<CloudOff className="h-3.5 w-3.5" /> Couldn't save. Keep typing to
							retry, or check your connection.
						</span>
					) : status === "saved" ? (
						<>
							<Check className="h-3.5 w-3.5" /> Saved
						</>
					) : (
						<>
							<Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
						</>
					)}
				</p>
			) : null}
		</div>
	);
}
