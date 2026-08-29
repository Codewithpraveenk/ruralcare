import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { assessNeed, rankFacilities, type Facility, type Service } from "@ruralcare/shared";
import { db, initializeDatabase } from "./db.ts";

const app = express();
app.use(cors()); app.use(express.json({ limit: "100kb" }));
function asFacility(record: Record<string, unknown>): Facility {
  return { ...record, type: record.type as Facility["type"], distanceKm: Number(record.distanceKm), available: Boolean(record.available), latitude: Number(record.latitude), longitude: Number(record.longitude), services: JSON.parse(String(record.services)) as Service[] } as Facility;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, mode: "synthetic-prototype" }));
app.post("/api/triage", (req, res) => {
  const parsed = z.object({ message: z.string().trim().min(2).max(600) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter a short description of the health need." });
  return res.json({ assessment: assessNeed(parsed.data.message), source: "deterministic-safety-fallback" });
});
app.get("/api/facilities", async (req, res) => {
  const service = z.enum(["PRIMARY_CARE", "MATERNITY", "CHILD_HEALTH", "EMERGENCY", "TELECONSULT"]).catch("PRIMARY_CARE").parse(req.query.service);
  const facilities = db.prepare("SELECT * FROM Facility").all().map((record) => asFacility(record as Record<string, unknown>));
  res.json({ facilities: rankFacilities(facilities, service), dataLabel: "Synthetic prototype availability - verify before travel" });
});
app.post("/api/referrals", async (req, res) => {
  const parsed = z.object({ patientLabel: z.string().trim().min(1).max(40), sourceFacility: z.string(), destinationFacility: z.string(), service: z.string(), urgency: z.string(), nextAction: z.string().max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Referral details are incomplete." });
  const referral = { id: crypto.randomUUID(), ...parsed.data, status: "PENDING", createdAt: new Date().toISOString() };
  db.prepare("INSERT INTO Referral (id,patientLabel,sourceFacility,destinationFacility,service,urgency,status,nextAction,createdAt) VALUES (?,?,?,?,?,?,?,?,?)").run(referral.id, referral.patientLabel, referral.sourceFacility, referral.destinationFacility, referral.service, referral.urgency, referral.status, referral.nextAction, referral.createdAt);
  res.status(201).json({ referral });
});
app.get("/api/referrals", async (_req, res) => res.json({ referrals: db.prepare("SELECT * FROM Referral ORDER BY createdAt DESC LIMIT 20").all() }));
app.patch("/api/referrals/:id", async (req, res) => {
  const status = z.enum(["PENDING", "CONTACTED", "COMPLETED"]).safeParse(req.body.status);
  if (!status.success) return res.status(400).json({ error: "Invalid status" });
  db.prepare("UPDATE Referral SET status = ? WHERE id = ?").run(status.data, req.params.id);
  const referral = db.prepare("SELECT * FROM Referral WHERE id = ?").get(req.params.id); if (!referral) return res.status(404).json({ error: "Referral not found" }); res.json({ referral });
});
app.get("/api/dashboard", async (_req, res) => {
  const referrals = db.prepare("SELECT * FROM Referral ORDER BY createdAt DESC").all() as Array<{ urgency: string; status: string }>;
  res.json({ referrals, totals: { total: referrals.length, urgent: referrals.filter((item) => item.urgency !== "ROUTINE").length, pending: referrals.filter((item) => item.status === "PENDING").length }, demand: [{ service: "Primary care", count: 12 }, { service: "Child health", count: 7 }, { service: "Maternity", count: 4 }] });
});

const port = Number(process.env.PORT || 8787);
initializeDatabase();
app.listen(port, () => console.log(`RuralCare API ready at http://localhost:${port}`));
