import {
  serviceCapacity,
  travelMinutes,
  type Assessment,
  type Facility,
  type Service,
  type ServiceCapacity,
  type Urgency,
} from "./index.ts";

export type CareLevel = "PRIMARY" | "SECONDARY" | "TERTIARY" | "EMERGENCY";
export type ServicePlan = {
  requiredService: Service;
  acceptableAlternatives: Service[];
  requiredCareLevel: CareLevel;
  reason: string;
};
export type RecommendationStatus =
  "RECOMMENDED" | "ALTERNATIVE" | "UNAVAILABLE_BUT_RELEVANT" | "NOT_SUITABLE";
export type RouteCandidate = Facility & {
  facilityId: string;
  facilityName: string;
  facilityType: string;
  locality: string;
  matchedService: Service;
  fallbackMatch: boolean;
  availability: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
  availabilitySource: "SIMULATED_FOR_PROTOTYPE" | "FACILITY_STAFF_REPORTED";
  serviceCapacity: ServiceCapacity;
  requiredServiceMatch: boolean;
  careLevelMatch: boolean;
  score: number;
  travelMinutes: number;
  rankingReasons: string[];
  recommendationStatus: RecommendationStatus;
  rerouteReason?: string;
};
export type RouteDecision = {
  requestId: string;
  plan: ServicePlan;
  candidates: RouteCandidate[];
  selectedFacilityId: string | null;
  originalFacilityId: string | null;
  rerouted: boolean;
  rerouteReason: string | null;
  explanation: string;
  audit: {
    urgency: Urgency;
    candidateCount: number;
    excludedOutsideDemoRegion: number;
    selectedFacilityId: string | null;
    rerouted: boolean;
    matchingVersion: string;
    timestamp: string;
  };
};

export const ROUTING_WEIGHTS = {
  EXACT_SERVICE: 1000,
  FALLBACK_SERVICE: 500,
  SOURCED_CAPABILITY: 100,
  CARE_LEVEL: 50,
  AVAILABLE: 25,
  LIMITED: 10,
  DISTANCE_PER_KM: 1,
} as const;
export const DEMO_REGION_RADIUS_KM = 75;
const levels: Record<Facility["type"], CareLevel[]> = {
  AAM: ["PRIMARY"],
  DISPENSARY: ["PRIMARY"],
  PHC: ["PRIMARY"],
  CHC: ["PRIMARY", "SECONDARY"],
  DISTRICT_HOSPITAL: ["SECONDARY", "EMERGENCY"],
};
const careRank: Record<CareLevel, number> = {
  PRIMARY: 1,
  SECONDARY: 2,
  TERTIARY: 3,
  EMERGENCY: 4,
};

export function classifyService(a: Assessment): ServicePlan {
  if (a.urgency === "EMERGENCY")
    return {
      requiredService: "EMERGENCY",
      acceptableAlternatives: [],
      requiredCareLevel: "EMERGENCY",
      reason:
        "Emergency-capable public care is required because a deterministic danger-sign rule was triggered.",
    };
  if (a.service === "CHILD_HEALTH")
    return {
      requiredService: "CHILD_HEALTH",
      acceptableAlternatives: ["PRIMARY_CARE"],
      requiredCareLevel: "PRIMARY",
      reason:
        "Child-health assessment is appropriate based on the structured need.",
    };
  if (a.service === "MATERNITY")
    return {
      requiredService: "MATERNITY",
      acceptableAlternatives: [],
      requiredCareLevel: "PRIMARY",
      reason:
        "Maternal-care assessment is appropriate based on the structured need.",
    };
  return {
    requiredService: "PRIMARY_CARE",
    acceptableAlternatives: [],
    requiredCareLevel: "PRIMARY",
    reason:
      "Primary-care assessment is appropriate based on the structured need.",
  };
}
function supportsLevel(f: Facility, needed: CareLevel) {
  return needed === "EMERGENCY"
    ? levels[f.type].includes("EMERGENCY")
    : levels[f.type].some((level) => careRank[level] >= careRank[needed]);
}
function matchedService(f: Facility, plan: ServicePlan): Service | null {
  if (f.services.includes(plan.requiredService)) return plan.requiredService;
  return (
    plan.acceptableAlternatives.find((service) =>
      f.services.includes(service),
    ) || null
  );
}
function sourceFor(f: Facility, service: Service) {
  return (
    f.serviceSources?.[service] ||
    f.capabilitySource ||
    "INFERRED_FROM_FACILITY_TYPE"
  );
}
function suitabilityScore(candidate: RouteCandidate) {
  return (
    (candidate.requiredServiceMatch
      ? ROUTING_WEIGHTS.EXACT_SERVICE
      : ROUTING_WEIGHTS.FALLBACK_SERVICE) +
    (sourceFor(candidate, candidate.matchedService) === "SOURCED_FROM_DIRECTORY"
      ? ROUTING_WEIGHTS.SOURCED_CAPABILITY
      : 0) +
    ROUTING_WEIGHTS.CARE_LEVEL -
    candidate.distanceKm * ROUTING_WEIGHTS.DISTANCE_PER_KM
  );
}

export function routeFacilities(
  facilities: Facility[],
  assessment: Assessment,
  requestId = "demo-request",
): RouteDecision {
  const plan = classifyService(assessment);
  const coordinateValid = facilities.filter(
    (f) =>
      Number.isFinite(f.latitude) &&
      Number.isFinite(f.longitude) &&
      f.latitude !== 0 &&
      f.longitude !== 0,
  );
  const inRegion = coordinateValid.filter(
    (f) => f.distanceKm <= DEMO_REGION_RADIUS_KM,
  );
  const candidates: RouteCandidate[] = inRegion
    .flatMap((f) => {
      const match = matchedService(f, plan);
      if (!match || !supportsLevel(f, plan.requiredCareLevel)) return [];
      const capacity = serviceCapacity(f, match),
        exact = match === plan.requiredService,
        source = sourceFor(f, match);
      const item: RouteCandidate = {
        ...f,
        facilityId: f.id,
        facilityName: f.name,
        facilityType: f.type,
        locality: f.address,
        matchedService: match,
        fallbackMatch: !exact,
        availability: capacity.status,
        availabilitySource: f.operationalSource || "SIMULATED_FOR_PROTOTYPE",
        serviceCapacity: capacity,
        requiredServiceMatch: exact,
        careLevelMatch: true,
        score: 0,
        travelMinutes: travelMinutes(f),
        rankingReasons: [
          exact
            ? `Exact service match: ${plan.requiredService.replaceAll("_", " ")}`
            : `Fallback service: ${match.replaceAll("_", " ")} (not verified ${plan.requiredService.replaceAll("_", " ")})`,
          `Appropriate ${plan.requiredCareLevel.toLowerCase()} care level`,
          `${f.distanceKm} km from the labelled demo origin`,
          `${capacity.status.toLowerCase()} ${match.replaceAll("_", " ")} availability — simulated for prototype`,
          `${source} capability`,
        ],
        recommendationStatus:
          capacity.status === "UNAVAILABLE"
            ? "UNAVAILABLE_BUT_RELEVANT"
            : "ALTERNATIVE",
      };
      item.score =
        suitabilityScore(item) +
        (capacity.status === "AVAILABLE"
          ? ROUTING_WEIGHTS.AVAILABLE
          : capacity.status === "LIMITED"
            ? ROUTING_WEIGHTS.LIMITED
            : 0);
      return [item];
    })
    .sort((a, b) => b.score - a.score);
  const original =
    [...candidates].sort(
      (a, b) => suitabilityScore(b) - suitabilityScore(a),
    )[0] || null;
  const selected =
    candidates.find((f) => f.availability !== "UNAVAILABLE") || null;
  const rerouted = Boolean(
    original &&
    selected &&
    original.id !== selected.id &&
    original.availability === "UNAVAILABLE",
  );
  const final = candidates.map((item) => ({
    ...item,
    recommendationStatus: (selected?.id === item.id
      ? "RECOMMENDED"
      : item.availability === "UNAVAILABLE"
        ? "UNAVAILABLE_BUT_RELEVANT"
        : "ALTERNATIVE") as RecommendationStatus,
    rerouteReason:
      item.id === original?.id && rerouted
        ? "REQUIRED_SERVICE_UNAVAILABLE"
        : undefined,
  }));
  const explanation = !selected
    ? "No suitable available facility was found within the current demo region. Availability is simulated; seek human assistance for a broader public-care search."
    : rerouted
      ? `${original?.name} was the strongest suitability match, but ${original.matchedService.replaceAll("_", " ")} availability is marked unavailable in this prototype. RuralCare rerouted to ${selected.name}.`
      : `${selected.name} is recommended because it is the strongest available service and care-level match within the current demo region.`;
  return {
    requestId,
    plan,
    candidates: final,
    selectedFacilityId: selected?.id || null,
    originalFacilityId: original?.id || null,
    rerouted,
    rerouteReason: rerouted ? "REQUIRED_SERVICE_UNAVAILABLE" : null,
    explanation,
    audit: {
      urgency: assessment.urgency,
      candidateCount: final.length,
      excludedOutsideDemoRegion: coordinateValid.length - inRegion.length,
      selectedFacilityId: selected?.id || null,
      rerouted,
      matchingVersion: "routing-v3",
      timestamp: new Date().toISOString(),
    },
  };
}
