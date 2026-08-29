# RuralCare Connect

An offline-capable SIH demonstration app for routing a rural citizen or ASHA worker to an appropriate **public** healthcare service. It is not a diagnosis tool or a live government system.

## Run in VS Code

1. Install [Node.js 20+](https://nodejs.org/) and open this folder in VS Code.
2. Copy `.env.example` to `.env` (leaving the key blank is fine).
3. In the VS Code terminal run `npm install` once, then run `npm run dev`.
4. Open the local URL shown for `web` (normally `http://localhost:5173`).

The first run creates a local SQLite database and seeds a Tamil Nadu demonstration set. The running prototype uses Node's built-in SQLite driver for reliable zero-setup local execution; `apps/api/prisma/schema.prisma` is included as the portable schema for a future Prisma/PostgreSQL deployment. Use the **Staff dashboard** link to see the operational view.

## Useful commands

- `npm run dev` - initialize SQLite and start API + PWA
- `npm test` - safety and facility-matching unit tests
- `npm run build` - type-check and create the production web build

## Demo route

Choose Tamil or English, enter a need such as `My child has fever and cough for two days`, confirm the bounded assessment, choose a facility, then create a referral. Switch to offline in browser developer tools and submit a referral to demonstrate the local queue; reconnect to sync it.

## Facility data provenance

The facility identity source is the supplied Government of India/National Health Portal `hospital_directory.csv`, filtered to `State = Tamil Nadu` and `Hospital_Category = Public/ Government`. The versioned 20-record extract, coordinate-enrichment register, validation rules, IPHS reference profiles, and demo-shift availability are kept separately in `apps/api/src/facility-directory.ts`. The source file has 2,399 Tamil Nadu rows, but only 20 are explicitly public/government and all their source-coordinate values are blank. Only five records with a documented exact coordinate match are admitted to routing.

| Field | Treatment |
| --- | --- |
| Facility name, address, district, pincode, care category | Real: supplied CSV fields `Hospital_Name`, `Address_Original_First_Line`, `District`, `Pincode`, `Hospital_Care_Type`, and `Hospital_Category` |
| Latitude / longitude | Real coordinate enrichment: public-map lookup against the supplied name/address/pincode, source URL, evidence, retrieval date, and confidence; the supplied Tamil Nadu `Location_Coordinates` values are blank |
| Distance | Calculated locally with the Haversine formula from a clearly labelled fixed demo-origin coordinate; never stored as an invented source value |
| Service fit | Explicit source specialties/facilities take precedence. Blank source detail uses an IPHS care-level reference mapping; it is not a live confirmation of a department or clinician |
| Availability, hours/readiness | Synthetic demo-shift state only; always verify before travel |
| Patients, referrals, staff activity, demand | Synthetic and non-identifying demo records |

The feature does not claim real-time availability, beds, staffing, or service confirmation. Facilities with no trustworthy source support should remain unavailable for routing until verified data is supplied.

For a judge-facing machine-readable explanation, call `GET /api/facility-data`. It returns the dataset filter, included source-row IDs, coordinate-match evidence, and the five status labels used by the prototype.

## Safety and data

- Facility identity and coordinates are real-directory/enriched records as documented above; availability and all care records are synthetic prototype data.
- Emergency keywords bypass normal recommendations and show urgent human-care guidance.
- AI is optional and never decides emergency routing or facility ranking.
- Do not put API keys in source code or commit `.env`.
