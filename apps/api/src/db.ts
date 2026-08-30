import { DatabaseSync } from "node:sqlite";
import { demoFacilities } from "./data.ts";

export const db = new DatabaseSync(new URL("../prisma/ruralcare.db", import.meta.url));
export function initializeDatabase() {
  db.exec(`CREATE TABLE IF NOT EXISTS Facility (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, distanceKm REAL NOT NULL, services TEXT NOT NULL, available INTEGER NOT NULL, hours TEXT NOT NULL, address TEXT NOT NULL, phone TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, capacityData TEXT NOT NULL DEFAULT '{}', lastUpdated TEXT NOT NULL DEFAULT 'Synthetic demo shift');
    CREATE TABLE IF NOT EXISTS Referral (id TEXT PRIMARY KEY, patientLabel TEXT NOT NULL, sourceFacility TEXT NOT NULL, destinationFacility TEXT NOT NULL, service TEXT NOT NULL, urgency TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'CREATED', nextAction TEXT NOT NULL, createdAt TEXT NOT NULL, demoId TEXT, careNeed TEXT, followUpDue TEXT, updatedAt TEXT, requestId TEXT, sourceMode TEXT, selectedFacilityType TEXT, routingExplanation TEXT, rerouted INTEGER DEFAULT 0, previousFacility TEXT, routingAudit TEXT);`);
  const facilityColumns = db.prepare("PRAGMA table_info(Facility)").all() as Array<{ name: string }>;
  for (const column of [["capacityData", "TEXT NOT NULL DEFAULT '{}'"], ["lastUpdated", "TEXT NOT NULL DEFAULT 'Synthetic demo shift'"]]) if (!facilityColumns.some((item) => item.name === column[0])) db.exec(`ALTER TABLE Facility ADD COLUMN ${column[0]} ${column[1]}`);
  const columns = db.prepare("PRAGMA table_info(Referral)").all() as Array<{ name: string }>;
  for (const column of [["demoId", "TEXT"], ["careNeed", "TEXT"], ["followUpDue", "TEXT"], ["updatedAt", "TEXT"], ["requestId", "TEXT"], ["sourceMode", "TEXT"], ["selectedFacilityType", "TEXT"], ["routingExplanation", "TEXT"], ["rerouted", "INTEGER DEFAULT 0"], ["previousFacility", "TEXT"], ["routingAudit", "TEXT"]]) if (!columns.some((item) => item.name === column[0])) db.exec(`ALTER TABLE Referral ADD COLUMN ${column[0]} ${column[1]}`);
  db.exec("UPDATE Referral SET status = CASE status WHEN 'PENDING' THEN 'CREATED' WHEN 'CONTACTED' THEN 'ACCEPTED' WHEN 'FOLLOW_UP' THEN 'FOLLOW_UP_DUE' ELSE status END WHERE status IN ('PENDING','CONTACTED','FOLLOW_UP')");
  db.exec("DELETE FROM Facility");
  db.exec("DELETE FROM Referral WHERE id LIKE 'demo-%'");
  const insert = db.prepare(`INSERT OR REPLACE INTO Facility (id,name,type,distanceKm,services,available,hours,address,phone,latitude,longitude,capacityData,lastUpdated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const facility of demoFacilities) insert.run(facility.id, facility.name, facility.type, facility.distanceKm, JSON.stringify(facility.services), Number(facility.available), facility.hours, facility.address, facility.phone, facility.latitude, facility.longitude, JSON.stringify(facility.capacity || {}), facility.lastUpdated || "Synthetic demo shift");
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
}
