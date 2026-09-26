/** Status values shared by the DB schema, server functions and UI. Kept free of
 *  drizzle imports so client components can use them without bundling the ORM. */

export const TASK_STATUSES = [
	"not_started",
	"in_progress",
	"stuck",
	"done",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ATTENDANCE_STATUSES = ["present", "late", "makeup"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
