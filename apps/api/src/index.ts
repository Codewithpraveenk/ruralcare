import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { assessNeed, rankFacilities, routeFacilities, serviceCapacity, travelMinutes, type Facility, type Service } from "@ruralcare/shared";
import { db, initializeDatabase } from "./db.ts";
import { facilityProvenance } from "./facility-directory.ts";
import { demoFacilities } from "./data.ts";

const app = express();
app.use(cors()); app.use(express.json({ limit: "100kb" }));
function asFacility(record: Record<string, unknown>): Facility {
  const source = demoFacilities.find((item) => item.id === record.id);
  return { ...record, type: record.type as Facility["type"], distanceKm: Number(record.distanceKm), available: Boolean(record.available), latitude: Number(record.latitude), longitude: Number(record.longitude), services: JSON.parse(String(record.services)) as Service[], capacity: JSON.parse(String(record.capacityData || "{}")), lastUpdated: String(record.lastUpdated || "Synthetic demo shift"), capabilitySource: source?.capabilitySource, serviceSources: source?.serviceSources } as Facility;
}
const stages = ["CREATED", "ACCEPTED", "ARRIVED", "FOLLOW_UP"] as const;
const stageLabel = (stage: string) => stage === "FOLLOW_UP" ? "Follow-up" : stage.slice(0, 1) + stage.slice(1).toLowerCase();
function serviceLabel(service: string) { return ({ PRIMARY_CARE: "General medicine", MATERNITY: "Maternal care", CHILD_HEALTH: "Paediatrics", EMERGENCY: "Emergency care", TELECONSULT: "Teleconsultation" } as Record<string, string>)[service] || service; }
function coordination() {
  const referrals = db.prepare("SELECT * FROM Referral ORDER BY updatedAt DESC, createdAt DESC").all() as Array<Record<string, unknown>>;
  const cases = referrals.map((item) => ({ id: item.id, demoId: item.demoId || `RCC-${String(item.id).slice(-4).toUpperCase()}`, patientLabel: item.patientLabel, careNeed: item.careNeed || serviceLabel(String(item.service)), service: item.service, urgency: item.urgency, facility: item.destinationFacility, sourceMode: item.sourceMode || "ASHA_ASSISTED", rerouted: Boolean(item.rerouted), stage: stageLabel(String(item.status || "CREATED")), status: item.status || "CREATED", followUpDue: item.followUpDue, updatedAt: item.updatedAt || item.createdAt }));
  const demandNames = ["General medicine", "Maternal care", "Paediatrics", "Diagnostics", "Teleconsultation"];
  const demand = demandNames.map((label) => ({ service: label, count: cases.filter((item) => serviceLabel(String(item.service)) === label).length + (label === "Diagnostics" ? 2 : 0) }));
  const affected = cases.filter((item) => item.service === "PRIMARY_CARE" && item.facility === "Gopalapuram Dispensary");
  const alternatives = rankFacilities((db.prepare("SELECT * FROM Facility").all() as Array<Record<string, unknown>>).map(asFacility).filter((item) => item.name !== "Gopalapuram Dispensary"), "PRIMARY_CARE").slice(0, 2).map((item) => ({ name: item.name, distanceKm: item.distanceKm, hours: item.hours }));
  return { cases, totals: { incoming: cases.length + 8, urgent: cases.filter((item) => item.urgency !== "ROUTINE").length, pending: cases.filter((item) => ["CREATED", "ACCEPTED"].includes(String(item.status))).length, followups: cases.filter((item) => item.status === "FOLLOW_UP" || Boolean(item.followUpDue)).length }, demand, capacityAlerts: [{ title: "Primary care unavailable at Gopalapuram Dispensary", service: "PRIMARY_CARE", affected: affected.map((item) => ({ demoId: item.demoId, careNeed: item.careNeed })), alternatives }], activity: cases.slice(0, 5).map((item) => ({ demoId: item.demoId, stage: item.stage, careNeed: item.careNeed, facility: item.facility, updatedAt: item.updatedAt })) };
}

app.get("/api/health", (_req, res) => res.json({ ok: true, mode: "synthetic-prototype" }));
app.get("/api/facility-data", (_req, res) => res.json(facilityProvenance()));
app.post("/api/triage", (req, res) => {
  const parsed = z.object({ message: z.string().trim().min(2).max(600) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter a short description of the health need." });
  return res.json({ assessment: assessNeed(parsed.data.message), source: "deterministic-safety-fallback" });
});
app.post("/api/routing", (req, res) => {
  const parsed = z.object({ message: z.string().trim().min(2).max(600), requestId: z.string().trim().max(80).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A short care need is required for routing." });
  const assessment = assessNeed(parsed.data.message);
  if (assessment.urgency === "INSUFFICIENT_INFORMATION") return res.status(422).json({ assessment, error: "More safety information is needed before facility routing." });
  const facilities = db.prepare("SELECT * FROM Facility").all().map((record) => asFacility(record as Record<string, unknown>));
  return res.json({ assessment, decision: routeFacilities(facilities, assessment, parsed.data.requestId || crypto.randomUUID()) });
});
app.get("/api/facilities", async (req, res) => {
  const service = z.enum(["PRIMARY_CARE", "MATERNITY", "CHILD_HEALTH", "EMERGENCY", "TELECONSULT"]).catch("PRIMARY_CARE").parse(req.query.service);
  const facilities = db.prepare("SELECT * FROM Facility").all().map((record) => asFacility(record as Record<string, unknown>));
  const candidates = facilities.filter((facility) => facility.services.includes(service));
  const ranked = rankFacilities(facilities, service);
  res.json({ facilities: ranked, candidates: candidates.map((facility) => { const capacity = serviceCapacity(facility, service); const capability = facility.serviceSources?.[service] || "INFERRED_FROM_FACILITY_TYPE"; return { ...facility, travelMinutes: travelMinutes(facility), serviceCapacity: capacity, capabilitySource: capability, ranking: ranked.findIndex((item) => item.id === facility.id) + 1, rerouteReason: capacity.status === "UNAVAILABLE" ? `${serviceLabel(service)} is unavailable in this synthetic shift.` : null, reasons: [`${capability}: ${serviceLabel(service)}`, `${facility.type.replaceAll("_", " ")} level of care`, `${travelMinutes(facility)} min demo travel estimate`, `${capacity.status.toLowerCase()} capacity · ${capacity.estimatedWaitMinutes} min wait · ${capacity.availableBeds} beds` ] }; }), recommendedId: ranked[0]?.id ?? null, dataLabel: "Official directory identity; separately sourced coordinates; synthetic capacity/travel - verify before travel" });
});
app.post("/api/referrals", async (req, res) => {
  const parsed = z.object({ patientLabel: z.string().trim().min(1).max(40), sourceFacility: z.string(), destinationFacility: z.string(), service: z.string(), urgency: z.string(), nextAction: z.string().max(200), careNeed: z.string().max(120).optional(), requestId: z.string().max(80).optional(), sourceMode: z.enum(["CITIZEN", "ASHA_ASSISTED"]).optional(), selectedFacilityType: z.string().max(40).optional(), routingExplanation: z.string().max(400).optional(), rerouted: z.boolean().optional(), previousFacility: z.string().max(160).optional(), routingAudit: z.record(z.unknown()).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Referral details are incomplete." });
  const createdAt = new Date().toISOString(); const referral = { id: crypto.randomUUID(), ...parsed.data, demoId: `RCC-${Math.floor(1000 + Math.random() * 9000)}`, status: "CREATED", createdAt, updatedAt: createdAt, followUpDue: new Date(Date.now() + 86400000).toISOString(), careNeed: parsed.data.careNeed || serviceLabel(parsed.data.service) };
  db.prepare("INSERT INTO Referral (id,patientLabel,sourceFacility,destinationFacility,service,urgency,status,nextAction,createdAt,demoId,careNeed,followUpDue,updatedAt,requestId,sourceMode,selectedFacilityType,routingExplanation,rerouted,previousFacility,routingAudit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(referral.id, referral.patientLabel, referral.sourceFacility, referral.destinationFacility, referral.service, referral.urgency, referral.status, referral.nextAction, referral.createdAt, referral.demoId, referral.careNeed, referral.followUpDue, referral.updatedAt, parsed.data.requestId || null, parsed.data.sourceMode || "CITIZEN", parsed.data.selectedFacilityType || null, parsed.data.routingExplanation || null, Number(parsed.data.rerouted || false), parsed.data.previousFacility || null, JSON.stringify(parsed.data.routingAudit || {}));
  res.status(201).json({ referral });
});
app.get("/api/referrals", async (_req, res) => res.json({ referrals: db.prepare("SELECT * FROM Referral ORDER BY createdAt DESC LIMIT 20").all() }));
app.patch("/api/referrals/:id", async (req, res) => {
  const status = z.enum(["CREATED", "ACCEPTED", "ARRIVED", "FOLLOW_UP"]).safeParse(req.body.status);
  if (!status.success) return res.status(400).json({ error: "Invalid status" });
  db.prepare("UPDATE Referral SET status = ?, updatedAt = ? WHERE id = ?").run(status.data, new Date().toISOString(), req.params.id);
  const referral = db.prepare("SELECT * FROM Referral WHERE id = ?").get(req.params.id); if (!referral) return res.status(404).json({ error: "Referral not found" }); res.json({ referral });
});
app.get("/api/coordination", (_req, res) => res.json(coordination()));
app.get("/api/dashboard", async (_req, res) => {
  res.json(coordination());
});

const port = Number(process.env.PORT || 8787);
initializeDatabase();
app.listen(port, () => console.log(`RuralCare API ready at http://localhost:${port}`));
