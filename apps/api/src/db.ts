import "./env.ts";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { demoFacilities } from "./data.ts";

const databaseUrl = process.env.DATABASE_URL?.trim() || "file:./ruralcare.db";
if (!databaseUrl.startsWith("file:"))
  throw new Error(
    "This prototype currently requires a file: SQLite DATABASE_URL.",
  );
const databasePath = fileURLToPath(
  new URL(databaseUrl, new URL("../prisma/", import.meta.url)),
);
mkdirSync(dirname(databasePath), { recursive: true });
export const db = new DatabaseSync(databasePath);
export function initializeDatabase() {
  db.exec(`CREATE TABLE IF NOT EXISTS Facility (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, distanceKm REAL NOT NULL, services TEXT NOT NULL, available INTEGER NOT NULL, hours TEXT NOT NULL, address TEXT NOT NULL, phone TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, capacityData TEXT NOT NULL DEFAULT '{}', lastUpdated TEXT NOT NULL DEFAULT 'Synthetic demo shift');
    CREATE TABLE IF NOT EXISTS User (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, phone TEXT UNIQUE, passwordHash TEXT, googleSub TEXT UNIQUE, avatarUrl TEXT, role TEXT NOT NULL, facilityId TEXT, preferredLanguage TEXT NOT NULL DEFAULT 'en', village TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS Referral (id TEXT PRIMARY KEY, clientId TEXT UNIQUE, patientLabel TEXT NOT NULL, sourceFacility TEXT NOT NULL, destinationFacility TEXT NOT NULL, service TEXT NOT NULL, urgency TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'CREATED', nextAction TEXT NOT NULL, createdAt TEXT NOT NULL, demoId TEXT, careNeed TEXT, followUpDue TEXT, updatedAt TEXT, requestId TEXT, sourceMode TEXT, selectedFacilityType TEXT, routingExplanation TEXT, rerouted INTEGER DEFAULT 0, previousFacility TEXT, routingAudit TEXT, rerouteStatus TEXT, recommendedFacility TEXT, rerouteTimestamp TEXT);
    CREATE TABLE IF NOT EXISTS FacilityServiceStatus (id TEXT PRIMARY KEY, facilityId TEXT NOT NULL, service TEXT NOT NULL, availability TEXT NOT NULL, updatedAt TEXT NOT NULL, updatedBy TEXT NOT NULL, source TEXT NOT NULL, UNIQUE(facilityId,service));
    CREATE TABLE IF NOT EXISTS ReferralStatusEvent (id TEXT PRIMARY KEY, referralId TEXT NOT NULL, fromStatus TEXT, toStatus TEXT NOT NULL, timestamp TEXT NOT NULL, actorType TEXT NOT NULL, actorUserId TEXT, action TEXT);
    CREATE TABLE IF NOT EXISTS FollowUpOutcome (id TEXT PRIMARY KEY, clientId TEXT UNIQUE, referralId TEXT NOT NULL, outcome TEXT NOT NULL, note TEXT, timestamp TEXT NOT NULL, sourceMode TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ClinicalOutcome (id TEXT PRIMARY KEY, referralId TEXT NOT NULL, disposition TEXT NOT NULL, instructionEnglish TEXT NOT NULL, instructionTamil TEXT NOT NULL, followUpDate TEXT, timestamp TEXT NOT NULL, actorUserId TEXT NOT NULL, actorName TEXT NOT NULL, actorRole TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ServiceGapEvent (id TEXT PRIMARY KEY, dedupeKey TEXT UNIQUE, requestId TEXT, referralId TEXT, requiredService TEXT NOT NULL, district TEXT NOT NULL, facilityId TEXT, eventType TEXT NOT NULL, timestamp TEXT NOT NULL);`);
  const facilityColumns = db
    .prepare("PRAGMA table_info(Facility)")
    .all() as Array<{ name: string }>;
  for (const column of [
    ["capacityData", "TEXT NOT NULL DEFAULT '{}'"],
    ["lastUpdated", "TEXT NOT NULL DEFAULT 'Synthetic demo shift'"],
  ])
    if (!facilityColumns.some((item) => item.name === column[0]))
      db.exec(`ALTER TABLE Facility ADD COLUMN ${column[0]} ${column[1]}`);
  const statusColumns=db.prepare("PRAGMA table_info(FacilityServiceStatus)").all() as Array<{name:string}>;
  for(const column of [["expiresAt","TEXT"],["verificationNote","TEXT"]])if(!statusColumns.some(item=>item.name===column[0]))db.exec(`ALTER TABLE FacilityServiceStatus ADD COLUMN ${column[0]} ${column[1]}`);
  db.exec("UPDATE FacilityServiceStatus SET expiresAt=updatedAt, verificationNote=COALESCE(verificationNote,'Legacy prototype override expired during migration') WHERE expiresAt IS NULL");
  const columns = db.prepare("PRAGMA table_info(Referral)").all() as Array<{
    name: string;
  }>;
  const userColumns = db.prepare("PRAGMA table_info(User)").all() as Array<{
    name: string;
  }>;
  for (const column of [
    ["preferredLanguage", "TEXT NOT NULL DEFAULT 'en'"],
    ["village", "TEXT"],
  ])
    if (!userColumns.some((item) => item.name === column[0]))
      db.exec(`ALTER TABLE User ADD COLUMN ${column[0]} ${column[1]}`);
  const authColumns = db.prepare("PRAGMA table_info(User)").all() as Array<{
    name: string;
    notnull: number;
  }>;
  if (
    !authColumns.some((item) => item.name === "googleSub") ||
    authColumns.find((item) => item.name === "passwordHash")?.notnull === 1
  )
    db.exec(`BEGIN;
    CREATE TABLE User_auth_new (id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE,phone TEXT UNIQUE,passwordHash TEXT,googleSub TEXT UNIQUE,avatarUrl TEXT,role TEXT NOT NULL,facilityId TEXT,preferredLanguage TEXT NOT NULL DEFAULT 'en',village TEXT,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
    INSERT INTO User_auth_new (id,name,email,phone,passwordHash,role,facilityId,preferredLanguage,village,createdAt,updatedAt) SELECT id,name,lower(email),phone,passwordHash,role,facilityId,coalesce(preferredLanguage,'en'),village,createdAt,updatedAt FROM User;
    DROP TABLE User;
    ALTER TABLE User_auth_new RENAME TO User;
    COMMIT;`);
  for (const column of [
    ["clientId", "TEXT"],
    ["demoId", "TEXT"],
    ["careNeed", "TEXT"],
    ["followUpDue", "TEXT"],
    ["updatedAt", "TEXT"],
    ["requestId", "TEXT"],
    ["sourceMode", "TEXT"],
    ["selectedFacilityType", "TEXT"],
    ["selectedFacilityId", "TEXT"],
    ["ownerUserId", "TEXT"],
    ["createdByUserId", "TEXT"],
    ["assistedByUserId", "TEXT"],
    ["routingExplanation", "TEXT"],
    ["rerouted", "INTEGER DEFAULT 0"],
    ["previousFacility", "TEXT"],
    ["previousFacilityId", "TEXT"],
    ["routingAudit", "TEXT"],
    ["rerouteStatus", "TEXT"],
    ["recommendedFacility", "TEXT"],
    ["recommendedFacilityId", "TEXT"],
    ["rerouteTimestamp", "TEXT"],
  ])
    if (!columns.some((item) => item.name === column[0]))
      db.exec(`ALTER TABLE Referral ADD COLUMN ${column[0]} ${column[1]}`);
  const eventColumns = db
    .prepare("PRAGMA table_info(ReferralStatusEvent)")
    .all() as Array<{ name: string }>;
  for (const column of [
    ["actorUserId", "TEXT"],
    ["action", "TEXT"],
  ])
    if (!eventColumns.some((item) => item.name === column[0]))
      db.exec(
        `ALTER TABLE ReferralStatusEvent ADD COLUMN ${column[0]} ${column[1]}`,
      );
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS Referral_clientId_key ON Referral(clientId) WHERE clientId IS NOT NULL",
  );
  db.exec(
    "UPDATE Referral SET status = CASE status WHEN 'PENDING' THEN 'CREATED' WHEN 'CONTACTED' THEN 'ACCEPTED' WHEN 'FOLLOW_UP' THEN 'FOLLOW_UP_DUE' ELSE status END WHERE status IN ('PENDING','CONTACTED','FOLLOW_UP')",
  );
  db.exec("DELETE FROM Facility");
  db.exec("DELETE FROM ReferralStatusEvent WHERE referralId LIKE 'demo-%'");
  db.exec("DELETE FROM FollowUpOutcome WHERE referralId LIKE 'demo-%'");
  db.exec("DELETE FROM ClinicalOutcome WHERE referralId LIKE 'demo-%'");
  db.exec("DELETE FROM Referral WHERE id LIKE 'demo-%'");
  const insert = db.prepare(
    `INSERT OR REPLACE INTO Facility (id,name,type,distanceKm,services,available,hours,address,phone,latitude,longitude,capacityData,lastUpdated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  for (const facility of demoFacilities)
    insert.run(
      facility.id,
      facility.name,
      facility.type,
      facility.distanceKm,
      JSON.stringify(facility.services),
      Number(facility.available),
      facility.hours,
      facility.address,
      facility.phone,
      facility.latitude,
      facility.longitude,
      JSON.stringify(facility.capacity || {}),
      facility.lastUpdated || "Synthetic demo shift",
    );
  const timestamp = new Date().toISOString(),
    passwordHash = bcrypt.hashSync("RuralCare@2026", 12),
    userSeed = db.prepare(
      `INSERT INTO User (id,name,email,phone,passwordHash,role,facilityId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,passwordHash=excluded.passwordHash,role=excluded.role,facilityId=excluded.facilityId,updatedAt=excluded.updatedAt`,
    );
  userSeed.run(
    "demo-citizen",
    "Demo Citizen",
    "citizen.demo@ruralcare.local",
    null,
    passwordHash,
    "CITIZEN",
    null,
    timestamp,
    timestamp,
  );
  db.exec(
    "UPDATE User SET facilityId='government-hospital-madurantakam' WHERE facilityId='public-health-centre-west-mambalam'; UPDATE User SET facilityId='government-hospital-cheyyur' WHERE facilityId='kk-nagar-dispensary';",
  );
  userSeed.run(
    "demo-asha",
    "Demo ASHA",
    "asha.demo@ruralcare.local",
    null,
    passwordHash,
    "ASHA",
    null,
    timestamp,
    timestamp,
  );
  userSeed.run(
    "demo-staff-phc",
    "Madurantakam Hospital Staff",
    "staff.demo@ruralcare.local",
    null,
    passwordHash,
    "STAFF",
    "government-hospital-madurantakam",
    timestamp,
    timestamp,
  );
  userSeed.run(
    "demo-doctor-phc",
    "Dr. Meena",
    "doctor.demo@ruralcare.local",
    null,
    passwordHash,
    "DOCTOR",
    "government-hospital-madurantakam",
    timestamp,
    timestamp,
  );
  userSeed.run(
    "demo-staff-kk",
    "Cheyyur Hospital Staff",
    "staff.kk.demo@ruralcare.local",
    null,
    passwordHash,
    "STAFF",
    "government-hospital-cheyyur",
    timestamp,
    timestamp,
  );
  userSeed.run(
    "demo-doctor-kk",
    "Dr. Kannan",
    "doctor.kk.demo@ruralcare.local",
    null,
    passwordHash,
    "DOCTOR",
    "government-hospital-cheyyur",
    timestamp,
    timestamp,
  );
  userSeed.run(
    "demo-admin-phc",
    "Madurantakam Facility Admin",
    "admin.demo@ruralcare.local",
    null,
    passwordHash,
    "FACILITY_ADMIN",
    "government-hospital-madurantakam",
    timestamp,
    timestamp,
  );
  // Referral worklists are intentionally not seeded. Every dashboard row must
  // originate from an authenticated citizen/ASHA referral created in the app.
}
