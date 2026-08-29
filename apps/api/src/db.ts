import { DatabaseSync } from "node:sqlite";
import { demoFacilities } from "./data.ts";

export const db = new DatabaseSync(new URL("../prisma/ruralcare.db", import.meta.url));
export function initializeDatabase() {
  db.exec(`CREATE TABLE IF NOT EXISTS Facility (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, distanceKm REAL NOT NULL, services TEXT NOT NULL, available INTEGER NOT NULL, hours TEXT NOT NULL, address TEXT NOT NULL, phone TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS Referral (id TEXT PRIMARY KEY, patientLabel TEXT NOT NULL, sourceFacility TEXT NOT NULL, destinationFacility TEXT NOT NULL, service TEXT NOT NULL, urgency TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', nextAction TEXT NOT NULL, createdAt TEXT NOT NULL);`);
  const insert = db.prepare(`INSERT OR REPLACE INTO Facility (id,name,type,distanceKm,services,available,hours,address,phone,latitude,longitude) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  for (const facility of demoFacilities) insert.run(facility.id, facility.name, facility.type, facility.distanceKm, JSON.stringify(facility.services), Number(facility.available), facility.hours, facility.address, facility.phone, facility.latitude, facility.longitude);
}
