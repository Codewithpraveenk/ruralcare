import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFacilityRecords,
  demoOrigin,
  facilityProvenance,
  tamilNaduPublicDirectory,
} from "./facility-directory.ts";
import {
  assessNeed,
  calculateDistanceKm,
  rankFacilities,
  routeFacilities,
} from "@ruralcare/shared";

test("included facilities have official Chengalpattu provenance and valid enrichment", () => {
  const provenance = facilityProvenance();
  const facilities = buildFacilityRecords();
  assert.equal(provenance.sourceRecords, 17);
  assert.equal(provenance.chengalpattuRecords, 17);
  assert.equal(provenance.validCoordinateRecords, 9);
  assert.equal(facilities.length, provenance.includedFacilities.length);
  for (const facility of facilities) {
    const entry = provenance.includedFacilities.find(
      (item) => item.facilityId === facility.id,
    );
    const source = tamilNaduPublicDirectory.find(
      (item) => item.sourceRowId === entry?.sourceRowId,
    );
    assert.equal(source?.category, "Public/ Government");
    assert.ok(
      source?.name && source.address && source.district === "Chengalpattu",
    );
    assert.ok(
      Number.isFinite(facility.latitude) && Number.isFinite(facility.longitude),
    );
    assert.ok(
      entry?.lookupSource &&
        entry.matchingEvidence &&
        entry.confidence === "HIGH",
    );
  }
});

test("facility distances are derived from coordinates and the labelled demo origin", () => {
  for (const facility of buildFacilityRecords())
    assert.equal(
      facility.distanceKm,
      calculateDistanceKm(demoOrigin, facility),
    );
});

test("blank directory specialty data is conservatively inferred and visibly labelled", () => {
  const blankSpecialtyFacility = buildFacilityRecords().find(
    (facility) => facility.id === "government-hospital-cheyyur",
  );
  assert.deepEqual(blankSpecialtyFacility?.services, [
    "PRIMARY_CARE",
    "MATERNITY",
    "CHILD_HEALTH",
    "EMERGENCY",
  ]);
  assert.equal(
    blankSpecialtyFacility?.capabilitySource,
    "INFERRED_FROM_FACILITY_TYPE",
  );
  assert.ok(
    facilityProvenance().labels.some((label) =>
      label.includes("INFERRED_FROM_FACILITY_TYPE"),
    ),
  );
});

test("synthetic shift availability reroutes away from the real but unavailable facility", () => {
  const facilities = buildFacilityRecords();
  const unavailable = facilities.find(
    (facility) => facility.id === "government-hospital-madurantakam",
  );
  assert.equal(unavailable?.capacity?.PRIMARY_CARE?.status, "UNAVAILABLE");
  assert.ok(
    rankFacilities(facilities, "PRIMARY_CARE").every(
      (facility) => facility.id !== unavailable?.id,
    ),
  );
});

test("judge-demo routine primary-care pathway visibly reroutes", () => {
  const assessment = assessNeed(
    "I am an adult with a mild headache since this morning. I am awake and have no breathing difficulty, no confusion and no severe bleeding.",
  );
  const decision = routeFacilities(
    buildFacilityRecords(),
    assessment,
    "judge-reroute-demo",
  );
  assert.equal(assessment.urgency, "ROUTINE");
  assert.equal(decision.rerouted, true);
  assert.equal(decision.originalFacilityId, "government-hospital-madurantakam");
  assert.equal(decision.rerouteReason, "REQUIRED_SERVICE_UNAVAILABLE");
  assert.ok(decision.selectedFacilityId);
});
