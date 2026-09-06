import "./env.ts";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import {
  assessNeed,
  calculateDistanceKm,
  nextSafetyQuestion,
  routeFacilities,
  serviceCapacity,
  structuredToMessage,
  travelMinutes,
  type Assessment,
  type Service,
} from "@ruralcare/shared";
import {
  requireAuth,
  requireRole,
  type AuthRequest,
  type SessionUser,
} from "./auth.ts";
import { createAuthRouter } from "./auth-routes.ts";
import { db, initializeDatabase } from "./db.ts";
import {
  facilityProvenance,
  facilityReviewQueue,
} from "./facility-directory.ts";
import { auditFacilityData } from "./facility-data-audit.ts";
import { facilityProvider } from "./facility-provider.ts";
import { clinicalExtractionProvider } from "./clinical-extraction.ts";
import {
  answerNavigationQuestion,
  navigationAssistantInput,
} from "./navigation-assistant.ts";

export const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());
const services = z.enum([
    "PRIMARY_CARE",
    "MATERNITY",
    "CHILD_HEALTH",
    "EMERGENCY",
    "TELECONSULT",
  ]),
  statuses = z.enum([
    "CREATED",
    "ACCEPTED",
    "ARRIVED",
    "FOLLOW_UP_DUE",
    "COMPLETED",
  ]);
const now = () => new Date().toISOString(),
  stageLabel = (stage: string) =>
    stage === "FOLLOW_UP_DUE"
      ? "Follow-up due"
      : stage.slice(0, 1) + stage.slice(1).toLowerCase(),
  serviceLabel = (service: string) =>
    (
      ({
        PRIMARY_CARE: "Primary Care",
        MATERNITY: "Maternal Care",
        CHILD_HEALTH: "Child Health",
        EMERGENCY: "Emergency Care",
        TELECONSULT: "Teleconsultation",
      }) as Record<string, string>
    )[service] || service;
const referralRow = (id: string) =>
  db
    .prepare("SELECT * FROM Referral WHERE id=? OR demoId=? OR clientId=?")
    .get(id, id, id) as Record<string, unknown> | undefined;
function canAccess(user: SessionUser, referral: Record<string, unknown>) {
  if (user.role === "CITIZEN") return referral.ownerUserId === user.id;
  if (user.role === "ASHA")
    return (
      referral.createdByUserId === user.id ||
      referral.assistedByUserId === user.id
    );
  return (
    Boolean(user.facilityId) && referral.selectedFacilityId === user.facilityId
  );
}
function addGap(input: {
  dedupeKey: string;
  requestId?: string;
  referralId?: string;
  requiredService: string;
  facilityId?: string;
  eventType: string;
}) {
  db.prepare(
    "INSERT OR IGNORE INTO ServiceGapEvent (id,dedupeKey,requestId,referralId,requiredService,district,facilityId,eventType,timestamp) VALUES (?,?,?,?,?,?,?,?,?)",
  ).run(
    crypto.randomUUID(),
    input.dedupeKey,
    input.requestId || null,
    input.referralId || null,
    input.requiredService,
    "Chengalpattu",
    input.facilityId || null,
    input.eventType,
    now(),
  );
}
function addStatus(
  referralId: string,
  fromStatus: string | null,
  toStatus: string,
  actor: SessionUser | { id?: string; role: "SYSTEM" },
  action: string,
) {
  db.prepare(
    "INSERT INTO ReferralStatusEvent (id,referralId,fromStatus,toStatus,timestamp,actorType,actorUserId,action) VALUES (?,?,?,?,?,?,?,?)",
  ).run(
    crypto.randomUUID(),
    referralId,
    fromStatus,
    toStatus,
    now(),
    actor.role,
    actor.id || null,
    action,
  );
}
function assessmentFor(service: Service, urgency: string): Assessment {
  return {
    urgency: urgency as Assessment["urgency"],
    service,
    symptoms: ["Non-diagnostic referral summary"],
    duration: "Recorded in referral",
    explanation: "Recalculation from the confirmed referral service.",
    nextAction: "Use the updated public-care pathway.",
    language: "en",
    redFlags: [],
    extraction: {
      ageGroup: service === "CHILD_HEALTH" ? "CHILD" : "ADULT",
      symptoms: [],
      duration: "Recorded",
      childFever: false,
      canDrink: null,
      repeatedVomiting: null,
      convulsions: null,
      consciousnessChange: null,
      breathingDifficulty: null,
      stiffNeck: null,
      severeBleeding: null,
      pregnancy: service === "MATERNITY",
    },
    triggeredRules: [],
    missingInformation: [],
  };
}
function referralDetail(id: string, user: SessionUser) {
  const referral = referralRow(id);
  if (!referral || !canAccess(user, referral)) return null;
  return {
    referral,
    history: db
      .prepare(
        "SELECT id,referralId,fromStatus,toStatus,timestamp,actorType,action FROM ReferralStatusEvent WHERE referralId=? ORDER BY timestamp",
      )
      .all(String(referral.id)),
    followUps: db
      .prepare(
        "SELECT id,referralId,outcome,note,timestamp,sourceMode FROM FollowUpOutcome WHERE referralId=? ORDER BY timestamp DESC",
      )
      .all(String(referral.id)),
    clinicalOutcomes: db
      .prepare(
        "SELECT id,referralId,disposition,instructionEnglish,instructionTamil,followUpDate,timestamp,actorName,actorRole FROM ClinicalOutcome WHERE referralId=? ORDER BY timestamp DESC",
      )
      .all(String(referral.id)),
  };
}
function scopedReferrals(user: SessionUser) {
  if (user.role === "CITIZEN")
    return db
      .prepare(
        "SELECT * FROM Referral WHERE ownerUserId=? ORDER BY updatedAt DESC,createdAt DESC",
      )
      .all(user.id) as Array<Record<string, unknown>>;
  if (user.role === "ASHA")
    return db
      .prepare(
        "SELECT * FROM Referral WHERE createdByUserId=? OR assistedByUserId=? ORDER BY updatedAt DESC,createdAt DESC",
      )
      .all(user.id, user.id) as Array<Record<string, unknown>>;
  return db
    .prepare(
      "SELECT * FROM Referral WHERE selectedFacilityId=? ORDER BY updatedAt DESC,createdAt DESC",
    )
    .all(user.facilityId || "") as Array<Record<string, unknown>>;
}
function continuityRisk(referral: Record<string, unknown>) {
  let score = 0;
  const reasons: string[] = [];
  const ageHours = Math.max(0, (Date.now() - new Date(String(referral.updatedAt || referral.createdAt)).getTime()) / 3600000);
  if (referral.urgency === "EMERGENCY") { score += 30; reasons.push("Emergency pathway needs rapid hand-off confirmation"); }
  else if (referral.urgency === "URGENT") { score += 15; reasons.push("Same-day assessment was recommended"); }
  if (Boolean(referral.rerouted)) { score += 20; reasons.push("Rerouting increases the chance of a missed hand-off"); }
  if (referral.status === "CREATED" && ageHours >= 6) { score += 25; reasons.push("Referral has not been acknowledged for over 6 hours"); }
  if (referral.status === "ACCEPTED" && ageHours >= 12) { score += 20; reasons.push("Accepted referral has no recorded arrival after 12 hours"); }
  if (referral.status === "FOLLOW_UP_DUE" && referral.followUpDue && new Date(String(referral.followUpDue)).getTime() < Date.now()) { score += 30; reasons.push("Follow-up date is overdue"); }
  if (referral.status === "COMPLETED") return { score: 0, level: "LOW", reasons: ["Continuity is recorded as completed"], model: "EXPLAINABLE_RULES_V1" };
  const bounded = Math.min(100, score);
  return { score: bounded, level: bounded >= 50 ? "HIGH" : bounded >= 25 ? "MEDIUM" : "LOW", reasons: reasons.length ? reasons : ["No current continuity-risk trigger"], model: "EXPLAINABLE_RULES_V1" };
}
function coordination(user: SessionUser) {
  const referrals = scopedReferrals(user),
    facilityId = user.facilityId || "",
    gaps = db
      .prepare(
        "SELECT requiredService,facilityId,eventType,timestamp FROM ServiceGapEvent WHERE facilityId=? ORDER BY timestamp DESC",
      )
      .all(facilityId) as Array<Record<string, unknown>>;
  const cases = referrals.map((item) => ({
    id: item.id,
    demoId: item.demoId || `RCC-${String(item.id).slice(-4).toUpperCase()}`,
    careNeed: item.careNeed || serviceLabel(String(item.service)),
    service: item.service,
    urgency: item.urgency,
    facility: item.destinationFacility,
    facilityId: item.selectedFacilityId,
    sourceMode: item.sourceMode,
    rerouted: Boolean(item.rerouted),
    rerouteStatus: item.rerouteStatus,
    recommendedFacility: item.recommendedFacility,
    stage: stageLabel(String(item.status || "CREATED")),
    status: item.status || "CREATED",
    followUpDue: item.followUpDue,
    updatedAt: item.updatedAt || item.createdAt,
    continuityRisk: continuityRisk(item),
  }));
  const taxonomy: Service[] = [
      "PRIMARY_CARE",
      "CHILD_HEALTH",
      "MATERNITY",
      "EMERGENCY",
    ],
    serviceAccess = taxonomy.map((service) => ({
      service: serviceLabel(service),
      requests: cases.filter((item) => item.service === service).length,
      reroutes: cases.filter(
        (item) => item.service === service && item.rerouted,
      ).length,
      accessGaps: gaps.filter((item) => item.requiredService === service)
        .length,
    }));
  const gapGroups = Object.values(
    gaps.reduce<
      Record<
        string,
        { service: string; facility: string; reason: string; count: number }
      >
    >((acc, item) => {
      const key = `${String(item.requiredService)}|${String(item.facilityId || "—")}|${String(item.eventType)}`;
      const current = acc[key] ?? {
        service: serviceLabel(String(item.requiredService)),
        facility: String(item.facilityId || "—"),
        reason: String(item.eventType).replaceAll("_", " "),
        count: 0,
      };
      current.count += 1;
      acc[key] = current;
      return acc;
    }, {}),
  );
  const assignedFacility = facilityProvider
      .list()
      .find((item) => item.id === facilityId),
    capacityAlerts = assignedFacility
      ? taxonomy.flatMap((service) => {
          const capacity = serviceCapacity(assignedFacility, service),
            affected = cases.filter(
              (item) => item.service === service && item.status !== "COMPLETED",
            );
          if (capacity.status === "AVAILABLE" || affected.length === 0)
            return [];
          const decision = routeFacilities(
              facilityProvider.list(),
              assessmentFor(service, "ROUTINE"),
              `dashboard-${facilityId}-${service}`,
            ),
            alternatives = decision.candidates
              .filter(
                (item) =>
                  item.id !== facilityId && item.availability !== "UNAVAILABLE",
              )
              .slice(0, 2)
              .map((item) => ({
                name: item.name,
                distanceKm: item.distanceKm,
                hours: `${item.availability} · ${item.serviceCapacity.estimatedWaitMinutes} min demo wait`,
              }));
          return [
            {
              title: `${serviceLabel(service)} ${capacity.status.toLowerCase()} at ${assignedFacility.name}`,
              service,
              affected: affected.map((item) => ({
                demoId: String(item.demoId),
                careNeed: String(item.careNeed),
              })),
              alternatives,
            },
          ];
        })
      : [];
  return {
    workspace: user.role === "DOCTOR" ? "DOCTOR" : "STAFF",
    facility: {
      id: facilityId,
      name: assignedFacility?.name || "Assigned facility",
    },
    cases,
    totals: {
      incoming: cases.length,
      urgent: cases.filter((item) => item.urgency !== "ROUTINE").length,
      pending: cases.filter((item) =>
        ["CREATED", "ACCEPTED"].includes(String(item.status)),
      ).length,
      followups: cases.filter((item) => item.status === "FOLLOW_UP_DUE").length,
      rerouted: cases.filter((item) => item.rerouted).length,
      serviceGaps: gaps.length,
      unacknowledged: cases.filter((item) => item.status === "CREATED").length,
      arrived: cases.filter((item) => item.status === "ARRIVED").length,
      completed: cases.filter((item) => item.status === "COMPLETED").length,
    },
    demand: serviceAccess.map((item) => ({
      service: item.service,
      count: item.requests,
    })),
    serviceAccess,
    recentGaps: gapGroups.slice(0, 8),
    capacityAlerts,
    capacity: db
      .prepare(
        "SELECT * FROM FacilityServiceStatus WHERE facilityId=? ORDER BY updatedAt DESC",
      )
      .all(facilityId),
    activity: cases
      .slice(0, 6)
      .map((item) => ({
        demoId: item.demoId,
        stage: item.stage,
        careNeed: item.careNeed,
        facility: item.facility,
        updatedAt: item.updatedAt,
      })),
  };
}

app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    mode: "verified-directory-with-simulated-operations",
    facilityData: auditFacilityData().counts,
  }),
);
app.use("/api/auth", createAuthRouter());
app.use("/api", requireAuth);

app.get("/api/facility-data", (_req, res) =>
  res.json({
    ...facilityProvenance(),
    adapter: "ImportedGovernmentFacilityProvider",
  }),
);
app.get(
  "/api/facility-data/audit",
  requireRole("FACILITY_ADMIN", "STAFF", "DOCTOR"),
  (_req, res) => {
    const report = auditFacilityData();
    res.status(report.valid ? 200 : 503).json(report);
  },
);
app.get(
  "/api/facility-data/review",
  requireRole("FACILITY_ADMIN"),
  (_req, res) => {
    const records = facilityReviewQueue();
    res.json({
      summary: {
        total: records.length,
        routeable: records.filter((item) => item.routeable).length,
        pending: records.filter((item) => !item.routeable).length,
      },
      records,
      policy:
        "Review only. A record cannot enter routing without verified coordinates and capability provenance.",
    });
  },
);
app.post("/api/transcribe", async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      audioBase64: z.string().min(100).max(7_000_000),
      mimeType: z.string().max(80),
      language: z.enum(["ta", "en"]).default("ta"),
    })
    .safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "A short audio recording is required." });
  if (!process.env.OPENAI_API_KEY)
    return res
      .status(503)
      .json({
        error:
          "Tamil audio transcription is not configured. Add OPENAI_API_KEY to the root .env file and restart the app.",
      });
  try {
    const audio = Buffer.from(parsed.data.audioBase64, "base64");
    if (audio.byteLength > 5_000_000)
      return res
        .status(413)
        .json({
          error: "Recording is too large. Please keep it under 15 seconds.",
        });
    const extension = parsed.data.mimeType.includes("ogg")
        ? "ogg"
        : parsed.data.mimeType.includes("mp4")
          ? "m4a"
          : "webm",
      form = new FormData();
    form.append(
      "file",
      new Blob([audio], { type: parsed.data.mimeType }),
      `ruralcare-${Date.now()}.${extension}`,
    );
    form.append("model", "whisper-1");
    form.append("language", parsed.data.language);
    form.append("response_format", "json");
    const response = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: form,
        },
      ),
      result = (await response.json()) as {
        text?: string;
        error?: { message?: string };
      };
    if (!response.ok || !result.text?.trim())
      return res
        .status(502)
        .json({
          error:
            result.error?.message || "Tamil transcription did not return text.",
        });
    res.json({
      text: result.text.trim(),
      language: parsed.data.language,
      source: "CLOUD_AUDIO_TRANSCRIPTION",
      audioStored: false,
    });
  } catch {
    return res
      .status(502)
      .json({ error: "Tamil transcription service could not be reached." });
  }
});
app.post("/api/triage", (req, res) => {
  const parsed = z
    .object({ message: z.string().trim().min(2).max(1200) })
    .safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "Please enter a short description of the health need." });
  res.json({
    assessment: assessNeed(parsed.data.message),
    source: "validated-local-extraction-and-deterministic-rules",
  });
});
app.post("/api/intake/extract", async (req, res) => {
  const parsed = z
    .object({
      rawText: z.string().trim().min(2).max(1200),
      preferredResponseLanguage: z.enum(["en", "ta"]),
    })
    .strict()
    .safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "Please enter a short description of the health need." });
  const result = await clinicalExtractionProvider.extract(
      parsed.data.rawText,
      parsed.data.preferredResponseLanguage,
    ),
    assessment = assessNeed(structuredToMessage(result.structured)),
    nextQuestion = nextSafetyQuestion(
      result.structured,
      [],
      Number(process.env.MAX_ADAPTIVE_QUESTIONS || 5),
      assessment.urgency === "EMERGENCY",
    );
  res.json({
    ...result,
    assessment,
    nextQuestion,
    decisionSource: "DETERMINISTIC_TRIAGE_RULES",
  });
});
app.post(
  "/api/navigation-assistant",
  requireRole("CITIZEN", "ASHA"),
  async (req: AuthRequest, res) => {
    const parsed = navigationAssistantInput.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Ask a short public-care navigation question." });
    res.json(await answerNavigationQuestion(parsed.data));
  },
);
app.post("/api/routing", (req, res) => {
  const parsed = z
    .object({
      message: z.string().trim().min(2).max(1200),
      requestId: z.string().trim().max(80).optional(),
      origin: z.object({latitude:z.number().min(8).max(14),longitude:z.number().min(76).max(81),label:z.string().trim().min(2).max(80)}).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "A short care need is required for routing." });
  const assessment = assessNeed(parsed.data.message);
  if (assessment.urgency === "INSUFFICIENT_INFORMATION")
    return res
      .status(422)
      .json({
        assessment,
        error: "More safety information is needed before facility routing.",
      });
  const requestId = parsed.data.requestId || crypto.randomUUID(),
    origin=parsed.data.origin,
    facilities=facilityProvider.list().map(item=>origin?{...item,distanceKm:calculateDistanceKm(origin,item)}:item),
    decision = routeFacilities(facilities, assessment, requestId);
  if (!decision.selectedFacilityId)
    addGap({
      dedupeKey: `route:${requestId}:${decision.candidates.length ? "all-unavailable" : "no-match"}`,
      requestId,
      requiredService: decision.plan.requiredService,
      eventType: decision.candidates.length
        ? "ALL_MATCHES_UNAVAILABLE"
        : "NO_SUITABLE_FACILITY",
    });
  res.json({ assessment, decision });
});
app.get("/api/facilities", (req, res) => {
  const service = services.catch("PRIMARY_CARE").parse(req.query.service),
    facilities = facilityProvider
      .list()
      .filter((f) => f.services.includes(service));
  res.json({
    candidates: facilities.map((f) => ({
      ...f,
      travelMinutes: travelMinutes(f),
      serviceCapacity: serviceCapacity(f, service),
      availabilitySource: "SIMULATED_FOR_PROTOTYPE",
    })),
    dataLabel:
      "Official identity/location where sourced; prototype availability is not live government data",
  });
});

app.get(
  "/api/capacity",
  requireRole("FACILITY_ADMIN", "STAFF"),
  (req: AuthRequest, res) =>
    res.json({
      facilities: facilityProvider
        .list()
        .filter((item) => item.id === req.user?.facilityId),
      source: "MIXED_OPERATIONAL_PROVENANCE",
    }),
);
app.put(
  "/api/capacity/:facilityId/:service",
  requireRole("STAFF"),
  (req: AuthRequest, res) => {
    if (req.user?.facilityId !== req.params.facilityId)
      return res
        .status(403)
        .json({
          error: "Staff can only change capacity for their assigned facility.",
        });
    const parsed = z
        .object({
          availability: z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE"]),
          verificationNote:z.string().trim().min(3).max(120).optional(),
          validForHours:z.number().int().min(1).max(12).default(4),
        })
        .safeParse(req.body),
      service = services.safeParse(req.params.service);
    if (!parsed.success || !service.success)
      return res
        .status(400)
        .json({ error: "Invalid prototype capacity update." });
    const facility = facilityProvider
      .list()
      .find((item) => item.id === req.params.facilityId);
    if (!facility)
      return res.status(404).json({ error: "Facility not found." });
    const timestamp = now(),expiresAt=new Date(Date.now()+parsed.data.validForHours*3600000).toISOString();
    db.prepare(
      "INSERT INTO FacilityServiceStatus (id,facilityId,service,availability,updatedAt,updatedBy,source,expiresAt,verificationNote) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(facilityId,service) DO UPDATE SET availability=excluded.availability,updatedAt=excluded.updatedAt,updatedBy=excluded.updatedBy,source=excluded.source,expiresAt=excluded.expiresAt,verificationNote=excluded.verificationNote",
    ).run(
      crypto.randomUUID(),
      facility.id,
      service.data,
      parsed.data.availability,
      timestamp,
      req.user.id,
      "FACILITY_STAFF_REPORTED",
      expiresAt,
      parsed.data.verificationNote||"Confirmed in facility coordination workspace",
    );
    const recommendations = [];
    if (parsed.data.availability === "UNAVAILABLE") {
      const affected = db
        .prepare(
          "SELECT * FROM Referral WHERE selectedFacilityId=? AND service=? AND status!='COMPLETED'",
        )
        .all(facility.id, service.data) as Array<Record<string, unknown>>;
      for (const referral of affected) {
        const decision = routeFacilities(
            facilityProvider.list(),
            assessmentFor(service.data, String(referral.urgency)),
            String(referral.requestId || referral.id),
          ),
          next = decision.candidates.find(
            (item) =>
              item.id === decision.selectedFacilityId &&
              item.id !== facility.id,
          );
        if (next) {
          db.prepare(
            "UPDATE Referral SET rerouted=1,previousFacility=COALESCE(previousFacility,destinationFacility),previousFacilityId=COALESCE(previousFacilityId,selectedFacilityId),rerouteStatus='REROUTE_RECOMMENDED',recommendedFacility=?,recommendedFacilityId=?,rerouteTimestamp=?,routingExplanation=?,updatedAt=? WHERE id=?",
          ).run(
            next.name,
            next.id,
            timestamp,
            decision.explanation,
            timestamp,
            String(referral.id),
          );
          addStatus(
            String(referral.id),
            String(referral.status),
            String(referral.status),
            { role: "SYSTEM" },
            "REROUTE_RECOMMENDED",
          );
          recommendations.push({
            referralId: String(referral.id),
            newFacility: next.name,
          });
        }
      }
    }
    res.json({
      facilityId: facility.id,
      service: service.data,
      availability: parsed.data.availability,
      source: "FACILITY_STAFF_REPORTED",
      updatedAt:timestamp,
      expiresAt,
      recommendations,
    });
  },
);

app.post(
  "/api/referrals",
  requireRole("CITIZEN", "ASHA"),
  (req: AuthRequest, res) => {
    const parsed = z
      .object({
        clientId: z.string().uuid().optional(),
        patientLabel: z.string().trim().min(1).max(40),
        sourceFacility: z.string().max(120),
        destinationFacility: z.string().max(160),
        selectedFacilityId: z.string().min(2).max(100),
        service: services,
        urgency: z.enum([
          "EMERGENCY",
          "URGENT",
          "ROUTINE",
          "INSUFFICIENT_INFORMATION",
        ]),
        nextAction: z.string().max(240),
        careNeed: z.string().max(160).optional(),
        requestId: z.string().max(80).optional(),
        sourceMode: z.enum(["CITIZEN", "ASHA_ASSISTED"]),
        selectedFacilityType: z.string().max(40).optional(),
        routingExplanation: z.string().max(500).optional(),
        rerouted: z.boolean().optional(),
        previousFacility: z.string().max(160).optional(),
        routingAudit: z.record(z.unknown()).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Referral details are incomplete." });
    if (
      (req.user?.role === "CITIZEN" && parsed.data.sourceMode !== "CITIZEN") ||
      (req.user?.role === "ASHA" && parsed.data.sourceMode !== "ASHA_ASSISTED")
    )
      return res
        .status(403)
        .json({ error: "Referral source mode must match the signed-in role." });
    if (
      !facilityProvider
        .list()
        .some(
          (item) =>
            item.id === parsed.data.selectedFacilityId &&
            item.name === parsed.data.destinationFacility,
        )
    )
      return res
        .status(400)
        .json({ error: "Selected public facility is invalid." });
    if (parsed.data.clientId) {
      const existing = referralRow(parsed.data.clientId);
      if (existing) {
        if (!canAccess(req.user!, existing))
          return res
            .status(403)
            .json({ error: "You do not have access to this referral." });
        return res.json({ referral: existing, idempotent: true });
      }
    }
    const createdAt = now(),
      id = crypto.randomUUID(),
      demoId = `RCC-${Math.floor(1000 + Math.random() * 9000)}`,
      owner = req.user?.role === "CITIZEN" ? req.user.id : null,
      assisted = req.user?.role === "ASHA" ? req.user.id : null;
    db.prepare(
      "INSERT INTO Referral (id,clientId,patientLabel,sourceFacility,destinationFacility,selectedFacilityId,service,urgency,status,nextAction,createdAt,demoId,careNeed,followUpDue,updatedAt,requestId,sourceMode,selectedFacilityType,routingExplanation,rerouted,previousFacility,routingAudit,ownerUserId,createdByUserId,assistedByUserId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      parsed.data.clientId || null,
      parsed.data.patientLabel,
      parsed.data.sourceFacility,
      parsed.data.destinationFacility,
      parsed.data.selectedFacilityId,
      parsed.data.service,
      parsed.data.urgency,
      "CREATED",
      parsed.data.nextAction,
      createdAt,
      demoId,
      parsed.data.careNeed || serviceLabel(parsed.data.service),
      new Date(Date.now() + 86400000).toISOString(),
      createdAt,
      parsed.data.requestId || null,
      parsed.data.sourceMode,
      parsed.data.selectedFacilityType || null,
      parsed.data.routingExplanation || null,
      Number(parsed.data.rerouted || false),
      parsed.data.previousFacility || null,
      JSON.stringify(parsed.data.routingAudit || {}),
      owner,
      req.user!.id,
      assisted,
    );
    addStatus(id, null, "CREATED", req.user!, "REFERRAL_CREATED");
    res.status(201).json({ referral: referralRow(id) });
  },
);
app.get("/api/referrals", (req: AuthRequest, res) =>
  res.json({ referrals: scopedReferrals(req.user!) }),
);
app.get("/api/referrals/:id", (req: AuthRequest, res) => {
  const detail = referralDetail(String(req.params.id), req.user!);
  if (!detail)
    return res
      .status(403)
      .json({ error: "You do not have access to this referral." });
  res.json(detail);
});
const transitions: Record<string, string[]> = {
  CREATED: ["ACCEPTED"],
  ACCEPTED: ["ARRIVED"],
  ARRIVED: ["FOLLOW_UP_DUE", "COMPLETED"],
  FOLLOW_UP_DUE: ["COMPLETED"],
  COMPLETED: [],
};
app.patch(
  "/api/referrals/:id",
  requireRole("DOCTOR", "FACILITY_ADMIN", "STAFF"),
  (req: AuthRequest, res) => {
    const parsed = z.object({ status: statuses }).safeParse(req.body),
      current = referralRow(String(req.params.id));
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid status." });
    if (!current || !canAccess(req.user!, current))
      return res
        .status(403)
        .json({
          error: "You can only update referrals assigned to your facility.",
        });
    if (!transitions[String(current.status)]?.includes(parsed.data.status))
      return res
        .status(409)
        .json({
          error: `Invalid referral transition from ${current.status} to ${parsed.data.status}.`,
        });
    db.prepare("UPDATE Referral SET status=?,updatedAt=? WHERE id=?").run(
      parsed.data.status,
      now(),
      String(current.id),
    );
    addStatus(
      String(current.id),
      String(current.status),
      parsed.data.status,
      req.user!,
      "STATUS_UPDATED",
    );
    res.json(referralDetail(String(current.id), req.user!));
  },
);
app.post(
  "/api/referrals/:id/reroute/confirm",
  requireRole("CITIZEN", "ASHA"),
  (req: AuthRequest, res) => {
    const current = referralRow(String(req.params.id));
    if (!current || !canAccess(req.user!, current))
      return res
        .status(403)
        .json({ error: "You do not have access to this referral." });
    if (!current.recommendedFacility || !current.recommendedFacilityId)
      return res
        .status(404)
        .json({ error: "No reroute recommendation found." });
    db.prepare(
      "UPDATE Referral SET destinationFacility=recommendedFacility,selectedFacilityId=recommendedFacilityId,rerouteStatus='REROUTE_CONFIRMED',updatedAt=? WHERE id=?",
    ).run(now(), String(current.id));
    addStatus(
      String(current.id),
      String(current.status),
      String(current.status),
      req.user!,
      "REROUTE_CONFIRMED",
    );
    res.json(referralDetail(String(current.id), req.user!));
  },
);
app.post(
  "/api/referrals/:id/follow-up",
  requireRole("CITIZEN", "ASHA"),
  (req: AuthRequest, res) => {
    const parsed = z
        .object({
          clientId: z.string().uuid(),
          outcome: z.enum([
            "CARE_REACHED",
            "COULD_NOT_REACH",
            "SERVICE_NOT_AVAILABLE",
            "FOLLOW_UP_NEEDED",
            "OTHER_ACCESS_PROBLEM",
          ]),
          note: z.string().max(180).optional(),
          sourceMode: z.enum(["CITIZEN", "ASHA_ASSISTED"]),
        })
        .safeParse(req.body),
      current = referralRow(String(req.params.id));
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid follow-up." });
    if (!current || !canAccess(req.user!, current))
      return res
        .status(403)
        .json({ error: "You do not have access to this referral." });
    const existing = db
      .prepare(
        "SELECT id,referralId,outcome,note,timestamp,sourceMode FROM FollowUpOutcome WHERE clientId=?",
      )
      .get(parsed.data.clientId);
    if (existing) return res.json({ followUp: existing, idempotent: true });
    const id = crypto.randomUUID(),
      timestamp = now(),
      referralId = String(current.id);
    db.prepare(
      "INSERT INTO FollowUpOutcome (id,clientId,referralId,outcome,note,timestamp,sourceMode) VALUES (?,?,?,?,?,?,?)",
    ).run(
      id,
      parsed.data.clientId,
      referralId,
      parsed.data.outcome,
      parsed.data.note || null,
      timestamp,
      parsed.data.sourceMode,
    );
    const target =
      parsed.data.outcome === "CARE_REACHED" &&
      ["ARRIVED", "FOLLOW_UP_DUE"].includes(String(current.status))
        ? "COMPLETED"
        : parsed.data.outcome === "FOLLOW_UP_NEEDED" &&
            current.status === "ARRIVED"
          ? "FOLLOW_UP_DUE"
          : String(current.status);
    if (target !== current.status) {
      db.prepare("UPDATE Referral SET status=?,updatedAt=? WHERE id=?").run(
        target,
        timestamp,
        referralId,
      );
      addStatus(
        referralId,
        String(current.status),
        target,
        req.user!,
        "FOLLOW_UP_STATUS",
      );
    }
    if (parsed.data.outcome === "SERVICE_NOT_AVAILABLE")
      addGap({
        dedupeKey: `followup:${parsed.data.clientId}`,
        requestId: String(current.requestId || ""),
        referralId,
        requiredService: String(current.service),
        facilityId: String(current.selectedFacilityId || ""),
        eventType: "SERVICE_REPORTED_UNAVAILABLE",
      });
    if (parsed.data.outcome === "COULD_NOT_REACH")
      addGap({
        dedupeKey: `followup:${parsed.data.clientId}`,
        requestId: String(current.requestId || ""),
        referralId,
        requiredService: String(current.service),
        facilityId: String(current.selectedFacilityId || ""),
        eventType: "COULD_NOT_REACH_FACILITY",
      });
    res
      .status(201)
      .json({
        followUp: db
          .prepare(
            "SELECT id,referralId,outcome,note,timestamp,sourceMode FROM FollowUpOutcome WHERE id=?",
          )
          .get(id),
        referral: referralDetail(referralId, req.user!),
      });
  },
);
app.post(
  "/api/referrals/:id/clinical-outcome",
  requireRole("DOCTOR"),
  (req: AuthRequest, res) => {
    const parsed = z.object({
      disposition: z.enum(["ASSESSED", "REFERRED_ON", "FOLLOW_UP_REQUIRED", "CARE_COMPLETED"]),
      instructionEnglish: z.string().trim().min(3).max(300),
      instructionTamil: z.string().trim().min(3).max(300),
      followUpDate: z.string().date().nullable().optional(),
    }).strict().safeParse(req.body);
    const current = referralRow(String(req.params.id));
    if (!parsed.success) return res.status(400).json({ error: "Complete both patient-instruction fields." });
    if (!current || !canAccess(req.user!, current)) return res.status(403).json({ error: "You can only update referrals assigned to your facility." });
    if (!["ARRIVED", "FOLLOW_UP_DUE"].includes(String(current.status))) return res.status(409).json({ error: "Mark the patient as arrived before recording an outcome." });
    const timestamp = now(), id = crypto.randomUUID();
    db.prepare("INSERT INTO ClinicalOutcome (id,referralId,disposition,instructionEnglish,instructionTamil,followUpDate,timestamp,actorUserId,actorName,actorRole) VALUES (?,?,?,?,?,?,?,?,?,?)").run(
      id, String(current.id), parsed.data.disposition, parsed.data.instructionEnglish, parsed.data.instructionTamil,
      parsed.data.followUpDate || null, timestamp, req.user!.id, req.user!.name, req.user!.role,
    );
    const target = parsed.data.disposition === "CARE_COMPLETED" ? "COMPLETED" : "FOLLOW_UP_DUE";
    if (target !== current.status) {
      db.prepare("UPDATE Referral SET status=?,followUpDue=?,updatedAt=? WHERE id=?").run(target, parsed.data.followUpDate || (current.followUpDue ? String(current.followUpDue) : null), timestamp, String(current.id));
      addStatus(String(current.id), String(current.status), target, req.user!, "CLINICAL_OUTCOME_RECORDED");
    }
    res.status(201).json(referralDetail(String(current.id), req.user!));
  },
);
app.get(
  "/api/coordination",
  requireRole("DOCTOR", "FACILITY_ADMIN", "STAFF"),
  (req: AuthRequest, res) => res.json(coordination(req.user!)),
);
app.get(
  "/api/staff/worklist",
  requireRole("FACILITY_ADMIN", "STAFF"),
  (req: AuthRequest, res) => res.json(coordination(req.user!)),
);
app.get(
  "/api/doctor/worklist",
  requireRole("DOCTOR"),
  (req: AuthRequest, res) => res.json(coordination(req.user!)),
);
app.get(
  "/api/asha/worklist",
  requireRole("ASHA"),
  (req: AuthRequest, res) => {
    const data = coordination(req.user!);
    data.cases.sort((a: any, b: any) => b.continuityRisk.score - a.continuityRisk.score);
    res.json({ ...data, workspace: "ASHA", riskModel: { name: "Explainable continuity rules", version: "v1", clinicalPrediction: false } });
  },
);
app.get(
  "/api/dashboard",
  requireRole("DOCTOR", "FACILITY_ADMIN", "STAFF"),
  (req: AuthRequest, res) => res.json(coordination(req.user!)),
);

const webDist = fileURLToPath(new URL("../../web/dist/", import.meta.url));
if (process.env.NODE_ENV === "production" && existsSync(webDist)) {
  app.use(express.static(webDist, { index: false, maxAge: "1h" }));
  app.get("*", (req, res, next) =>
    req.path.startsWith("/api/")
      ? next()
      : res.sendFile(resolve(webDist, "index.html")),
  );
}

export function startServer(port = Number(process.env.PORT || 8787)) {
  initializeDatabase();
  return app.listen(port, "0.0.0.0", () =>
    console.log(`RuralCare API ready on port ${port}`),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  startServer();
