import assert from "node:assert/strict";
import test from "node:test";
import { auditFacilityData } from "./facility-data-audit.ts";

test("official Chengalpattu dataset passes provenance and safety validation",()=>{
  const report=auditFacilityData();
  assert.equal(report.valid,true);
  assert.deepEqual(report.errors,[]);
  assert.equal(report.counts.officialRecords,17);
  assert.equal(report.counts.chengalpattuRecords,17);
  assert.equal(report.counts.validCoordinates,9);
  assert.equal(report.counts.routeableRecords,9);
  assert.equal(report.counts.sourcedCapabilities,3);
  assert.equal(report.counts.inferredCapabilities,30);
  assert.ok(report.warnings.some(item=>item.includes("HMIS")));
});
