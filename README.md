# RuralCare Connect

An offline-capable SIH demonstration app for routing a rural citizen or ASHA worker to an appropriate **public** healthcare service. It is not a diagnosis tool or a live government system.

## Run in VS Code

1. Install [Node.js 20+](https://nodejs.org/) and open this folder in VS Code.
2. Copy `.env.example` to `.env` (leaving the key blank is fine).
3. In the VS Code terminal run `npm install` once, then run `npm run dev`.
4. Open the local URL shown for `web` (normally `http://localhost:5173`).

The first run creates a local SQLite database and seeds a Tamil Nadu demonstration set. The running prototype uses Node's built-in SQLite driver for reliable zero-setup local execution; `apps/api/prisma/schema.prisma` is included as the portable schema for a future Prisma/PostgreSQL deployment. Use the **Staff dashboard** link to see the operational view.

## Demo authentication

Milestone 4 uses a signed JWT inside an HTTP-only, SameSite cookie. Passwords are hashed with bcrypt (cost 12); neither hashes nor session tokens are exposed to the frontend. Copy `.env.example` to `.env`, set a long random `AUTH_SECRET`, and leave `COOKIE_SECURE=false` only for local HTTP development.

| Role | Email | Password | Access |
|---|---|---|---|
| Citizen | `citizen.demo@ruralcare.local` | `RuralCare@2026` | Own care journeys, referrals, reroutes and follow-up |
| ASHA | `asha.demo@ruralcare.local` | `RuralCare@2026` | Assisted journeys and only referrals created/linked by this ASHA |
| Staff | `staff.demo@ruralcare.local` | `RuralCare@2026` | Referrals, status actions, capacity and aggregates for Public Health Centre only |

Citizen registration never accepts a role and always creates a `CITIZEN`. ASHA and Staff accounts are seeded for the prototype; public privileged registration is disabled.

## Useful commands

- `npm run dev` - initialize SQLite and start API + PWA
- `npm test` - safety and facility-matching unit tests
- `npm run build` - type-check and create the production web build

## Demo route

Choose Citizen or ASHA-assisted mode, select Tamil or English, enter a need such as `My child has fever and cough for two days`, answer the safety questions, confirm the bounded assessment, choose a facility, then create a continuity pass. The Care Route shows exactly how the stated need became a required service and care level.

For reliable Tamil speech input (including Brave), copy `.env.example` to `.env`, add an `OPENAI_API_KEY`, and restart `npm run dev`. Select **தமிழில் பேசுங்கள்**, allow microphone access, speak, then press **நிறுத்தி எழுத்தாக்கவும்** (or wait for the 12-second automatic stop). The app records a short clip and displays an editable **We heard / நாங்கள் கேட்டது** transcript. The transcript enters intake only after the user confirms it; retry discards it. RuralCare does not persist the audio. Transcription requires connectivity; typed Tamil and deterministic fallback extraction remain available offline.

## Multilingual AI intake boundary

When `OPENAI_API_KEY` is configured, `/api/intake/extract` uses the Responses API with strict Structured Outputs to normalize English, Tamil, Tanglish, or mixed input. The request contains only the health-need text and preferred response language, sets `store: false`, and is validated again with a strict server schema. The schema deliberately has no diagnosis, prescription, urgency, or facility-choice field. Missing facts remain `null`, distinct from an explicit `false`.

The default extraction model is configured by `OPENAI_EXTRACTION_MODEL` (currently `gpt-5.4-nano`). A timeout, invalid output, missing key, or network failure immediately activates the local rules fallback. After extraction, the existing deterministic triage engine alone produces the safety class. Child-fever follow-up uses a curated one-question-at-a-time registry, supports Yes / No / Not sure, stops on an emergency finding, never repeats a question, and asks at most five questions.

On the follow-up screen, refresh the shared referral status or report whether care was reached. Outcomes such as “service not available” become non-identifying service-gap events in Staff View. To demonstrate resilience, switch offline in browser developer tools: the current journey, referral and follow-up actions persist in IndexedDB and sync idempotently when connectivity returns.

Staff View includes real counts derived from the local prototype database, recent service gaps, referral history, and a clearly labelled **prototype capacity control**. Making a service unavailable creates a reroute recommendation for affected referrals; it never silently replaces a citizen's confirmed destination.

## Facility data provenance

The facility identity source is the Government of India/National Health Portal `hospital_directory.csv`, filtered to `State = Tamil Nadu` and `Hospital_Category = Public/ Government`. The versioned 20-record curated extract, coordinate-enrichment register, validation rules, conservative facility-type fallback, and demo-shift availability are kept separately in `apps/api/src/facility-directory.ts`. The retrieved source file has 2,399 Tamil Nadu rows; the prototype imports 20 selected public/government records and all supplied Tamil Nadu coordinate values were blank. Six records have documented coordinate enrichments; the citizen journey only ranks facilities within the labelled 75 km Chennai demo region.

| Field | Treatment |
| --- | --- |
| Facility name, address, district, pincode, care category | Real: supplied CSV fields `Hospital_Name`, `Address_Original_First_Line`, `District`, `Pincode`, `Hospital_Care_Type`, and `Hospital_Category` |
| Latitude / longitude | Real coordinate enrichment: public-map lookup against the supplied name/address/pincode, source URL, evidence, retrieval date, and confidence; the supplied Tamil Nadu `Location_Coordinates` values are blank |
| Distance | Calculated locally with the Haversine formula from a clearly labelled fixed demo-origin coordinate; never stored as an invented source value |
| Service fit | Explicit source specialties/facilities are labelled `SOURCED_FROM_DIRECTORY`. Blank source detail uses a conservative facility-type fallback labelled `INFERRED_FROM_FACILITY_TYPE`; it is not verified capability, staffing, or clinician availability |
| Availability, hours/readiness | Synthetic demo-shift state only; always verify before travel |
| Patients, referrals, staff activity, demand | Synthetic and non-identifying demo records |

The feature does not claim real-time availability, beds, staffing, or service confirmation. Facilities with no trustworthy source support should remain unavailable for routing until verified data is supplied.

For a judge-facing machine-readable explanation, call `GET /api/facility-data`. It returns the dataset filter, included source-row IDs, coordinate-match evidence, and the five status labels used by the prototype.

## Safety and data

- Facility identity and coordinates are real-directory/enriched records as documented above; availability and all care records are synthetic prototype data.
- Deterministic rules—not an LLM—produce `EMERGENCY`, `URGENT`, `ROUTINE`, or `INSUFFICIENT_INFORMATION`. Every non-routine result exposes its rule ID, finding, source reference, and non-diagnostic explanation.
- A child fever alone requests safety details before classification; it never automatically becomes urgent.
- AI, when configured, only extracts validated structured facts. It never decides urgency, emergency routing, or facility ranking.
- Do not put API keys in source code or commit `.env`.

Read [the data and triage audit](docs/data-and-triage-audit.md) for source counts, Chengalpattu coverage, citations, simulated fields, and limitations.

## Milestone 3 data boundary

Facility records are accessed through a `FacilityDataProvider`. The current provider combines the imported/synthetic directory with locally stored prototype-capacity overrides. It is intentionally replaceable by an authorized government or facility feed later. Capacity, wait time, beds and availability remain simulated and must not be presented as live operational data.
