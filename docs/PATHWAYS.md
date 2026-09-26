# Course Pathways & Prerequisites — Feature Plan

How the planner should **suggest** courses, and how it should **validate** them, based on
prerequisites and the official SPU recommended sequence. The two ideas are distinct and the
feature needs both.

> Status: planning. Last updated 2026-06-22.
> Companion to [PLAN.md](./PLAN.md). Scope context: BS Computer Science, DTA transfer — see
> the project memory `spu-scheduler-goal`.

---

## 1. The core finding (why this needs hand-curated data)

The SPU **catalog does not publish course-level prerequisites**. Pulling every CSC course
description from the catalog, exactly **one** course states an enforceable prerequisite:

| Course | What the catalog actually says |
|---|---|
| CSC 2330 | "2.5 or better in 2 quarters (or 1 semester) of OOP taken outside SPU in a language other than C++" |
| CSC 4760 | "*Recommended* prerequisite: CSC 2431" (not enforced) |
| CSC 1800 | "demonstrable computer literacy" (not a course) |

Every other CSC course says **"none."** So the "course flow" the staff shared (the arrows
between boxes) **exists nowhere machine-readable** — it's an advising convention.

**But** the catalog's **Plan of Study** tab *does* publish a recommended quarter-by-quarter
sequence for both freshmen and transfers. That sequence encodes the same dependency
information in temporal order: if course B is always scheduled after course A, A is effectively
a prerequisite for B. That is our authoritative source for both pathways and (derived) prereqs.

**Consequence:** prerequisites must be **curated by hand** into our data and marked
`verified: true`. There is no scrape for them. The recommended pathways below are the raw
material.

Source: catalog [Computer Science (BS)](https://catalog.spu.edu/undergraduate/college-schools/cbt-technology/computer-science/computer-science-bs/),
[CSC course descriptions](https://catalog.spu.edu/undergraduate/course-descriptions/csc/),
and the [transfer schedule guide PDF](https://spu.edu/~/media/academics/college-of-arts-sciences/engineering-comp-sci/doc/transfer-cscis-suggested-schedule.ashx).

---

## 2. Two pathways, two student types

A freshman path is **not** the same as a transfer path. The feature must key suggestions on
**entry type**. SPU publishes exactly these two for BS CS.

### 2a. Freshman — Four-Year Plan (verbatim from catalog Plan of Study)

| Year | Autumn | Winter | Spring |
|---|---|---|---|
| **Freshman** | CSC 1250 (5), FYS 1000 (3), MAT 1234 (5) | CSC 1260 (5), MAT 1235 (5) | CSC 2430 (5), MAT 2401 (3) |
| **Sophomore** | Gen Ed (15) | CSC 2431 (5), MAT 1720 (5) | CSC 2099 (1); + MAT 2360 (5) / Science (5) / Gen Ed slotted variably |
| **Junior** | CSC 3310 (4), GS 3001 (1) | CSC 3011 (3), CSC 3220 (5), CSC 3430 (4) | CSC 3099 (1), CSC 3150 (5), CSC 3221 (5) |
| **Senior** | CSC 3750 (5), CSC 4410 (5), CSC 4896 (3), CSC 4941 (1) | CSC 4897 (3) | CSC 3350 (3), CSC 4898 (3) |

Total **128–138 credits** (includes Common + Exploratory Curriculum gen-ed).

### 2b. Transfer — Two-Year Plan (verbatim from catalog Plan of Study)

Assumes a DTA associate's + the pre-transfer prep is done (see §2c). Note it **starts with
CSC 2330**, the bridge course for transfers whose OOP was in a non-C++ language, then goes
straight into CSC 2431 — there is **no CSC 1250/1260/2430 at SPU** for this path.

| Year | Autumn | Winter | Spring |
|---|---|---|---|
| **Year 1** | CSC 2330 (5), GS 3001 (1), TCOR 3001 (5) | CSC 2431 (5), CSC 3011 (3), CSC 3220 (5), MAT 1720 (5) | CSC 2099 (1), CSC 3150 (5), CSC 3221 (5), MAT 2401 (3) |
| **Year 2** | CSC 3310 (4), CSC 3750 (5), CSC 4410 (5), CSC 4896 (3), CSC 4941 (1) | CSC 3430 (4), CSC 4897 (3) | CSC 3099 (1), CSC 3350 (3), CSC 4898 (3) |

Total **86–93 credits** (gen ed covered by DTA — this is the relevant number for our user).

The catalog also lists "any quarter" rows per year: technical electives (3–8 cr Year 1, 3–5 cr
Year 2) and **TCOR 3100 Christian Theology (5) in Year 2**. They have no fixed quarter, so
`pathways.json` omits them and `suggestPlan` won't place them. TCOR 3100 still counts in
`requirements.json`, so it shows as remaining until she places it herself.

### 2c. Pre-transfer prep (gates the whole transfer path)

To be on track for the 2-year plan, complete **before** transferring (SPU-equivalent codes):

- Two quarters of programming **including Data Structures**, same language (≈ CSC 1230/2430/2431; C++ preferred)
- Calculus I–II–III (≈ MAT 1234/1235/1236)
- Physics I–II–III (≈ PHY 1121/1122/1123)
- Helpful, not required: Statistics (MAT 2360), Linear Algebra (MAT 2401)

### 2d. Concrete freshman vs. transfer differences

| | Freshman | Transfer |
|---|---|---|
| Intro programming | Taken at SPU: CSC 1250 → 1260 → 2430 | Taken **elsewhere**; bridged via **CSC 2330** |
| First-year seminar | **FYS 1000** required | Not taken |
| Gen ed (Common/Exploratory) | Taken at SPU (~bulk of credits) | **Covered by DTA** |
| Calculus/Physics | At SPU in years 1–2 | **Pre-transfer prerequisite** |
| Duration | 4 years | 2 years |
| Total credits to plan | 128–138 | 86–93 |

Our user is the **transfer** case, but building the model for both keeps it correct and reusable.

---

## 3. Derived prerequisite graph (NEEDS HUMAN VERIFICATION)

Inferred from the sequence ordering + the few catalog statements + standard CS structure.
These are **proposals to confirm with an advisor / the staff chart**, not facts. Marked
`verified: false` until checked.

| Course | Derived prerequisite(s) | Basis |
|---|---|---|
| CSC 1260 | CSC 1250 | sequence |
| CSC 2430 | CSC 1260 | sequence |
| CSC 2431 | CSC 2430 **(C+ min)** OR CSC 2330 **(C+ min)** | sequence + "C+ in CSC 2330 or CSC 2430" rule |
| CSC 2330 | 2 qtrs OOP incl. Data Structures, non-C++, 2.5+ (pre-transfer) | catalog |
| CSC 3011 / 3150 / 3220 / 3310 / 3430 / 3750 / 4410 | CSC 2431 | all scheduled after 2431; standard data-structures gate |
| CSC 3221 | CSC 3220 | sequence (consecutive quarters) |
| CSC 3099 | CSC 2099 | "interview prep" two-course sequence |
| CSC 4896 → 4897 → 4898 | each prior capstone course | project sequence across 3 quarters |
| CSC 4941 | "after/while pursuing an approved internship or certification" | catalog note |
| MAT 1235 | MAT 1234 | calculus sequence |
| MAT 2401 | MAT 1235 (or 1234) | linear algebra after calculus |
| MAT 2360 | MAT 1234 | statistics after calculus I |

**Cross-cutting grade rule:** C- or better in any course applied to the major; **C+** or better
specifically in CSC 2330 / 2430 to advance.

> Data note: our [requirements.json](../src/data/requirements.json) General Core lists CSC
> **1250/1260**, matching the freshman plan; the transfer plan and transfer guide reference
> CSC **1230/2330**. Reconcile when curating — both numbering schemes are live.

---

## 4. Feature design

Two layers, mirroring §1's two ideas:

1. **Prerequisites = hard validation.** Curated `prereqs` per course; `buildPlanView` walks
   terms chronologically and flags a course placed before its prereqs are earned. 18/120
   courses have curated prereqs (all still `verified: false`); the rest pass unchecked.
2. **Pathways = soft suggestion.** Pick entry type → seed a suggested plan from the official
   sequence, adapted to what she's already completed and the days she can attend.

### UX flow (as built in `/plan`)

1. **Pick student type** — `Transfer` (default for our user) or `Freshman`.
2. We load that pathway template (§2a / §2b).
3. **Subtract what's done** — remove courses already in `completed` / covered by the DTA.
4. **Suggest** — `suggestPlan(pathway, completed, start)` lays the remaining pathway courses
   across *real* terms (rolling the year each Autumn) into `placements`
   (term key → course ids). No section data is involved, so it covers the whole multi-year plan.
5. **Decorate + validate** — `buildPlanView` attaches concrete sections from
   [sections.json](../src/data/sections.json) (fit to `availableDays`, overridable per course via
   `sectionChoices`) **only for the published schedule year**; later terms fall back to catalog
   "typically offered" hints. It flags prereq gaps, time clashes and credit load.
6. She edits from there. The suggestion is a *starting point*, not a lock.

An earlier design seeded one real section (CRN) per pathway course. It was dropped: sections
exist for ~1 academic year while pathways span 2–4, so it crammed everything into 2026-27.

---

## 5. Data-model changes

### 5a. Prerequisites — richer than a flat list

*(Implemented.)* The original `prereqs: string[]` (implicit AND) couldn't express "CSC 2430 **or** CSC 2330", grade
minimums, or corequisites. Now:

```ts
type Prereq =
  | { course: string; minGrade?: string }   // "CSC2431", optionally "C+"
  | { anyOf: Prereq[] }                      // OR group
  | { coreq: string };                       // allowed in the SAME quarter

interface Course {
  prereqs: Prereq[];   // implicit AND across the array (replaces string[])
  // ...existing fields
}
```

`isEligible` ([planner.ts](../src/lib/planner.ts)) uses the recursive
`prereqSatisfied(prereq, earned, sameTerm)`.

### 5b. Pathways — static data *(implemented)*

```ts
type EntryType = "freshman" | "transfer";

interface PathwayStep {
  termOffset: number;       // 0 = first quarter, 1 = next, ... (season order)
  courseIds: string[];
}

interface Pathway {
  entryType: EntryType;
  degree: "BS-CS";
  source: string;           // catalog Plan of Study URL
  totalCreditsRange: [number, number];
  steps: PathwayStep[];     // §2a / §2b transcribed
}
```

Lives in `src/data/pathways.json`; `entryType` is persisted in `AppState`.

---

## 6. Implementation phases

1. ✅ **Model + engine.** `Prereq` type, recursive eligibility, `pathways.json`,
   `suggestPlan(pathway, completed, start)` → `placements`.
2. ◐ **Curate prereqs.** §3's edges entered into `courses.json` (18 courses). **Not yet
   verified** against an advisor / the staff chart — every course is still `verified: false`.
3. ✅ **UI.** Entry-type selector + "Suggest plan" seeding `placements`; `buildPlanView` for
   section decoration and warnings.
4. ☐ **Polish.** Optional "what unlocks what" prereq view mirroring the chart.

---

## 7. Open questions / verification

- [ ] Confirm the derived prereqs in §3 with the staff chart or Dr. Dingler (chair).
- [ ] Confirm our user's actual transferred courses → which pathway courses are already done.
- [ ] CSC numbering: 1250/1260 (freshman) vs 1230/2330 (transfer/guide) — which apply to her?
- [ ] Does she need CSC 2330 (non-C++ bridge) or did she take C++ → straight to CSC 2431?
- [ ] Sections data is for 2026–27 only; later terms show catalog hints, not sections. Re-scrape
      each year (`TERM_YEAR` in scripts/scrape.ts). spu.edu's WAF currently 403s scripted
      requests to the time schedule, so the scraper keeps the existing `sections.json` when that
      happens.
```
