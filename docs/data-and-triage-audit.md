# Facility data and safety-triage audit

## Data boundary

This prototype uses a curated, 20-record public/government Tamil Nadu subset from the Government of India **National Hospital Directory**. The source was downloaded on 2026-08-30 from [data.gov.in](https://www.data.gov.in/resource/national-hospital-directory-geo-code-and-additional-parameters-updated-till-last-month). The downloaded national file contained 30,273 records; 2,399 had `State = Tamil Nadu`. The current local prototype imports the 20 curated records required for its route demo, of which five have separately cited coordinate enrichments.

The same downloaded directory had **zero valid coordinates for all Tamil Nadu records** and **zero records whose district was Chengalpattu/Chengalpet**. It retains older district naming such as Kanchipuram. Therefore the prototype reports:

- Chengalpattu official-directory record count: **0**
- Imported curated official records: **20**
- Route-eligible records with valid, separately sourced coordinates: **5**
- Capability labels: each service is either `SOURCED_FROM_DIRECTORY` (the directory's `Specialties`/`Facilities` text explicitly supports it) or `INFERRED_FROM_FACILITY_TYPE` (a conservative routing fallback, never a verified capability).

The official [Chengalpattu district hospitals page](https://chengalpattu.nic.in/public-utility-category/hospitals/) is a named-record reference but does not provide a downloadable service-level/coordinate directory. The data.gov.in page publishes the companion NIN facility URL (`https://info.nhp.gov.in/api/nin-health-facilities.csv`), but it was unreachable when checked on 2026-08-30. No records or coordinates were invented to fill those gaps.

Coordinates, road time, availability, waiting time and beds are not live government data. The five displayed coordinates have individual public-map citations in `/api/facility-data`; travel is calculated from a labelled demo origin; capacity is explicitly synthetic.

## Triage boundary

The application performs local, schema-shaped extraction of age group, symptoms and explicitly reported danger-sign details. An LLM is not used to make an urgency decision. If one is added later, it may only produce validated structured extraction; `assessNeed` remains the sole deterministic classifier.

Classifications are:

- `EMERGENCY`: an immediate high-risk red-flag escalation; do not wait for ordinary matching.
- `URGENT`: prompt/same-day assessment recommended for a non-emergency warning concern.
- `ROUTINE`: no identified urgent red flags in the information supplied.
- `INSUFFICIENT_INFORMATION`: not enough safety information to classify safely.

Every non-routine result returns `triggeredRuleId`, finding, guideline reference and a short non-diagnostic explanation. Rules are conservative navigation safeguards, not diagnostic or treatment advice. The references used are WHO **IMCI Chart Booklet** (2014), WHO/ICRC **Basic Emergency Care** (2018), and WHO antenatal-care guidance. In particular, fever in a child by itself is not classified urgent: the app asks about drinking/feeding, vomiting, convulsions, alertness, breathing and stiff neck first.

## Remaining simulations and limitations

- Facility capacities, queue/wait times, beds, availability and reroutes are scenario data.
- The map is an offline illustrative route map, not real navigation or ambulance dispatch.
- The directory has no usable Tamil Nadu coordinate field in the retrieved version; only five separately sourced enrichments are map-capable.
- No live government API, NIN integration, ABDM claim, diagnosis, prescribing or clinical decision support is present.
