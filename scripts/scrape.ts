/**
 * SPU Scheduler — catalog scraper (one-shot, run manually).
 *
 *   pnpm scrape
 *   # or: node --experimental-strip-types scripts/scrape.ts
 *
 * Produces two committed, human-verifiable JSON files:
 *   src/data/courses.json       — durable course facts from the catalog
 *   src/data/requirements.json  — what the BS-CS degree demands
 *
 * It scrapes the *stable* catalog only (course-descriptions pages + the BS-CS
 * program page). The volatile quarterly time schedule is intentionally ignored
 * because quarter-of-offering already lives in the catalog (see docs/PLAN.md §3).
 *
 * IMPORTANT: prerequisites and requirement groups are inconsistently formatted on
 * the source pages. Everything this script emits has `verified: false`. A human
 * MUST review the output before the planner is allowed to trust it.
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { JSDOM } from "jsdom"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const COURSE_DESC_BASE = "https://catalog.spu.edu/undergraduate/course-descriptions/"
const REQUIREMENTS_URL =
  "https://catalog.spu.edu/undergraduate/college-schools/cbt-technology/computer-science/computer-science-bs/"

/** Subjects scraped in full (the major + its math sequence). Others referenced by
 * the degree (e.g. a single CHM/PHY science option) are scraped but filtered down
 * to only the courses the requirements actually name — keeping the dataset tiny. */
const FULL_SUBJECTS = ["CSC", "MAT"]

const USER_AGENT =
  "spu-scheduler-scraper/1.0 (personal course-planning tool; +docs/PLAN.md)"

// ---------------------------------------------------------------------------
// Types (mirror docs/PLAN.md §4; extra *Raw fields preserved for verification)
// ---------------------------------------------------------------------------

type Term = "AUT" | "WIN" | "SPR" | "SUM" | "ALT"
type Category = "CS_CORE" | "CS_ELECTIVE" | "MATH" | "OTHER"

interface Course {
  id: string // "CSC2430"
  subject: string // "CSC"
  number: string // "2430"
  title: string
  credits: number // upper bound when the catalog lists a range
  creditsRaw: string // original parenthetical, e.g. "(1-5 Credits)"
  offered: Term[]
  offeredRaw: string // original "Typically offered: ..." text
  prereqs: string[] // course ids parsed from prereqsRaw (AND logic; verify!)
  prereqsRaw: string // original "Prerequisite: ..." sentence(s)
  category: Category
  verified: false
}

interface ReqCourse {
  id: string
  credits: number | null
  /** true when this row is an "or <course>" alternative to the row(s) above it. */
  or?: true
}

interface ReqGroup {
  name: string
  /** From "Section Credits Required" / the area total row, when present. */
  creditsRequired: number | null
  /** null = take them all; otherwise the catalog's selection rule text. */
  selectionRule: string | null
  courses: ReqCourse[]
}

interface Requirements {
  catalogYear: string
  sourceUrl: string
  scrapedAt: string
  /** Largest "Total Credits" found on the page (verify against the official total). */
  totalCreditsForDegree: number | null
  verified: false
  groups: ReqGroup[]
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const COURSE_CODE = /\b([A-Z]{2,4})\s(\d{4})\b/g

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } })
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`)
  return res.text()
}

function parse(html: string): Document {
  return new JSDOM(html).window.document
}

/** textContent with collapsed whitespace. */
function text(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim()
}

function toId(subject: string, num: string): string {
  return `${subject}${num}`
}

/** Map a phrase like "Autumn, Spring." or "Alternate Years, Summer." to Terms. */
function parseTerms(phrase: string): Term[] {
  const out = new Set<Term>()
  if (/alternate years/i.test(phrase)) out.add("ALT")
  if (/autumn|fall/i.test(phrase)) out.add("AUT")
  if (/winter/i.test(phrase)) out.add("WIN")
  if (/spring/i.test(phrase)) out.add("SPR")
  if (/summer/i.test(phrase)) out.add("SUM")
  return [...out]
}

function firstCatalogYear(html: string): string {
  return html.match(/20\d{2}-20?\d{2}/)?.[0] ?? "UNKNOWN"
}

// ---------------------------------------------------------------------------
// Course descriptions → Course[]
// ---------------------------------------------------------------------------

function parseCourses(html: string): Course[] {
  const doc = parse(html)
  const courses: Course[] = []

  for (const block of doc.querySelectorAll(".courseblock")) {
    const codeText = text(block.querySelector(".detail-code"))
    const m = codeText.match(/^([A-Z]{2,4})\s*(\d{4})/)
    if (!m) continue
    const [, subject, number] = m

    const title = text(block.querySelector(".detail-title"))
    const creditsRaw = text(block.querySelector(".detail-hours_html"))
    const cr = creditsRaw.match(/(\d+)(?:\s*-\s*(\d+))?\s*Credits?/i)
    const credits = cr ? Number(cr[2] ?? cr[1]) : 0

    // The description / prereq prose lives in courseblockextra paragraphs.
    const body = [...block.querySelectorAll(".courseblockextra")]
      .map((p) => text(p))
      .join(" ")

    const offeredRaw = body.match(/Typically offered:[^.]*\.?/i)?.[0]?.trim() ?? ""
    const offered = offeredRaw ? parseTerms(offeredRaw) : []

    // Sentences that *start* with a capitalised "Prerequisite(s)" label.
    // Lower-case prose ("...prerequisite to CSC 2430.") and reverse references
    // ("Prerequisite to ...") are excluded — they are not this course's prereqs.
    const prereqSentences = body
      .split(/(?<=\.)\s+/)
      .map((s) => s.trim())
      .filter((s) => /^Prerequisites?\b/.test(s) && !/^Prerequisites? to\b/i.test(s))
    const prereqsRaw = prereqSentences.join(" ")

    const prereqs = [...new Set([...prereqsRaw.matchAll(COURSE_CODE)].map((x) => toId(x[1], x[2])))]
      // a course can't be its own prereq (guards against odd self-references)
      .filter((id) => id !== toId(subject, number))

    courses.push({
      id: toId(subject, number),
      subject,
      number,
      title,
      credits,
      creditsRaw,
      offered,
      offeredRaw,
      prereqs,
      prereqsRaw,
      category: "OTHER", // assigned later from requirements
      verified: false,
    })
  }

  return courses
}

// ---------------------------------------------------------------------------
// BS-CS program page → Requirements
// ---------------------------------------------------------------------------

function courseCodeFromRow(row: Element): string | null {
  const a = row.querySelector("td.codecol a.code")
  const code = (a?.getAttribute("title") ?? text(a)).trim()
  return /^[A-Z]{2,4}\s\d{4}$/.test(code) ? code.replace(/\s/, "") : null
}

function hours(row: Element): number | null {
  const h = text(row.querySelector("td.hourscol"))
  const n = h.match(/\d+/)
  return n ? Number(n[0]) : null
}

function parseRequirements(html: string): Requirements {
  const doc = parse(html)
  const groups: ReqGroup[] = []
  let current: ReqGroup | null = null

  for (const table of doc.querySelectorAll("table.sc_courselist")) {
    for (const row of table.querySelectorAll("tbody > tr")) {
      const areaSpan = row.querySelector("span.courselistcomment.areaheader")
      if (areaSpan) {
        current = {
          name: text(areaSpan),
          creditsRequired: hours(row),
          selectionRule: null,
          courses: [],
        }
        groups.push(current)
        continue
      }
      if (!current) continue

      const code = courseCodeFromRow(row)
      if (code) {
        current.courses.push({
          id: code,
          credits: hours(row),
          ...(row.className.includes("orclass") ||
          row.querySelector("td.codecol")?.className.includes("orclass")
            ? { or: true as const }
            : {}),
        })
        continue
      }

      // Non-course comment rows: selection rules and section totals.
      const comment = row.querySelector("span.courselistcomment")
      if (comment) {
        const t = text(comment)
        if (/section credits required/i.test(t)) {
          current.creditsRequired = hours(row) ?? current.creditsRequired
        } else {
          current.selectionRule = current.selectionRule ? `${current.selectionRule}; ${t}` : t
          current.creditsRequired = current.creditsRequired ?? hours(row)
        }
      }
    }
  }

  const totals = [...doc.querySelectorAll("td.hourscol.listsum, .listsum")]
    .map((el) => Number(text(el).match(/\d+/)?.[0]))
    .filter((n) => Number.isFinite(n))

  return {
    catalogYear: firstCatalogYear(html),
    sourceUrl: REQUIREMENTS_URL,
    scrapedAt: new Date().toISOString().slice(0, 10),
    totalCreditsForDegree: totals.length ? Math.max(...totals) : null,
    verified: false,
    groups,
  }
}

// ---------------------------------------------------------------------------
// Categorisation (uses parsed requirements to tag courses)
// ---------------------------------------------------------------------------

function categorize(courses: Course[], requirements: Requirements): void {
  const requiredCsc = new Set<string>()
  const electiveCsc = new Set<string>()
  for (const g of requirements.groups) {
    const isChoice = g.selectionRule != null
    for (const c of g.courses) {
      if (!c.id.startsWith("CSC")) continue
      if (isChoice || c.or) electiveCsc.add(c.id)
      else requiredCsc.add(c.id)
    }
  }
  for (const c of courses) {
    if (c.subject === "MAT") c.category = "MATH"
    else if (requiredCsc.has(c.id)) c.category = "CS_CORE"
    else if (electiveCsc.has(c.id)) c.category = "CS_ELECTIVE"
    else if (c.subject === "CSC") c.category = "CS_ELECTIVE"
    else c.category = "OTHER"
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("→ Fetching BS-CS requirements …")
  const requirements = parseRequirements(await fetchHtml(REQUIREMENTS_URL))

  // Every subject the degree names + the always-full majors (CSC, MAT).
  const referencedIds = new Set<string>()
  const subjects = new Set(FULL_SUBJECTS)
  for (const g of requirements.groups) {
    for (const c of g.courses) {
      referencedIds.add(c.id)
      subjects.add(c.id.match(/^[A-Z]{2,4}/)?.[0] ?? "")
    }
  }
  subjects.delete("")

  const byId = new Map<string, Course>()
  for (const subject of [...subjects].sort()) {
    const url = `${COURSE_DESC_BASE}${subject.toLowerCase()}/`
    let parsed: Course[]
    try {
      console.log(`→ Fetching ${subject} course descriptions …`)
      parsed = parseCourses(await fetchHtml(url))
    } catch (err) {
      console.warn(`  ⚠ could not scrape ${subject} (${url}): ${(err as Error).message}`)
      continue
    }
    const isFull = FULL_SUBJECTS.includes(subject)
    for (const c of parsed) {
      if (!isFull && !referencedIds.has(c.id)) continue // trim ancillary subjects
      if (!byId.has(c.id)) byId.set(c.id, c)
    }
  }

  const courses = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
  categorize(courses, requirements)

  // ---- Write -------------------------------------------------------------
  const dataDir = fileURLToPath(new URL("../src/data/", import.meta.url))
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(`${dataDir}courses.json`, `${JSON.stringify(courses, null, 2)}\n`)
  writeFileSync(`${dataDir}requirements.json`, `${JSON.stringify(requirements, null, 2)}\n`)

  // ---- Verification report ----------------------------------------------
  const missing = [...referencedIds].filter((id) => !byId.has(id)).sort()
  const noOffered = courses.filter((c) => c.offered.length === 0)
  const noPrereqs = courses.filter((c) => c.prereqs.length === 0)
  // Prereq prose the catalog gave us but no course code was extractable from —
  // these need a human to translate the prose into prereqs[] by hand.
  const prosePrereqs = courses.filter((c) => c.prereqsRaw && c.prereqs.length === 0)

  console.log("\n────────────────────── SCRAPE SUMMARY ──────────────────────")
  console.log(`catalog year        : ${requirements.catalogYear}`)
  console.log(`courses written     : ${courses.length}  → src/data/courses.json`)
  console.log(`requirement groups  : ${requirements.groups.length}  → src/data/requirements.json`)
  console.log(`total degree credits: ${requirements.totalCreditsForDegree ?? "?"}`)
  if (missing.length)
    console.log(`⚠ required courses with NO catalog entry: ${missing.join(", ")}`)
  console.log(`⚠ courses with no parsed quarter offered : ${noOffered.length}`)
  console.log(`⚠ courses with no parsed prerequisites   : ${noPrereqs.length}`)
  if (prosePrereqs.length)
    console.log(
      `⚠ prereq prose found but no code parsed (fix by hand): ${prosePrereqs.map((c) => c.id).join(", ")}`,
    )
  console.log(
    "\n⚠ ALL output is verified:false. Hand-review src/data/*.json (especially\n" +
      "  prereqs and requirement groups) and flip verified:true before trusting it.\n" +
      "  This is a planning aid, not an official degree audit.",
  )
}

main().catch((err) => {
  console.error(err)
  // Surface a non-zero exit without importing node:process types.
  throw err
})
