import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Locally the connection string lives in .env; on Vercel it's already in the environment.
if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/lib/tracker/db/schema.ts",
	out: "./drizzle",
	dbCredentials: { url },
});
