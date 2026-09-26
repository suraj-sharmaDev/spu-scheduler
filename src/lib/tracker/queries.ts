import {
	queryOptions,
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import {
	checkIn,
	getTrackerState,
	logMakeup,
	saveProjectReview,
	saveWeeklyReflection,
	type TrackerState,
	toggleChecklist,
	updateTask,
} from "./api";
import type { TaskStatus } from "./status";

export const trackerQuery = (project: string) =>
	queryOptions({
		queryKey: ["tracker", project],
		queryFn: () => getTrackerState({ data: { project } }),
	});

export function useTracker(project: string): TrackerState {
	return useSuspenseQuery(trackerQuery(project)).data;
}

/**
 * A mutation that optionally applies `optimistic` to the cached state right
 * away, rolls back on error, and refetches when it settles.
 */
function useTrackerMutation<V>(
	project: string,
	mutationFn: (vars: V) => Promise<unknown>,
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
		onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
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
