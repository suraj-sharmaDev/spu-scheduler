/** Small validators for server-function inputs. Each throws a readable error. */

export function object(input: unknown): Record<string, unknown> {
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		throw new Error("Expected an object");
	}
	return input as Record<string, unknown>;
}

export function string(
	value: unknown,
	name: string,
	maxLength: number,
): string {
	if (typeof value !== "string") throw new Error(`${name} must be text`);
	if (value.length > maxLength) {
		throw new Error(`${name} is too long (max ${maxLength} characters)`);
	}
	return value;
}

export function integer(
	value: unknown,
	name: string,
	min: number,
	max: number,
): number {
	if (typeof value !== "number" || !Number.isInteger(value)) {
		throw new Error(`${name} must be a whole number`);
	}
	if (value < min || value > max) {
		throw new Error(`${name} must be between ${min} and ${max}`);
	}
	return value;
}

export function boolean(value: unknown, name: string): boolean {
	if (typeof value !== "boolean")
		throw new Error(`${name} must be true or false`);
	return value;
}

export function oneOf<T extends string>(
	value: unknown,
	name: string,
	options: readonly T[],
): T {
	if (typeof value !== "string" || !options.includes(value as T)) {
		throw new Error(`${name} must be one of ${options.join(", ")}`);
	}
	return value as T;
}

/** Answers keyed by question; only known questions, bounded length. */
export function answers(
	value: unknown,
	questions: readonly string[],
	maxLength: number,
): Record<string, string> {
	const raw = object(value);
	const out: Record<string, string> = {};
	for (const [key, answer] of Object.entries(raw)) {
		if (!questions.includes(key)) throw new Error(`Unknown question "${key}"`);
		out[key] = string(answer, key, maxLength);
	}
	return out;
}
