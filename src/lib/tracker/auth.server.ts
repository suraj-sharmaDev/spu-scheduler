import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
	deleteCookie,
	getCookie,
	setCookie,
} from "@tanstack/react-start/server";

export type Role = "learner" | "admin";

const COOKIE = "tracker_session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const MIN_SECRET_LENGTH = 32;

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
}

function secret(): string {
	const value = requireEnv("SESSION_SECRET");
	if (value.length < MIN_SECRET_LENGTH) {
		throw new Error(
			`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`,
		);
	}
	return value;
}

/** Constant-time string comparison (hashing first equalises lengths). */
function safeEqual(a: string, b: string): boolean {
	const ha = createHash("sha256").update(a).digest();
	const hb = createHash("sha256").update(b).digest();
	return timingSafeEqual(ha, hb);
}

function sign(payload: string): string {
	return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function roleForPasscode(passcode: string): Role | null {
	// Check both so timing doesn't reveal which role matched.
	const learner = safeEqual(passcode, requireEnv("TRACKER_LEARNER_PASSCODE"));
	const admin = safeEqual(passcode, requireEnv("TRACKER_ADMIN_PASSCODE"));
	if (learner) return "learner";
	if (admin) return "admin";
	return null;
}

export function startSession(role: Role): void {
	const expires = Date.now() + MAX_AGE_SECONDS * 1000;
	const payload = `${role}.${expires}`;
	setCookie(COOKIE, `${payload}.${sign(payload)}`, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: MAX_AGE_SECONDS,
	});
}

export function endSession(): void {
	deleteCookie(COOKIE, { path: "/" });
}

export function readSession(): { role: Role } | null {
	const raw = getCookie(COOKIE);
	if (!raw) return null;
	const [role, expires, signature] = raw.split(".");
	if (!role || !expires || !signature) return null;
	if (!safeEqual(signature, sign(`${role}.${expires}`))) return null;
	if (Number(expires) < Date.now()) return null;
	if (role !== "learner" && role !== "admin") return null;
	return { role };
}

/** Throws unless the current session has one of `roles`. */
export function requireRole(...roles: Role[]): Role {
	const session = readSession();
	if (!session) throw new Error("Please sign in again.");
	if (!roles.includes(session.role)) {
		throw new Error("This account is read-only.");
	}
	return session.role;
}
