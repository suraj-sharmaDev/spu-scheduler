import {
	queryOptions,
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import {
	type ActiveSession,
	checkIn,
	discardStudySession,
	finishStudySession,
	getTrackerState,
	logMakeup,
	saveProjectReview,
	saveWeeklyReflection,
	startStudySession,
	type TrackerState,
	toggleChecklist,
	updateStudySession,
	updateTask,
} from "./api";
import { pauseTimer, resumeTimer, timerOf } from "./session";
import type { TaskStatus } from "./status";

export const trackerQuery = (project: string) =>
	queryOptions({
		queryKey: ["tracker", project],
		queryFn: () => getTrackerState({ data: { project } }),
	});

export function useTracker(project: string): TrackerState {
	return useSuspenseQuery(trackerQuery(project)).data;
}

/** Server clock minus client clock (ms), from the latest tracker read. */
export function useClockSkew(project: string): number {
	const { data, dataUpdatedAt } = useSuspenseQuery(trackerQuery(project));
	return Date.parse(data.serverNow) - dataUpdatedAt;
}

/**
 * A mutation that optionally applies `optimistic` to the cached state right
 * away, rolls back on error, and refetches when it settles.
 */
function useTrackerMutation<V, R = unknown>(
	project: string,
	mutationFn: (vars: V) => Promise<R>,
	optimistic?: (state: TrackerState, vars: V) => TrackerState,
) {
	const queryClient = useQueryClient();
	const key = trackerQuery(project).queryKey;
	return useMutation({
		mutationFn,
		onMutate: async (vars: V) => {
			if (!optimistic) return { previous: undefined };
			await queryClient.cancelQueries({ queryKey: key });
			const previous = queryClient.getQueryData(key);
			if (previous) queryClient.setQueryData(key, optimistic(previous, vars));
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) queryClient.setQueryData(key, context.previous);
		},
		// All projects: attendance and the open session are shared across them.
		onSettled: () => queryClient.invalidateQueries({ queryKey: ["tracker"] }),
	});
}

export interface TaskPatch {
	taskId: string;
	status?: TaskStatus;
	minutes?: number | null;
	notes?: string;
}

export function useUpdateTask(project: string) {
	return useTrackerMutation(
		project,
		(patch: TaskPatch) => updateTask({ data: { project, ...patch } }),
		(state, { taskId, ...patch }) => {
			const prev = state.progress[taskId] ?? {
				status: "not_started" as const,
				minutes: null,
				notes: "",
				updatedAt: new Date().toISOString(),
			};
			const next = { ...prev };
			if (patch.status !== undefined) next.status = patch.status;
			if (patch.minutes !== undefined) next.minutes = patch.minutes;
			if (patch.notes !== undefined) next.notes = patch.notes;
			return { ...state, progress: { ...state.progress, [taskId]: next } };
		},
	);
}

export function useToggleChecklist(project: string) {
	return useTrackerMutation(
		project,
		(vars: { itemId: string; checked: boolean }) =>
			toggleChecklist({ data: { project, ...vars } }),
		(state, { itemId, checked }) => ({
			...state,
			checkedItems: checked
				? [...new Set([...state.checkedItems, itemId])]
				: state.checkedItems.filter((id) => id !== itemId),
		}),
	);
}

export function useCheckIn(project: string) {
	return useTrackerMutation(project, () => checkIn());
}

export function useLogMakeup(project: string) {
	return useTrackerMutation(project, (vars: { note?: string }) =>
		logMakeup({ data: vars }),
	);
}

export function useSaveReflection(project: string) {
	return useTrackerMutation(
		project,
		(vars: {
			week: number;
			answers: Record<string, string>;
			confidence: number | null;
		}) => saveWeeklyReflection({ data: { project, ...vars } }),
	);
}

export function useSaveReview(project: string) {
	return useTrackerMutation(
		project,
		(vars: { subject: string; answers: Record<string, string> }) =>
			saveProjectReview({ data: { project, ...vars } }),
	);
}

// --- guided sessions ------------------------------------------------------------

const withSession = (
	state: TrackerState,
	fn: (s: ActiveSession) => ActiveSession | null,
): TrackerState => ({
	...state,
	activeSession: state.activeSession ? fn(state.activeSession) : null,
});

export function useStartSession(project: string) {
	return useTrackerMutation(project, (taskId: string) =>
		startStudySession({ data: { project, taskId } }),
	);
}

export type SessionAction =
	| { action: "pause" }
	| { action: "resume" }
	| { action: "step"; step: number };

export function useSessionControl(project: string) {
	return useTrackerMutation(
		project,
		(vars: SessionAction & { id: number }) =>
			updateStudySession({ data: vars }),
		(state, vars) =>
			withSession(state, (s) => {
				if (vars.action === "step") return { ...s, step: vars.step };
				const now = Date.now();
				const timer =
					vars.action === "pause"
						? pauseTimer(timerOf(s), now)
						: resumeTimer(timerOf(s), now);
				return {
					...s,
					bankedMs: timer.bankedMs,
					runningSince:
						timer.runningSince === null
							? null
							: new Date(timer.runningSince).toISOString(),
				};
			}),
	);
}

export function useFinishSession(project: string) {
	return useTrackerMutation(
		project,
		(vars: {
			id: number;
			taskId: string;
			outcome: TaskStatus;
			minutes: number;
		}) => finishStudySession({ data: { project, ...vars } }),
	);
}

// Not optimistic: clearing the session early would unmount the confirm panel
// before its onSuccess (which navigates away) could run.
export function useDiscardSession(project: string) {
	return useTrackerMutation(project, (id: number) =>
		discardStudySession({ data: { id } }),
	);
}
