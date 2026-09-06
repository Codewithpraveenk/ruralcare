import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  ClipboardPlus,
  CloudOff,
  GitCompareArrows,
  HeartPulse,
  Hospital,
  Languages,
  MapPin,
  MessageCircle,
  Mic,
  Navigation,
  PhoneCall,
  Printer,
  QrCode,
  Route,
  RotateCcw,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Send,
  UsersRound,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  assessNeed,
  applyAdaptiveAnswer,
  calculateDistanceKm,
  extractStructuredNeed,
  nextSafetyQuestion,
  rankFacilities,
  routeFacilities,
  structuredToMessage,
  type Assessment,
  type SafetyQuestion,
  type StructuredIntake,
  type Facility,
  type RouteDecision,
  type Service,
} from "@ruralcare/shared";
import { RouteMap } from "./RouteMap.tsx";
import { AuthProvider, useAuth, type AuthUser } from "./AuthContext.tsx";
import { portalIntentKey, type PortalIntent } from "./portal.ts";
import {
  clearWorkflow,
  loadWorkflow,
  pendingActions,
  queueAction,
  removeAction,
  saveWorkflow,
  type SyncState,
} from "./offline-store.ts";
import "./styles.css";
import "./simple-shell.css";

const LoginScreen = lazy(() => import("./LoginScreen.tsx"));

type View =
  | "intake"
  | "assessment"
  | "facilities"
  | "referral"
  | "followup"
  | "dashboard";
type Referral = {
  id: string;
  patientLabel: string;
  destinationFacility: string;
  urgency: string;
  status: string;
  createdAt: string;
};
type StaffCase = {
  id: string;
  need: string;
  urgency: "HIGH" | "MEDIUM" | "ROUTINE";
  facility: string;
  sourceMode?: "CITIZEN" | "ASHA_ASSISTED";
  rerouted?: boolean;
  status: "Created" | "Accepted" | "Arrived" | "Follow-up";
  followup: boolean;
};
const scenarios = [
  {
    label: "Fever · needs answers",
    tamil: "Expected: MORE INFORMATION",
    message: "My child has mild fever since this morning.",
    Icon: HeartPulse,
  },
  {
    label: "Child fever · stable",
    tamil: "Expected: ROUTINE",
    message:
      "My 8-year-old child has mild fever since this morning. The child is drinking well, awake, has no vomiting, no seizure, no breathing difficulty and no stiff neck.",
    Icon: ShieldCheck,
  },
  {
    label: "Primary-care reroute",
    tamil: "Expected: ROUTINE + REROUTE",
    message:
      "I am an adult with a mild headache since this morning. I am awake and have no breathing difficulty, no confusion and no severe bleeding.",
    Icon: Route,
  },
  {
    label: "Pregnancy warning",
    tamil: "Expected: URGENT",
    message:
      "I am pregnant and have bleeding, but I am awake and breathing normally.",
    Icon: CalendarDays,
  },
  {
    label: "Mixed-language danger sign",
    tamil: "Expected: EMERGENCY",
    message: "குழந்தைக்கு fever இருக்கு and வலிப்பு ஏற்பட்டது.",
    Icon: AlertTriangle,
  },
];
const demoOrigin = { latitude: 12.514, longitude: 79.884 };
type CareOrigin={id:string;label:string;latitude:number;longitude:number;source:"CURATED_OFFLINE"|"DEVICE_LOCATION"};
const careOrigins:CareOrigin[]=[
  {id:"madurantakam",label:"Madurantakam",latitude:12.514,longitude:79.884,source:"CURATED_OFFLINE"},
  {id:"cheyyur",label:"Cheyyur",latitude:12.349,longitude:80.003,source:"CURATED_OFFLINE"},
  {id:"chengalpattu",label:"Chengalpattu",latitude:12.6819,longitude:79.9834,source:"CURATED_OFFLINE"},
  {id:"maraimalai-nagar",label:"Maraimalai Nagar",latitude:12.7912,longitude:80.0329,source:"CURATED_OFFLINE"},
  {id:"medavakkam",label:"Medavakkam",latitude:12.9143,longitude:80.1918,source:"CURATED_OFFLINE"},
];
const withDistance = (facility: Omit<Facility, "distanceKm">): Facility => ({
  ...facility,
  distanceKm: calculateDistanceKm(demoOrigin, facility),
});
const localFacilities: Facility[] = [
  withDistance({
    id: "government-hospital-madurantakam",
    name: "Government Hospital, Madurantakam",
    type: "CHC",
    services: ["PRIMARY_CARE", "CHILD_HEALTH", "MATERNITY", "EMERGENCY"],
    available: true,
    hours: "Hours not published — verify before travel",
    address: "Government Hospital, Hospital Road, Madurantakam - 603306",
    phone: "7358124622",
    latitude: 12.5093491,
    longitude: 79.8903597,
    capabilitySource: "SOURCED_FROM_DIRECTORY",
    capacity: {
      PRIMARY_CARE: {
        status: "UNAVAILABLE",
        estimatedWaitMinutes: 0,
        availableBeds: 0,
        note: "SIMULATED_FOR_PROTOTYPE · rerouting scenario",
      },
      CHILD_HEALTH: {
        status: "AVAILABLE",
        estimatedWaitMinutes: 25,
        availableBeds: 1,
        note: "SIMULATED_FOR_PROTOTYPE",
      },
      MATERNITY: {
        status: "LIMITED",
        estimatedWaitMinutes: 45,
        availableBeds: 1,
        note: "SIMULATED_FOR_PROTOTYPE",
      },
      EMERGENCY: {
        status: "AVAILABLE",
        estimatedWaitMinutes: 12,
        availableBeds: 2,
        note: "SIMULATED_FOR_PROTOTYPE",
      },
    },
  }),
  withDistance({
    id: "government-hospital-cheyyur",
    name: "Government Hospital, Cheyyur",
    type: "CHC",
    services: ["PRIMARY_CARE", "CHILD_HEALTH", "MATERNITY", "EMERGENCY"],
    available: true,
    hours: "Hours not published — verify before travel",
    address: "Government Hospital, Salt Road, Cheyyur - 603302",
    phone: "9947589042",
    latitude: 12.35204,
    longitude: 80.002556,
    capabilitySource: "INFERRED_FROM_FACILITY_TYPE",
    capacity: {
      PRIMARY_CARE: {
        status: "AVAILABLE",
        estimatedWaitMinutes: 20,
        availableBeds: 0,
        note: "SIMULATED_FOR_PROTOTYPE",
      },
      CHILD_HEALTH: {
        status: "AVAILABLE",
        estimatedWaitMinutes: 25,
        availableBeds: 1,
        note: "SIMULATED_FOR_PROTOTYPE",
      },
      MATERNITY: {
        status: "LIMITED",
        estimatedWaitMinutes: 50,
        availableBeds: 1,
        note: "SIMULATED_FOR_PROTOTYPE",
      },
      EMERGENCY: {
        status: "AVAILABLE",
        estimatedWaitMinutes: 15,
        availableBeds: 1,
        note: "SIMULATED_FOR_PROTOTYPE",
      },
    },
  }),
  withDistance({
    id: "chengalpattu-government-medical-college",
    name: "Government Chengalpattu Medical College Hospital",
    type: "DISTRICT_HOSPITAL",
    services: ["PRIMARY_CARE", "CHILD_HEALTH", "MATERNITY", "EMERGENCY"],
    available: true,
    hours: "Hours not published — verify before travel",
    address:
      "GST Road, Chengalpattu Medical College Campus, Chengalpattu - 603001",
    phone: "Not published in supplied directory",
    latitude: 12.6819,
    longitude: 79.9834,
    capabilitySource: "INFERRED_FROM_FACILITY_TYPE",
    capacity: {
      PRIMARY_CARE: {
        status: "AVAILABLE",
        estimatedWaitMinutes: 35,
        availableBeds: 8,
        note: "Synthetic general-care capacity",
      },
      CHILD_HEALTH: {
        status: "AVAILABLE",
        estimatedWaitMinutes: 30,
        availableBeds: 4,
        note: "Synthetic child-health capacity",
      },
      MATERNITY: {
        status: "AVAILABLE",
        estimatedWaitMinutes: 30,
        availableBeds: 4,
        note: "Synthetic maternity capacity",
      },
      EMERGENCY: {
        status: "AVAILABLE",
        estimatedWaitMinutes: 8,
        availableBeds: 5,
        note: "Synthetic emergency capacity",
      },
    },
  }),
];
const queueKey = "ruralcare-referral-queue";
const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    let message = "Network unavailable";
    try {
      const problem = await response.json();
      message = problem.error || message;
    } catch {
      /* keep connectivity fallback */
    }
    if (response.status === 401)
      window.dispatchEvent(new Event("ruralcare-auth-expired"));
    throw new Error(message);
  }
  return response.json();
}
function isOfflineFailure(error: unknown) {
  return !navigator.onLine || error instanceof TypeError;
}
function queueReferral(data: unknown) {
  const queue = JSON.parse(localStorage.getItem(queueKey) || "[]");
  queue.push(data);
  localStorage.setItem(queueKey, JSON.stringify(queue));
}
function IconButton({
  Icon,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { Icon?: LucideIcon }) {
  return (
    <button className={className} {...props}>
      {Icon && <Icon size={18} strokeWidth={2.3} />}
      <span>{children}</span>
    </button>
  );
}
const seedCases: StaffCase[] = [
  {
    id: "RCC-1048",
    need: "Child fever & cough",
    urgency: "HIGH",
    facility: "Public Health Centre",
    status: "Created",
    followup: true,
  },
  {
    id: "RCC-1047",
    need: "Antenatal check-up",
    urgency: "MEDIUM",
    facility: "Public Health Centre",
    status: "Accepted",
    followup: false,
  },
  {
    id: "RCC-1046",
    need: "Blood pressure review",
    urgency: "ROUTINE",
    facility: "K.K.Nagar Dispensary",
    status: "Arrived",
    followup: true,
  },
  {
    id: "RCC-1045",
    need: "Persistent stomach pain",
    urgency: "HIGH",
    facility: "Gopalapuram Dispensary",
    status: "Follow-up",
    followup: true,
  },
];
const demand = [
  { label: "General medicine", count: 18, color: "#0f766e" },
  { label: "Maternal care", count: 9, color: "#d39a1a" },
  { label: "Paediatrics", count: 7, color: "#c15a36" },
  { label: "Diagnostics", count: 6, color: "#47769b" },
  { label: "Teleconsultation", count: 4, color: "#6b7280" },
];
const pipeline = ["Created", "Accepted", "Arrived", "Follow-up"] as const;
function StaffDashboard({ onBack }: { onBack: () => void }) {
  const [cases, setCases] = useState(seedCases);
  const [alternatives, setAlternatives] = useState(false);
  const [filter, setFilter] = useState<"All" | "Priority" | "Follow-up">("All");
  const visible = cases.filter((item) =>
    filter === "All" || filter === "Priority"
      ? filter === "All" || item.urgency === "HIGH"
      : item.followup,
  );
  const counts = {
    incoming: cases.length + 8,
    urgent: cases.filter((item) => item.urgency === "HIGH").length + 1,
    pending: cases.filter(
      (item) => item.status === "Created" || item.status === "Accepted",
    ).length,
    followups: cases.filter((item) => item.followup).length,
  };
  const advance = (id: string) =>
    setCases((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const index = pipeline.indexOf(item.status);
        return {
          ...item,
          status: pipeline[Math.min(index + 1, pipeline.length - 1)],
          followup: index + 1 >= 3,
        };
      }),
    );
  return (
    <section className="staff-workspace">
      <div className="staff-heading">
        <div>
          <p className="kicker">ASHA / PHC COORDINATION WORKSPACE</p>
          <h1>Today’s care pathways.</h1>
          <p>
            Mock data for the SIH demo. All patient IDs and activities are
            synthetic and non-identifying.
          </p>
        </div>
        <button className="back" onClick={onBack}>
          <ChevronLeft /> Citizen journey
        </button>
      </div>
      <div className="staff-context">
        <span>
          <Activity size={16} /> Live demo shift · 09:30–16:30
        </span>
        <span>
          <BadgeCheck size={16} /> 4 facilities reporting
        </span>
        <span>
          <ShieldCheck size={16} /> No real patient data
        </span>
      </div>
      <div className="staff-summary">
        <article>
          <span className="summary-icon teal">
            <ClipboardPlus />
          </span>
          <div>
            <b>{counts.incoming}</b>
            <small>Incoming requests</small>
          </div>
          <em>+4 since morning</em>
        </article>
        <article>
          <span className="summary-icon red">
            <AlertTriangle />
          </span>
          <div>
            <b>{counts.urgent}</b>
            <small>Urgent / high-risk</small>
          </div>
          <em>Needs attention</em>
        </article>
        <article>
          <span className="summary-icon gold">
            <Hospital />
          </span>
          <div>
            <b>{counts.pending}</b>
            <small>Pending referrals</small>
          </div>
          <em>Awaiting hand-off</em>
        </article>
        <article>
          <span className="summary-icon blue">
            <CalendarDays />
          </span>
          <div>
            <b>{counts.followups}</b>
            <small>Follow-ups due</small>
          </div>
          <em>Today + tomorrow</em>
        </article>
      </div>
      <div className="staff-grid">
        <article className="active-cases">
          <div className="panel-title">
            <div>
              <p className="eyebrow">ACTIVE CARE COORDINATION</p>
              <h2>Cases that need movement</h2>
            </div>
            <div className="filter-row">
              {(["All", "Priority", "Follow-up"] as const).map((item) => (
                <button
                  key={item}
                  className={filter === item ? "selected" : ""}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="case-table">
            <div className="case-head">
              <span>Demo patient & need</span>
              <span>Pathway</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {visible.map((item) => (
              <div className="case-row" key={item.id}>
                <div>
                  <b>{item.id}</b>
                  <span>{item.need}</span>
                  <i className={`urgency-chip ${item.urgency.toLowerCase()}`}>
                    {item.urgency}
                  </i>
                </div>
                <div>
                  <small>Recommended facility</small>
                  <b>{item.facility}</b>
                  <small>
                    {item.sourceMode === "CITIZEN"
                      ? "Citizen"
                      : "ASHA-assisted"}
                    {item.rerouted ? " · Rerouted" : ""}
                  </small>
                </div>
                <div>
                  <span
                    className={`pipeline-chip ${item.status.toLowerCase().replace("-", "")}`}
                  >
                    {item.status}
                  </span>
                </div>
                <IconButton
                  Icon={ArrowRight}
                  className="case-action"
                  onClick={() => advance(item.id)}
                >
                  {item.status === "Follow-up" ? "Reviewed" : "Advance"}
                </IconButton>
              </div>
            ))}
          </div>
        </article>
        <aside className="capacity-alert">
          <div className="alert-heading">
            <span>
              <CircleAlert />
            </span>
            <div>
              <p className="eyebrow">CAPACITY ALERT</p>
              <h2>Paediatrics unavailable at CHC</h2>
            </div>
          </div>
          <p>
            <b>3 child-health requests</b> are affected in today’s demo queue.
            Route them before unnecessary travel.
          </p>
          <div className="affected-list">
            <span>RCC-1048 · Child fever</span>
            <span>RCC-1041 · Breathing concern</span>
            <span>RCC-1039 · Immunisation query</span>
          </div>
          <button onClick={() => setAlternatives(!alternatives)}>
            {alternatives ? "Hide alternatives" : "View alternative facilities"}{" "}
            <ArrowRight size={16} />
          </button>
          {alternatives && (
            <div className="alternatives">
              <b>Suggested alternatives</b>
              <span>Melur PHC · 5.6 km · Child health available</span>
              <span>
                District Government Hospital · 27.5 km · 24×7 emergency
              </span>
            </div>
          )}
        </aside>
      </div>
      <div className="pipeline-panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">REFERRAL PIPELINE</p>
            <h2>Where each hand-off stands</h2>
          </div>
          <span className="pipeline-note">
            Tap “Advance” in active cases to update a mock case
          </span>
        </div>
        <div className="pipeline-steps">
          {pipeline.map((stage, index) => (
            <div key={stage}>
              <span>{index + 1}</span>
              <b>{stage}</b>
              <small>
                {cases.filter((item) => item.status === stage).length} cases
              </small>
            </div>
          ))}
        </div>
      </div>
      <div className="staff-lower">
        <article className="demand-overview">
          <div className="panel-title">
            <div>
              <p className="eyebrow">SERVICE-DEMAND OVERVIEW</p>
              <h2>What people are seeking</h2>
            </div>
            <small>Today’s mock queue</small>
          </div>
          {demand.map((item) => (
            <div className="demand-row" key={item.label}>
              <span>{item.label}</span>
              <div>
                <i
                  style={{
                    width: `${(item.count / 18) * 100}%`,
                    background: item.color,
                  }}
                />
              </div>
              <b>{item.count}</b>
            </div>
          ))}
          <p className="small">
            Demand signals support outreach planning; they do not represent
            clinical prevalence.
          </p>
        </article>
        <article className="recent-activity">
          <p className="eyebrow">RECENT REFERRAL ACTIVITY</p>
          <h2>Continuity events</h2>
          <div className="activity-row">
            <span className="activity-dot green" />
            <p>
              <b>RCC-1047 accepted</b>
              <small>
                Melur PHC acknowledged antenatal check-up · 9 min ago
              </small>
            </p>
          </div>
          <div className="activity-row">
            <span className="activity-dot amber" />
            <p>
              <b>Capacity reroute suggested</b>
              <small>
                Paediatrics request moved away from CHC · 16 min ago
              </small>
            </p>
          </div>
          <div className="activity-row">
            <span className="activity-dot blue" />
            <p>
              <b>Follow-up due today</b>
              <small>RCC-1046 needs an ASHA call-back · 32 min ago</small>
            </p>
          </div>
          <div className="activity-row">
            <span className="activity-dot green" />
            <p>
              <b>Referral created offline</b>
              <small>
                RCC-1048 safely queued and ready to sync · 46 min ago
              </small>
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}

type CoordinationCase = {
  id: string;
  demoId: string;
  careNeed: string;
  urgency: "EMERGENCY" | "URGENT" | "ROUTINE";
  facility: string;
  service?: string;
  sourceMode?: "CITIZEN" | "ASHA_ASSISTED";
  rerouted?: boolean;
  rerouteStatus?: string;
  recommendedFacility?: string;
  stage: string;
  status: "CREATED" | "ACCEPTED" | "ARRIVED" | "FOLLOW_UP_DUE" | "COMPLETED";
  followUpDue?: string;
  updatedAt: string;
  continuityRisk?: { score: number; level: "LOW" | "MEDIUM" | "HIGH"; reasons: string[]; model: string };
};
type Coordination = {
  workspace?: "DOCTOR" | "STAFF";
  facility?: { id: string; name: string };
  cases: CoordinationCase[];
  totals: {
    incoming: number;
    urgent: number;
    pending: number;
    followups: number;
    rerouted: number;
    serviceGaps: number;
    unacknowledged?: number;
    arrived?: number;
    completed?: number;
  };
  demand: { service: string; count: number }[];
  capacityAlerts?: {
    title: string;
    service?: string;
    affected: { demoId: string; careNeed: string }[];
    alternatives: { name: string; distanceKm: number; hours: string }[];
  }[];
  serviceAccess: {
    service: string;
    requests: number;
    reroutes: number;
    accessGaps: number;
  }[];
  recentGaps: {
    service: string;
    facility: string;
    reason: string;
    count: number;
  }[];
  capacity: Array<Record<string, unknown>>;
  activity: {
    demoId: string;
    stage: string;
    careNeed: string;
    facility: string;
    updatedAt: string;
  }[];
};
type FacilityReview={summary:{total:number;routeable:number;pending:number};policy:string;records:Array<{sourceRowId:string;name:string;careType:string;address:string;phone:string;sourceUrl:string;retrievedOn:string;routeable:boolean;facilityId:string|null;coordinateConfidence:string|null;missing:string[];serviceBoundary:string[]|string}>};
const serviceNameTamil = (service?: string) =>
  ({ PRIMARY_CARE: "முதன்மை சிகிச்சை", MATERNITY: "மகப்பேறு பராமரிப்பு", CHILD_HEALTH: "குழந்தை நலம்", EMERGENCY: "அவசர சிகிச்சை", TELECONSULT: "தொலை மருத்துவ ஆலோசனை" } as Record<string, string>)[service || ""] || "பொது சுகாதார சேவை";
const staffQueueKey = (userId: string) =>
  `ruralcare:${userId}:staff-action-queue`;
const fallbackCoordination: Coordination = {
  cases: seedCases.map((item, index) => ({
    id: `fallback-${index}`,
    demoId: item.id,
    careNeed: item.need,
    urgency:
      item.urgency === "HIGH"
        ? "URGENT"
        : item.urgency === "MEDIUM"
          ? "URGENT"
          : "ROUTINE",
    facility: item.facility,
    stage: item.status,
    status:
      item.status === "Follow-up"
        ? "FOLLOW_UP_DUE"
        : (item.status.toUpperCase() as CoordinationCase["status"]),
    updatedAt: new Date().toISOString(),
  })),
  totals: {
    incoming: 6,
    urgent: 3,
    pending: 2,
    followups: 1,
    rerouted: 0,
    serviceGaps: 0,
  },
  demand: [
    { service: "General medicine", count: 8 },
    { service: "Maternal care", count: 4 },
    { service: "Paediatrics", count: 5 },
    { service: "Diagnostics", count: 2 },
    { service: "Teleconsultation", count: 1 },
  ],
  capacityAlerts: [
    {
      title: "Paediatrics unavailable at CHC",
      affected: [
        { demoId: "RCC-1041", careNeed: "Breathing concern" },
        { demoId: "RCC-1039", careNeed: "Immunisation query" },
      ],
      alternatives: [
        {
          name: "Melur Public Health Centre",
          distanceKm: 5.6,
          hours: "Child health available",
        },
      ],
    },
  ],
  serviceAccess: [],
  recentGaps: [],
  capacity: [],
  activity: [
    {
      demoId: "RCC-1047",
      stage: "Accepted",
      careNeed: "Antenatal check-up",
      facility: "Melur Public Health Centre",
      updatedAt: new Date().toISOString(),
    },
  ],
};
function queueStaffAction(userId: string, id: string, status: string) {
  const items = JSON.parse(localStorage.getItem(staffQueueKey(userId)) || "[]");
  items.push({ id, status });
  localStorage.setItem(staffQueueKey(userId), JSON.stringify(items));
}
function LiveStaffDashboard({ onBack }: { onBack?: () => void }) {
  const { user } = useAuth();
  const [data, setData] = useState<Coordination>({
    ...fallbackCoordination,
    cases: [],
    totals: {
      incoming: 0,
      urgent: 0,
      pending: 0,
      followups: 0,
      rerouted: 0,
      serviceGaps: 0,
    },
    demand: [],
    serviceAccess: [],
    recentGaps: [],
    capacity: [],
    activity: [],
  });
  const [filter, setFilter] = useState<"All" | "Priority" | "Follow-up">("All");
  const [alternatives, setAlternatives] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [capacityFacilities, setCapacityFacilities] = useState<Facility[]>([]);
  const [capacityFacilityId, setCapacityFacilityId] = useState("");
  const [capacityService, setCapacityService] =
    useState<Service>("PRIMARY_CARE");
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [handoverCode, setHandoverCode] = useState("");
  const [clinicalDisposition, setClinicalDisposition] = useState("FOLLOW_UP_REQUIRED");
  const [instructionEnglish, setInstructionEnglish] = useState("");
  const [instructionTamil, setInstructionTamil] = useState("");
  const [clinicalFollowUpDate, setClinicalFollowUpDate] = useState("");
  const [workspaceSection, setWorkspaceSection] = useState<
    "referrals" | "capacity" | "insights" | "scan"
  >("referrals");
  const [facilityReview,setFacilityReview]=useState<FacilityReview|null>(null);
  const refresh = async (clearMessage = true) => {
    setLoading(true);
    try {
      const result = await request(
        user?.role === "ASHA"
          ? "/api/asha/worklist"
          : user?.role === "DOCTOR"
          ? "/api/doctor/worklist"
          : "/api/staff/worklist",
      );
      setData(result);
      if (user?.role !== "DOCTOR" && user?.role !== "ASHA") {
        const capacityResult = await request("/api/capacity");
        setCapacityFacilities(capacityResult.facilities);
        if (!capacityFacilityId && capacityResult.facilities[0])
          setCapacityFacilityId(capacityResult.facilities[0].id);
      }
      if(user?.role==="FACILITY_ADMIN")setFacilityReview(await request("/api/facility-data/review"));
      if (clearMessage) setMessage("");
    } catch {
      setMessage(
        "The facility workspace could not refresh. Reconnect and try again.",
      );
    } finally {
      setLoading(false);
    }
  };
  const updateCapacity = async (
    availability: "AVAILABLE" | "LIMITED" | "UNAVAILABLE",
  ) => {
    if (!capacityFacilityId) return;
    try {
      const result = await request(
        `/api/capacity/${capacityFacilityId}/${capacityService}`,
        { method: "PUT", body: JSON.stringify({ availability,verificationNote:"Confirmed by assigned facility staff",validForHours:4 }) },
      );
      await refresh(false);
      setMessage(
        `${capacityService.replaceAll("_", " ")} marked ${availability.toLowerCase()} until ${new Date(result.expiresAt).toLocaleTimeString()}. ${result.recommendations.length} referral reroute recommendation(s) created.`,
      );
    } catch {
      setMessage("Capacity changes require a connection and were not saved.");
    }
  };
  const openCase = async (item: CoordinationCase) => {
    try {
      const result = await request(`/api/referrals/${item.id}`);
      setSelectedDetail(result);
    } catch (error: any) {
      setMessage(error?.message || "Could not open this assigned referral.");
    }
  };
  const openHandoverCode = async () => {
    const code = handoverCode.trim().replace(/^ruralcare:referral:/i, "");
    if (!code) return setMessage("Enter or scan a referral code first.");
    try {
      const result = await request(`/api/referrals/${encodeURIComponent(code)}`);
      setSelectedDetail(result);
      setHandoverCode("");
      setMessage("Referral pass verified for this facility.");
    } catch (error: any) {
      setMessage(error?.message || "This referral is invalid or is not assigned to your facility.");
    }
  };
  const scanHandoverImage = async (file?: File) => {
    const Detector = (window as any).BarcodeDetector;
    if (!file || !Detector) return setMessage("QR camera scanning needs a supported Chrome/Edge device. You can enter the printed code instead.");
    try {
      const bitmap = await createImageBitmap(file);
      const results = await new Detector({ formats: ["qr_code"] }).detect(bitmap);
      bitmap.close();
      const value = results[0]?.rawValue || "";
      if (!value) return setMessage("No QR code was found in that image. Try again or enter the code.");
      setHandoverCode(value);
      const code = String(value).replace(/^ruralcare:referral:/i, "");
      const result = await request(`/api/referrals/${encodeURIComponent(code)}`);
      setSelectedDetail(result);
      setMessage("Referral QR verified for this facility.");
    } catch (error: any) {
      setMessage(error?.message || "The QR could not be read or is not assigned to this facility.");
    }
  };
  const saveClinicalOutcome = async () => {
    if (!selectedDetail?.referral?.id) return;
    if (!instructionEnglish.trim() || !instructionTamil.trim()) return setMessage("Add both English and Tamil patient instructions.");
    try {
      const result = await request(`/api/referrals/${selectedDetail.referral.id}/clinical-outcome`, {
        method: "POST",
        body: JSON.stringify({ disposition: clinicalDisposition, instructionEnglish, instructionTamil, followUpDate: clinicalFollowUpDate || null }),
      });
      setSelectedDetail(result);
      setInstructionEnglish("");
      setInstructionTamil("");
      setClinicalFollowUpDate("");
      setMessage("Visit outcome saved and shared with the patient timeline.");
      await refresh(false);
    } catch (error: any) {
      setMessage(error?.message || "The visit outcome could not be saved.");
    }
  };
  const syncActions = async () => {
    const queued = JSON.parse(
      localStorage.getItem(staffQueueKey(user!.id)) || "[]",
    );
    if (!queued.length) return;
    try {
      await Promise.all(
        queued.map((item: { id: string; status: string }) =>
          request(`/api/referrals/${item.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: item.status }),
          }),
        ),
      );
      localStorage.removeItem(staffQueueKey(user!.id));
      await refresh();
      setMessage("Queued staff updates synced.");
    } catch {
      /* keep actions for the next reconnect */
    }
  };
  useEffect(() => {
    refresh();
    syncActions();
    const onOnline = () => syncActions();
    addEventListener("online", onOnline);
    return () => removeEventListener("online", onOnline);
  }, []);
  const advance = async (item: CoordinationCase) => {
    const order: CoordinationCase["status"][] = [
      "CREATED",
      "ACCEPTED",
      "ARRIVED",
      "FOLLOW_UP_DUE",
      "COMPLETED",
    ];
    const next =
      order[Math.min(order.indexOf(item.status) + 1, order.length - 1)];
    setData((current) =>
      current
        ? {
            ...current,
            cases: current.cases.map((row) =>
              row.id === item.id
                ? {
                    ...row,
                    status: next,
                    stage:
                      next === "FOLLOW_UP_DUE"
                        ? "Follow-up due"
                        : next.slice(0, 1) + next.slice(1).toLowerCase(),
                  }
                : row,
            ),
          }
        : current,
    );
    try {
      await request(`/api/referrals/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await refresh();
    } catch {
      queueStaffAction(user!.id, item.id, next);
      setMessage(
        "Offline: staff update saved and will sync when the connection returns.",
      );
    }
  };
  const visible = data.cases.filter((item) =>
    filter === "All" || filter === "Priority"
      ? filter === "All" || item.urgency !== "ROUTINE"
      : item.status === "FOLLOW_UP_DUE",
  );
  const alert = data.capacityAlerts?.[0];
  if (user?.role === "ASHA") {
    return (
      <section className="asha-workspace">
        <div className="staff-heading"><div><p className="kicker">ASHA FIELD FOLLOW-UP</p><h1>People who may need help reaching care.</h1><p>Prioritized from your assisted referrals using transparent continuity rules—not a clinical prediction.</p></div><button className="dashboard-refresh" onClick={() => refresh()} disabled={loading}><Activity /> {loading ? "Refreshing…" : "Refresh"}</button></div>
        <div className="asha-risk-legend"><span><i className="risk-high" /> High follow-up priority</span><span><i className="risk-medium" /> Medium</span><span><i className="risk-low" /> Low</span></div>
        {message && <div className="staff-message">{message}<button onClick={() => refresh()}>Retry</button></div>}
        <div className="asha-followup-list">
          {data.cases.length === 0 ? <div className="dashboard-empty"><BadgeCheck /><b>No assisted referrals need follow-up.</b></div> : data.cases.map(item => (
            <article key={item.id}>
              <div><span>{item.demoId}</span><b>{item.careNeed}</b><small>{item.facility} · {item.status.replaceAll("_", " ")}</small></div>
              <strong className={`risk-${item.continuityRisk?.level.toLowerCase()}`}>{item.continuityRisk?.level || "LOW"} · {item.continuityRisk?.score || 0}</strong>
              <ul>{item.continuityRisk?.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
              <button onClick={() => openCase(item)}>Open referral</button>
            </article>
          ))}
        </div>
        {selectedDetail && <div className="case-detail-backdrop" role="presentation" onClick={() => setSelectedDetail(null)}><section className="case-detail-panel" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><button className="case-detail-close" onClick={() => setSelectedDetail(null)}>×</button><p className="kicker">ASSISTED REFERRAL</p><h2>{selectedDetail.referral.demoId}</h2><div className="case-detail-summary"><div><span>Confirmed need</span><b>{selectedDetail.referral.careNeed}</b></div><div><span>Status</span><b>{selectedDetail.referral.status.replaceAll("_", " ")}</b></div><div><span>Facility</span><b>{selectedDetail.referral.destinationFacility}</b></div><div><span>Follow-up due</span><b>{selectedDetail.referral.followUpDue ? new Date(selectedDetail.referral.followUpDue).toLocaleDateString() : "Not set"}</b></div></div><p className="doctor-boundary"><ShieldCheck /> Priority reasons support outreach coordination only.</p></section></div>}
      </section>
    );
  }
  if (user?.role === "DOCTOR") {
    const actionLabel: Record<CoordinationCase["status"], string> = {
      CREATED: "Accept hand-off",
      ACCEPTED: "Mark arrived",
      ARRIVED: "Set follow-up due",
      FOLLOW_UP_DUE: "Complete continuity",
      COMPLETED: "Completed",
    };
    return (
      <section className={`doctor-workspace section-${workspaceSection}`}>
        <div className="staff-heading">
          <div>
            <p className="kicker">DOCTOR REFERRAL WORKSPACE</p>
            <h1>Assigned care hand-offs.</h1>
            <p>
              Review why each referral reached{" "}
              {data.facility?.name || "your facility"}, acknowledge arrival, and
              close the continuity loop. Only referrals assigned to this facility are shown.
            </p>
          </div>
          <button
            className="dashboard-refresh"
            onClick={() => refresh()}
            disabled={loading}
          >
            <Activity size={16} />
            {loading ? "Refreshing…" : "Refresh worklist"}
          </button>
        </div>
        <div className="staff-context">
          <span>
            <Hospital size={16} />
            {data.facility?.name || "Assigned public facility"}
          </span>
          <span>
            <ShieldCheck size={16} /> Coordination support—not diagnosis
          </span>
          <span>
            <BadgeCheck size={16} /> Facility-scoped access
          </span>
        </div>
        <nav className="workspace-tabs" aria-label="Doctor workspace sections">
          <button className={workspaceSection === "referrals" ? "active" : ""} onClick={() => setWorkspaceSection("referrals")}><ClipboardPlus /> Referrals</button>
          <button className={workspaceSection === "scan" ? "active" : ""} onClick={() => setWorkspaceSection("scan")}><QrCode /> Scan pass</button>
        </nav>
        {message && (
          <div className="staff-message">
            {message}
            <button onClick={() => refresh()}>Retry</button>
          </div>
        )}
        <section className="handover-lookup" aria-label="Open referral pass">
          <QrCode />
          <div><b>Open a referral pass</b><small>Enter the code printed below the patient QR.</small></div>
          <input value={handoverCode} onChange={(event) => setHandoverCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void openHandoverCode()} placeholder="Referral code" aria-label="Referral pass code" />
          <div className="handover-actions">
            <label><Camera /> Scan QR<input type="file" accept="image/*" capture="environment" onChange={(event) => void scanHandoverImage(event.target.files?.[0])} /></label>
            <button onClick={openHandoverCode}>Verify and open</button>
          </div>
        </section>
        <div className="doctor-summary">
          <article>
            <span className="summary-icon teal">
              <ClipboardPlus />
            </span>
            <div>
              <b>
                {data.totals.unacknowledged ??
                  data.cases.filter((item) => item.status === "CREATED").length}
              </b>
              <small>Awaiting acknowledgment</small>
            </div>
          </article>
          <article>
            <span className="summary-icon red">
              <AlertTriangle />
            </span>
            <div>
              <b>{data.totals.urgent}</b>
              <small>Priority hand-offs</small>
            </div>
          </article>
          <article>
            <span className="summary-icon blue">
              <Hospital />
            </span>
            <div>
              <b>
                {data.totals.arrived ??
                  data.cases.filter((item) => item.status === "ARRIVED").length}
              </b>
              <small>Arrived for care</small>
            </div>
          </article>
          <article>
            <span className="summary-icon gold">
              <CalendarDays />
            </span>
            <div>
              <b>{data.totals.followups}</b>
              <small>Follow-ups due</small>
            </div>
          </article>
        </div>
        <div className="doctor-layout">
          <article className="doctor-worklist">
            <div className="panel-title">
              <div>
                <p className="eyebrow">MY FACILITY WORKLIST</p>
                <h2>Referrals requiring review</h2>
              </div>
              <div className="filter-row">
                {(["All", "Priority", "Follow-up"] as const).map((item) => (
                  <button
                    key={item}
                    className={filter === item ? "selected" : ""}
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            {loading ? (
              <div className="dashboard-loading">
                <Activity />
                <b>Loading assigned referrals…</b>
              </div>
            ) : visible.length === 0 ? (
              <div className="dashboard-empty">
                <BadgeCheck />
                <b>No referrals in this view.</b>
                <p>
                  New facility-assigned hand-offs will appear here
                  automatically.
                </p>
              </div>
            ) : (
              <div className="doctor-case-list">
                {visible.map((item) => (
                  <article
                    key={item.id}
                    className={
                      item.urgency !== "ROUTINE" ? "priority-case" : ""
                    }
                  >
                    <div className="doctor-case-id">
                      <span>{item.demoId}</span>
                      <i
                        className={`urgency-chip ${item.urgency === "ROUTINE" ? "routine" : "medium"}`}
                      >
                        {item.urgency}
                      </i>
                    </div>
                    <div>
                      <b>{item.careNeed}</b>
                      <small>
                        {String(item.service || "Required service").replaceAll(
                          "_",
                          " ",
                        )}{" "}
                        ·{" "}
                        {item.sourceMode === "ASHA_ASSISTED"
                          ? "ASHA-assisted"
                          : "Citizen"}
                      </small>
                      <p>
                        {item.rerouted ? "Rerouted into this facility · " : ""}
                        {item.facility}
                      </p>
                    </div>
                    <span
                      className={`pipeline-chip ${item.status.toLowerCase().replaceAll("_", "")}`}
                    >
                      {item.stage}
                    </span>
                    <div className="doctor-case-actions">
                      <button onClick={() => openCase(item)}>
                        Review hand-off
                      </button>
                      <button
                        className="primary"
                        onClick={() => advance(item)}
                        disabled={item.status === "COMPLETED"}
                      >
                        {actionLabel[item.status]}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
          <aside className="doctor-guidance">
            <p className="eyebrow">WORKSPACE PURPOSE</p>
            <h2>Close the hand-off safely</h2>
            <ol>
              <li>
                <b>Review</b>
                <span>
                  See the stated need, deterministic urgency and routing
                  explanation.
                </span>
              </li>
              <li>
                <b>Acknowledge</b>
                <span>
                  Confirm that the assigned facility received the referral.
                </span>
              </li>
              <li>
                <b>Continue</b>
                <span>
                  Record arrival, follow-up due and continuity completion.
                </span>
              </li>
            </ol>
            <p>
              <ShieldCheck size={16} /> No diagnosis or prescription is
              generated here.
            </p>
          </aside>
        </div>
        <div className="pipeline-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">FACILITY HAND-OFF PIPELINE</p>
              <h2>Where assigned referrals stand</h2>
            </div>
          </div>
          <div className="pipeline-steps">
            {[
              "CREATED",
              "ACCEPTED",
              "ARRIVED",
              "FOLLOW_UP_DUE",
              "COMPLETED",
            ].map((stage, index) => (
              <div key={stage}>
                <span>{index + 1}</span>
                <b>
                  {stage === "FOLLOW_UP_DUE"
                    ? "Follow-up due"
                    : stage.slice(0, 1) + stage.slice(1).toLowerCase()}
                </b>
                <small>
                  {data.cases.filter((item) => item.status === stage).length}{" "}
                  cases
                </small>
              </div>
            ))}
          </div>
        </div>
        {selectedDetail && (
          <div
            className="case-detail-backdrop"
            role="presentation"
            onClick={() => setSelectedDetail(null)}
          >
            <section
              className="case-detail-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Doctor referral review"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="case-detail-close"
                onClick={() => setSelectedDetail(null)}
              >
                ×
              </button>
              <p className="kicker">ASSIGNED CARE HAND-OFF</p>
              <h2>{selectedDetail.referral.demoId}</h2>
              <div className="case-detail-summary">
                <div>
                  <span>Patient</span>
                  <b>{selectedDetail.referral.patientLabel}</b>
                </div>
                <div>
                  <span>Urgency</span>
                  <b>{selectedDetail.referral.urgency}</b>
                </div>
                <div>
                  <span>Stated care need</span>
                  <b>
                    {selectedDetail.referral.careNeed ||
                      selectedDetail.referral.service?.replaceAll("_", " ")}
                  </b>
                </div>
                <div>
                  <span>Required service</span>
                  <b>{selectedDetail.referral.service?.replaceAll("_", " ")}</b>
                </div>
                <div>
                  <span>Assigned facility</span>
                  <b>{selectedDetail.referral.destinationFacility}</b>
                </div>
                <div>
                  <span>Status</span>
                  <b>{selectedDetail.referral.status?.replaceAll("_", " ")}</b>
                </div>
              </div>
              <article className="routing-rationale">
                <b>Why this referral reached your facility</b>
                <p>
                  {selectedDetail.referral.routingExplanation ||
                    "Matched to the required public service, care level and prototype availability state."}
                </p>
              </article>
              <div className="case-history">
                <h3>Continuity timeline</h3>
                {selectedDetail.history?.map((event: any) => (
                  <div key={event.id}>
                    <BadgeCheck />
                    <span>
                      <b>{event.toStatus.replaceAll("_", " ")}</b>
                      <small>
                        {event.action?.replaceAll("_", " ")} ·{" "}
                        {new Date(event.timestamp).toLocaleString()}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
              {selectedDetail.clinicalOutcomes?.length > 0 && (
                <div className="clinical-outcome-history">
                  <h3>Recorded visit outcomes</h3>
                  {selectedDetail.clinicalOutcomes.map((outcome: any) => (
                    <article key={outcome.id}>
                      <b>{outcome.disposition.replaceAll("_", " ")}</b>
                      <p>{outcome.instructionEnglish}</p>
                      <p lang="ta">{outcome.instructionTamil}</p>
                      <small>{outcome.actorName} · {new Date(outcome.timestamp).toLocaleString()}</small>
                    </article>
                  ))}
                </div>
              )}
              {["ARRIVED", "FOLLOW_UP_DUE"].includes(selectedDetail.referral.status) && (
                <section className="clinical-outcome-form">
                  <h3>Record visit outcome</h3>
                  <p>Enter coordination instructions only. Do not enter a diagnosis or prescription.</p>
                  <label>Disposition<select value={clinicalDisposition} onChange={(event) => setClinicalDisposition(event.target.value)}><option value="ASSESSED">Assessed</option><option value="REFERRED_ON">Referred onward</option><option value="FOLLOW_UP_REQUIRED">Follow-up required</option><option value="CARE_COMPLETED">Care completed</option></select></label>
                  <label>Patient instruction — English<textarea value={instructionEnglish} onChange={(event) => setInstructionEnglish(event.target.value)} maxLength={300} /></label>
                  <label>நோயாளி வழிமுறை — தமிழ்<textarea lang="ta" value={instructionTamil} onChange={(event) => setInstructionTamil(event.target.value)} maxLength={300} /></label>
                  <label>Follow-up date (optional)<input type="date" value={clinicalFollowUpDate} onChange={(event) => setClinicalFollowUpDate(event.target.value)} /></label>
                  <button onClick={saveClinicalOutcome}>Save and share with patient</button>
                </section>
              )}
              <p className="doctor-boundary">
                <ShieldCheck /> This panel supports referral coordination only.
                It does not diagnose, prescribe or replace clinical assessment.
              </p>
            </section>
          </div>
        )}
      </section>
    );
  }
  return (
    <section className={`staff-workspace section-${workspaceSection}`}>
      <div className="staff-heading">
        <div>
          <p className="kicker">FACILITY COORDINATION WORKSPACE</p>
          <h1>Today’s care pathways.</h1>
          <p>
            Manage authenticated referrals assigned to your facility, update
            handovers, and review time-limited service availability reports.
          </p>
        </div>
        {onBack ? (
          <button className="back" onClick={onBack}>
            <ChevronLeft /> Citizen journey
          </button>
        ) : (
          <button
            className="dashboard-refresh"
            onClick={() => refresh()}
            disabled={loading}
          >
            <Activity size={16} />
            {loading ? "Refreshing…" : "Refresh dashboard"}
          </button>
        )}
      </div>
      <div className="staff-context">
        <span>
          <Activity size={16} /> Authenticated facility workspace
        </span>
        <span>
          <BadgeCheck size={16} /> {data.cases.length} shared care records
        </span>
        <span>
          <ShieldCheck size={16} /> Facility-scoped access
        </span>
      </div>
      <nav className="workspace-tabs" aria-label="Facility workspace sections">
        <button className={workspaceSection === "referrals" ? "active" : ""} onClick={() => setWorkspaceSection("referrals")}><ClipboardPlus /> Referrals</button>
        <button className={workspaceSection === "capacity" ? "active" : ""} onClick={() => setWorkspaceSection("capacity")}><Hospital /> Capacity</button>
        <button className={workspaceSection === "insights" ? "active" : ""} onClick={() => setWorkspaceSection("insights")}><Activity /> Insights</button>
      </nav>
      {message && (
        <div className="staff-message">
          {message}
          <button onClick={() => refresh()}>Retry</button>
        </div>
      )}
      <section className="handover-lookup" aria-label="Open referral pass">
        <QrCode />
        <div><b>Open a referral pass</b><small>Scan the patient QR or enter its protected referral code.</small></div>
        <input value={handoverCode} onChange={(event) => setHandoverCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void openHandoverCode()} placeholder="Referral code" aria-label="Referral pass code" />
        <div className="handover-actions">
          <label><Camera /> Scan QR<input type="file" accept="image/*" capture="environment" onChange={(event) => void scanHandoverImage(event.target.files?.[0])} /></label>
          <button onClick={openHandoverCode}>Verify and open</button>
        </div>
      </section>
      <div className="staff-summary">
        <article>
          <span className="summary-icon teal">
            <ClipboardPlus />
          </span>
          <div>
            <b>{data.totals.incoming}</b>
            <small>Incoming requests</small>
          </div>
          <em>Shared referral queue</em>
        </article>
        <article>
          <span className="summary-icon red">
            <AlertTriangle />
          </span>
          <div>
            <b>{data.totals.urgent}</b>
            <small>Urgent / high-risk</small>
          </div>
          <em>Needs attention</em>
        </article>
        <article>
          <span className="summary-icon gold">
            <Hospital />
          </span>
          <div>
            <b>{data.totals.pending}</b>
            <small>Pending referrals</small>
          </div>
          <em>Awaiting hand-off</em>
        </article>
        <article>
          <span className="summary-icon blue">
            <CalendarDays />
          </span>
          <div>
            <b>{data.totals.followups}</b>
            <small>Follow-ups due</small>
          </div>
          <em>Today + tomorrow</em>
        </article>
        <article>
          <span className="summary-icon gold">
            <Route />
          </span>
          <div>
            <b>{data.totals.rerouted}</b>
            <small>Rerouted cases</small>
          </div>
          <em>Stored decisions</em>
        </article>
        <article>
          <span className="summary-icon red">
            <CircleAlert />
          </span>
          <div>
            <b>{data.totals.serviceGaps}</b>
            <small>Service-gap events</small>
          </div>
          <em>Access feedback</em>
        </article>
      </div>
      <article className="capacity-control">
        <div>
          <p className="eyebrow">TIME-LIMITED STATUS REPORT</p>
          <h2>Confirm current service availability</h2>
          <small>
            Staff-reported status expires after four hours. It is not an HMIS
            or government live-data claim.
          </small>
        </div>
        <select
          value={capacityFacilityId}
          onChange={(event) => setCapacityFacilityId(event.target.value)}
        >
          {capacityFacilities.map((facility) => (
            <option key={facility.id} value={facility.id}>
              {facility.name}
            </option>
          ))}
        </select>
        <select
          value={capacityService}
          onChange={(event) =>
            setCapacityService(event.target.value as Service)
          }
        >
          {(
            [
              "PRIMARY_CARE",
              "CHILD_HEALTH",
              "MATERNITY",
              "EMERGENCY",
            ] as Service[]
          ).map((service) => (
            <option key={service} value={service}>
              {service.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <div>
          <button onClick={() => updateCapacity("AVAILABLE")}>Available</button>
          <button onClick={() => updateCapacity("LIMITED")}>Limited</button>
          <button onClick={() => updateCapacity("UNAVAILABLE")}>
            Unavailable
          </button>
        </div>
      </article>
      {user?.role==="FACILITY_ADMIN"&&facilityReview&&<article className="facility-review-panel">
        <div className="panel-title"><div><p className="eyebrow">FACILITY DATA REVIEW</p><h2>Official records awaiting verification</h2></div><span className="pipeline-note">{facilityReview.summary.routeable} routeable · {facilityReview.summary.pending} quarantined</span></div>
        <p>{facilityReview.policy}</p>
        <div className="facility-review-list">{facilityReview.records.map(record=><div key={record.sourceRowId} className={record.routeable?"verified":"pending"}><span>{record.routeable?<BadgeCheck/>:<CircleAlert/>}</span><div><b>{record.name}</b><small>{record.careType} · {record.address}</small><small>{record.routeable?`Routeable · coordinate confidence ${record.coordinateConfidence}`:`Blocked: ${record.missing.join(", ").replaceAll("_"," ")}`}</small></div><a href={record.sourceUrl} target="_blank" rel="noreferrer">Official source</a></div>)}</div>
      </article>}
      <div className="staff-grid">
        <article className="active-cases">
          <div className="panel-title">
            <div>
              <p className="eyebrow">ACTIVE CARE COORDINATION</p>
              <h2>Cases that need movement</h2>
            </div>
            <div className="filter-row">
              {(["All", "Priority", "Follow-up"] as const).map((item) => (
                <button
                  key={item}
                  className={filter === item ? "selected" : ""}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="case-table">
            <div className="case-head">
              <span>Patient & confirmed need</span>
              <span>Pathway</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {loading ? (
              <div className="dashboard-loading">
                <Activity />
                <b>Loading coordination data…</b>
              </div>
            ) : visible.length === 0 ? (
              <div className="dashboard-empty">
                <BadgeCheck />
                <b>No cases in this view.</b>
                <p>
                  New referrals and follow-ups will appear here automatically.
                </p>
              </div>
            ) : (
              visible.map((item) => (
                <div className="case-row" key={item.id}>
                  <div>
                    <b>{item.demoId}</b>
                    <span>{item.careNeed}</span>
                    <i
                      className={`urgency-chip ${item.urgency === "ROUTINE" ? "routine" : item.urgency === "EMERGENCY" ? "high" : "medium"}`}
                    >
                      {item.urgency === "ROUTINE" ? "ROUTINE" : "PRIORITY"}
                    </i>
                  </div>
                  <div>
                    <small>Recommended facility</small>
                    <b>{item.facility}</b>
                    <small>
                      {item.sourceMode === "CITIZEN"
                        ? "Citizen"
                        : "ASHA-assisted"}
                      {item.rerouted ? " · Rerouted" : ""}
                      {item.rerouteStatus
                        ? ` · ${item.rerouteStatus.replaceAll("_", " ")}`
                        : ""}
                    </small>
                  </div>
                  <div>
                    <span
                      className={`pipeline-chip ${item.status.toLowerCase().replace("_", "")}`}
                    >
                      {item.stage}
                    </span>
                  </div>
                  <div className="case-buttons">
                    <button onClick={() => openCase(item)}>Review</button>
                    <IconButton
                      Icon={ArrowRight}
                      className="case-action"
                      onClick={() => advance(item)}
                      disabled={item.status === "COMPLETED"}
                    >
                      {item.status === "COMPLETED" ? "Completed" : "Advance"}
                    </IconButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
        {alert && (
          <aside className="capacity-alert">
            <div className="alert-heading">
              <span>
                <CircleAlert />
              </span>
              <div>
                <p className="eyebrow">CAPACITY ALERT</p>
                <h2>{alert.title}</h2>
              </div>
            </div>
            <p>
              <b>
                {alert.affected.length}{" "}
                {alert.service?.replaceAll("_", " ").toLowerCase() || "care"}{" "}
                request{alert.affected.length === 1 ? "" : "s"}
              </b>{" "}
              are affected by the current time-limited capacity report.
            </p>
            <div className="affected-list">
              {alert.affected.map((item) => (
                <span key={item.demoId}>
                  {item.demoId} · {item.careNeed}
                </span>
              ))}
            </div>
            <button onClick={() => setAlternatives(!alternatives)}>
              {alternatives
                ? "Hide alternatives"
                : "View alternative facilities"}{" "}
              <ArrowRight size={16} />
            </button>
            {alternatives && (
              <div className="alternatives">
                <b>Suggested alternatives</b>
                {alert.alternatives.map((item) => (
                  <span key={item.name}>
                    {item.name} · {item.distanceKm} km · {item.hours}
                  </span>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
      {selectedDetail && (
        <div
          className="case-detail-backdrop"
          role="presentation"
          onClick={() => setSelectedDetail(null)}
        >
          <section
            className="case-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Referral details"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="case-detail-close"
              onClick={() => setSelectedDetail(null)}
            >
              ×
            </button>
            <p className="kicker">ASSIGNED REFERRAL</p>
            <h2>{selectedDetail.referral.demoId}</h2>
            <div className="case-detail-summary">
              <div>
                <span>Patient</span>
                <b>{selectedDetail.referral.patientLabel}</b>
              </div>
              <div>
                <span>Urgency</span>
                <b>{selectedDetail.referral.urgency}</b>
              </div>
              <div>
                <span>Care need</span>
                <b>
                  {selectedDetail.referral.careNeed ||
                    selectedDetail.referral.service?.replaceAll("_", " ")}
                </b>
              </div>
              <div>
                <span>Required service</span>
                <b>{selectedDetail.referral.service?.replaceAll("_", " ")}</b>
              </div>
              <div>
                <span>Assigned facility</span>
                <b>{selectedDetail.referral.destinationFacility}</b>
              </div>
              <div>
                <span>Status</span>
                <b>{selectedDetail.referral.status?.replaceAll("_", " ")}</b>
              </div>
            </div>
            <article className="routing-rationale">
              <b>Why this pathway</b>
              <p>
                {selectedDetail.referral.routingExplanation ||
                  "Matched to the required public service and the prototype availability state."}
              </p>
            </article>
            <div className="case-history">
              <h3>Referral continuity</h3>
              {selectedDetail.history?.map((event: any) => (
                <div key={event.id}>
                  <BadgeCheck />
                  <span>
                    <b>{event.toStatus.replaceAll("_", " ")}</b>
                    <small>
                      {event.action?.replaceAll("_", " ")} ·{" "}
                      {new Date(event.timestamp).toLocaleString()}
                    </small>
                  </span>
                </div>
              ))}
            </div>
            <p className="doctor-boundary">
              <ShieldCheck /> This workspace coordinates an assigned referral.
              It does not diagnose or prescribe.
            </p>
          </section>
        </div>
      )}
      <div className="pipeline-panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">REFERRAL PIPELINE</p>
            <h2>Where each hand-off stands</h2>
          </div>
          <span className="pipeline-note">
            Advance a case to update this shared local record
          </span>
        </div>
        <div className="pipeline-steps">
          {["CREATED", "ACCEPTED", "ARRIVED", "FOLLOW_UP_DUE", "COMPLETED"].map(
            (stage, index) => (
              <div key={stage}>
                <span>{index + 1}</span>
                <b>
                  {stage === "FOLLOW_UP_DUE"
                    ? "Follow-up due"
                    : stage.slice(0, 1) + stage.slice(1).toLowerCase()}
                </b>
                <small>
                  {data.cases.filter((item) => item.status === stage).length}{" "}
                  cases
                </small>
              </div>
            ),
          )}
        </div>
      </div>
      <div className="staff-lower">
        <article className="demand-overview">
          <div className="panel-title">
            <div>
              <p className="eyebrow">SERVICE-DEMAND OVERVIEW</p>
              <h2>What people are seeking</h2>
            </div>
            <small>Shared local records</small>
          </div>
          {data.demand.map((item, index) => (
            <div className="demand-row" key={item.service}>
              <span>{item.service}</span>
              <div>
                <i
                  style={{
                    width: `${Math.max(12, Math.min(100, item.count * 15))}%`,
                    background: [
                      "#0f766e",
                      "#d39a1a",
                      "#c15a36",
                      "#47769b",
                      "#6b7280",
                    ][index],
                  }}
                />
              </div>
              <b>{item.count}</b>
            </div>
          ))}
          <p className="small">
            Signals support service planning; they are not clinical
            prevalence data.
          </p>
        </article>
        <article className="gap-overview">
          <p className="eyebrow">RECENT ACCESS GAPS</p>
          <h2>Where care access is failing</h2>
          {data.recentGaps.length === 0 ? (
            <p className="small">No service-gap events recorded yet.</p>
          ) : (
            data.recentGaps.map((item) => (
              <div
                className="gap-row"
                key={`${item.service}-${item.facility}-${item.reason}`}
              >
                <b>{item.service}</b>
                <span>{item.facility}</span>
                <span>{item.reason}</span>
                <em>{item.count}</em>
              </div>
            ))
          )}
        </article>
        <article className="recent-activity">
          <p className="eyebrow">RECENT REFERRAL ACTIVITY</p>
          <h2>Continuity events</h2>
          {data.activity.map((item, index) => (
            <div className="activity-row" key={`${item.demoId}-${index}`}>
              <span
                className={`activity-dot ${index % 3 === 0 ? "green" : index % 3 === 1 ? "amber" : "blue"}`}
              />
              <p>
                <b>
                  {item.demoId} · {item.stage}
                </b>
                <small>
                  {item.careNeed} → {item.facility}
                </small>
              </p>
            </div>
          ))}
        </article>
      </div>
    </section>
  );
}

function LegacyApp() {
  const [language, setLanguage] = useState<"en" | "ta">("en");
  const [view, setView] = useState<View>("intake");
  const [message, setMessage] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selected, setSelected] = useState<Facility | null>(null);
  const [patientLabel, setPatientLabel] = useState("Demo patient");
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const t = useMemo(
    () =>
      language === "ta"
        ? {
            home: "முகப்பு",
            assistant: "உதவி முறை",
            title: "சரியான பராமரிப்பு. சரியான நேரத்தில்.",
            intro:
              "நாங்கள் உங்கள் தேவையைப் புரிந்து கொண்டு அருகிலுள்ள சரியான பொது சுகாதார சேவைக்குச் செலுத்துகிறோம்.",
            prompt: "என்ன உதவி தேவை?",
            next: "பாதுகாப்பாக தொடரவும்",
            staff: "பணியாளர் பார்வை",
          }
        : {
            home: "Care Compass",
            assistant: "ASHA-assisted mode",
            title: "Right care. Right pathway.",
            intro:
              "Tell us what you need. We connect you to an appropriate public health service—clearly and safely.",
            prompt: "What do you need help with?",
            next: "Continue safely",
            staff: "Staff view",
          },
    [language],
  );
  const step =
    view === "intake"
      ? 1
      : view === "assessment"
        ? 2
        : view === "facilities"
          ? 3
          : view === "referral"
            ? 4
            : 5;
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener("online", on);
    addEventListener("offline", off);
    return () => {
      removeEventListener("online", on);
      removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    if (!online) return;
    const queued = JSON.parse(localStorage.getItem(queueKey) || "[]");
    if (!queued.length) return;
    Promise.all(
      queued.map((item: unknown) =>
        request("/api/referrals", {
          method: "POST",
          body: JSON.stringify(item),
        }),
      ),
    )
      .then(() => {
        localStorage.removeItem(queueKey);
        setNotice(
          "Offline referral synced. Your continuity record is up to date.",
        );
      })
      .catch(() => undefined);
  }, [online]);
  async function triage() {
    if (!message.trim())
      return setNotice("Please describe the health need first.");
    const local = assessNeed(message);
    setAssessment(local);
    setView("assessment");
    try {
      const result = await request("/api/triage", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setAssessment(result.assessment);
    } catch {
      setNotice(
        "Offline-safe assessment is active. You can continue without internet.",
      );
    }
  }
  async function findFacilities() {
    if (!assessment) return;
    setFacilities(rankFacilities(localFacilities, assessment.service));
    setView("facilities");
    try {
      const result = await request(
        `/api/facilities?service=${assessment.service}`,
      );
      setFacilities(result.facilities);
    } catch {
      setNotice(
        "Showing cached prototype facility data. Please verify before travel.",
      );
    }
  }
  async function createReferral() {
    if (!selected || !assessment) return;
    const body = {
      patientLabel,
      sourceFacility: "ASHA-assisted intake",
      destinationFacility: selected.name,
      service: assessment.service,
      urgency: assessment.urgency,
      nextAction: assessment.nextAction,
      careNeed: assessment.symptoms.join(", "),
    };
    try {
      const result = await request("/api/referrals", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setNotice(
        `Referral ${result.referral.demoId} created. Follow-up is scheduled for tomorrow.`,
      );
    } catch {
      queueReferral(body);
      setNotice(
        "No signal? Referral has been safely saved on this device and will sync later.",
      );
    }
    setView("followup");
  }
  function openDashboard() {
    setView("dashboard");
  }
  function startVoice() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech)
      return setNotice(
        "Voice input is unavailable in this browser. Please type your need.",
      );
    const recognition = new Speech();
    recognition.lang = language === "ta" ? "ta-IN" : "en-IN";
    recognition.onresult = (event: any) =>
      setMessage(event.results[0][0].transcript);
    recognition.start();
  }
  function emergency() {
    setMessage("I need emergency help: chest pain");
    setAssessment(assessNeed("I need emergency help: chest pain"));
    setView("assessment");
  }
  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <div className="brand-mark">
            <HeartPulse />
          </div>
          <div>
            <b>RuralCare</b>
            <span>CONNECT</span>
          </div>
        </div>
        <nav aria-label="Main navigation">
          <button
            className={view !== "dashboard" ? "active" : ""}
            onClick={() => setView("intake")}
          >
            <Sparkles /> {t.home}
          </button>
          <button onClick={openDashboard}>
            <UsersRound /> {t.staff}
          </button>
        </nav>
        <div className="aside-card">
          <div className="signal">
            <Wifi size={16} /> Offline-first ready
          </div>
          <p>Saved care journeys continue even when the signal does not.</p>
          <span>Synthetic SIH prototype</span>
        </div>
        <div className="aside-bottom">
          <ShieldCheck size={18} />
          <p>
            <b>Safety bounded</b>
            <br />
            Not a diagnosis tool
          </p>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="mobile-brand">
            <HeartPulse />
            <b>RuralCare</b>
          </div>
          <div className="mode-pill">
            <UsersRound size={15} />
            {t.assistant}
          </div>
          <div className="top-actions">
            <button
              className="language"
              onClick={() => setLanguage(language === "en" ? "ta" : "en")}
            >
              <Languages size={17} />
              {language === "en" ? "தமிழ்" : "English"}
            </button>
            <button
              className={online ? "connection online" : "connection offline"}
            >
              {online ? <Wifi size={16} /> : <CloudOff size={16} />}
              {online ? "Connected" : "Offline"}
            </button>
          </div>
        </header>
        <div className="prototype-banner">
          <BadgeCheck size={17} />
          <span>Public-health navigation prototype</span>
          <i>•</i>
          <span>Synthetic demo data</span>
          <i>•</i>
          <span>Always verify availability before travel</span>
        </div>
        {view !== "dashboard" && (
          <div className="journey">
            <span>YOUR CARE JOURNEY</span>
            {["Share", "Understand", "Match", "Refer", "Follow up"].map(
              (name, i) => (
                <div
                  className={
                    i + 1 <= step ? "journey-step done" : "journey-step"
                  }
                  key={name}
                >
                  <b>{i + 1}</b>
                  <small>{name}</small>
                </div>
              ),
            )}
          </div>
        )}
        {notice && (
          <div className="toast">
            <BadgeCheck size={18} />
            <span>{notice}</span>
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
        {view === "intake" && (
          <section className="home-grid care-conversation">
            <div className="welcome-panel">
              <p className="kicker">CARE COMPASS · RURAL TAMIL NADU</p>
              <h1>{t.title}</h1>
              <p className="lead">{t.intro}</p>
              <div className="input-panel">
                <label>
                  {t.prompt}
                  <span>Local language welcome</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    language === "ta"
                      ? "உதாரணம்: குழந்தைக்கு இரண்டு நாட்களாக காய்ச்சல் உள்ளது"
                      : "Example: My child has fever and cough for two days"
                  }
                />
                <div className="input-actions">
                  <IconButton Icon={Mic} className="ghost" onClick={startVoice}>
                    Speak instead
                  </IconButton>
                  <IconButton Icon={ArrowRight} onClick={triage}>
                    {t.next}
                  </IconButton>
                </div>
              </div>
              <div className="safety-strip">
                <ShieldCheck />
                <p>
                  <b>Clear, not clinical.</b> We help you reach public care; we
                  do not diagnose or prescribe.
                </p>
              </div>
            </div>
            <div className="right-rail">
              <div className="quick-panel">
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">GUIDED START</span>
                    <h2>Common needs</h2>
                  </div>
                  <Sparkles className="accent" />
                </div>
                {scenarios.map(({ label, tamil, message: scenario, Icon }) => (
                  <button
                    className="scenario"
                    key={label}
                    onClick={() => setMessage(scenario)}
                  >
                    <span className="scenario-icon">
                      <Icon size={20} />
                    </span>
                    <span>
                      <b>{label}</b>
                      <small>{tamil}</small>
                    </span>
                    <ArrowRight size={17} />
                  </button>
                ))}
              </div>
              <button className="emergency-button" onClick={emergency}>
                <AlertTriangle />
                <span>
                  <b>Emergency? Act now</b>
                  <small>Immediate human-care guidance</small>
                </span>
                <ArrowRight />
              </button>
              <div className="signal-card">
                <MapPin />
                <div>
                  <b>District demo readiness</b>
                  <span>4 public facilities · 7 care services</span>
                </div>
                <BadgeCheck />
              </div>
            </div>
          </section>
        )}
        {view === "assessment" && assessment && (
          <section className="flow-card assessment-layout">
            <button className="back" onClick={() => setView("intake")}>
              <ChevronLeft /> Back to request
            </button>
            <div className="flow-title">
              <p className="kicker">WE LISTENED. PLEASE CONFIRM.</p>
              <h1>
                {assessment.urgency === "EMERGENCY"
                  ? "Act immediately"
                  : "Your care pathway"}
              </h1>
              <p>{assessment.explanation}</p>
            </div>
            <div className={`urgency-card ${assessment.urgency.toLowerCase()}`}>
              <div>
                {assessment.urgency === "EMERGENCY" ? (
                  <AlertTriangle />
                ) : (
                  <ShieldCheck />
                )}
              </div>
              <section>
                <span>SAFETY GUIDANCE</span>
                <h2>{assessment.urgency}</h2>
                <p>{assessment.nextAction}</p>
              </section>
            </div>
            <div className="understood">
              <div>
                <span>Suggested public service</span>
                <b>{assessment.service.replaceAll("_", " ")}</b>
              </div>
              <div>
                <span>Language</span>
                <b>
                  {assessment.language === "ta" ? "Tamil" : assessment.language}
                </b>
              </div>
              <div>
                <span>Need signals</span>
                <b>{assessment.symptoms.join(", ")}</b>
              </div>
            </div>
            {assessment.urgency === "EMERGENCY" ? (
              <div className="emergency-actions">
                <IconButton
                  Icon={PhoneCall}
                  onClick={() =>
                    setNotice("Demo emergency SMS alert prepared.")
                  }
                >
                  Send demo emergency alert
                </IconButton>
                <p>
                  This prototype deliberately does not delay emergency care with
                  chat or matching.
                </p>
              </div>
            ) : (
              <div className="flow-actions">
                <IconButton
                  Icon={ChevronLeft}
                  className="ghost"
                  onClick={() => setView("intake")}
                >
                  Edit request
                </IconButton>
                <IconButton Icon={Navigation} onClick={findFacilities}>
                  Find suitable public care
                </IconButton>
              </div>
            )}
          </section>
        )}
        {view === "facilities" && assessment && (
          <section className="facilities-page">
            <div className="section-heading">
              <div>
                <p className="kicker">CARE MATCHING · NOT JUST NEAREST</p>
                <h1>Public services ready for your need</h1>
                <p>
                  We prioritize required service, demo availability, and travel
                  distance.
                </p>
              </div>
              <div className="matching-chip">
                <BadgeCheck /> Safety-checked pathway
              </div>
            </div>
            <div className="facility-list">
              {facilities.map((facility, index) => (
                <article className="facility-card" key={facility.id}>
                  <div className="rank">0{index + 1}</div>
                  <div className="facility-main">
                    <div className="facility-top">
                      <span className="level-tag">
                        {facility.type.replaceAll("_", " ")}
                      </span>
                      <span className="live-dot">● Available in demo</span>
                    </div>
                    <h2>{facility.name}</h2>
                    <p>
                      <MapPin size={16} />
                      {facility.address} · <b>{facility.distanceKm} km away</b>
                    </p>
                    <div className="service-tags">
                      {facility.services.slice(0, 3).map((service) => (
                        <span key={service}>
                          {service.replaceAll("_", " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="facility-side">
                    <p>
                      <b>{facility.hours}</b>
                      <small>Demo service hours</small>
                    </p>
                    <IconButton
                      Icon={ArrowRight}
                      onClick={() => {
                        setSelected(facility);
                        setView("referral");
                      }}
                    >
                      Choose pathway
                    </IconButton>
                  </div>
                </article>
              ))}
            </div>
            <button
              className="back text-button"
              onClick={() => setView("assessment")}
            >
              <ChevronLeft /> Review assessment
            </button>
          </section>
        )}
        {view === "referral" && selected && assessment && (
          <section className="referral-page">
            <div className="referral-card">
              <div className="referral-header">
                <div className="brand-mark">
                  <ClipboardPlus />
                </div>
                <div>
                  <span>RURALCARE CONNECT</span>
                  <h1>Continuity pass</h1>
                </div>
                <BadgeCheck />
              </div>
              <p className="muted">
                A simple hand-off so the next public facility understands the
                care need without making the patient start over.
              </p>
              <label>
                Patient label <small>Demo only; no real personal data</small>
                <input
                  value={patientLabel}
                  onChange={(e) => setPatientLabel(e.target.value)}
                  maxLength={40}
                />
              </label>
              <div className="pass-row">
                <span>CARE NEED</span>
                <b>{assessment.service.replaceAll("_", " ")}</b>
              </div>
              <div className="pass-row">
                <span>ROUTED TO</span>
                <b>{selected.name}</b>
              </div>
              <div className="pass-row">
                <span>NEXT ACTION</span>
                <b>{assessment.nextAction}</b>
              </div>
              <div className="referral-foot">
                <ShieldCheck />
                <span>Structured, shareable context · Prototype only</span>
              </div>
            </div>
            <div className="referral-copy">
              <p className="kicker">REFERRAL CONTINUITY</p>
              <h1>One care story, carried forward.</h1>
              <p>
                The novelty is not merely AI triage. It is a safety-bounded
                hand-off from citizen need to a suitable public service, with a
                follow-up loop.
              </p>
              <div className="mini-points">
                <span>
                  <BadgeCheck /> Service-aware referral
                </span>
                <span>
                  <CloudOff /> Stores safely offline
                </span>
                <span>
                  <UsersRound /> Staff coordination view
                </span>
              </div>
              <div className="flow-actions">
                <IconButton
                  Icon={ChevronLeft}
                  className="ghost"
                  onClick={() => setView("facilities")}
                >
                  Choose another facility
                </IconButton>
                <IconButton Icon={ClipboardPlus} onClick={createReferral}>
                  Create continuity pass
                </IconButton>
              </div>
            </div>
          </section>
        )}
        {view === "followup" && (
          <section className="followup-page">
            <div className="success-mark">
              <BadgeCheck />
            </div>
            <p className="kicker">CARE JOURNEY SAVED</p>
            <h1>Your next step is clear.</h1>
            <p>
              We have created—or safely queued—your prototype referral and
              follow-up plan.
            </p>
            <div className="timeline">
              <div>
                <span>NOW</span>
                <section>
                  <b>Referral continuity pass</b>
                  <p>
                    Care context is ready for the receiving public facility.
                  </p>
                </section>
              </div>
              <div>
                <span>TOMORROW</span>
                <section>
                  <b>Follow-up reminder</b>
                  <p>
                    Confirm whether the facility was reached and next care
                    started.
                  </p>
                </section>
              </div>
              <div>
                <span>STAFF</span>
                <section>
                  <b>Demand signal updates</b>
                  <p>
                    Non-identifying referral demand improves coordination
                    visibility.
                  </p>
                </section>
              </div>
            </div>
            <div className="flow-actions">
              <IconButton
                Icon={UsersRound}
                className="ghost"
                onClick={openDashboard}
              >
                View staff coordination
              </IconButton>
              <IconButton
                Icon={Sparkles}
                onClick={() => {
                  setView("intake");
                  setMessage("");
                  setAssessment(null);
                  setSelected(null);
                }}
              >
                Start another journey
              </IconButton>
            </div>
          </section>
        )}
        {view === "dashboard" && (
          <LiveStaffDashboard onBack={() => setView("intake")} />
        )}
      </main>
    </div>
  );
}
type PathView =
  | "home"
  | "input"
  | "understanding"
  | "urgency"
  | "service"
  | "comparison"
  | "recommendation"
  | "reroute"
  | "referral"
  | "followup"
  | "myreferrals"
  | "dashboard";
type FacilityCandidate = Facility & {
  ranking?: number;
  reasons?: string[];
  travelMinutes?: number;
  serviceCapacity?: {
    status: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
    estimatedWaitMinutes: number;
    availableBeds: number;
    note: string;
  };
  rerouteReason?: string | null;
  rankingReasons?: string[];
  availability?: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
  availabilitySource?: "SIMULATED_FOR_PROTOTYPE";
  recommendationStatus?:
    "RECOMMENDED" | "ALTERNATIVE" | "UNAVAILABLE_BUT_RELEVANT" | "NOT_SUITABLE";
};
type AssistantAction =
  | "CONTINUE_PATHWAY"
  | "REVIEW_SAFETY"
  | "COMPARE_FACILITIES"
  | "CREATE_CONTINUITY_PASS"
  | "CHECK_FOLLOW_UP"
  | "NONE";
type AssistantMessage = {
  role: "assistant" | "user";
  text: string;
  provider?: "OPENAI" | "LOCAL_GUIDE";
};
function NavigationAssistant({
  language,
  stage,
  hasRecommendation,
  rerouted,
  onAction,
}: {
  language: "en" | "ta";
  stage: Exclude<PathView, "dashboard">;
  hasRecommendation: boolean;
  rerouted: boolean;
  onAction: (action: AssistantAction) => void;
}) {
  const [open, setOpen] = useState(false),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [action, setAction] = useState<AssistantAction>("NONE"),
    [messages, setMessages] = useState<AssistantMessage[]>([
      {
        role: "assistant",
        text: "I can explain this public-care pathway. I cannot diagnose or prescribe.",
        provider: "LOCAL_GUIDE",
      },
    ]);
  const fallback =
    language === "ta"
      ? "இந்த படியில் என்ன நடக்கிறது என்பதை விளக்க முடியும். மருத்துவ பாதுகாப்பு முடிவுகள் Safety படியில் உள்ள விதிகளால் மட்டுமே எடுக்கப்படும்."
      : "I can explain what happens at this step. Medical safety decisions are made only by the deterministic rules in the Safety step.";
  async function ask(text = input) {
    const question = text.trim();
    if (!question || busy) return;
    setMessages((items) => [...items, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const result = await request("/api/navigation-assistant", {
        method: "POST",
        body: JSON.stringify({
          message: question,
          language,
          stage,
          hasRecommendation,
          rerouted,
        }),
      });
      setMessages((items) => [
        ...items,
        { role: "assistant", text: result.reply, provider: result.provider },
      ]);
      setAction(result.suggestedAction || "NONE");
    } catch {
      setMessages((items) => [
        ...items,
        { role: "assistant", text: fallback, provider: "LOCAL_GUIDE" },
      ]);
      setAction(stage === "urgency" ? "REVIEW_SAFETY" : "CONTINUE_PATHWAY");
    } finally {
      setBusy(false);
    }
  }
  const actionLabels: Record<Exclude<AssistantAction, "NONE">, string> = {
    CONTINUE_PATHWAY: "Continue care pathway",
    REVIEW_SAFETY: "Open safety step",
    COMPARE_FACILITIES: "Review facility comparison",
    CREATE_CONTINUITY_PASS: "Open continuity pass",
    CHECK_FOLLOW_UP: "Check follow-up",
  };
  return (
    <>
      <button
        className="assistant-launcher"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close RuralCare guide" : "Open RuralCare guide"}
      >
        {open ? <X /> : <MessageCircle />}
        <span>Care guide</span>
      </button>
      {open && (
        <section
          className="assistant-panel"
          aria-label="RuralCare navigation guide"
        >
          <header>
            <div>
              <span>
                <MessageCircle />
              </span>
              <div>
                <b>RuralCare guide</b>
                <small>Navigation only · not diagnosis</small>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close guide">
              <X />
            </button>
          </header>
          <div className="assistant-messages">
            {messages.map((item, index) => (
              <article key={`${item.role}-${index}`} className={item.role}>
                <p>{item.text}</p>
                {item.role === "assistant" && (
                  <small>
                    {item.provider === "OPENAI"
                      ? "AI-assisted explanation"
                      : "Offline-safe guide"}
                  </small>
                )}
              </article>
            ))}
            {busy && (
              <article className="assistant">
                <p>Preparing a bounded pathway explanation…</p>
              </article>
            )}
          </div>
          <div className="assistant-prompts">
            <button
              onClick={() =>
                ask(
                  language === "ta"
                    ? "அடுத்து என்ன நடக்கும்?"
                    : "What happens next?",
                )
              }
            >
              What next?
            </button>
            <button
              onClick={() =>
                ask(
                  language === "ta"
                    ? "இந்த நிலையம் ஏன்?"
                    : "Why this facility?",
                )
              }
            >
              Why this facility?
            </button>
            <button
              onClick={() =>
                ask(
                  language === "ta" ? "இது நோயறிதலா?" : "Is this a diagnosis?",
                )
              }
            >
              Safety boundary
            </button>
          </div>
          {action !== "NONE" && (
            <button
              className="assistant-action"
              onClick={() => {
                onAction(action);
                setOpen(false);
              }}
            >
              {actionLabels[action]}
            </button>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask();
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={400}
              placeholder={
                language === "ta"
                  ? "வழியைப் பற்றி கேளுங்கள்"
                  : "Ask about this pathway"
              }
            />
            <button
              disabled={busy || input.trim().length < 2}
              aria-label="Send question"
            >
              <Send />
            </button>
          </form>
          <footer>
            <ShieldCheck /> Urgency and matching remain deterministic.
          </footer>
        </section>
      )}
    </>
  );
}
function AuthenticatedApp() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <main className="auth-loading">
        <HeartPulse />
        <b>Restoring secure session…</b>
      </main>
    );
  if (!user)
    return (
      <Suspense
        fallback={
          <main className="auth-loading">
            <HeartPulse />
            <b>Opening secure sign in…</b>
          </main>
        }
      >
        <LoginScreen />
      </Suspense>
    );
  return <App user={user} />;
}

function App({ user }: { user: AuthUser }) {
  const { logout } = useAuth();
  const isClinical = ["DOCTOR", "FACILITY_ADMIN", "STAFF"].includes(user.role),
    isPatient = user.role === "CITIZEN";
  const [view, setView] = useState<PathView>(
    isClinical ? "dashboard" : isPatient ? "home" : "input",
  );
  const [language, setLanguage] = useState<"en" | "ta">("en");
  const [sourceMode, setSourceMode] = useState<"CITIZEN" | "ASHA_ASSISTED">(
    user.role === "ASHA" ? "ASHA_ASSISTED" : "CITIZEN",
  );
  const [syncState, setSyncState] = useState<SyncState>("SYNCED");
  const [workflowLoaded, setWorkflowLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [structuredIntake, setStructuredIntake] =
    useState<StructuredIntake | null>(null);
  const [adaptiveQuestion, setAdaptiveQuestion] =
    useState<SafetyQuestion | null>(null);
  const [askedQuestionIds, setAskedQuestionIds] = useState<string[]>([]);
  const [extractionMetadata, setExtractionMetadata] = useState<Record<
    string,
    any
  > | null>(null);
  const [candidates, setCandidates] = useState<FacilityCandidate[]>([]);
  const [recommended, setRecommended] = useState<FacilityCandidate | null>(
    null,
  );
  const [routeDecision, setRouteDecision] = useState<RouteDecision | null>(
    null,
  );
  const [followUpAnswers, setFollowUpAnswers] = useState<
    Record<string, "YES" | "NO">
  >({});
  const [selected, setSelected] = useState<FacilityCandidate | null>(null);
  const [currentReferral, setCurrentReferral] = useState<Record<
    string,
    any
  > | null>(null);
  const [followUpNote, setFollowUpNote] = useState("");
  const [voiceState, setVoiceState] = useState<
    | "IDLE"
    | "RECORDING"
    | "TRANSCRIBING"
    | "TRANSCRIPT_READY"
    | "CONFIRMED"
    | "ERROR"
  >("IDLE");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [referralQr, setReferralQr] = useState("");
  const [voiceTranscriptSource, setVoiceTranscriptSource] = useState<
    "BROWSER_SPEECH" | "CLOUD_AUDIO" | null
  >(null);
  const [voiceConfidence, setVoiceConfidence] = useState<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const voiceBaseMessageRef = useRef("");
  const [patientLabel, setPatientLabel] = useState(user.name || "Patient");
  const [notice, setNotice] = useState("");
  const [careOrigin,setCareOrigin]=useState<CareOrigin>(()=>{try{return JSON.parse(localStorage.getItem("ruralcare:care-origin")||"")||careOrigins[0];}catch{return careOrigins[0];}});
  const [myReferrals, setMyReferrals] = useState<Array<Record<string, any>>>(
    [],
  );
  const [online, setOnline] = useState(navigator.onLine);
  const labels =
    language === "ta"
      ? { prompt: "என்ன உதவி தேவை?", next: "தொடரவும்" }
      : { prompt: "What healthcare help do you need?", next: "Continue" };
  const stageNames = ["Need", "Safety", "Recommendation", "Continuity"];
  const stageIndex: Record<PathView, number> = {
    home: 0,
    input: 1,
    understanding: 1,
    urgency: 2,
    service: 2,
    comparison: 3,
    recommendation: 3,
    reroute: 3,
    referral: 4,
    followup: 4,
    myreferrals: 4,
    dashboard: 0,
  };
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener("online", on);
    addEventListener("offline", off);
    return () => {
      removeEventListener("online", on);
      removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    loadWorkflow<any>(user.id)
      .then((saved) => {
        if (saved) {
          setLanguage(saved.language || user.preferredLanguage || "en");
          setSourceMode(user.role === "ASHA" ? "ASHA_ASSISTED" : "CITIZEN");
          setMessage(saved.message || "");
          setAssessment(saved.assessment || null);
          setStructuredIntake(saved.structuredIntake || null);
          setAskedQuestionIds(saved.askedQuestionIds || []);
          setExtractionMetadata(saved.extractionMetadata || null);
          setRouteDecision(saved.routeDecision || null);
          setCandidates(saved.candidates || []);
          setRecommended(saved.recommended || null);
          setSelected(saved.selected || null);
          setCurrentReferral(saved.currentReferral || null);
          // Never open directly on an old clinical result. Keep the saved
          // pathway available, but let the patient choose whether to resume it.
          setView(isClinical ? "dashboard" : isPatient ? "home" : "input");
          setSyncState(saved.syncState || "LOCAL_ONLY");
        }
        setWorkflowLoaded(true);
      })
      .catch(() => setWorkflowLoaded(true));
  }, [user.id]);
  useEffect(() => {
    if (!workflowLoaded) return;
    saveWorkflow(user.id, {
      language,
      sourceMode,
      message,
      assessment,
      structuredIntake,
      askedQuestionIds,
      extractionMetadata,
      routeDecision,
      candidates,
      recommended,
      selected,
      currentReferral,
      view,
      syncState,
    }).catch(() => undefined);
  }, [
    workflowLoaded,
    user.id,
    language,
    sourceMode,
    message,
    assessment,
    structuredIntake,
    askedQuestionIds,
    extractionMetadata,
    routeDecision,
    candidates,
    recommended,
    selected,
    currentReferral,
    view,
    syncState,
  ]);
  useEffect(() => {
    if (!online || isClinical) return;
    setSyncState("SYNCING");
    pendingActions(user.id)
      .then(async (actions) => {
        for (const action of actions) {
          try {
            const result = await request(action.path, {
              method: action.method,
              body: JSON.stringify(action.body),
            });
            if (action.path === "/api/referrals")
              setCurrentReferral(result.referral);
            await removeAction(action.id);
          } catch (error: any) {
            if (String(error?.message).includes("sign in"))
              setNotice(
                "Please sign in again before syncing this account's offline work.",
              );
            setSyncState("SYNC_FAILED");
            return;
          }
        }
        setSyncState("SYNCED");
      })
      .catch(() => setSyncState("SYNC_FAILED"));
  }, [online, user.id, user.role, isClinical]);
  useEffect(() => {
    const id = currentReferral?.id;
    if (!id) {
      setReferralQr("");
      return;
    }
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(`ruralcare:referral:${id}`, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 280,
          color: { dark: "#123f38", light: "#ffffff" },
        }),
      )
      .then(setReferralQr)
      .catch(() => setReferralQr(""));
  }, [currentReferral?.id]);
  async function start() {
    if (!message.trim())
      return setNotice("Please describe the healthcare need first.");
    if (voiceState === "TRANSCRIPT_READY")
      return setNotice(
        "Please confirm or edit the transcript before continuing.",
      );
    const fallbackStructured = extractStructuredNeed(message, language),
      fallback = assessNeed(structuredToMessage(fallbackStructured));
    setStructuredIntake(fallbackStructured);
    setExtractionMetadata({
      provider: "LOCAL_RULES",
      fallbackUsed: true,
      promptVersion: "clinical-extraction-v1",
    });
    setAskedQuestionIds([]);
    setAdaptiveQuestion(nextSafetyQuestion(fallbackStructured));
    setAssessment(fallback);
    setView("understanding");
    try {
      const result = await request("/api/intake/extract", {
        method: "POST",
        body: JSON.stringify({
          rawText: message,
          preferredResponseLanguage: language,
        }),
      });
      setAssessment(result.assessment);
      setStructuredIntake(result.structured);
      setExtractionMetadata(result.metadata);
      setAdaptiveQuestion(result.nextQuestion);
    } catch {
      setNotice("Offline-safe structured extraction is active.");
    }
  }
  async function loadComparison() {
    if (!assessment) return;
    const originFacilities=localFacilities.map(item=>({...item,distanceKm:calculateDistanceKm(careOrigin,item)}));
    const fallbackDecision = routeFacilities(
      originFacilities,
      assessment,
      crypto.randomUUID(),
    );
    setRouteDecision(fallbackDecision);
    setCandidates(fallbackDecision.candidates as FacilityCandidate[]);
    const fallbackRecommended =
      (fallbackDecision.candidates.find(
        (item) => item.id === fallbackDecision.selectedFacilityId,
      ) as FacilityCandidate | undefined) || null;
    setRecommended(fallbackRecommended);
    setSelected(fallbackRecommended);
    setView("comparison");
    try {
      const confirmedNeed = structuredIntake
        ? structuredToMessage(structuredIntake)
        : message;
      const result = await request("/api/routing", {
        method: "POST",
        body: JSON.stringify({
          message: confirmedNeed,
          requestId: crypto.randomUUID(),
          origin:{latitude:careOrigin.latitude,longitude:careOrigin.longitude,label:careOrigin.label},
        }),
      });
      const decision = result.decision as RouteDecision;
      setRouteDecision(decision);
      setCandidates(decision.candidates as FacilityCandidate[]);
      const onlineRecommended =
        (decision.candidates.find(
          (item) => item.id === decision.selectedFacilityId,
        ) as FacilityCandidate | undefined) || null;
      setRecommended(onlineRecommended);
      setSelected(onlineRecommended);
    } catch {
      setNotice(
        "Offline: showing the same routing engine with cached facility data.",
      );
    }
  }
  function applySafetyAnswers() {
    if (
      !assessment ||
      assessment.missingInformation.some(
        (question) => !followUpAnswers[question],
      )
    )
      return setNotice("Please answer each safety question.");
    const facts = assessment.missingInformation.map((question) => {
      const yes = followUpAnswers[question] === "YES";
      if (question.includes("drink or breastfeed"))
        return yes
          ? "The child can drink normally."
          : "The child cannot drink.";
      if (question.includes("vomiting everything"))
        return yes
          ? "The child is vomiting everything."
          : "The child has no vomiting.";
      if (question.includes("seizure or become difficult"))
        return yes
          ? "The child had a seizure."
          : "The child has no seizure and is awake.";
      if (question.includes("difficulty breathing or a stiff neck"))
        return yes
          ? "The child has difficulty breathing."
          : "The child has no breathing difficulty and no stiff neck.";
      return yes
        ? "There is difficulty breathing."
        : "There is no breathing difficulty and no confusion.";
    });
    const enriched = `${message} ${facts.join(" ")}`;
    setMessage(enriched);
    setAssessment(assessNeed(enriched));
    setFollowUpAnswers({});
    setNotice("Safety answers added to the structured assessment.");
  }
  function answerAdaptive(answer: "YES" | "NO" | "NOT_SURE") {
    if (!structuredIntake || !adaptiveQuestion) return;
    const updated = applyAdaptiveAnswer(
        structuredIntake,
        adaptiveQuestion.questionId,
        answer,
      ),
      asked = [...askedQuestionIds, adaptiveQuestion.questionId],
      updatedAssessment = assessNeed(structuredToMessage(updated));
    setStructuredIntake(updated);
    setAskedQuestionIds(asked);
    setAssessment(updatedAssessment);
    setAdaptiveQuestion(
      nextSafetyQuestion(
        updated,
        asked,
        5,
        updatedAssessment.urgency === "EMERGENCY",
      ),
    );
    setNotice(
      answer === "NOT_SURE"
        ? "That detail remains unknown; the pathway will stay safety-bounded."
        : "Answer recorded and deterministic safety rules rechecked.",
    );
  }
  async function createReferral() {
    if (!assessment || !selected) return;
    const clientId = crypto.randomUUID();
    const body = {
      clientId,
      patientLabel,
      sourceFacility:
        sourceMode === "ASHA_ASSISTED"
          ? "ASHA-assisted pathway"
          : "Citizen pathway",
      destinationFacility: selected.name,
      selectedFacilityId: selected.id,
      service: assessment.service,
      urgency: assessment.urgency,
      nextAction: assessment.nextAction,
      careNeed: message.trim().slice(0, 160) || assessment.symptoms.join(", "),
      requestId: routeDecision?.requestId,
      sourceMode,
      selectedFacilityType: selected.type,
      routingExplanation:
        routeDecision?.explanation ||
        selected.rerouteReason ||
        "Selected based on service suitability, care level, distance, and prototype availability.",
      rerouted: routeDecision?.rerouted || false,
      previousFacility:
        routeDecision?.originalFacilityId !== selected.id
          ? candidates.find(
              (item) => item.id === routeDecision?.originalFacilityId,
            )?.name
          : undefined,
      routingAudit: routeDecision?.audit,
    };
    try {
      const result = await request("/api/referrals", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setNotice(
        `Continuity pass ${result.referral.demoId} created for the selected public-care pathway.`,
      );
      setCurrentReferral(result.referral);
      setSyncState("SYNCED");
    } catch (error) {
      if (!isOfflineFailure(error)) {
        setNotice(
          error instanceof Error
            ? error.message
            : "The referral could not be created.",
        );
        return;
      }
      await queueAction(user.id, {
        id: clientId,
        path: "/api/referrals",
        method: "POST",
        body,
      });
      setCurrentReferral({
        id: clientId,
        demoId: `LOCAL-${clientId.slice(0, 6).toUpperCase()}`,
        status: "CREATED",
        ...body,
      });
      setSyncState("PENDING_SYNC");
      setNotice("Offline: continuity pass safely queued on this device.");
    }
    setView("followup");
  }
  async function refreshReferral() {
    if (
      !currentReferral ||
      String(currentReferral.demoId || "").startsWith("LOCAL-")
    )
      return setNotice("This continuity pass is waiting to sync.");
    try {
      const result = await request(`/api/referrals/${currentReferral.id}`);
      setCurrentReferral({
        ...result.referral,
        history: result.history || [],
        clinicalOutcomes: result.clinicalOutcomes || [],
        followUps: result.followUps || [],
      });
      setNotice("Latest staff status loaded.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not refresh this referral.",
      );
    }
  }
  function startNewCareRequest() {
    setMessage("");
    setAssessment(null);
    setStructuredIntake(null);
    setAdaptiveQuestion(null);
    setAskedQuestionIds([]);
    setExtractionMetadata(null);
    setRouteDecision(null);
    setCandidates([]);
    setRecommended(null);
    setSelected(null);
    setFollowUpAnswers({});
    setVoiceTranscript("");
    setVoiceTranscriptSource(null);
    setVoiceConfidence(null);
    setVoiceState("IDLE");
    setView("input");
  }
  async function openCareJourney() {
    setView(isPatient ? "home" : "input");
  }
  function openIntake() {
    if (view === "home") {
      startNewCareRequest();
      return;
    }
    setView("input");
  }
  async function openMyReferrals() {
    setView("myreferrals");
    try {
      const result = await request("/api/referrals");
      setMyReferrals(result.referrals || []);
    } catch (error: any) {
      setNotice(error?.message || "Could not load this account's referrals.");
    }
  }
  async function switchPortal(portal: PortalIntent) {
    localStorage.setItem(portalIntentKey, portal);
    await logout();
  }
  async function confirmReroute() {
    if (!currentReferral) return;
    try {
      const result = await request(
        `/api/referrals/${currentReferral.id}/reroute/confirm`,
        { method: "POST" },
      );
      setCurrentReferral(result.referral);
      setNotice(
        "Alternative public facility confirmed. Referral history was preserved.",
      );
    } catch {
      setNotice(
        "Reroute confirmation needs a connection. Your original destination is unchanged.",
      );
    }
  }
  async function submitFollowUp(
    outcome:
      | "CARE_REACHED"
      | "COULD_NOT_REACH"
      | "SERVICE_NOT_AVAILABLE"
      | "FOLLOW_UP_NEEDED",
  ) {
    if (!currentReferral) return;
    const clientId = crypto.randomUUID(),
      body = { clientId, outcome, note: followUpNote, sourceMode };
    const path = `/api/referrals/${currentReferral.id}/follow-up`;
    try {
      const result = await request(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setCurrentReferral(result.referral?.referral || currentReferral);
      setSyncState("SYNCED");
      setNotice(
        outcome === "CARE_REACHED"
          ? "Care reached and continuity completed."
          : "Follow-up outcome shared with the care team.",
      );
    } catch (error) {
      if (!isOfflineFailure(error)) {
        setNotice(
          error instanceof Error
            ? error.message
            : "The follow-up could not be saved.",
        );
        return;
      }
      await queueAction(user.id, { id: clientId, path, method: "POST", body });
      setSyncState("PENDING_SYNC");
      setNotice(
        "Follow-up saved offline and waiting to sync for this signed-in account.",
      );
    }
  }
  useEffect(() => {
    if (view !== "followup" || !currentReferral || !online) return;
    const timer = window.setInterval(() => {
      refreshReferral();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [view, currentReferral?.id, online]);
  async function transcribeRecording(blob: Blob, spokenLanguage: "ta" | "en") {
    setVoiceState("TRANSCRIBING");
    setNotice(
      spokenLanguage === "ta"
        ? "தமிழ் குரலை எழுத்தாக மாற்றுகிறோம்…"
        : "Converting speech to text…",
    );
    try {
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const result = await request("/api/transcribe", {
        method: "POST",
        body: JSON.stringify({
          audioBase64,
          mimeType: blob.type || "audio/webm",
          language: spokenLanguage,
        }),
      });
      setVoiceTranscript(result.text);
      setVoiceConfidence(typeof result.confidence === "number" ? result.confidence : null);
      setMessage(
        `${voiceBaseMessageRef.current.trim()}${voiceBaseMessageRef.current.trim() ? " " : ""}${String(result.text).trim()}`,
      );
      setVoiceTranscriptSource("CLOUD_AUDIO");
      setVoiceState("TRANSCRIPT_READY");
      setNotice(
        spokenLanguage === "ta"
          ? "நாங்கள் கேட்ட உரையை சரிபார்த்து உறுதிப்படுத்தவும்."
          : "Review and confirm what we heard.",
      );
    } catch {
      setVoiceState("ERROR");
      setNotice(
        "Free browser speech is unavailable in this browser, and optional cloud transcription is not configured. Open RuralCare in Chrome or Edge, or type the need.",
      );
    }
  }
  function startFreeBrowserSpeech(spokenLanguage: "ta" | "en") {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return false;
    const recognition = new Speech();
    let transcript = "",
      failed = false;
    speechRecognitionRef.current = recognition;
    recognition.lang = spokenLanguage === "ta" ? "ta-IN" : "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setVoiceTranscript("");
      setVoiceTranscriptSource("BROWSER_SPEECH");
      setVoiceConfidence(null);
      setVoiceState("RECORDING");
      setNotice(
        spokenLanguage === "ta"
          ? "இலவச உலாவி குரல் கேட்கிறது… பேசி முடித்ததும் நிறுத்தவும் அழுத்தவும்."
          : "Free browser speech is listening… speak, then tap Stop.",
      );
    };
    recognition.onresult = (event: any) => {
      transcript = Array.from(event.results as ArrayLike<any>)
        .map((result: any) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      setVoiceTranscript(transcript);
      const confidences = Array.from(event.results as ArrayLike<any>).map((result: any) => Number(result[0]?.confidence || 0)).filter(Boolean);
      setVoiceConfidence(confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null);
      setMessage(
        `${voiceBaseMessageRef.current.trim()}${voiceBaseMessageRef.current.trim() ? " " : ""}${transcript}`,
      );
    };
    recognition.onerror = (event: any) => {
      failed = true;
      speechRecognitionRef.current = null;
      setVoiceState("ERROR");
      setNotice(
        event.error === "not-allowed"
          ? "Microphone permission was blocked. Allow microphone access in the address bar and try again."
          : event.error === "no-speech"
            ? "No speech was detected. Tap Try again and speak clearly."
            : "Browser speech recognition could not start. Use Chrome or Edge, or type the need.",
      );
    };
    recognition.onend = () => {
      speechRecognitionRef.current = null;
      if (failed) return;
      if (transcript) {
        setVoiceState("TRANSCRIPT_READY");
        setNotice(
          spokenLanguage === "ta"
            ? "நாங்கள் கேட்ட உரையை சரிபார்த்து உறுதிப்படுத்தவும்."
            : "Review and confirm what the browser heard.",
        );
      } else {
        setVoiceState("IDLE");
        setNotice(
          spokenLanguage === "ta"
            ? "குரல் கேட்கவில்லை. மீண்டும் முயற்சிக்கவும்."
            : "No speech was heard. Please try again.",
        );
      }
    };
    try {
      recognition.start();
      return true;
    } catch {
      speechRecognitionRef.current = null;
      return false;
    }
  }
  async function voice(spokenLanguage: "ta" | "en" = language) {
    if (voiceState === "RECORDING") {
      if (recordingTimerRef.current)
        window.clearTimeout(recordingTimerRef.current);
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
        return;
      }
      recorderRef.current?.stop();
      return;
    }
    if (voiceState === "ERROR" || voiceState === "CONFIRMED") {
      setVoiceState("IDLE");
      setVoiceTranscript("");
      setVoiceTranscriptSource(null);
      setVoiceConfidence(null);
    } else if (voiceState !== "IDLE") return;
    voiceBaseMessageRef.current = message;
    setLanguage(spokenLanguage);
    if (startFreeBrowserSpeech(spokenLanguage)) return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    )
      return setNotice(
        "Free voice input is unavailable here. Open the app in Chrome or Edge, or type the need.",
      );
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const preferred = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(
          stream,
          preferred ? { mimeType: preferred } : undefined,
        ),
        chunks: BlobPart[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        const blob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size < 500) {
          setVoiceState("IDLE");
          setNotice(
            "No usable speech was recorded. Tap once, speak, then tap Stop.",
          );
          return;
        }
        void transcribeRecording(blob, spokenLanguage);
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        setVoiceState("IDLE");
        setNotice(
          "The microphone recording failed. Check browser microphone permission.",
        );
      };
      recorder.start(250);
      setVoiceState("RECORDING");
      setNotice(
        spokenLanguage === "ta"
          ? "பதிவு செய்கிறது… பேசி முடித்ததும் நிறுத்தவும் அழுத்தவும்."
          : "Recording… tap Stop when you finish speaking.",
      );
      recordingTimerRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 12000);
    } catch (error: any) {
      setVoiceState("IDLE");
      setNotice(
        error?.name === "NotAllowedError"
          ? "Microphone permission was blocked. Allow it in the address bar, then try again."
          : "Could not open the microphone. Check that it is connected and not used by another app.",
      );
    }
  }
  function handleAssistantAction(action: AssistantAction) {
    if (action === "REVIEW_SAFETY") {
      setView(assessment ? "urgency" : "input");
      return;
    }
    if (action === "COMPARE_FACILITIES") {
      if (candidates.length) setView("comparison");
      else if (assessment && assessment.urgency !== "INSUFFICIENT_INFORMATION")
        void loadComparison();
      else setView("input");
      return;
    }
    if (action === "CREATE_CONTINUITY_PASS") {
      setView(selected && assessment ? "referral" : "comparison");
      return;
    }
    if (action === "CHECK_FOLLOW_UP") {
      setView(currentReferral ? "followup" : "myreferrals");
      return;
    }
    if (action === "CONTINUE_PATHWAY")
      setView(view === "home" ? "input" : view);
  }
  const standardCard = (children: React.ReactNode) => (
    <section className="flow-card pathway-card">{children}</section>
  );
  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <div className="brand-mark">
            <HeartPulse />
          </div>
          <div>
            <b>RuralCare</b>
            <span>CONNECT</span>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {isPatient && (
            <button
              className={view === "home" ? "active" : ""}
              onClick={openCareJourney}
              aria-current={view === "home" ? "page" : undefined}
              title="Care home"
            >
              <HeartPulse /> Home
            </button>
          )}
          {!isClinical && (
            <button
              className={!["home", "myreferrals", "followup", "dashboard"].includes(view) ? "active" : ""}
              onClick={openIntake}
              aria-current={!["home", "myreferrals", "followup", "dashboard"].includes(view) ? "page" : undefined}
              title={user.role === "ASHA" ? "Start an assisted intake" : "Start a care request"}
            >
              <MessageCircle /> {user.role === "ASHA" ? "Assisted intake" : "Get care"}
            </button>
          )}
          {!isClinical && (
            <button
              className={view === "myreferrals" || view === "followup" ? "active" : ""}
              onClick={openMyReferrals}
              aria-current={view === "myreferrals" || view === "followup" ? "page" : undefined}
              title={user.role === "ASHA" ? "Assisted referrals" : "My referrals"}
            >
              <ClipboardPlus /> {user.role === "ASHA" ? "Referrals" : "My referrals"}
            </button>
          )}
          {user.role === "ASHA" && (
            <button
              className={view === "dashboard" ? "active workspace-nav" : "workspace-nav"}
              onClick={() => setView("dashboard")}
              aria-current={view === "dashboard" ? "page" : undefined}
              title="Open ASHA dashboard"
            >
              <Activity /> ASHA dashboard
            </button>
          )}
          {isClinical && (
            <button
              className="active workspace-nav"
              onClick={() => setView("dashboard")}
              aria-current="page"
            >
              {user.role === "DOCTOR" ? <Stethoscope /> : <UsersRound />}
              <span>
                {user.role === "DOCTOR"
                  ? "Doctor dashboard"
                  : "Staff dashboard"}
                <small>Current workspace</small>
              </span>
            </button>
          )}
        </nav>
        <div className="aside-card">
          <div className="signal">
            <Wifi size={16} /> Offline-first ready
          </div>
          <p>Need → service → available public care → continuity.</p>
          <span>Synthetic SIH prototype</span>
        </div>
        <div className="aside-bottom">
          <ShieldCheck size={18} />
          <p>
            <b>{user.name}</b>
            <br />
            {user.role.replaceAll("_", " ")}
          </p>
          <button className="logout-button" onClick={() => logout()}>
            Logout
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="mobile-brand">
            <HeartPulse />
            <b>RuralCare</b>
          </div>
          <div className="mode-pill">
            <Route size={15} /> Need-to-care pathway
          </div>
          <div className="top-actions">
            <button
              className="language"
              onClick={() => setLanguage(language === "en" ? "ta" : "en")}
            >
              <Languages size={17} />
              {language === "en" ? "தமிழ்" : "English"}
            </button>
            <button
              className={online ? "connection online" : "connection offline"}
            >
              {online ? <Wifi size={16} /> : <CloudOff size={16} />}
              {online ? "Connected" : "Offline"}
            </button>
          </div>
        </header>
        <div className="prototype-banner">
          <BadgeCheck size={17} />
          <span>Prototype with synthetic capacity data</span>
          <i>•</i>
          <span>Always verify availability before travel</span>
        </div>
        {view !== "dashboard" && view !== "input" && (
          <div className="pathway-tracker">
            {stageNames.map((name, index) => (
              <div
                className={
                  index + 1 <= stageIndex[view]
                    ? "pathway-step done"
                    : "pathway-step"
                }
                key={name}
              >
                <b>{index + 1}</b>
                <small>{name}</small>
              </div>
            ))}
          </div>
        )}
        {notice && (
          <div className="toast">
            <BadgeCheck size={18} />
            <span>{notice}</span>
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
        {view === "home" && isPatient && (
          <section className="patient-home">
            <div className="patient-welcome">
              <div>
                <p className="kicker">MY CARE JOURNEY</p>
                <h1>
                  {user.name.toLowerCase().startsWith("demo ")
                    ? "Welcome to RuralCare Connect."
                    : `Welcome, ${user.name.split(" ")[0]}.`}
                </h1>
                <p>
                  Describe a need in Tamil, English, or Tanglish and keep the
                  same care story through referral and follow-up.
                </p>
                <div className="patient-home-actions">
                  <button
                    onClick={startNewCareRequest}
                  >
                    <Sparkles /> Start a new care request
                  </button>
                  <button className="ghost" onClick={openMyReferrals}>
                    <ClipboardPlus /> View my referrals
                  </button>
                </div>
              </div>
              <HeartPulse />
            </div>
            <div className="patient-home-grid">
              <article>
                <span>
                  <Mic />
                </span>
                <b>Speak naturally</b>
                <p>
                  Review and confirm the transcript before it enters the safety
                  pathway.
                </p>
              </article>
              <article>
                <span>
                  <SearchCheck />
                </span>
                <b>Find suitable public care</b>
                <p>
                  Service fit and capacity—not distance alone—guide the route.
                </p>
              </article>
              <article>
                <span>
                  <Route />
                </span>
                <b>Track continuity</b>
                <p>
                  See referral, reroute, arrival, and follow-up status in one
                  account.
                </p>
              </article>
            </div>
            {(message.trim() || assessment) && (
              <article className="resume-care-card">
                <div>
                  <p className="kicker">UNFINISHED REQUEST</p>
                  <h2>Continue where you stopped?</h2>
                  <p>{message || "A saved care request is available on this device."}</p>
                </div>
                <button onClick={() => setView(assessment ? "understanding" : "input")}>
                  Resume request <ArrowRight />
                </button>
              </article>
            )}
            {currentReferral && (
              <article className="active-referral-home">
                <div>
                  <p className="kicker">ACTIVE CARE JOURNEY</p>
                  <h2>{currentReferral.demoId}</h2>
                  <span>{currentReferral.destinationFacility}</span>
                </div>
                <strong>
                  {String(currentReferral.status || "CREATED").replaceAll(
                    "_",
                    " ",
                  )}
                </strong>
                <button onClick={() => setView("followup")}>
                  Open journey <ArrowRight />
                </button>
              </article>
            )}
            <div className="patient-safety-note">
              <ShieldCheck />
              <p>
                <b>Navigation support—not a diagnosis.</b> Emergency warning
                signs always direct you to immediate human help.
              </p>
            </div>
          </section>
        )}
        {view === "input" && (
          <section className="home-grid care-conversation">
            <div className="welcome-panel">
              <h1>How can we help?</h1>
              <p className="lead">
                Describe your concern in Tamil or English. We’ll help you find suitable public care.
              </p>
              <div className="input-panel">
                <div className="care-chat" aria-label="Care conversation">
                  <div className="care-chat-avatar"><HeartPulse size={18} /></div>
                  <div className="care-chat-bubble assistant">
                    {language === "ta"
                      ? "வணக்கம். இன்று யாருக்கு என்ன உடல்நல உதவி தேவை என்பதை பேசவும் அல்லது தட்டச்சு செய்யவும்."
                      : "Hello. Tell me who needs help and what is happening. You can speak or type naturally."}
                  </div>
                </div>
                <label>
                  {labels.prompt}
                  <span>Tamil, English, or mixed language</span>
                </label>
                <details className="care-origin-control">
                  <summary>Location: {careOrigin.label} · Change</summary>
                  <label htmlFor="care-origin">Starting location <small>Used only to calculate this route</small></label>
                  <div><select id="care-origin" value={careOrigin.id} onChange={event=>{const next=careOrigins.find(item=>item.id===event.target.value)||careOrigins[0];setCareOrigin(next);localStorage.setItem("ruralcare:care-origin",JSON.stringify(next));}}>{careOrigins.map(origin=><option key={origin.id} value={origin.id}>{origin.label}</option>)}</select><button type="button" onClick={()=>navigator.geolocation?navigator.geolocation.getCurrentPosition(position=>{const next:CareOrigin={id:"device",label:"Current device location",latitude:position.coords.latitude,longitude:position.coords.longitude,source:"DEVICE_LOCATION"};setCareOrigin(next);localStorage.setItem("ruralcare:care-origin",JSON.stringify(next));setNotice("Current location selected for this route only.");},()=>setNotice("Location permission was not available. Choose a village instead."),{enableHighAccuracy:false,timeout:8000,maximumAge:300000}):setNotice("Location is not supported in this browser.")}><MapPin/> Use my location</button></div>
                  <small>{careOrigin.source==="DEVICE_LOCATION"?"Device location selected · not continuously tracked":"Approximate location · available offline"}</small>
                </details>
                <textarea
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (voiceState === "TRANSCRIPT_READY") {
                      setVoiceTranscript(e.target.value.slice(voiceBaseMessageRef.current.length).trim());
                    }
                  }}
                  placeholder={
                    language === "ta"
                      ? "உதாரணம்: கர்ப்ப கால பரிசோதனை தேவை"
                      : "Example: I am pregnant and need a check-up"
                  }
                />
                {voiceState === "TRANSCRIPT_READY" && (
                  <div
                    className="transcript-review"
                    role="region"
                    aria-label="Speech transcript review"
                  >
                    <b>{language === "ta" ? "நாங்கள் கேட்டது" : "We heard"}</b>
                    <textarea
                      value={voiceTranscript}
                      onChange={(event) =>
                        setVoiceTranscript(event.target.value)
                      }
                      aria-label="Editable speech transcript"
                    />
                    <div>
                      <button
                        onClick={() => {
                          setVoiceState("CONFIRMED");
                          setNotice(
                            language === "ta"
                              ? "உரை உறுதிப்படுத்தப்பட்டது."
                              : "Transcript confirmed.",
                          );
                        }}
                        disabled={!voiceTranscript.trim()}
                      >
                        <CheckCircle2 size={16} />{" "}
                        {language === "ta"
                          ? "உறுதிப்படுத்து"
                          : "Confirm transcript"}
                      </button>
                      <button
                        onClick={() => {
                          setMessage(voiceBaseMessageRef.current);
                          setVoiceTranscript("");
                          setVoiceTranscriptSource(null);
                          setVoiceConfidence(null);
                          setVoiceState("IDLE");
                          setNotice(
                            language === "ta"
                              ? "மீண்டும் பேசுங்கள்."
                              : "Ready to record again.",
                          );
                        }}
                      >
                        <RotateCcw size={16} />{" "}
                        {language === "ta" ? "மீண்டும் முயற்சி" : "Try again"}
                      </button>
                    </div>
                    <small>
                      {voiceTranscriptSource === "BROWSER_SPEECH"
                        ? "Free browser speech recognition · no OpenAI credits used. "
                        : "Optional cloud transcription. "}
                      You can edit the words above. Clinical extraction starts
                      only after confirmation.
                    </small>
                    {voiceConfidence !== null && voiceConfidence < 0.72 && (
                      <div className="voice-confidence-warning"><CircleAlert /> Low-confidence speech ({Math.round(voiceConfidence * 100)}%). Check names, symptom words, age and duration carefully before confirming.</div>
                    )}
                  </div>
                )}
                <div className="input-actions">
                  <div
                    className="voice-inputs"
                    aria-label="Voice input language"
                  >
                    <IconButton
                      Icon={Mic}
                      className={`ghost tamil-voice ${voiceState !== "IDLE" ? "listening" : ""}`}
                      onClick={() => voice("ta")}
                    >
                      {voiceState === "RECORDING" && language === "ta"
                        ? "நிறுத்தி எழுத்தாக்கவும்"
                        : voiceState === "TRANSCRIBING" && language === "ta"
                          ? "எழுத்தாக்குகிறது…"
                          : "தமிழில் பேசுங்கள்"}
                    </IconButton>
                    <button
                      className="english-voice"
                      onClick={() => voice("en")}
                      disabled={voiceState !== "IDLE" && language !== "en"}
                    >
                      {voiceState === "RECORDING" && language === "en"
                        ? "Stop & transcribe"
                        : voiceState === "TRANSCRIBING" && language === "en"
                          ? "Transcribing…"
                          : "Speak English"}
                    </button>
                  </div>
                  <small className="voice-privacy">
                    Speech is converted to editable text. Review it before
                    continuing.
                  </small>
                  <IconButton Icon={ArrowRight} onClick={start}>
                    {labels.next}
                  </IconButton>
                </div>
              </div>
              <div className="safety-strip">
                <ShieldCheck />
                <p>
                  <b>Safe pathway support.</b> We do not diagnose or prescribe.
                </p>
                <button className="inline-emergency" onClick={()=>setNotice("If you need emergency help, contact local emergency services or seek immediate in-person care. This app cannot dispatch help. Your message has not been changed.")}><AlertTriangle/> Emergency help</button>
              </div>
            </div>
          </section>
        )}
        {view === "understanding" &&
          assessment &&
          standardCard(
            <>
              <button className="back" onClick={() => setView("input")}>
                <ChevronLeft /> Edit need
              </button>
              <div className="flow-title">
                <p className="kicker">STEP 2 · STRUCTURED UNDERSTANDING</p>
                <h1>Here is what we understood.</h1>
                <p>
                  Confirm the structured information before the system suggests
                  any care pathway.
                </p>
              </div>
              <div className="care-review-conversation">
                <div className="review-message patient-message">
                  <span>You</span>
                  <p>{message}</p>
                </div>
                <div className="review-message assistant-message">
                  <span>RuralCare</span>
                  <p>
                    {language === "ta"
                      ? "நான் புரிந்துகொண்ட தகவல்கள் கீழே உள்ளன. சரியாக இருந்தால் மட்டும் உறுதிப்படுத்தவும்."
                      : "I organised what you shared below. Confirm only if it is correct."}
                  </p>
                </div>
              </div>
              <div className="path-summary">
                <div>
                  <span>Need signals</span>
                  <b>{assessment.symptoms.join(", ")}</b>
                </div>
                <div>
                  <span>Duration</span>
                  <b>{assessment.duration}</b>
                </div>
                <div>
                  <span>Language</span>
                  <b>
                    {assessment.language === "ta"
                      ? "Tamil"
                      : assessment.language}
                  </b>
                </div>
                {structuredIntake && (
                  <>
                    <div>
                      <span>Age group</span>
                      <b>
                        {structuredIntake.ageGroup}
                        {structuredIntake.age !== null
                          ? ` · ${structuredIntake.age} years`
                          : ""}
                      </b>
                    </div>
                    <div>
                      <span>Important unknowns</span>
                      <b>
                        {structuredIntake.missingImportantFields.length
                          ? structuredIntake.missingImportantFields.join(", ")
                          : "None identified"}
                      </b>
                    </div>
                  </>
                )}
              </div>
              {structuredIntake && structuredIntake.ambiguities.length > 0 && (
                <div className="contradiction-alert" role="alert">
                  <CircleAlert />
                  <div><b>Conflicting information needs correction</b>{structuredIntake.ambiguities.map(item => <p key={item}>{item}</p>)}<small>Edit the original message so only the correct statement remains, then continue again.</small></div>
                </div>
              )}
              <p className="voice-privacy">
                Understanding source:{" "}
                {extractionMetadata?.provider === "OPENAI"
                  ? "AI-assisted structured extraction"
                  : "offline-safe local extraction"}
                . Urgency is always decided by deterministic safety rules.
              </p>
              <div className="flow-actions">
                <IconButton
                  Icon={ChevronLeft}
                  className="ghost"
                  onClick={() => setView("input")}
                >
                  Change input
                </IconButton>
                <IconButton
                  Icon={CheckCircle2}
                  onClick={() => setView("urgency")}
                  disabled={Boolean(structuredIntake?.ambiguities.length)}
                >
                  Confirm understanding
                </IconButton>
              </div>
            </>,
          )}
        {view === "urgency" &&
          assessment &&
          standardCard(
            <>
              <button className="back" onClick={() => setView("input")}>
                <ChevronLeft /> Edit need
              </button>
              <div className="flow-title">
                <p className="kicker">STEP 2 · SAFETY CHECK</p>
                <h1>
                  {assessment.urgency === "EMERGENCY"
                    ? "Act immediately"
                    : "Your safety level"}
                </h1>
                <p>
                  Urgency is a conservative routing safeguard, not a diagnosis.
                </p>
              </div>
              <div
                className={`urgency-card ${assessment.urgency.toLowerCase()}`}
              >
                <div>
                  {assessment.urgency === "EMERGENCY" ? (
                    <AlertTriangle />
                  ) : (
                    <ShieldCheck />
                  )}
                </div>
                <section>
                  <span>URGENCY CLASSIFICATION</span>
                  <h2>{assessment.urgency}</h2>
                  <p>{assessment.nextAction}</p>
                </section>
              </div>
              {assessment.triggeredRules.length > 0 && (
                <div className="rule-audit" aria-label="Safety rule details">
                  {assessment.triggeredRules.map((item) => (
                    <div key={item.triggeredRuleId}>
                      <b>{item.triggeredRuleId}</b>
                      <span>{item.finding}</span>
                      <small>{item.guidelineReference}</small>
                    </div>
                  ))}
                </div>
              )}
              {assessment.urgency === "EMERGENCY" ? (
                <div className="emergency-actions">
                  <IconButton
                    Icon={PhoneCall}
                    onClick={() =>
                      setNotice("Demo emergency SMS alert prepared.")
                    }
                  >
                    Send demo emergency alert
                  </IconButton>
                  <IconButton
                    Icon={Hospital}
                    className="ghost"
                    onClick={loadComparison}
                  >
                    Show emergency destination
                  </IconButton>
                  <p>
                    Immediate guidance remains first. Facility routing is
                    restricted to emergency-capable public care.
                  </p>
                </div>
              ) : assessment.urgency === "INSUFFICIENT_INFORMATION" &&
                adaptiveQuestion ? (
                <div className="missing-information">
                  <b>{language === "ta" ? "ஒரு பாதுகாப்புக் கேள்வி" : "One safety question"}</b>
                  <p>{adaptiveQuestion.translations[language]}</p>
                  <div className="safety-questions">
                    <div className="safety-question">
                      <span>{adaptiveQuestion.translations[language]}</span>
                      <div>
                        <button onClick={() => answerAdaptive("YES")}>
                          {language === "ta" ? "ஆம்" : "Yes"}
                        </button>
                        <button onClick={() => answerAdaptive("NO")}>{language === "ta" ? "இல்லை" : "No"}</button>
                        <button onClick={() => answerAdaptive("NOT_SURE")}>
                          {language === "ta" ? "தெரியவில்லை" : "Not sure"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <small>{adaptiveQuestion.sourceReference}</small>
                </div>
              ) : assessment.urgency === "INSUFFICIENT_INFORMATION" ? (
                <div className="missing-information">
                  <b>Safety details needed before routing</b>
                  <p>
                    Answer only these relevant questions. The deterministic
                    safety rules will reassess the request.
                  </p>
                  <div className="safety-questions">
                    {assessment.missingInformation.map((question) => (
                      <div className="safety-question" key={question}>
                        <span>{question}</span>
                        <div>
                          <button
                            className={
                              followUpAnswers[question] === "YES"
                                ? "selected"
                                : ""
                            }
                            onClick={() =>
                              setFollowUpAnswers({
                                ...followUpAnswers,
                                [question]: "YES",
                              })
                            }
                          >
                            Yes
                          </button>
                          <button
                            className={
                              followUpAnswers[question] === "NO"
                                ? "selected"
                                : ""
                            }
                            onClick={() =>
                              setFollowUpAnswers({
                                ...followUpAnswers,
                                [question]: "NO",
                              })
                            }
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <IconButton Icon={CheckCircle2} onClick={applySafetyAnswers}>
                    Recheck safety level
                  </IconButton>
                </div>
              ) : (
                <div className="flow-actions">
                  <IconButton
                    Icon={ChevronLeft}
                    className="ghost"
                    onClick={() => setView("input")}
                  >
                    Edit need
                  </IconButton>
                  <IconButton
                    Icon={GitCompareArrows}
                    onClick={() => setView("service")}
                  >
                    See required public service
                  </IconButton>
                </div>
              )}
            </>,
          )}
        {view === "service" &&
          assessment &&
          standardCard(
            <>
              <button className="back" onClick={() => setView("urgency")}>
                <ChevronLeft /> Urgency
              </button>
              <div className="flow-title">
                <p className="kicker">STEP 3 · SERVICE DECISION</p>
                <h1>The required public service is clear.</h1>
                <p>
                  This is the core product decision: your words are converted
                  into a service-level care need.
                </p>
              </div>
              <div className="service-decision">
                <SearchCheck />
                <div>
                  <span>REQUIRED PUBLIC SERVICE</span>
                  <h2>{assessment.service.replaceAll("_", " ")}</h2>
                  <p>
                    Based on the confirmed need signals and safety
                    classification—not keyword search alone.
                  </p>
                </div>
              </div>
              <div className="flow-actions">
                <IconButton
                  Icon={ChevronLeft}
                  className="ghost"
                  onClick={() => setView("urgency")}
                >
                  Back
                </IconButton>
                <IconButton Icon={GitCompareArrows} onClick={loadComparison}>
                  Compare public facilities
                </IconButton>
              </div>
            </>,
          )}
        {view === "comparison" && assessment && (
          <section className="facilities-page">
            <div className="section-heading">
              <div>
                <p className="kicker">
                  STEP 3 · SERVICE + FACILITY RECOMMENDATION
                </p>
                <h1>
                  {assessment.urgency === "EMERGENCY"
                    ? "Emergency-capable public destination."
                    : "Your suitable public-care options."}
                </h1>
                <p>
                  {assessment.urgency === "EMERGENCY"
                    ? "Immediate human help comes first. This destination is restricted to emergency-capable public care."
                    : "Service suitability and care level are checked before distance. Availability is simulated for this prototype."}
                </p>
              </div>
              <div className="matching-chip">
                <GitCompareArrows /> Service-aware comparison
              </div>
            </div>
            <div
              className="translation-card"
              aria-label="Need-to-service translation"
            >
              <div>
                <span>
                  {sourceMode === "ASHA_ASSISTED"
                    ? "ASHA recorded"
                    : "Citizen said"}
                </span>
                <b>“{message}”</b>
              </div>
              <div>
                <span>RuralCare normalized</span>
                <b>
                  {assessment.service === "CHILD_HEALTH"
                    ? "Stable child-health concern"
                    : assessment.symptoms.join(", ")}
                </b>
              </div>
              <div>
                <span>Deterministic safety result</span>
                <b>{assessment.urgency}</b>
              </div>
              <div>
                <span>Required service / care level</span>
                <b>
                  {routeDecision?.plan.requiredService.replaceAll("_", " ") ||
                    assessment.service.replaceAll("_", " ")}{" "}
                  · {routeDecision?.plan.requiredCareLevel || "PRIMARY"}
                </b>
              </div>
            </div>
            <RouteMap
              facilities={candidates}
              selectedId={selected?.id || recommended?.id}
              service={assessment.service}
              origin={careOrigin}
              onSelect={(facility) =>
                setSelected(facility as FacilityCandidate)
              }
            />
            {routeDecision && (
              <div
                className={`routing-explanation ${routeDecision.rerouted ? "rerouted" : ""}`}
              >
                <b>
                  {routeDecision.rerouted
                    ? "Automatically rerouted"
                    : "Why this route?"}
                </b>
                <span>{routeDecision.explanation}</span>
                <small>
                  Required service:{" "}
                  {routeDecision.plan.requiredService.replaceAll("_", " ")} ·
                  Availability source: SIMULATED_FOR_PROTOTYPE
                </small>
              </div>
            )}
            <div className="facility-list">
              {candidates.map((facility, index) => (
                <article
                  className={`facility-card ${facility.serviceCapacity?.status === "UNAVAILABLE" || !facility.available ? "unavailable-card" : ""}`}
                  key={facility.id}
                >
                  <div className="rank">
                    {facility.serviceCapacity?.status !== "UNAVAILABLE" &&
                    facility.available
                      ? `0${facility.ranking || index + 1}`
                      : "—"}
                  </div>
                  <div className="facility-main">
                    <div className="facility-top">
                      <span className="level-tag">
                        {facility.type.replaceAll("_", " ")}
                      </span>
                      <span
                        className={`capacity-dot ${facility.serviceCapacity?.status?.toLowerCase() || (facility.available ? "available" : "unavailable")}`}
                      >
                        ●{" "}
                        {facility.serviceCapacity?.status ||
                          (facility.available
                            ? "AVAILABLE"
                            : "UNAVAILABLE")}{" "}
                        capacity
                      </span>
                    </div>
                    <h2>{facility.name}</h2>
                    <p>
                      <MapPin size={16} />
                      {facility.distanceKm} km · {facility.address}
                    </p>
                    <div className="reason-list">
                      {(facility.rankingReasons || facility.reasons)
                        ?.slice(0, 4)
                        .map((reason) => (
                          <span key={reason}>
                            <CheckCircle2 size={14} />
                            {reason}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div className="facility-side">
                    <p>
                      <b>
                        {facility.travelMinutes ||
                          Math.round(facility.distanceKm * 4.2)}{" "}
                        min route
                      </b>
                      <small>
                        {facility.serviceCapacity?.estimatedWaitMinutes ?? 30}{" "}
                        min wait ·{" "}
                        {facility.serviceCapacity?.availableBeds ?? 0} beds ·
                        synthetic
                      </small>
                    </p>
                    {facility.serviceCapacity?.status !== "UNAVAILABLE" &&
                    facility.available ? (
                      <IconButton
                        Icon={ArrowRight}
                        onClick={() => {
                          setSelected(facility);
                          setView("recommendation");
                        }}
                      >
                        Explain recommendation
                      </IconButton>
                    ) : (
                      <IconButton
                        Icon={Route}
                        onClick={() => {
                          setSelected(facility);
                          setView("reroute");
                        }}
                      >
                        See reroute
                      </IconButton>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <button
              className="back text-button"
              onClick={() => setView("service")}
            >
              <ChevronLeft /> Required service
            </button>
          </section>
        )}
        {view === "recommendation" &&
          assessment &&
          selected &&
          standardCard(
            <>
              <button className="back" onClick={() => setView("comparison")}>
                <ChevronLeft /> Facility comparison
              </button>
              <div className="flow-title">
                <p className="kicker">STEP 3 · EXPLAINABLE RECOMMENDATION</p>
                <h1>Why {selected.name} is suitable.</h1>
                <p>
                  We make the routing reason visible so the user and ASHA worker
                  can trust the public-care pathway.
                </p>
              </div>
              <div className="recommendation-panel">
                <BadgeCheck />
                <div>
                  <h2>{selected.name}</h2>
                  <p>
                    <b>Service fit:</b> Provides{" "}
                    {assessment.service.replaceAll("_", " ")}.
                  </p>
                  <p>
                    <b>Care capability:</b> {selected.type.replaceAll("_", " ")}{" "}
                    level is appropriate for this need.
                  </p>
                  <p>
                    <b>Current readiness:</b>{" "}
                    {selected.serviceCapacity?.status || "AVAILABLE"} capacity ·{" "}
                    {selected.travelMinutes ||
                      Math.round(selected.distanceKm * 4.2)}{" "}
                    min demo travel ·{" "}
                    {selected.serviceCapacity?.estimatedWaitMinutes ?? 30} min
                    wait · {selected.serviceCapacity?.availableBeds ?? 0} beds.
                    Synthetic demo estimates.
                  </p>
                </div>
              </div>
              <div className="flow-actions">
                <IconButton
                  Icon={ChevronLeft}
                  className="ghost"
                  onClick={() => setView("comparison")}
                >
                  Compare again
                </IconButton>
                <IconButton
                  Icon={ClipboardPlus}
                  onClick={() => setView("referral")}
                >
                  Create continuity pass
                </IconButton>
              </div>
            </>,
          )}
        {view === "reroute" &&
          assessment &&
          selected &&
          standardCard(
            <>
              <button className="back" onClick={() => setView("comparison")}>
                <ChevronLeft /> Facility comparison
              </button>
              <div className="flow-title">
                <p className="kicker">STEP 3 · DYNAMIC REROUTING</p>
                <h1>This facility cannot serve the need right now.</h1>
                <p>
                  {selected.name} provides the required service, but is
                  unavailable in this synthetic shift. RuralCare reroutes
                  instead of sending the citizen on an avoidable trip.
                </p>
              </div>
              <div className="reroute-alert">
                <CircleAlert />
                <div>
                  <b>Unavailable: {selected.name}</b>
                  <span>
                    Reason:{" "}
                    {selected.rerouteReason ||
                      selected.serviceCapacity?.note ||
                      "required service is unavailable in this synthetic shift."}
                  </span>
                </div>
              </div>
              {recommended && (
                <div className="recommendation-panel">
                  <Route />
                  <div>
                    <span>BEST AVAILABLE ALTERNATIVE</span>
                    <h2>{recommended.name}</h2>
                    <p>
                      {recommended.distanceKm} km ·{" "}
                      {recommended.type.replaceAll("_", " ")} ·{" "}
                      {assessment.service.replaceAll("_", " ")} available ·{" "}
                      {recommended.travelMinutes ||
                        Math.round(recommended.distanceKm * 4.2)}{" "}
                      min demo route ·{" "}
                      {recommended.serviceCapacity?.estimatedWaitMinutes ?? 30}{" "}
                      min wait.
                    </p>
                  </div>
                  <IconButton
                    Icon={ArrowRight}
                    onClick={() => {
                      setSelected(recommended);
                      setView("recommendation");
                    }}
                  >
                    Use this pathway
                  </IconButton>
                </div>
              )}
              <button
                className="back text-button"
                onClick={() => setView("comparison")}
              >
                <ChevronLeft /> Compare all options
              </button>
            </>,
          )}
        {view === "referral" && selected && assessment && (
          <section className="referral-page">
            <div className="referral-card">
              <div className="referral-header">
                <div className="brand-mark">
                  <ClipboardPlus />
                </div>
                <div>
                  <span>RURALCARE CONNECT</span>
                  <h1>Continuity pass</h1>
                </div>
                <BadgeCheck />
              </div>
              <p className="muted">
                This is the final hand-off after the correct care pathway has
                been selected.
              </p>
              <label>
                Patient label <small>Demo only; no real personal data</small>
                <input
                  value={patientLabel}
                  onChange={(e) => setPatientLabel(e.target.value)}
                  maxLength={40}
                />
              </label>
              <div className="pass-row">
                <span>CONFIRMED SERVICE</span>
                <b>{assessment.service.replaceAll("_", " ")}</b>
              </div>
              <div className="pass-row">
                <span>FINAL PUBLIC FACILITY</span>
                <b>{selected.name}</b>
              </div>
              {routeDecision?.rerouted && (
                <>
                  <div className="pass-row">
                    <span>ORIGINALLY CONSIDERED</span>
                    <b>
                      {candidates.find(
                        (item) => item.id === routeDecision.originalFacilityId,
                      )?.name || "Unavailable facility"}
                    </b>
                  </div>
                  <div className="pass-row">
                    <span>REROUTE REASON</span>
                    <b>
                      Required service unavailable in the simulated demo shift
                    </b>
                  </div>
                </>
              )}
              <div className="pass-row">
                <span>WHY SELECTED</span>
                <b>
                  {routeDecision?.explanation ||
                    "Suitable service and care-level match within the demo region."}
                </b>
              </div>
              <div className="pass-row">
                <span>NEXT ACTION</span>
                <b>{assessment.nextAction}</b>
              </div>
              <div className="referral-foot">
                <ShieldCheck />
                <span>Continuity after correct routing · Prototype only</span>
              </div>
            </div>
            <div className="referral-copy">
              <p className="kicker">STEP 4 · REFERRAL CONTINUITY</p>
              <h1>Carry the correct pathway forward.</h1>
              <p>
                The referral is not the beginning of RuralCare’s value. It
                preserves the need, urgency, service, and selected public
                facility after safe, explainable routing.
              </p>
              <div className="flow-actions">
                <IconButton
                  Icon={ChevronLeft}
                  className="ghost"
                  onClick={() => setView("recommendation")}
                >
                  Review recommendation
                </IconButton>
                <IconButton Icon={ClipboardPlus} onClick={createReferral}>
                  Create continuity pass
                </IconButton>
              </div>
            </div>
          </section>
        )}
        {view === "followup" && (
          <section className="followup-page">
            <div className="success-mark">
              <BadgeCheck />
            </div>
            <p className="kicker">STEP 4 · FOLLOW-UP</p>
            <h1>The public-care pathway continues.</h1>
            <p>
              Your continuity pass is created or safely queued. The Staff View
              can now coordinate the next hand-off.
            </p>
            {currentReferral && (
              <>
                <article className="digital-referral-pass">
                  <div className="referral-qr">
                    {referralQr ? <img src={referralQr} alt="Referral handover QR code" /> : <QrCode />}
                  </div>
                  <div>
                    <span>DIGITAL REFERRAL PASS</span>
                    <h2>{currentReferral.demoId}</h2>
                    <p>Show this pass at <b>{currentReferral.destinationFacility}</b>. The QR contains only a protected referral identifier.</p>
                    <dl>
                      <div><dt>Confirmed need</dt><dd>{currentReferral.careNeed}</dd></div>
                      <div><dt>தேவையான சேவை</dt><dd>{serviceNameTamil(currentReferral.service)}</dd></div>
                    </dl>
                    <code>{currentReferral.id}</code>
                    <button onClick={() => window.print()}><Printer /> Print pass</button>
                  </div>
                </article>
                <div className="continuity-status">
                  <div>
                    <span>CONTINUITY PASS</span>
                    <b>{currentReferral.demoId}</b>
                  </div>
                  <div>
                    <span>LATEST STATUS</span>
                    <b>{currentReferral.status}</b>
                  </div>
                  <div>
                    <span>SOURCE MODE</span>
                    <b>{sourceMode.replaceAll("_", " ")}</b>
                  </div>
                  <div>
                    <span>SYNC</span>
                    <b>{syncState.replaceAll("_", " ")}</b>
                  </div>
                  <IconButton
                    Icon={RotateCcw}
                    className="ghost"
                    onClick={refreshReferral}
                  >
                    Refresh staff status
                  </IconButton>
                </div>
                {currentReferral.rerouteStatus === "REROUTE_RECOMMENDED" && (
                  <div className="reroute-alert">
                    <Route />
                    <div>
                      <b>Service changed after your referral</b>
                      <p>
                        Your original destination remains{" "}
                        {currentReferral.destinationFacility}. Staff recommend{" "}
                        {currentReferral.recommendedFacility}; confirm only if
                        you accept this new route.
                      </p>
                      <button onClick={confirmReroute}>
                        Confirm alternative facility
                      </button>
                    </div>
                  </div>
                )}
                {currentReferral.clinicalOutcomes?.length > 0 && (
                  <section className="patient-clinical-update">
                    <p className="kicker">CARE TEAM UPDATE</p>
                    {currentReferral.clinicalOutcomes.map((outcome: any) => (
                      <article key={outcome.id}>
                        <div><BadgeCheck /><b>{outcome.disposition.replaceAll("_", " ")}</b></div>
                        <p>{language === "ta" ? outcome.instructionTamil : outcome.instructionEnglish}</p>
                        {language !== "ta" && <p lang="ta">{outcome.instructionTamil}</p>}
                        {outcome.followUpDate && <small>Follow-up: {new Date(`${outcome.followUpDate}T00:00:00`).toLocaleDateString()}</small>}
                        <small>Updated by {outcome.actorName} · {new Date(outcome.timestamp).toLocaleString()}</small>
                      </article>
                    ))}
                  </section>
                )}
              </>
            )}
            <div className="followup-outcome">
              <h2>Was care reached?</h2>
              <p>
                Share a non-identifying access outcome so staff can coordinate
                follow-up and see service gaps.
              </p>
              <textarea
                value={followUpNote}
                onChange={(event) => setFollowUpNote(event.target.value)}
                maxLength={180}
                placeholder="Optional short access note (no medical details)"
              />
              <div>
                <button onClick={() => submitFollowUp("CARE_REACHED")}>
                  Care reached
                </button>
                <button onClick={() => submitFollowUp("COULD_NOT_REACH")}>
                  Could not reach
                </button>
                <button onClick={() => submitFollowUp("SERVICE_NOT_AVAILABLE")}>
                  Service unavailable
                </button>
                <button onClick={() => submitFollowUp("FOLLOW_UP_NEEDED")}>
                  Follow-up needed
                </button>
              </div>
            </div>
            <div className="timeline">
              <div>
                <span>NOW</span>
                <section>
                  <b>Correct service and facility preserved</b>
                  <p>
                    The chosen public-care pathway is ready for the receiving
                    facility.
                  </p>
                </section>
              </div>
              <div>
                <span>NEXT</span>
                <section>
                  <b>Staff coordination</b>
                  <p>
                    ASHA/PHC staff can accept, track arrival, and arrange
                    follow-up.
                  </p>
                </section>
              </div>
              <div>
                <span>FOLLOW-UP</span>
                <section>
                  <b>Reminder and status</b>
                  <p>
                    Confirm that care was reached and the next action is clear.
                  </p>
                </section>
              </div>
            </div>
            <div className="flow-actions">
              <IconButton
                Icon={UsersRound}
                className="ghost"
                onClick={() => void switchPortal("STAFF")}
              >
                Switch to staff sign-in
              </IconButton>
              <IconButton
                Icon={Sparkles}
                onClick={() => {
                  setView("input");
                  setMessage("");
                  setAssessment(null);
                  setSelected(null);
                }}
              >
                Start another journey
              </IconButton>
            </div>
          </section>
        )}
        {view === "myreferrals" && (
          <section className="flow-card pathway-card my-referrals">
            <div className="flow-title">
              <p className="kicker">ACCOUNT-OWNED CONTINUITY</p>
              <h1>
                {user.role === "ASHA"
                  ? "My assisted referrals"
                  : "My referrals"}
              </h1>
              <p>
                Only referrals owned by or explicitly linked to this signed-in
                account are returned by the API.
              </p>
            </div>
            {myReferrals.length === 0 ? (
              <div className="empty-referrals">
                <ClipboardPlus />
                <b>No referrals for this account yet.</b>
                <button onClick={() => setView("input")}>
                  Start a care journey
                </button>
              </div>
            ) : (
              <div className="referral-account-list">
                {myReferrals.map((item) => (
                  <article key={item.id}>
                    <div>
                      <span>{item.demoId}</span>
                      <b>
                        {item.careNeed || item.service?.replaceAll("_", " ")}
                      </b>
                      <small>
                        {item.sourceMode?.replaceAll("_", " ")} ·{" "}
                        {item.destinationFacility}
                      </small>
                    </div>
                    <strong>{item.status?.replaceAll("_", " ")}</strong>
                    <button
                      onClick={() => {
                        setCurrentReferral(item);
                        setView("followup");
                      }}
                    >
                      Open
                    </button>
                  </article>
                ))}
              </div>
            )}
            <button className="back text-button" onClick={openCareJourney}>
              <ChevronLeft /> Back to care journey
            </button>
          </section>
        )}
        {view === "dashboard" && (isClinical || user.role === "ASHA") && <LiveStaffDashboard />}
      </main>
      {!isClinical && view !== "dashboard" && (
        <NavigationAssistant
          language={language}
          stage={view}
          hasRecommendation={Boolean(recommended)}
          rerouted={Boolean(routeDecision?.rerouted)}
          onAction={handleAssistantAction}
        />
      )}
    </div>
  );
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}
createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <AuthenticatedApp />
  </AuthProvider>,
);
