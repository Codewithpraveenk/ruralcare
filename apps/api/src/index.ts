import "dotenv/config";
import cors from "cors";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { assessNeed, rankFacilities, type Facility, type Service } from "@ruralcare/shared";
import { demoFacilities } from "./data.ts";

const prisma = new PrismaClient();
const app = express();
app.use(cors()); app.use(express.json({ limit: "100kb" }));

async function seed() {
  for (const facility of demoFacilities) await prisma.facility.upsert({ where: { id: facility.id }, update: { ...facility, services: JSON.stringify(facility.services) }, create: { ...facility, services: JSON.stringify(facility.services) } });
}
function asFacility(record: Awaited<ReturnType<typeof prisma.facility.findMany>>[number]): Facility {
  return { ...record, type: record.type as Facility["type"], services: JSON.parse(record.services) as Service[] };
}

app.get("/api/health", (_req, res) => res.json({ ok: true, mode: "synthetic-prototype" }));
app.post("/api/triage", (req, res) => {
  const parsed = z.object({ message: z.string().trim().min(2).max(600) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter a short description of the health need." });
  return res.json({ assessment: assessNeed(parsed.data.message), source: "deterministic-safety-fallback" });
});
app.get("/api/facilities", async (req, res) => {
  const service = z.enum(["PRIMARY_CARE", "MATERNITY", "CHILD_HEALTH", "EMERGENCY", "TELECONSULT"]).catch("PRIMARY_CARE").parse(req.query.service);
  const facilities = (await prisma.facility.findMany()).map(asFacility);
  res.json({ facilities: rankFacilities(facilities, service), dataLabel: "Synthetic prototype availability - verify before travel" });
});
app.post("/api/referrals", async (req, res) => {
  const parsed = z.object({ patientLabel: z.string().trim().min(1).max(40), sourceFacility: z.string(), destinationFacility: z.string(), service: z.string(), urgency: z.string(), nextAction: z.string().max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Referral details are incomplete." });
  const referral = await prisma.referral.create({ data: parsed.data }); res.status(201).json({ referral });
});
app.get("/api/referrals", async (_req, res) => res.json({ referrals: await prisma.referral.findMany({ orderBy: { createdAt: "desc" }, take: 20 }) }));
app.patch("/api/referrals/:id", async (req, res) => {
  const status = z.enum(["PENDING", "CONTACTED", "COMPLETED"]).safeParse(req.body.status);
  if (!status.success) return res.status(400).json({ error: "Invalid status" });
  const referral = await prisma.referral.update({ where: { id: req.params.id }, data: { status: status.data } }); res.json({ referral });
});
app.get("/api/dashboard", async (_req, res) => {
  const referrals = await prisma.referral.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ referrals, totals: { total: referrals.length, urgent: referrals.filter((item) => item.urgency !== "ROUTINE").length, pending: referrals.filter((item) => item.status === "PENDING").length }, demand: [{ service: "Primary care", count: 12 }, { service: "Child health", count: 7 }, { service: "Maternity", count: 4 }] });
});

const port = Number(process.env.PORT || 8787);
seed().then(() => app.listen(port, () => console.log(`RuralCare API ready at http://localhost:${port}`))).catch((error) => { console.error(error); process.exit(1); });
