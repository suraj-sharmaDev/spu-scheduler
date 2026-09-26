# SPU Scheduler — Project Plan

A personal course-planning tool to help plan a 2-year **BS in Computer Science** at
**Seattle Pacific University (SPU)** after transferring from **North Seattle College**
on a **DTA** (Direct Transfer Agreement).

> Status: planning complete, not yet built. Last updated 2026-06-19.

---

## 1. Goal & scope

**Goal:** Let the user pick a quarter (Autumn / Winter / Spring / Summer) and plan which
courses to take, respecting prerequisites, quarter availability, and a sane credit load —
producing a clear multi-quarter path to graduation.

**Scope decision — this is the key insight:**
Because the DTA satisfies SPU's general-education / Common Curriculum requirements, the
remaining 2 years are almost entirely the **CS major + MAT (calculus) sequence + residency**.
That's roughly **15–20 courses** with a defined prerequisite chain — *not* the whole catalog.

We model only that path. This keeps the dataset tiny, hand-verifiable, and the tool genuinely
useful (a focused planner) rather than a generic course browser.

**Explicitly out of scope (for v1):**
- Day/time-of-day scheduling and time-conflict detection (would require the volatile
  quarterly time schedule — see §3).
- General-education / Common Curriculum tracking (DTA covers it).
- Multi-user, accounts, or any backend.

> Update 2026-09-26: the scheduler itself is still client-only, but the app now also
> hosts the Learning Tracker, which has a backend (Neon Postgres + passcode login).
> See [TRACKER.md](TRACKER.md).

---

## 2. Key decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Scheduling granularity | **Quarter-level** | Catalog already encodes quarter availability; no need for volatile time data. |
| Data acquisition | **Scrape** SPU catalog → static JSON | Re-runnable per catalog year; committed to repo. |
| Catalog year & transcript | **Unknown for now** | Build with a user-editable "transferred courses" input (localStorage). |
| Hosting | **Static / client-side only** | No backend, deploys anywhere, zero ongoing cost. |

**Stack (already scaffolded):** TanStack Start (React 19, file-based routing),
TanStack Query, Tailwind v4, Biome, pnpm, Vitest.

---

## 3. Data sources & critical findings

| Source | URL | Use |
|---|---|---|
| CSC course descriptions | https://catalog.spu.edu/undergraduate/course-descriptions/csc/ | code, title, credits, prereqs, **quarter offered** |
| BS-CS degree requirements | https://spu.edu/computer-science-bs-reqs | which courses are *required* + totals |
| Quarterly time schedule | https://spu.edu/undergraduate-time-schedule | (NOT used in v1 — volatile days/times) |

**Critical finding #1 — quarter availability is in the stable catalog.**
The course-descriptions page lists `Offered: Autumn / Winter / Spring / Alternate Years`
per course. So quarter-level planning needs **only the stable catalog**, scraped once per
catalog year — never the time schedule that changes every term. This is what makes the
static-asset approach work cleanly.

**Critical finding #2 — prerequisites are messy.**
Prereqs are inconsistently formatted: some labeled (`Prerequisite: CSC 2430`), some buried
in prose, and several advanced courses show none when they almost certainly have one.
➜ **Scraper output MUST be human-verified before trusting it.**

**Critical finding #3 — course list ≠ degree requirements.**
The course-descriptions page lists *all* CSC courses; *which* ones the BS actually requires
is a separate page (plus the MAT calculus sequence). Two separate scrapes.

**SPU calendar:** quarter system — Autumn, Winter, Spring, optional Summer. Most courses
are 5 credits; full-time load is ~12–18 credits/quarter.

---

## 4. Data model

Static JSON committed under `src/data/`. Hand-verified after each scrape.

```jsonc
// courses.json — durable, from catalog
{
  "id": "CSC2430",
  "title": "Object Oriented Programming",
  "credits": 5,
  "offered": ["AUT", "SPR"],        // AUT | WIN | SPR | SUM | ALT (alternate years)
  "prereqs": ["CSC1230"],           // array of course ids (AND logic)
  "prereqsRaw": "Prerequisite: CSC 1230",  // original text, for verification
  "category": "CS_CORE",            // CS_CORE | CS_ELECTIVE | MATH | OTHER
  "minGrade": "C+",                 // optional, e.g. CSC 2330/2430 gate
  "verified": false                 // flips to true after human review
}
```

```jsonc
// requirements.json — what the BS-CS degree demands (tag with catalogYear)
{
  "catalogYear": "2025-26",
  "totalCreditsForDegree": 180,
  "groups": [
    { "name": "CS Core", "required": ["CSC2430", "CSC2431", "..."] },
    { "name": "CS Electives", "chooseCredits": 15, "from": ["CSC4410", "..."] },
    { "name": "Math", "required": ["MAT1234", "..."] }
  ]
}
```

```jsonc
// transferred.json (or localStorage) — what she brings / has done
{ "completed": ["CSC1230", "MAT1234"], "dtaComplete": true, "catalogYear": "2025-26" }
```

> Prereq logic: start with simple AND-arrays. If real data needs OR / "one of",
> upgrade to `prereqs: { allOf: [...], oneOf: [[...]] }` later.

---

## 5. Scraper

A one-shot Node script, run manually, output committed as JSON.

- **Location:** `scripts/scrape.ts`, run via `pnpm dlx tsx scripts/scrape.ts` (or add a script).
- **Steps:**
  1. Fetch the CSC course-descriptions page → parse each course block →
     extract code, title, credits, `offered`, `prereqsRaw`.
  2. Parse `prereqsRaw` into `prereqs[]` with a regex for `CSC ####` / `MAT ####` tokens.
     Leave anything ambiguous in `prereqsRaw` and set `verified: false`.
  3. Fetch the BS-CS requirements page → build `requirements.json`.
  4. Write `src/data/*.json`.
- **Then:** a human reviews every course, fixes prereqs, sets `verified: true`.
- **Re-run:** once per catalog year, or when requirements change.

> Keep the scraper dumb and the verification explicit. Do not let unverified data drive
> the planner silently — surface a "⚠ unverified prereqs" badge in the UI.

---

## 6. App architecture

Client-side only, on the existing TanStack Start base. Data imported as static JSON.

**Routes**
- `/` — overview: degree progress (completed vs remaining credits & groups).
- `/plan` — the quarter planner (core screen).
- `/transferred` — edit completed/transferred courses (persisted to localStorage).

**Core planner (`/plan`)**
- A timeline of quarters (e.g. AUT 25 → SPR 27).
- For a selected quarter, show **eligible** courses:
  *prereqs satisfied (from transferred + earlier planned quarters)* **AND**
  *offered that quarter* **AND** *not already taken/planned*.
- Add a course to a quarter → live validation:
  - ❌ prereq gap
  - ⚠ credit overload (> ~18/quarter)
  - ⚠ "Autumn-only / alternate-years — you may miss it"
  - ⚠ unverified data
- Persist the whole plan to localStorage.

**State**
- Static data: import JSON directly (or load via TanStack Query for caching ergonomics).
- User plan + transferred courses: localStorage (a small store / context).

**Pure logic to unit-test (Vitest):**
- `isEligible(course, { completed, plannedBefore, quarter })`
- `creditsForQuarter(plan, quarter)`
- `remainingRequirements(requirements, completed, plan)`
- `validatePlan(plan)` → list of warnings/errors

---

## 7. Build order

1. **Scraper + verified data** (`scripts/scrape.ts` → `src/data/*.json`, hand-checked).
   *Everything depends on this and the data quality needs human eyes — do it first.*
2. **Domain logic + tests** — the pure functions in §6, with Vitest coverage.
3. **`/transferred` + `/` overview** — input completed courses, see what's left.
4. **`/plan` quarter planner** — eligibility filtering, timeline, live validation.
5. **Polish** — persistence, empty/error states, "share/export plan" (e.g. JSON or print).

---

## 8. Open questions / inputs needed

- [ ] **Catalog year** she'll be admitted under (requirements are tied to it).
- [ ] **Transferred/completed courses** (DTA + any CS/math already done at NSC).
- [ ] Exact **BS-CS required course list** + the **MAT sequence** (confirm from requirements page).
- [ ] Any **C+/grade gates** beyond CSC 2330/2430.
- [ ] OR-style prerequisites — does the real data need "one of" logic?

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Catalog data goes stale (yearly) | Re-run scraper per catalog year; tag data with `catalogYear`. |
| Prereq data wrong/missing | Mandatory human verification; `verified` flag + UI warning badge. |
| Requirements differ from assumptions | Confirm against advisor / official degree audit before relying on it. |
| Scraper breaks if site HTML changes | It's a manual one-shot; fix when re-running. Keep raw text in JSON. |

> ⚠ This tool is a **planning aid, not an official degree audit.** Always confirm the final
> plan with an SPU academic advisor.
