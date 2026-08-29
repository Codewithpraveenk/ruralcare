import test from "node:test";
import assert from "node:assert/strict";
import { assessNeed, rankFacilities, type Facility } from "./index.ts";

test("emergency language always escalates", () => {
  assert.equal(assessNeed("My father has chest pain").urgency, "EMERGENCY");
  assert.equal(assessNeed("கடுமையான இரத்தப்போக்கு உள்ளது").service, "EMERGENCY");
});
test("Tamil child fever is routed to child health urgently", () => {
  const result = assessNeed("குழந்தைக்கு காய்ச்சல் இரண்டு நாள்");
  assert.equal(result.urgency, "URGENT"); assert.equal(result.service, "CHILD_HEALTH");
});
test("matching ignores unavailable sites", () => {
  const facilities = [{ id: "1", name: "Near", type: "PHC", distanceKm: 1, services: ["PRIMARY_CARE"], available: false, capacity: { PRIMARY_CARE: { status: "UNAVAILABLE", estimatedWaitMinutes: 0, availableBeds: 0, note: "Demo" } } }, { id: "2", name: "Ready", type: "PHC", distanceKm: 3, services: ["PRIMARY_CARE"], available: true, capacity: { PRIMARY_CARE: { status: "AVAILABLE", estimatedWaitMinutes: 20, availableBeds: 2, note: "Demo" } } }] as Facility[];
  assert.deepEqual(rankFacilities(facilities, "PRIMARY_CARE").map((item) => item.id), ["2"]);
});
test("an available-capacity facility beats a closer limited facility", () => {
  const facilities = [{ id: "limited", name: "Limited", type: "PHC", distanceKm: 1, services: ["MATERNITY"], available: true, capacity: { MATERNITY: { status: "LIMITED", estimatedWaitMinutes: 75, availableBeds: 0, note: "Demo" } } }, { id: "available", name: "Available", type: "PHC", distanceKm: 5, services: ["MATERNITY"], available: true, capacity: { MATERNITY: { status: "AVAILABLE", estimatedWaitMinutes: 20, availableBeds: 3, note: "Demo" } } }] as Facility[];
  assert.equal(rankFacilities(facilities, "MATERNITY")[0].id, "available");
});
