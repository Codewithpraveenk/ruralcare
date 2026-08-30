import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { demoFacilities } from "./data.ts";

export const db = new DatabaseSync(new URL("../prisma/ruralcare.db", import.meta.url));
export function initializeDatabase() {
  db.exec(`CREATE TABLE IF NOT EXISTS Facility (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, distanceKm REAL NOT NULL, services TEXT NOT NULL, available INTEGER NOT NULL, hours TEXT NOT NULL, address TEXT NOT NULL, phone TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, capacityData TEXT NOT NULL DEFAULT '{}', lastUpdated TEXT NOT NULL DEFAULT 'Synthetic demo shift');
    CREATE TABLE IF NOT EXISTS User (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, phone TEXT UNIQUE, passwordHash TEXT NOT NULL, role TEXT NOT NULL, facilityId TEXT, preferredLanguage TEXT NOT NULL DEFAULT 'en', village TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS Referral (id TEXT PRIMARY KEY, clientId TEXT UNIQUE, patientLabel TEXT NOT NULL, sourceFacility TEXT NOT NULL, destinationFacility TEXT NOT NULL, service TEXT NOT NULL, urgency TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'CREATED', nextAction TEXT NOT NULL, createdAt TEXT NOT NULL, demoId TEXT, careNeed TEXT, followUpDue TEXT, updatedAt TEXT, requestId TEXT, sourceMode TEXT, selectedFacilityType TEXT, routingExplanation TEXT, rerouted INTEGER DEFAULT 0, previousFacility TEXT, routingAudit TEXT, rerouteStatus TEXT, recommendedFacility TEXT, rerouteTimestamp TEXT);
    CREATE TABLE IF NOT EXISTS FacilityServiceStatus (id TEXT PRIMARY KEY, facilityId TEXT NOT NULL, service TEXT NOT NULL, availability TEXT NOT NULL, updatedAt TEXT NOT NULL, updatedBy TEXT NOT NULL, source TEXT NOT NULL, UNIQUE(facilityId,service));
    CREATE TABLE IF NOT EXISTS ReferralStatusEvent (id TEXT PRIMARY KEY, referralId TEXT NOT NULL, fromStatus TEXT, toStatus TEXT NOT NULL, timestamp TEXT NOT NULL, actorType TEXT NOT NULL, actorUserId TEXT, action TEXT);
    CREATE TABLE IF NOT EXISTS FollowUpOutcome (id TEXT PRIMARY KEY, clientId TEXT UNIQUE, referralId TEXT NOT NULL, outcome TEXT NOT NULL, note TEXT, timestamp TEXT NOT NULL, sourceMode TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ServiceGapEvent (id TEXT PRIMARY KEY, dedupeKey TEXT UNIQUE, requestId TEXT, referralId TEXT, requiredService TEXT NOT NULL, district TEXT NOT NULL, facilityId TEXT, eventType TEXT NOT NULL, timestamp TEXT NOT NULL);`);
  const facilityColumns = db.prepare("PRAGMA table_info(Facility)").all() as Array<{ name: string }>;
  for (const column of [["capacityData", "TEXT NOT NULL DEFAULT '{}'"], ["lastUpdated", "TEXT NOT NULL DEFAULT 'Synthetic demo shift'"]]) if (!facilityColumns.some((item) => item.name === column[0])) db.exec(`ALTER TABLE Facility ADD COLUMN ${column[0]} ${column[1]}`);
  const columns = db.prepare("PRAGMA table_info(Referral)").all() as Array<{ name: string }>;
  const userColumns=db.prepare("PRAGMA table_info(User)").all() as Array<{name:string}>;for(const column of [["preferredLanguage","TEXT NOT NULL DEFAULT 'en'"],["village","TEXT"]])if(!userColumns.some(item=>item.name===column[0]))db.exec(`ALTER TABLE User ADD COLUMN ${column[0]} ${column[1]}`);
  for (const column of [["clientId", "TEXT"], ["demoId", "TEXT"], ["careNeed", "TEXT"], ["followUpDue", "TEXT"], ["updatedAt", "TEXT"], ["requestId", "TEXT"], ["sourceMode", "TEXT"], ["selectedFacilityType", "TEXT"], ["selectedFacilityId", "TEXT"], ["ownerUserId", "TEXT"], ["createdByUserId", "TEXT"], ["assistedByUserId", "TEXT"], ["routingExplanation", "TEXT"], ["rerouted", "INTEGER DEFAULT 0"], ["previousFacility", "TEXT"], ["previousFacilityId", "TEXT"], ["routingAudit", "TEXT"], ["rerouteStatus", "TEXT"], ["recommendedFacility", "TEXT"], ["recommendedFacilityId", "TEXT"], ["rerouteTimestamp", "TEXT"]]) if (!columns.some((item) => item.name === column[0])) db.exec(`ALTER TABLE Referral ADD COLUMN ${column[0]} ${column[1]}`);
  const eventColumns=db.prepare("PRAGMA table_info(ReferralStatusEvent)").all() as Array<{name:string}>;for(const column of [["actorUserId","TEXT"],["action","TEXT"]])if(!eventColumns.some(item=>item.name===column[0]))db.exec(`ALTER TABLE ReferralStatusEvent ADD COLUMN ${column[0]} ${column[1]}`);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS Referral_clientId_key ON Referral(clientId) WHERE clientId IS NOT NULL");
  db.exec("UPDATE Referral SET status = CASE status WHEN 'PENDING' THEN 'CREATED' WHEN 'CONTACTED' THEN 'ACCEPTED' WHEN 'FOLLOW_UP' THEN 'FOLLOW_UP_DUE' ELSE status END WHERE status IN ('PENDING','CONTACTED','FOLLOW_UP')");
  db.exec("DELETE FROM Facility");
  db.exec("DELETE FROM Referral WHERE id LIKE 'demo-%'");
  const insert = db.prepare(`INSERT OR REPLACE INTO Facility (id,name,type,distanceKm,services,available,hours,address,phone,latitude,longitude,capacityData,lastUpdated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const facility of demoFacilities) insert.run(facility.id, facility.name, facility.type, facility.distanceKm, JSON.stringify(facility.services), Number(facility.available), facility.hours, facility.address, facility.phone, facility.latitude, facility.longitude, JSON.stringify(facility.capacity || {}), facility.lastUpdated || "Synthetic demo shift");
  const timestamp=new Date().toISOString(),passwordHash=bcrypt.hashSync("RuralCare@2026",12),userSeed=db.prepare("INSERT OR IGNORE INTO User (id,name,email,phone,passwordHash,role,facilityId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)");
  userSeed.run("demo-citizen","Demo Citizen","citizen.demo@ruralcare.local",null,passwordHash,"CITIZEN",null,timestamp,timestamp);
  userSeed.run("demo-asha","Demo ASHA","asha.demo@ruralcare.local",null,passwordHash,"ASHA",null,timestamp,timestamp);
  userSeed.run("demo-staff-phc","Demo PHC Staff","staff.demo@ruralcare.local",null,passwordHash,"STAFF","public-health-centre-west-mambalam",timestamp,timestamp);
  userSeed.run("demo-doctor-phc","Dr. Meena","doctor.demo@ruralcare.local",null,passwordHash,"DOCTOR","public-health-centre-west-mambalam",timestamp,timestamp);
  userSeed.run("demo-admin-phc","PHC Facility Admin","admin.demo@ruralcare.local",null,passwordHash,"FACILITY_ADMIN","public-health-centre-west-mambalam",timestamp,timestamp);
  const seed = db.prepare("INSERT OR IGNORE INTO Referral (id,patientLabel,sourceFacility,destinationFacility,service,urgency,status,nextAction,createdAt,demoId,careNeed,followUpDue,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
  const now = new Date().toISOString(); const tomorrow = new Date(Date.now() + 86400000).toISOString();
  const demoCases = [
    ["demo-1048", "Demo patient A", "ASHA-assisted intake", "Public Health Centre", "CHILD_HEALTH", "URGENT", "CREATED", "Visit a suitable public facility today.", now, "RCC-1048", "Child fever & cough", tomorrow, now],
    ["demo-1047", "Demo patient B", "ASHA-assisted intake", "Public Health Centre", "MATERNITY", "ROUTINE", "ACCEPTED", "Schedule antenatal check-up.", now, "RCC-1047", "Antenatal check-up", tomorrow, now],
    ["demo-1046", "Demo patient C", "ASHA-assisted intake", "K.K.Nagar Dispensary and Polyclinic", "PRIMARY_CARE", "ROUTINE", "ARRIVED", "Complete blood pressure review.", now, "RCC-1046", "Blood pressure review", tomorrow, now],
    ["demo-1045", "Demo patient D", "ASHA-assisted intake", "Gopalapuram Dispensary", "PRIMARY_CARE", "URGENT", "FOLLOW_UP_DUE", "ASHA call-back required.", now, "RCC-1045", "Persistent stomach pain", tomorrow, now],
    ["demo-1041", "Demo patient E", "ASHA-assisted intake", "Public Health Centre", "CHILD_HEALTH", "URGENT", "CREATED", "Route to available child-health service.", now, "RCC-1041", "Breathing concern", tomorrow, now],
    ["demo-1039", "Demo patient F", "ASHA-assisted intake", "Public Health Centre", "CHILD_HEALTH", "ROUTINE", "CREATED", "Confirm immunisation service.", now, "RCC-1039", "Immunisation query", tomorrow, now]
  ];
  for (const item of demoCases) seed.run(...item);
  db.exec(`UPDATE Referral SET createdByUserId='demo-asha',assistedByUserId='demo-asha',sourceMode='ASHA_ASSISTED',selectedFacilityId=CASE destinationFacility WHEN 'Public Health Centre' THEN 'public-health-centre-west-mambalam' WHEN 'K.K.Nagar Dispensary and Polyclinic' THEN 'kk-nagar-dispensary' WHEN 'Gopalapuram Dispensary' THEN 'gopalapuram-dispensary' ELSE selectedFacilityId END WHERE id LIKE 'demo-%'`);
}
