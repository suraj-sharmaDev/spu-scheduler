import { useCallback, useEffect, useRef, useState } from "react";
import { useUpdateTask } from "./queries";
import { elapsedMs, timerOf } from "./session";

// --- open session timer --------------------------------------------------------

/**
 * Elapsed ms of a server-stored session, ticking every second. `skewMs`
 * (server minus client clock) keeps a phone with a wrong clock honest.
 * Returns 0 during SSR/first render to avoid hydration mismatches.
 */
export function useSessionElapsed(
	session: { runningSince: string | null; bankedMs: number } | null,
	skewMs: number,
): number {
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		setNow(Date.now());
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);
	if (!session || now === null) return session?.bankedMs ?? 0;
	return elapsedMs(timerOf(session), now + skewMs);
}

// --- notes that save as you type ---------------------------------------------

const AUTOSAVE_DELAY_MS = 1000;

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

/**
 * Local notes text that saves itself a second after typing stops (and on
 * `flush()`). Server updates are picked up only when there are no local edits.
 */
export function useAutosaveNotes(
	project: string,
	taskId: string,
	serverNotes: string,
	enabled: boolean,
) {
	const [text, setTextState] = useState(serverNotes);
	const lastSaved = useRef(serverNotes);
	const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
	const update = useUpdateTask(project);
	const { mutate } = update;

	const dirty = text !== lastSaved.current;

	// biome-ignore lint/correctness/useExhaustiveDependencies: react only to new server values, not local typing
	useEffect(() => {
		if (text === lastSaved.current && serverNotes !== lastSaved.current) {
			lastSaved.current = serverNotes;
			setTextState(serverNotes);
		}
	}, [serverNotes]);

	const save = useCallback(
		(value: string) => {
			if (!enabled || value === lastSaved.current) return;
			const previous = lastSaved.current;
			lastSaved.current = value;
			mutate(
				{ taskId, notes: value },
				{
					// Mark the text unsaved again so the next edit or flush retries.
					onError: () => {
						if (lastSaved.current === value) lastSaved.current = previous;
					},
				},
			);
		},
		[enabled, mutate, taskId],
	);

	const flush = useCallback(() => {
		if (pending.current) clearTimeout(pending.current);
		pending.current = null;
		save(text);
	}, [save, text]);

	const setText = (value: string) => {
		setTextState(value);
		if (pending.current) clearTimeout(pending.current);
		pending.current = setTimeout(() => save(value), AUTOSAVE_DELAY_MS);
	};

	// Save whatever is pending when the component goes away.
	const latest = useRef({ text, save });
	latest.current = { text, save };
	useEffect(
		() => () => {
			if (pending.current) {
				clearTimeout(pending.current);
				latest.current.save(latest.current.text);
			}
		},
		[],
	);

	const status: SaveStatus = update.isError
		? "error"
		: dirty
			? "unsaved"
			: update.isPending
				? "saving"
				: "saved";

	return { text, setText, flush, status, error: update.error };
}
