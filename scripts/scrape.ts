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

/** Quarterly time schedule (the ONLY place meeting days/times live). Unlike the
 * catalog this is volatile — re-scrape it per academic year. `TERM_YEAR` is SPU's
 * academic-year code: 20266 = the 2026-2027 year (Autumn 2026 → Summer 2027). */
const TIME_SCHEDULE_BASE = "https://spu.edu/undergraduate-time-schedule/subjects/"
const TERM_YEAR = "20266"
const ACADEMIC_YEAR_START = 2026

/** The major itself + its math sequence — scraped in full. */
const MAJOR_SUBJECTS = ["CSC", "MAT"]

/** SPU Common Curriculum / general-education subjects. A DTA transfer still has to
 * slot these university-wide courses (General Studies, University Core, Theology
 * Core), and the BS-CS major page doesn't enumerate most of them — so scrape them
 * in full too. These are small, SPU-specific subjects; broad disciplinary subjects
 * (ENG/HIS/ART/…) are deliberately left out to keep the dataset tiny. */
const GENED_SUBJECTS = ["GS", "UCOR", "TCOR"]

/** Subjects we keep every course of. Other subjects referenced by the degree (e.g.
 * a single CHM/PHY science option) are scraped but filtered down to only the courses
 * the requirements actually name. */
const FULL_SUBJECTS = [...MAJOR_SUBJECTS, ...GENED_SUBJECTS]

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

type Day = "M" | "Tu" | "W" | "Th" | "F" | "Sa"
type Season = "AUT" | "WIN" | "SPR" | "SUM"

/** A concrete, schedulable class section from the quarterly time schedule. */
interface Section {
  crn: string // "1390" — unique per section
  courseId: string // "CSC1250"
  season: Season // the quarter this section actually runs in
  year: number // calendar year that quarter starts in
  days: Day[] // meeting days, [] when fully arranged / online-async
  startMin: number | null // minutes from midnight, null when no fixed time
  endMin: number | null
  timeRaw: string // original "9:00 AM-11:00 AM"
  credits: number // section credits (upper bound for variable-credit)
  /** "Arranged" sections meet online / by appointment — days are advisory. */
  arranged: boolean
  instructor: string
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
// Time schedule → Section[]  (meeting days/times — the volatile data)
// ---------------------------------------------------------------------------

const DAY_TOKENS: Day[] = ["M", "Tu", "W", "Th", "F", "Sa"]

function seasonFromTerm(term: string): Season | null {
  if (/autumn|fall/i.test(term)) return "AUT"
  if (/winter/i.test(term)) return "WIN"
  if (/spring/i.test(term)) return "SPR"
  if (/summer/i.test(term)) return "SUM"
  return null
}

/** Autumn opens the academic year; Winter/Spring/Summer fall in the next year. */
function yearForSeason(season: Season): number {
  return season === "AUT" ? ACADEMIC_YEAR_START : ACADEMIC_YEAR_START + 1
}

function parseDays(raw: string): Day[] {
  // Drop the "Arranged" marker, split the "M,W,F" / "Tu,Th" list, keep known tokens.
  const tokens = raw
    .replace(/Arranged/gi, "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Day => (DAY_TOKENS as string[]).includes(s))
  return DAY_TOKENS.filter((d) => tokens.includes(d)) // canonical order
}

/** "9:00 AM-11:00 AM" (with an optional leading "- " from arranged rows) → minutes. */
function parseTime(raw: string): { startMin: number | null; endMin: number | null } {
  const m = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!m) return { startMin: null, endMin: null }
  const toMin = (h: string, mm: string, ap: string): number =>
    ((Number(h) % 12) + (/pm/i.test(ap) ? 12 : 0)) * 60 + Number(mm)
  return { startMin: toMin(m[1], m[2], m[3]), endMin: toMin(m[4], m[5], m[6]) }
}

function parseSections(html: string, keep: ReadonlySet<string>): Section[] {
  const doc = parse(html)
  const table = doc.querySelector("table.offerings-wrapper")
  if (!table) return []

  const sections: Section[] = []
  let courseId: string | null = null

  for (const row of table.querySelectorAll("tr")) {
    if (row.classList.contains("course-heading")) {
      // "CSC 1250: Problem Solving and Programming Course details"
      const m = text(row).match(/^([A-Z]{2,4})\s*(\d{4})/)
      courseId = m ? toId(m[1], m[2]) : null
      continue
    }
    if (!row.classList.contains("section") || !courseId) continue
    if (!keep.has(courseId)) continue

    const season = seasonFromTerm(text(row.querySelector("td.term")))
    if (!season) continue

    const daysRaw = text(row.querySelector("td.days"))
    const timeRaw = text(row.querySelector("td.times")).replace(/^-\s*/, "")
    const creditsRaw = text(row.querySelector("td.credits"))
    const credits = Number(creditsRaw.match(/\d+/g)?.at(-1) ?? 0)
    const { startMin, endMin } = parseTime(timeRaw)

    sections.push({
      crn: text(row.querySelector("td.crn")),
      courseId,
      season,
      year: yearForSeason(season),
      days: parseDays(daysRaw),
      startMin,
      endMin,
      timeRaw,
      credits,
      arranged: /arranged/i.test(daysRaw) || timeRaw === "" || timeRaw === "-",
      instructor: text(row.querySelector("td.instructors")),
    })
  }
  return sections
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

  // ---- Time schedule: meeting days/times for the courses we kept ----------
  const keepIds = new Set(courses.map((c) => c.id))
  const sections: Section[] = []
  for (const subject of [...subjects].sort()) {
    const url = `${TIME_SCHEDULE_BASE}${subject}?term_year=${TERM_YEAR}&cat_year=${TERM_YEAR}`
    try {
      console.log(`→ Fetching ${subject} time schedule …`)
      sections.push(...parseSections(await fetchHtml(url), keepIds))
    } catch (err) {
      console.warn(`  ⚠ could not scrape ${subject} schedule (${url}): ${(err as Error).message}`)
    }
  }
  sections.sort(
    (a, b) => a.courseId.localeCompare(b.courseId) || a.crn.localeCompare(b.crn),
  )

  // ---- Write -------------------------------------------------------------
  const dataDir = fileURLToPath(new URL("../src/data/", import.meta.url))
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(`${dataDir}courses.json`, `${JSON.stringify(courses, null, 2)}\n`)
  writeFileSync(`${dataDir}requirements.json`, `${JSON.stringify(requirements, null, 2)}\n`)
  writeFileSync(`${dataDir}sections.json`, `${JSON.stringify(sections, null, 2)}\n`)

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
  console.log(
    `sections written    : ${sections.length}  → src/data/sections.json  (${ACADEMIC_YEAR_START}-${ACADEMIC_YEAR_START + 1})`,
  )
  const coursesWithSections = new Set(sections.map((s) => s.courseId)).size
  console.log(`courses with a section this year: ${coursesWithSections}/${courses.length}`)
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
