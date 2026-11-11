/**
 * FICTIONAL demonstration data for MSW Site.
 * Phone numbers use Ofcom's reserved drama range (07700 900xxx) and email
 * addresses use the reserved .example domain.  Companies, people, main
 * contractors and documents are invented.
 */
import { createHash } from "node:crypto";
import type { DrawingStyle } from "./pdfs";
import type { PhotoScene } from "./photos";

/** Deterministic UUID from a stable key, so tests and docs can refer to records. */
export function demoId(key: string): string {
  const h = createHash("sha1").update(`msw-demo:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const DEMO_PASSWORD = "SiteDemo!2026";

export type CompanyKey = "msw" | "abc" | "northern" | "studweld" | "precision" | "capital";

export const demoCompanies: Record<CompanyKey, {
  name: string; isMsw?: boolean; trade: string; contactName: string; contactPhone: string; contactEmail: string;
}> = {
  msw: { name: "MSW UK Ltd", isMsw: true, trade: "Safety netting, metal decking, shear studs, edge trims, concrete", contactName: "MSW Office", contactPhone: "07700 900100", contactEmail: "office@msw.example" },
  abc: { name: "Derby Decking", trade: "Safety netting & metal decking", contactName: "Dave Clarke", contactPhone: "07700 900301", contactEmail: "office@derbydecking.example" },
  northern: { name: "SOS", trade: "Safety netting & metal decking", contactName: "Sarah Booth", contactPhone: "07700 900401", contactEmail: "ops@sos.example" },
  studweld: { name: "Top Deck", trade: "Safety netting & metal decking", contactName: "Office", contactPhone: "07700 900501", contactEmail: "info@topdeck.example" },
  precision: { name: "Newby Decking Services", trade: "Safety netting & metal decking", contactName: "Office", contactPhone: "07700 900601", contactEmail: "info@newbydecking.example" },
  capital: { name: "Capital Trims Ltd", trade: "Edge trims", contactName: "Office", contactPhone: "07700 900701", contactEmail: "info@capitaltrims.example" },
};

export type Role = "admin" | "office" | "operative" | "manager";

export interface DemoUser {
  key: string;
  name: string;
  company: CompanyKey;
  role: Role;
  title: string;
  phone: string;
  active?: boolean;
}

const emailDomain: Record<CompanyKey, string> = {
  msw: "msw.example",
  abc: "derbydecking.example",
  northern: "sos.example",
  studweld: "topdeck.example",
  precision: "newbydecking.example",
  capital: "capitaltrims.example",
};

export const demoUsers: DemoUser[] = [
  { key: "claire", name: "Damian Pendleton", company: "msw", role: "admin", title: "Contracts Manager", phone: "07700 900101" },
  { key: "richard", name: "Richard Hale", company: "msw", role: "office", title: "Operations Director", phone: "07700 900102" },
  { key: "sam", name: "Alan Stokoe", company: "msw", role: "office", title: "Office", phone: "07700 900103" },
  { key: "pete", name: "Pete", company: "msw", role: "office", title: "Quantity Surveyor", phone: "07700 900107" },
  { key: "gareth", name: "Gareth Evans", company: "msw", role: "operative", title: "Safety Netting Supervisor", phone: "07700 900104" },
  { key: "luke", name: "Luke Bennett", company: "msw", role: "operative", title: "Safety Netting Operative", phone: "07700 900105" },
  { key: "chris", name: "Chris Dawson", company: "msw", role: "operative", title: "Shear Stud Welder", phone: "07700 900106" },
  { key: "dave", name: "Dave Clarke", company: "abc", role: "manager", title: "Director", phone: "07700 900301" },
  { key: "john", name: "John Smith", company: "abc", role: "operative", title: "Gang Leader", phone: "07700 900311" },
  { key: "mark", name: "Mark Jones", company: "abc", role: "operative", title: "Netting & Deck Operative", phone: "07700 900312" },
  { key: "paul", name: "Paul Brown", company: "abc", role: "operative", title: "Netting & Deck Operative", phone: "07700 900313" },
  { key: "steve", name: "Steve Wilson", company: "abc", role: "operative", title: "Netting & Deck Operative", phone: "07700 900314" },
  { key: "sarah", name: "Sarah Booth", company: "northern", role: "manager", title: "Operations Manager", phone: "07700 900401" },
  { key: "liam", name: "Liam Turner", company: "northern", role: "operative", title: "Gang Leader", phone: "07700 900411" },
  { key: "ryan", name: "Ryan Hughes", company: "northern", role: "operative", title: "Netting & Deck Operative", phone: "07700 900412" },
  { key: "kieran", name: "Kieran Walsh", company: "northern", role: "operative", title: "Netting & Deck Operative", phone: "07700 900413" },
  { key: "tom", name: "Tom Baker", company: "studweld", role: "operative", title: "Netting & Deck Operative", phone: "07700 900511" },
  { key: "gary", name: "Gary Lewis", company: "studweld", role: "operative", title: "Netting & Deck Operative", phone: "07700 900512" },
  { key: "adam", name: "Adam Price", company: "precision", role: "operative", title: "Netting & Deck Operative", phone: "07700 900611" },
  { key: "jason", name: "Jason Reid", company: "precision", role: "operative", title: "Netting & Deck Operative", phone: "07700 900612" },
  { key: "carl", name: "Carl Moore", company: "precision", role: "operative", title: "Netting & Deck Operative", phone: "07700 900613" },
  { key: "ben", name: "Ben Foster", company: "capital", role: "operative", title: "Edge Trim Installer", phone: "07700 900711" },
  { key: "danny", name: "Danny Ward", company: "capital", role: "operative", title: "Edge Trim Installer", phone: "07700 900712", active: false },
];

export function demoEmail(u: Pick<DemoUser, "name" | "company">) {
  return `${u.name.toLowerCase().replace(/[^a-z]+/g, ".")}@${emailDomain[u.company]}`;
}

export const userId = (key: string) => demoId(`user:${key}`);
export const companyId = (key: CompanyKey) => demoId(`company:${key}`);
export const jobId = (key: string) => demoId(`job:${key}`);
export const areaId = (job: string, area: string) => demoId(`area:${job}:${area}`);

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
export interface DemoJob {
  key: string;
  number: string;
  name: string;
  address: string;
  postcode: string;
  directions?: string;
  mainContractor: string;
  contact: { name: string; role: string; phone: string };
  startDays: number; // relative to today (negative = past)
  endDays: number;
  status: "planned" | "live" | "on_hold" | "complete";
  inductionUrl?: string;
  inductionNotes?: string;
  instructions?: string;
  contractsManager: string;
  areas: { key: string; name: string; kind: "floor" | "phase" | "zone" | "area" }[];
  createdDaysAgo: number;
}

export const demoJobs: DemoJob[] = [
  {
    key: "bm",
    number: "MSW-2611",
    name: "British Museum — Western Range Extension",
    address: "Great Russell Street, Bloomsbury, London",
    postcode: "WC1B 3DG",
    directions:
      "Construction access is via the Montague Place logistics gate — NOT the museum's public entrance. Report to the Kingsgate welfare cabin to sign in. No parking on site; use public transport (Russell Square / Tottenham Court Road).",
    mainContractor: "Kingsgate Construction Ltd (fictional)",
    contact: { name: "Martin Doyle", role: "Site Manager, Kingsgate", phone: "07700 900201" },
    startDays: -38,
    endDays: 64,
    status: "live",
    inductionUrl: "https://induction.example.com/kingsgate/western-range",
    inductionNotes: "Complete the Kingsgate online induction before your first day (about 25 minutes). Bring your CSCS card and photo ID.",
    instructions:
      "Gate opens 07:30 — no access before. Working hours 07:30–17:30 Monday to Friday.\n\nHoist bookings through Kingsgate logistics by 15:00 the day before.\n\nDeck bundles are landed by tower crane on Tuesdays and Thursdays only. Do not break bundles at the leading edge.\n\nHot works permit required for stud welding — request from the site manager each morning.\n\nMaintain the exclusion zone below decking works at all times. Nets are inspected daily by the MSW supervisor (Gareth Evans) — do not start until the inspection tag is signed.",
    contractsManager: "claire",
    areas: [
      { key: "l1", name: "Level 1", kind: "floor" },
      { key: "l2", name: "Level 2", kind: "floor" },
      { key: "l3", name: "Level 3", kind: "floor" },
      { key: "l4", name: "Level 4", kind: "floor" },
      { key: "roof", name: "Roof", kind: "floor" },
    ],
    createdDaysAgo: 52,
  },
  {
    key: "riverside",
    number: "MSW-2604",
    name: "Riverside Quarter Block B",
    address: "Kirkstall Road, Leeds",
    postcode: "LS3 1LH",
    directions: "Enter from the Kirkstall Road roundabout, second gate on the left. Operative parking in the gravel compound — arrive before 07:15.",
    mainContractor: "Hallam & Pryce Construction (fictional)",
    contact: { name: "Nadia Khan", role: "Project Manager, Hallam & Pryce", phone: "07700 900202" },
    startDays: -60,
    endDays: 45,
    status: "live",
    inductionUrl: "https://induction.example.com/hallam-pryce/riverside-b",
    instructions:
      "Phase 1 (Core A) deck is priority this week; Phase 2 starts once the steel frame is signed off.\n\nConcrete pours booked Wednesdays — decking in the pour area must be signed off by 12:00 Tuesday.\n\nSmoking only in the designated shelter by the gate.",
    contractsManager: "claire",
    areas: [
      { key: "p1", name: "Phase 1 — Core A", kind: "phase" },
      { key: "p2", name: "Phase 2 — Core B", kind: "phase" },
    ],
    createdDaysAgo: 75,
  },
  {
    key: "northgate",
    number: "MSW-2598",
    name: "Northgate Hospital Multi-Storey Car Park",
    address: "Northgate Road, Manchester",
    postcode: "M8 5RB",
    directions: "Hospital site — follow the yellow contractor signs from the Northgate Road entrance. Keep ambulance routes clear at all times.",
    mainContractor: "Pennine Build Partnership (fictional)",
    contact: { name: "Owen Gallagher", role: "Site Manager", phone: "07700 900203" },
    startDays: -95,
    endDays: 20,
    status: "live",
    instructions: "Live hospital site: no reversing without a banksman. Noisy works (stud welding) 08:00–16:00 only.",
    contractsManager: "richard",
    areas: [
      { key: "d1", name: "Deck 1", kind: "zone" },
      { key: "d2", name: "Deck 2", kind: "zone" },
      { key: "d3", name: "Deck 3", kind: "zone" },
    ],
    createdDaysAgo: 110,
  },
  {
    key: "wharf",
    number: "MSW-2617",
    name: "Wharf Street Offices Refurbishment",
    address: "Wharf Street, Bristol",
    postcode: "BS1 4RN",
    mainContractor: "Severn Interiors Group (fictional)",
    contact: { name: "Priya Shah", role: "Site Manager", phone: "07700 900204" },
    startDays: 12,
    endDays: 40,
    status: "planned",
    inductionUrl: "https://induction.example.com/severn/wharf-street",
    instructions: "Start date to be confirmed by the MSW office. Do not attend until your attendance dates are confirmed.",
    contractsManager: "claire",
    areas: [
      { key: "l1", name: "Level 1", kind: "floor" },
      { key: "l2", name: "Level 2", kind: "floor" },
    ],
    createdDaysAgo: 6,
  },
  {
    key: "stannes",
    number: "MSW-2552",
    name: "St Anne's Primary School Extension",
    address: "Bristol Road, Birmingham",
    postcode: "B29 6BD",
    mainContractor: "Midland Schools Construction (fictional)",
    contact: { name: "Gemma Price", role: "Site Manager", phone: "07700 900205" },
    startDays: -150,
    endDays: -40,
    status: "complete",
    contractsManager: "richard",
    areas: [{ key: "gf", name: "First Floor Slab", kind: "floor" }],
    createdDaysAgo: 170,
  },
  {
    key: "canal",
    number: "MSW-2621",
    name: "Canal Basin Residential",
    address: "Canal Street, Nottingham",
    postcode: "NG1 7EH",
    mainContractor: "Trentside Homes (fictional)",
    contact: { name: "Joe Barker", role: "Project Manager", phone: "07700 900206" },
    startDays: -10,
    endDays: 90,
    status: "on_hold",
    instructions: "ON HOLD — main contractor programme under review. Do not attend site.",
    contractsManager: "claire",
    areas: [
      { key: "pa", name: "Phase A", kind: "phase" },
      { key: "pb", name: "Phase B", kind: "phase" },
    ],
    createdDaysAgo: 20,
  },
];

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export interface DemoRevision {
  rev: string;
  daysAgo: number;
  note: string;
  final: "approved" | "superseded" | "draft" | "withdrawn";
}

export interface DemoDocument {
  key: string;
  job: string;
  kind: "drawing" | "rams";
  number: string;
  title: string;
  areas: string[]; // empty = whole job
  style?: DrawingStyle;
  activity?: string;
  revisions: DemoRevision[];
}

export const demoDocuments: DemoDocument[] = [
  // British Museum — level-specific drawings demonstrate area restrictions.
  { key: "bm-ga", job: "bm", kind: "drawing", number: "MSW-2611-GA-001", title: "General Arrangement & Setting Out", areas: [], style: "ga",
    revisions: [
      { rev: "C01", daysAgo: 40, note: "First issue for construction", final: "superseded" },
      { rev: "C02", daysAgo: 26, note: "Grid H setting out revised", final: "superseded" },
      { rev: "C03", daysAgo: 9, note: "Roof plant zone added", final: "approved" },
    ] },
  { key: "bm-dk1", job: "bm", kind: "drawing", number: "MSW-2611-DK-101", title: "Level 1 Metal Deck Layout", areas: ["l1"], style: "deck",
    revisions: [
      { rev: "C01", daysAgo: 30, note: "First issue for construction", final: "superseded" },
      { rev: "C02", daysAgo: 3, note: "Riser opening at C3 enlarged", final: "approved" },
    ] },
  { key: "bm-dk2", job: "bm", kind: "drawing", number: "MSW-2611-DK-102", title: "Level 2 Metal Deck Layout", areas: ["l2"], style: "deck",
    revisions: [{ rev: "C01", daysAgo: 21, note: "First issue for construction", final: "approved" }] },
  { key: "bm-dk3", job: "bm", kind: "drawing", number: "MSW-2611-DK-103", title: "Level 3 Metal Deck Layout", areas: ["l3"], style: "deck",
    revisions: [
      { rev: "C01", daysAgo: 14, note: "First issue for construction", final: "approved" },
      { rev: "C02", daysAgo: 1, note: "Awaiting engineer comments — stair void", final: "draft" },
    ] },
  { key: "bm-dk4", job: "bm", kind: "drawing", number: "MSW-2611-DK-104", title: "Level 4 Metal Deck Layout", areas: ["l4"], style: "deck",
    revisions: [{ rev: "P01", daysAgo: 4, note: "Preliminary — for comment", final: "draft" }] },
  { key: "bm-sn", job: "bm", kind: "drawing", number: "MSW-2611-SN-201", title: "Safety Netting Layout — Levels 3 & 4", areas: ["l3", "l4"], style: "netting",
    revisions: [
      { rev: "A", daysAgo: 18, note: "First issue", final: "superseded" },
      { rev: "B", daysAgo: 7, note: "Net N4 extended to grid H", final: "approved" },
    ] },
  { key: "bm-st", job: "bm", kind: "drawing", number: "MSW-2611-ST-301", title: "Shear Stud Layout — Level 1", areas: ["l1"], style: "studs",
    revisions: [{ rev: "C01", daysAgo: 16, note: "First issue for construction", final: "approved" }] },
  { key: "bm-et", job: "bm", kind: "drawing", number: "MSW-2611-ET-401", title: "Edge Trim Details — Typical", areas: [], style: "trims",
    revisions: [{ rev: "C01", daysAgo: 20, note: "First issue for construction", final: "approved" }] },
  { key: "bm-rams-deck", job: "bm", kind: "rams", number: "RAMS-2611-01", title: "Metal Decking Installation", areas: [], activity: "Metal deck installation",
    revisions: [
      { rev: "1", daysAgo: 41, note: "First issue", final: "superseded" },
      { rev: "2", daysAgo: 12, note: "Updated crane lifting arrangements", final: "approved" },
    ] },
  { key: "bm-rams-net", job: "bm", kind: "rams", number: "RAMS-2611-02", title: "Safety Netting Installation & Removal", areas: ["l3", "l4"], activity: "Safety netting installation and removal",
    revisions: [{ rev: "1", daysAgo: 19, note: "First issue", final: "approved" }] },
  { key: "bm-rams-stud", job: "bm", kind: "rams", number: "RAMS-2611-03", title: "Shear Stud Welding", areas: ["l1", "l2"], activity: "Shear stud welding",
    revisions: [{ rev: "1", daysAgo: 17, note: "First issue", final: "approved" }] },

  // Riverside
  { key: "rq-dk1", job: "riverside", kind: "drawing", number: "MSW-2604-DK-201", title: "Phase 1 Core A Deck Layout", areas: ["p1"], style: "deck",
    revisions: [{ rev: "C01", daysAgo: 33, note: "First issue for construction", final: "approved" }] },
  { key: "rq-dk2", job: "riverside", kind: "drawing", number: "MSW-2604-DK-202", title: "Phase 2 Core B Deck Layout", areas: ["p2"], style: "deck",
    revisions: [
      { rev: "P01", daysAgo: 20, note: "Preliminary", final: "withdrawn" },
      { rev: "P02", daysAgo: 5, note: "Revised steel sizes — awaiting approval", final: "draft" },
    ] },
  { key: "rq-ga", job: "riverside", kind: "drawing", number: "MSW-2604-GA-001", title: "General Arrangement", areas: [], style: "ga",
    revisions: [{ rev: "C02", daysAgo: 28, note: "Issued for construction", final: "approved" }] },
  { key: "rq-rams-deck", job: "riverside", kind: "rams", number: "RAMS-2604-01", title: "Metal Decking Installation", areas: [], activity: "Metal deck installation",
    revisions: [{ rev: "1", daysAgo: 58, note: "First issue", final: "approved" }] },
  { key: "rq-rams-conc", job: "riverside", kind: "rams", number: "RAMS-2604-02", title: "Concrete Placing & Finishing", areas: ["p1"], activity: "Concrete placing and power floating",
    revisions: [{ rev: "1", daysAgo: 50, note: "First issue", final: "approved" }] },

  // Northgate
  { key: "ng-et", job: "northgate", kind: "drawing", number: "MSW-2598-ET-101", title: "Edge Trim Layout — Decks 1–3", areas: [], style: "trims",
    revisions: [
      { rev: "C01", daysAgo: 80, note: "First issue for construction", final: "superseded" },
      { rev: "C02", daysAgo: 11, note: "Ramp trim height clarified", final: "approved" },
    ] },
  { key: "ng-st", job: "northgate", kind: "drawing", number: "MSW-2598-ST-102", title: "Shear Stud Layout — Deck 3", areas: ["d3"], style: "studs",
    revisions: [{ rev: "C01", daysAgo: 60, note: "First issue for construction", final: "approved" }] },
  { key: "ng-rams", job: "northgate", kind: "rams", number: "RAMS-2598-01", title: "Edge Trims & Stud Welding", areas: [], activity: "Edge trim installation and shear stud welding",
    revisions: [{ rev: "2", daysAgo: 70, note: "Hospital site rules added", final: "approved" }] },

  // Wharf Street (planned — nothing approved yet)
  { key: "ws-rams", job: "wharf", kind: "rams", number: "RAMS-2617-01", title: "Shear Stud Welding", areas: [], activity: "Shear stud welding",
    revisions: [{ rev: "1", daysAgo: 2, note: "Draft for review", final: "draft" }] },

  // St Anne's (complete)
  { key: "sa-dk", job: "stannes", kind: "drawing", number: "MSW-2552-DK-101", title: "First Floor Deck Layout", areas: [], style: "deck",
    revisions: [{ rev: "C01", daysAgo: 160, note: "First issue for construction", final: "approved" }] },
];

export const ramsHazards: Record<string, { hazard: string; risk: string; controls: string }[]> = {
  default: [
    { hazard: "Falls from height at leading edges and openings", risk: "High", controls: "Safety nets installed, inspected and tagged beneath all working areas before work starts. Leading edge protection maintained. Openings covered or protected immediately. Harnesses used only where specified in the rescue plan." },
    { hazard: "Falling objects", risk: "High", controls: "Exclusion zone below maintained with barriers and signage. Tools tethered at the leading edge. Bundles banded until positioned on the steel." },
    { hazard: "Manual handling of sheets and trims", risk: "Medium", controls: "Two-person lifts for sheets over 3 m. Gloves with cut resistance level D minimum. Bundles landed close to the work position by crane." },
    { hazard: "Wind", risk: "Medium", controls: "Work stops and unfixed sheets are secured when gusts exceed 23 mph (site anemometer). Supervisor decides on restart." },
    { hazard: "Lifting operations", risk: "High", controls: "All lifts planned under the main contractor's lifting plan, slung by trained slinger/signallers only. Never stand under a suspended load." },
  ],
  stud: [
    { hazard: "Electric shock and arc flash from stud welding", risk: "High", controls: "Equipment PAT tested and inspected daily. Welding leads routed clear of walkways. Welding visors with correct shade. Hot works permit obtained daily." },
    { hazard: "Fire", risk: "Medium", controls: "Fire watch for 60 minutes after hot works finish. Extinguisher at the working position. Combustibles cleared within 10 m." },
    { hazard: "Noise", risk: "Medium", controls: "Hearing protection mandatory within 5 m of welding. Noisy works within permitted hours only." },
  ],
  concrete: [
    { hazard: "Wet concrete burns and dermatitis", risk: "Medium", controls: "Waterproof gloves and wellingtons. Washing facilities at the pour location. Skin checks at breaks." },
    { hazard: "Pump line blockage and whip", risk: "High", controls: "Line secured at every joint. Exclusion zone around the pump hose end. Only trained operator clears blockages." },
  ],
};

// ---------------------------------------------------------------------------
// Access (the critical access-model scenarios)
// ---------------------------------------------------------------------------
export interface DemoGrant {
  job: string;
  users: string[];
  allAreas?: boolean;
  areas?: string[];
  note?: string;
  fromDays?: number;
  toDays?: number;
  daysAgo: number;
  managerReports?: boolean;
  revokeDaysAgo?: number;
}

export const demoGrants: DemoGrant[] = [
  // Gang A (Derby Decking): Levels 1 & 2 only.  Paul and Steve are NOT on this job.
  { job: "bm", users: ["john", "mark"], areas: ["l1", "l2"], note: "Gang A — Levels 1 & 2", fromDays: -30, toDays: 30, daysAgo: 31 },
  // Gang B (SOS): Levels 3 & 4 only.
  { job: "bm", users: ["liam", "ryan"], areas: ["l3", "l4"], note: "Gang B — Levels 3 & 4", fromDays: -20, toDays: 40, daysAgo: 21 },
  // Kieran was moved off the job (gang allocation change, history retained).
  { job: "bm", users: ["kieran"], areas: ["l3", "l4"], note: "Gang B", fromDays: -20, toDays: 40, daysAgo: 21, revokeDaysAgo: 5 },
  { job: "bm", users: ["tom"], areas: ["l1"], note: "Following on Level 1", fromDays: -10, toDays: 10, daysAgo: 12 },
  { job: "bm", users: ["gareth"], allAreas: true, note: "MSW supervisor", daysAgo: 38 },
  // Derby Decking's director: job-wide information plus Derby Decking's own reports on THIS job only.
  { job: "bm", users: ["dave"], areas: [], note: "Derby Decking director — report visibility", daysAgo: 25, managerReports: true },

  // Riverside: Derby Decking's other gang (Paul & Steve) — Dave has NOT been granted this job.
  { job: "riverside", users: ["paul", "steve"], allAreas: true, note: "Derby Decking gang 2", fromDays: -45, toDays: 30, daysAgo: 46 },
  { job: "riverside", users: ["adam", "jason"], areas: ["p1"], note: "Pours in Phase 1", daysAgo: 40 },
  { job: "riverside", users: ["luke"], allAreas: true, daysAgo: 58 },

  // Northgate
  { job: "northgate", users: ["gary", "ben"], allAreas: true, daysAgo: 90 },
  { job: "northgate", users: ["carl"], areas: ["d1", "d2"], daysAgo: 60 },

  // Wharf Street (planned; attendance booked)
  { job: "wharf", users: ["chris"], allAreas: true, fromDays: 12, toDays: 26, note: "Stud welding, two weeks", daysAgo: 3 },

  // St Anne's (complete — access ended)
  { job: "stannes", users: ["john", "mark"], allAreas: true, daysAgo: 150, revokeDaysAgo: 38 },
];

// ---------------------------------------------------------------------------
// Site reports
// ---------------------------------------------------------------------------
export interface DemoReport {
  key: string;
  job: string;
  area?: string;
  author: string;
  kind: "issue" | "progress" | "photo";
  category?: "delay" | "access" | "edge_protection" | "materials" | "drawing_query" | "safety" | "other";
  priority?: "normal" | "high" | "urgent";
  title: string;
  description: string;
  minutesAgo: number;
  shared?: boolean;
  photos: { scene: PhotoScene; caption: string }[];
  responses: { author: string; body?: string; status?: "open" | "in_progress" | "resolved" | "closed"; minutesAfter: number }[];
}

const H = 60;
const D = 24 * H;

export const demoReports: DemoReport[] = [
  {
    key: "bm-edge", job: "bm", area: "l2", author: "john", kind: "issue", category: "edge_protection", priority: "urgent",
    title: "Edge protection missing at grid C4, Level 2",
    description: "Barrier removed at the leading edge near grid C4 — looks like another trade took it down for a delivery. Bay taped off and Martin Doyle (Kingsgate) told by phone at 09:10. We are not working this bay until it is reinstated.",
    minutesAgo: 2 * D - 3 * H, photos: [{ scene: "edge", caption: "Level 2, grid C4 — barrier missing" }],
    responses: [
      { author: "claire", body: "Thanks John, right call. I've spoken to Martin — Kingsgate are reinstating it by 11:00. Don't work the bay until you've seen it back in place.", status: "in_progress", minutesAfter: 22 },
      { author: "john", body: "Barrier back in at 10:40, checked by Gareth. Carrying on.", minutesAfter: 95 },
      { author: "claire", status: "resolved", body: "Closing this out. Thanks both.", minutesAfter: 110 },
    ],
  },
  {
    key: "bm-prog1", job: "bm", area: "l1", author: "mark", kind: "progress",
    title: "Level 1 bays A1–D3 decked and pinned",
    description: "12 bays laid and pinned today. Side laps stitched up to grid D. Starting E1 tomorrow subject to crane.",
    minutesAgo: D + 2 * H, photos: [{ scene: "deck", caption: "Level 1 — bays A1 to D3 complete" }, { scene: "deck", caption: "Level 1 — side laps stitched to grid D" }], responses: [],
  },
  {
    key: "bm-hoist", job: "bm", area: "l3", author: "liam", kind: "issue", category: "access", priority: "high",
    title: "Hoist out of service — no access to Level 3",
    description: "Hoist has a fault tag on it this morning. Gang B can't get netting up to Level 3. Waiting at the welfare cabin; Kingsgate say an engineer is coming but no time given.",
    minutesAgo: 95, photos: [{ scene: "hoist", caption: "Hoist tagged out of use" }], responses: [],
  },
  {
    key: "bm-l2photos", job: "bm", area: "l2", author: "claire", kind: "photo", shared: true,
    title: "Level 2 deck completion — record photos",
    description: "Record photos from the Level 2 handover walk-round. Shared with the Level 2 team for reference.",
    minutesAgo: 3 * D, photos: [{ scene: "deck", caption: "Level 2 handover — looking north" }, { scene: "studs", caption: "Level 2 — studs complete grid A–C" }], responses: [],
  },
  {
    key: "bm-query", job: "bm", area: "l1", author: "tom", kind: "issue", category: "drawing_query", priority: "normal",
    title: "Stud spacing — DK-101 note differs from ST-301",
    description: "DK-101 rev C02 note 3 says studs at 300 centres, ST-301 shows 2 per trough. Which one do we follow?",
    minutesAgo: 2 * D, photos: [{ scene: "studs", caption: "Studs at grid B2" }],
    responses: [
      { author: "sam", body: "ST-301 governs stud spacing — 2 per trough. The DK-101 note refers to deck fixings, not studs. We'll make that clearer at the next revision.", status: "resolved", minutesAfter: 48 },
    ],
  },
  {
    key: "bm-netprog", job: "bm", area: "l4", author: "ryan", kind: "progress",
    title: "Netting complete Level 4, bays E–H",
    description: "Nets N4–N7 rigged and tied off. Inspection tag signed by Gareth.",
    minutesAgo: D - 5 * H, photos: [{ scene: "netting", caption: "Level 4 — nets N4 to N7" }], responses: [],
  },
  {
    key: "rq-short", job: "riverside", area: "p1", author: "paul", kind: "issue", category: "materials", priority: "normal",
    title: "Short delivery — 12 sheets missing from bundle 14",
    description: "Bundle 14 delivered with 38 sheets, delivery note says 50. Can finish Core A bays 1–6 but not 7–8.",
    minutesAgo: 5 * H, photos: [{ scene: "materials", caption: "Bundle 14 label and count" }], responses: [],
  },
  {
    key: "rq-prog", job: "riverside", area: "p1", author: "steve", kind: "progress",
    title: "Core A level 3 deck complete",
    description: "All bays laid, pinned and stitched. Ready for stud welding.",
    minutesAgo: 2 * D + 4 * H, photos: [], responses: [],
  },
  {
    key: "rq-pump", job: "riverside", area: "p1", author: "adam", kind: "issue", category: "delay", priority: "normal",
    title: "Pour delayed — pump not arrived",
    description: "Pump booked for 07:30, not here at 09:00. Gang standing.",
    minutesAgo: 6 * D, photos: [],
    responses: [
      { author: "claire", body: "Chased the pump hire — on its way, ETA 09:45. Apologies.", status: "in_progress", minutesAfter: 15 },
      { author: "claire", status: "closed", minutesAfter: 300 },
    ],
  },
  {
    key: "ng-trim", job: "northgate", area: "d2", author: "ben", kind: "issue", category: "drawing_query", priority: "high",
    title: "Edge trim height at ramp conflicts with ET-101",
    description: "Ramp edge trim shown as 150 mm on ET-101 rev C01 but the slab is 200 mm thick at the ramp.",
    minutesAgo: 12 * D, photos: [],
    responses: [
      { author: "richard", body: "Good spot. Engineer confirms 200 mm. ET-101 rev C02 has been issued — please use that.", status: "resolved", minutesAfter: 26 * H },
    ],
  },
  {
    key: "ng-prog", job: "northgate", area: "d3", author: "gary", kind: "progress",
    title: "Deck 3 studs complete grid 1–4",
    description: "Ring tests passed on all sampled studs.",
    minutesAgo: 3 * D, photos: [{ scene: "studs", caption: "Deck 3 studs grid 1–4" }], responses: [],
  },
];
