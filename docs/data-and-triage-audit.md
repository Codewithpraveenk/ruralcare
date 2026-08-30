# Facility data and safety-triage audit

## Data boundary

This prototype uses a curated, 20-record public/government Tamil Nadu subset from the Government of India **National Hospital Directory**. The source was downloaded on 2026-08-30 from [data.gov.in](https://www.data.gov.in/resource/national-hospital-directory-geo-code-and-additional-parameters-updated-till-last-month). The downloaded national file contained 30,273 records; 2,399 had `State = Tamil Nadu`. The current local prototype imports the 20 curated records required for its route demo, of which five have separately cited coordinate enrichments.

The same downloaded directory had **zero valid coordinates for all Tamil Nadu records** and **zero records whose district was Chengalpattu/Chengalpet**. It retains older district naming such as Kanchipuram. Therefore the prototype reports:

- Chengalpattu official-directory record count: **0**
- Imported curated official records: **20**
- Coordinate-enriched records: **6**. Routing is restricted to the 75 km Chennai demo region, so the two Kanniyakumari records remain documented but are excluded from this local journey.
- Capability labels: each service is either `SOURCED_FROM_DIRECTORY` (the directory's `Specialties`/`Facilities` text explicitly supports it) or `INFERRED_FROM_FACILITY_TYPE` (a conservative routing fallback, never a verified capability).

The official [Chengalpattu district hospitals page](https://chengalpattu.nic.in/public-utility-category/hospitals/) is a named-record reference but does not provide a downloadable service-level/coordinate directory. The data.gov.in page publishes the companion NIN facility URL (`https://info.nhp.gov.in/api/nin-health-facilities.csv`), but it was unreachable when checked on 2026-08-30. No records or coordinates were invented to fill those gaps.

Coordinates, road time, availability, waiting time and beds are not live government data. The six enriched coordinates have individual public-map citations in `/api/facility-data`; travel is calculated from a labelled demo origin; capacity is explicitly synthetic.

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

## Care routing (Milestone 2)

`packages/shared/src/routing.ts` is the deterministic matching engine. It maps the completed triage assessment to a small service plan: `PRIMARY_CARE`, `CHILD_HEALTH`, `MATERNITY`, or `EMERGENCY`; emergency requests require emergency-capable care. Facility care levels are conservative: AAM/dispensary/PHC are primary; CHC is primary/secondary; district hospital is secondary/emergency.

The engine filters invalid coordinates, facilities outside the 75 km demo region, unsuitable service support, and facilities below the needed level before ranking. Exact service matches form a hard **1000-point** tier; acceptable primary-care fallbacks use a **500-point** tier. Sourced capability adds **100**, care-level fit **50**, available status **25** (limited **10**), and distance subtracts **1 per km**. Thus an exact service match cannot be displaced by a merely closer fallback. Every result returns the matched service, whether it is a fallback, provenance, simulated availability (`SIMULATED_FOR_PROTOTYPE`), human-readable reasons, and a recommendation status.

If the highest-scoring suitable facility is unavailable, the decision preserves it as the original facility, selects the next suitable available option, and returns `REQUIRED_SERVICE_UNAVAILABLE` with an explanation. The referral stores the routing request ID, source mode, selected facility type, explanation, reroute flag, prior facility, and non-sensitive routing audit. The existing staff workflow reads the same referral table.

RuralCare Connect is an AI-assisted care-navigation and triage-support prototype, not a medical diagnosis system. Real facility identity/location data is used where sourced. Current service availability, queues, beds and doctor availability are simulated for prototype demonstration.

## Continuity and public-health feedback (Milestone 3)

- A journey records whether it was entered by a citizen or with ASHA assistance. This is workflow context, not authentication.
- The UI exposes the translation chain: citizen statement → normalized need → safety class → required service/care level.
- Each referral has a stable client identifier, status history, follow-up outcomes and offline sync state. Duplicate queued submissions are rejected by unique idempotency keys.
- Staff capacity changes are persisted locally and labelled `SIMULATED_FOR_PROTOTYPE`. When an already-confirmed destination becomes unavailable, the system stores `REROUTE_RECOMMENDED`; the original destination changes only after explicit confirmation (`REROUTE_CONFIRMED`).
- No-match routing, all-unavailable routing, reported service unavailability and inability to reach care create non-identifying `ServiceGapEvent` records. Staff metrics are calculated from stored referrals and these events, with no hard-coded count offsets.
- The browser stores the active workflow and queued referral/follow-up actions in IndexedDB. Queued actions expose `LOCAL_ONLY`, `PENDING_SYNC`, `SYNCING`, `SYNCED` or `SYNC_FAILED` state and retry on reconnection.
- `FacilityDataProvider` isolates facility reads from routing and capacity logic. The current implementation is local; a future authorized integration can replace it without changing the triage boundary.

### Still simulated or limited

- Capacity changes are a staff-controlled demonstration and are not hospital updates.
- There is no authenticated citizen identity, ASHA identity, government registry write-back, SMS delivery, ambulance dispatch or clinical follow-up integration.
- Offline sync is single-device, best-effort prototype synchronization; conflict resolution across multiple devices is not implemented.
- Service-gap summaries are operational signals only. They are not epidemiological surveillance, diagnosis, or evidence of facility performance.
