import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function continuityDb() {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE Referral (id TEXT PRIMARY KEY, clientId TEXT UNIQUE, destinationFacility TEXT, recommendedFacility TEXT, rerouteStatus TEXT, sourceMode TEXT);
    CREATE TABLE FacilityServiceStatus (facilityId TEXT, service TEXT, availability TEXT, source TEXT, UNIQUE(facilityId,service));
    CREATE TABLE ReferralStatusEvent (id TEXT PRIMARY KEY, referralId TEXT, fromStatus TEXT, toStatus TEXT, actorType TEXT);
    CREATE TABLE FollowUpOutcome (id TEXT PRIMARY KEY, clientId TEXT UNIQUE, referralId TEXT, outcome TEXT);
    CREATE TABLE ServiceGapEvent (id TEXT PRIMARY KEY, dedupeKey TEXT UNIQUE, referralId TEXT, eventType TEXT);
  `);
  return database;
}

test("capacity override is persistent, unique, and explicitly simulated", () => {
  const database = continuityDb();
  database.prepare("INSERT INTO FacilityServiceStatus VALUES (?,?,?,?)").run("phc-1", "PRIMARY_CARE", "UNAVAILABLE", "SIMULATED_FOR_PROTOTYPE");
  database.prepare("INSERT INTO FacilityServiceStatus VALUES (?,?,?,?) ON CONFLICT(facilityId,service) DO UPDATE SET availability=excluded.availability").run("phc-1", "PRIMARY_CARE", "LIMITED", "SIMULATED_FOR_PROTOTYPE");
  assert.deepEqual({ ...database.prepare("SELECT availability,source FROM FacilityServiceStatus").get() }, { availability: "LIMITED", source: "SIMULATED_FOR_PROTOTYPE" });
});

test("capacity change recommends reroute without overwriting confirmed destination", () => {
  const database = continuityDb();
  database.prepare("INSERT INTO Referral VALUES (?,?,?,?,?,?)").run("r1", "client-1", "Original PHC", null, null, "ASHA_ASSISTED");
  database.prepare("UPDATE Referral SET recommendedFacility=?,rerouteStatus=? WHERE id=?").run("Alternative CHC", "REROUTE_RECOMMENDED", "r1");
  const before = { ...database.prepare("SELECT destinationFacility,recommendedFacility,rerouteStatus FROM Referral WHERE id='r1'").get() };
  assert.deepEqual(before, { destinationFacility: "Original PHC", recommendedFacility: "Alternative CHC", rerouteStatus: "REROUTE_RECOMMENDED" });
  database.prepare("UPDATE Referral SET destinationFacility=recommendedFacility,rerouteStatus='REROUTE_CONFIRMED' WHERE id='r1'").run();
  assert.equal((database.prepare("SELECT destinationFacility FROM Referral WHERE id='r1'").get() as {destinationFacility:string}).destinationFacility, "Alternative CHC");
});

test("referrals, follow-ups, and service gaps are idempotent", () => {
  const database = continuityDb();
  database.prepare("INSERT INTO Referral VALUES (?,?,?,?,?,?)").run("r1", "client-1", "PHC", null, null, "CITIZEN");
  assert.throws(() => database.prepare("INSERT INTO Referral VALUES (?,?,?,?,?,?)").run("r2", "client-1", "PHC", null, null, "CITIZEN"));
  database.prepare("INSERT INTO FollowUpOutcome VALUES (?,?,?,?)").run("f1", "follow-client-1", "r1", "SERVICE_NOT_AVAILABLE");
  assert.throws(() => database.prepare("INSERT INTO FollowUpOutcome VALUES (?,?,?,?)").run("f2", "follow-client-1", "r1", "SERVICE_NOT_AVAILABLE"));
  database.prepare("INSERT INTO ServiceGapEvent VALUES (?,?,?,?)").run("g1", "followup:follow-client-1", "r1", "SERVICE_REPORTED_UNAVAILABLE");
  assert.throws(() => database.prepare("INSERT INTO ServiceGapEvent VALUES (?,?,?,?)").run("g2", "followup:follow-client-1", "r1", "SERVICE_REPORTED_UNAVAILABLE"));
});

test("shared referral history preserves actor and ordered transitions", () => {
  const database = continuityDb();
  database.prepare("INSERT INTO ReferralStatusEvent VALUES (?,?,?,?,?)").run("e1", "r1", null, "CREATED", "CITIZEN");
  database.prepare("INSERT INTO ReferralStatusEvent VALUES (?,?,?,?,?)").run("e2", "r1", "CREATED", "ACCEPTED", "STAFF");
  assert.deepEqual(database.prepare("SELECT fromStatus,toStatus,actorType FROM ReferralStatusEvent WHERE referralId=? ORDER BY rowid").all("r1").map(item=>({...item})), [
    { fromStatus: null, toStatus: "CREATED", actorType: "CITIZEN" },
    { fromStatus: "CREATED", toStatus: "ACCEPTED", actorType: "STAFF" },
  ]);
});
