import assert from "node:assert/strict";
import test from "node:test";
import { buildFacilityRecords, demoOrigin, facilityProvenance, tamilNaduPublicDirectory } from "./facility-directory.ts";
import { calculateDistanceKm } from "@ruralcare/shared";
import { rankFacilities } from "@ruralcare/shared";

test("included facilities have public Tamil Nadu directory provenance and valid enrichment", () => {
  const provenance = facilityProvenance();
  const facilities = buildFacilityRecords();
  assert.equal(provenance.sourceRecords, 20);
  assert.equal(facilities.length, provenance.includedFacilities.length);
  for (const facility of facilities) {
    const entry = provenance.includedFacilities.find((item) => item.facilityId === facility.id);
    const source = tamilNaduPublicDirectory.find((item) => item.sourceRowId === entry?.sourceRowId);
    assert.equal(source?.category, "Public/ Government");
    assert.ok(source?.name && source.address && source.district);
    assert.ok(Number.isFinite(facility.latitude) && Number.isFinite(facility.longitude));
    assert.ok(entry?.lookupSource && entry.matchingEvidence && entry.confidence === "HIGH");
  }
});

test("facility distances are derived from coordinates and the labelled demo origin", () => {
  for (const facility of buildFacilityRecords()) assert.equal(facility.distanceKm, calculateDistanceKm(demoOrigin, facility));
});

test("blank directory specialty data is only used through reference routing, not marked verified", () => {
  const blankSpecialtyFacility = buildFacilityRecords().find((facility) => facility.id === "gopalapuram-dispensary");
  assert.deepEqual(blankSpecialtyFacility?.services, ["PRIMARY_CARE"]);
  assert.ok(facilityProvenance().labels.includes("IPHS reference service fit"));
});

test("synthetic shift availability reroutes away from the real but unavailable facility", () => {
  const facilities = buildFacilityRecords();
  const unavailable = facilities.find((facility) => facility.id === "gopalapuram-dispensary");
  assert.equal(unavailable?.available, false);
  assert.ok(rankFacilities(facilities, "PRIMARY_CARE").every((facility) => facility.id !== unavailable?.id));
});
