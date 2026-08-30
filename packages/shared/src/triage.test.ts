import test from "node:test";
import assert from "node:assert/strict";
import { assessNeed, rankFacilities, type Facility } from "./index.ts";

test("deterministic danger rules escalate and expose an audit trail", () => {
  const result = assessNeed("My child has fever, cannot drink and has a seizure");
  assert.equal(result.urgency, "EMERGENCY");
  assert.equal(result.service, "EMERGENCY");
  assert.ok(result.triggeredRules.some((item) => item.triggeredRuleId === "EMR_CONVULSION"));
  assert.ok(result.triggeredRules.every((item) => item.finding && item.guidelineReference && item.explanation));
});
test("Tamil severe bleeding is an emergency", () => {
  const result = assessNeed("கடுமையான இரத்தப்போக்கு உள்ளது");
  assert.equal(result.urgency, "EMERGENCY");
  assert.equal(result.triggeredRules[0].triggeredRuleId, "EMR_SEVERE_BLEEDING");
});
test("mild child fever requests safety details rather than becoming urgent", () => {
  const result = assessNeed("குழந்தைக்கு காய்ச்சல் இரண்டு நாள்");
  assert.equal(result.urgency, "INSUFFICIENT_INFORMATION");
  assert.equal(result.service, "CHILD_HEALTH");
  assert.ok(result.missingInformation.some((item) => item.includes("drink")));
});
test("child fever with reassuring answers is routine", () => {
  const result = assessNeed("My 8-year-old child has mild fever since this morning. The child is drinking well, awake, has no vomiting, no seizure, no breathing difficulty and no stiff neck.");
  assert.equal(result.urgency, "ROUTINE");
});
test("judge-demo child fever alone remains insufficient, never urgent", () => {
  assert.equal(assessNeed("My child has mild fever since this morning.").urgency, "INSUFFICIENT_INFORMATION");
});
test("judge-demo adult mild headache is routine", () => {
  assert.equal(assessNeed("I am an adult with a mild headache since this morning. I am awake and have no breathing difficulty, no confusion and no severe bleeding.").urgency, "ROUTINE");
});
test("judge-demo mixed Tamil-English convulsion is emergency", () => {
  const result = assessNeed("குழந்தைக்கு fever இருக்கு and வலிப்பு ஏற்பட்டது.");
  assert.equal(result.urgency, "EMERGENCY");
  assert.equal(result.language, "mixed");
  assert.equal(result.triggeredRules[0].triggeredRuleId, "EMR_CONVULSION");
});
test("child inability to drink and repeated vomiting are deterministic danger signs", () => {
  assert.equal(assessNeed("My child has fever and cannot drink.").triggeredRules[0].triggeredRuleId, "EMR_CHILD_UNABLE_TO_DRINK");
  assert.equal(assessNeed("My child has fever and is vomiting everything.").triggeredRules[0].triggeredRuleId, "EMR_CHILD_VOMITS_EVERYTHING");
});
test("pregnancy warning concern is urgent with a guideline reference", () => {
  const result = assessNeed("pregnant with bleeding");
  assert.equal(result.urgency, "URGENT");
  assert.ok(result.triggeredRules[0].guidelineReference);
});
test("matching ignores unavailable sites", () => {
  const facilities = [{ id: "1", name: "Near", type: "PHC", distanceKm: 1, services: ["PRIMARY_CARE"], available: false, capacity: { PRIMARY_CARE: { status: "UNAVAILABLE", estimatedWaitMinutes: 0, availableBeds: 0, note: "Demo" } } }, { id: "2", name: "Ready", type: "PHC", distanceKm: 3, services: ["PRIMARY_CARE"], available: true, capacity: { PRIMARY_CARE: { status: "AVAILABLE", estimatedWaitMinutes: 20, availableBeds: 2, note: "Demo" } } }] as Facility[];
  assert.deepEqual(rankFacilities(facilities, "PRIMARY_CARE").map((item) => item.id), ["2"]);
});
test("available capacity beats closer limited capacity", () => {
  const facilities = [{ id: "limited", name: "Limited", type: "PHC", distanceKm: 1, services: ["MATERNITY"], available: true, capacity: { MATERNITY: { status: "LIMITED", estimatedWaitMinutes: 75, availableBeds: 0, note: "Demo" } } }, { id: "available", name: "Available", type: "PHC", distanceKm: 5, services: ["MATERNITY"], available: true, capacity: { MATERNITY: { status: "AVAILABLE", estimatedWaitMinutes: 20, availableBeds: 3, note: "Demo" } } }] as Facility[];
  assert.equal(rankFacilities(facilities, "MATERNITY")[0].id, "available");
});
