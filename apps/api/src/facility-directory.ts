import {
  calculateDistanceKm,
  type CapabilitySource,
  type Facility,
  type Service,
  type ServiceCapacity,
} from "@ruralcare/shared";

export type DirectoryRecord = {
  sourceRowId: string;
  name: string;
  category: "Public/ Government";
  careType: string;
  address: string;
  district: "Chengalpattu";
  pincode: string;
  phone: string;
  sourceUrl: string;
  retrievedOn: string;
  explicitlySourcedServices: Service[];
  serviceEvidence?: string;
};
type CoordinateEnrichment = {
  facilityId: string;
  sourceRowId: string;
  latitude: number;
  longitude: number;
  lookupSource: string;
  matchingEvidence: string;
  retrievedOn: string;
  confidence: "HIGH";
  routingLevel: Facility["type"];
};

// Version 2026-09-03. Identity, address and phone are copied from official Tamil Nadu
// district/municipality pages. They make no claim about current doctors, beds or queues.
export const tamilNaduPublicDirectory: DirectoryRecord[] = [
  {
    sourceRowId: "cgl-district-cheyyur",
    name: "Government Hospital, Cheyyur",
    category: "Public/ Government",
    careType: "Government Hospital",
    address: "Government Hospital, Salt Road, Cheyyur - 603302",
    district: "Chengalpattu",
    pincode: "603302",
    phone: "9947589042",
    sourceUrl: "https://chengalpattu.nic.in/public-utility-category/hospitals/",
    retrievedOn: "2026-09-03",
    explicitlySourcedServices: [],
  },
  {
    sourceRowId: "cgl-district-chromepet",
    name: "Government Hospital, Chromepet",
    category: "Public/ Government",
    careType: "Government Hospital",
    address:
      "Great Southern Trunk Road, Mahalakshmi Colony, Chromepet, Tambaram, Chennai - 600044",
    district: "Chengalpattu",
    pincode: "600044",
    phone: "9789721967",
    sourceUrl: "https://chengalpattu.nic.in/public-utility-category/hospitals/",
    retrievedOn: "2026-09-03",
    explicitlySourcedServices: [],
  },
  {
    sourceRowId: "cgl-district-madurantakam",
    name: "Government Hospital, Madurantakam",
    category: "Public/ Government",
    careType: "Taluk Hospital",
    address: "Government Hospital, Hospital Road, Madurantakam - 603306",
    district: "Chengalpattu",
    pincode: "603306",
    phone: "7358124622",
    sourceUrl: "https://chengalpattu.nic.in/public-utility-category/hospitals/",
    retrievedOn: "2026-09-03",
    explicitlySourcedServices: ["PRIMARY_CARE", "MATERNITY", "EMERGENCY"],
    serviceEvidence:
      "Official Madurantakam master-plan publication lists maternity, accident and emergency, surgery, X-ray, dental, family-welfare and Siddha services.",
  },
  {
    sourceRowId: "cgl-municipality-medical-college",
    name: "Government Chengalpattu Medical College Hospital",
    category: "Public/ Government",
    careType: "Medical College Hospital",
    address:
      "GST Road, Chengalpattu Medical College Campus, Chengalpattu - 603001",
    district: "Chengalpattu",
    pincode: "603001",
    phone: "Not published on source page",
    sourceUrl: "https://www.tnurbantree.tn.gov.in/chengalpattu/hospitals/",
    retrievedOn: "2026-09-03",
    explicitlySourcedServices: [],
  },
  {
    sourceRowId: "cgl-municipality-maternity",
    name: "Municipal Maternity Hospital",
    category: "Public/ Government",
    careType: "Municipal Maternity Hospital",
    address: "Hanumanthaputheri, Chengalpattu",
    district: "Chengalpattu",
    pincode: "",
    phone: "Not published on source page",
    sourceUrl: "https://www.tnurbantree.tn.gov.in/chengalpattu/hospitals/",
    retrievedOn: "2026-09-03",
    explicitlySourcedServices: ["MATERNITY"],
    serviceEvidence:
      "The official municipality directory explicitly identifies this as a maternity hospital.",
  },
  ...[
    ["thirukalukundram", "Thirukalukundram", "Taluk Hospital"],
    ["mamallapuram", "Mamallapuram", "Non-Taluk Hospital"],
    ["nandhivaram", "Nandhivaram", "Primary Health Center"],
    ["medavakkam", "Medavakkam", "Primary Health Center"],
    ["pavunjur", "Pavunjur", "Primary Health Center"],
    ["achirapakkam", "Achirapakkam", "Primary Health Center"],
    ["zamin-endathur", "Zamin Endathur", "Primary Health Center"],
    ["kelambakkam", "Kelambakkam", "Primary Health Center"],
    ["chunampet", "Chunampet", "Primary Health Center"],
    ["maraimalai-nagar", "Maraimalai Nagar", "Primary Health Center"],
    ["koovathur", "Koovathur", "Primary Health Center"],
    ["sadras", "Sadras", "Primary Health Center"],
  ].map(([slug, name, careType]) => ({
    sourceRowId: `imhd-chengalpet-${slug}`,
    name,
    category: "Public/ Government" as const,
    careType,
    address: `${name}, Chengalpattu district — exact street address not published in source`,
    district: "Chengalpattu" as const,
    pincode: "",
    phone: "Not published on source page",
    sourceUrl: "https://imhd.tn.gov.in/siddha-hospitals/",
    retrievedOn: "2026-09-03",
    explicitlySourcedServices: [] as Service[],
    serviceEvidence: `The official Tamil Nadu Indian Medicine directory confirms a Siddha wing at this ${careType}; it does not verify the modern-medicine services used by RuralCare routing.`,
  })),
];

// Coordinates are separately provenance-labelled OpenStreetMap/Nominatim matches.
// The maternity record stays in provenance but is excluded until coordinates are verified.
const coordinateEnrichments: CoordinateEnrichment[] = [
  {
    facilityId: "government-hospital-madurantakam",
    sourceRowId: "cgl-district-madurantakam",
    latitude: 12.5093491,
    longitude: 79.8903597,
    lookupSource: "https://www.openstreetmap.org/",
    matchingEvidence: "Exact hospital name and Madurantakam locality match",
    retrievedOn: "2026-09-03",
    confidence: "HIGH",
    routingLevel: "CHC",
  },
  {
    facilityId: "government-hospital-cheyyur",
    sourceRowId: "cgl-district-cheyyur",
    latitude: 12.35204,
    longitude: 80.002556,
    lookupSource: "https://www.openstreetmap.org/",
    matchingEvidence: "Government hospital and Cheyyur locality match",
    retrievedOn: "2026-09-03",
    confidence: "HIGH",
    routingLevel: "CHC",
  },
  {
    facilityId: "government-hospital-chromepet",
    sourceRowId: "cgl-district-chromepet",
    latitude: 12.9516,
    longitude: 80.1413,
    lookupSource: "https://www.openstreetmap.org/",
    matchingEvidence:
      "Government hospital, GST Road and Chromepet locality match",
    retrievedOn: "2026-09-03",
    confidence: "HIGH",
    routingLevel: "CHC",
  },
  {
    facilityId: "chengalpattu-government-medical-college",
    sourceRowId: "cgl-municipality-medical-college",
    latitude: 12.6819,
    longitude: 79.9834,
    lookupSource: "https://www.openstreetmap.org/",
    matchingEvidence:
      "Medical college hospital campus and Chengalpattu locality match",
    retrievedOn: "2026-09-03",
    confidence: "HIGH",
    routingLevel: "DISTRICT_HOSPITAL",
  },
  {facilityId:"government-hospital-thirukalukundram",sourceRowId:"imhd-chengalpet-thirukalukundram",latitude:12.6067021,longitude:80.0587443,lookupSource:"https://www.openstreetmap.org/",matchingEvidence:"Exact Thirukalukundram Government Hospital, locality and Chengalpattu district match",retrievedOn:"2026-09-03",confidence:"HIGH",routingLevel:"CHC"},
  {facilityId:"government-hospital-mamallapuram",sourceRowId:"imhd-chengalpet-mamallapuram",latitude:12.61773,longitude:80.180966,lookupSource:"https://www.openstreetmap.org/",matchingEvidence:"Government Hospital at Mahabalipuram/Mamallapuram, locality and Chengalpattu district match",retrievedOn:"2026-09-03",confidence:"HIGH",routingLevel:"CHC"},
  {facilityId:"primary-health-centre-medavakkam",sourceRowId:"imhd-chengalpet-medavakkam",latitude:12.9142715,longitude:80.1918308,lookupSource:"https://www.openstreetmap.org/",matchingEvidence:"Exact Primary Health Centre and Medavakkam locality match",retrievedOn:"2026-09-03",confidence:"HIGH",routingLevel:"PHC"},
  {facilityId:"primary-health-centre-maraimalai-nagar",sourceRowId:"imhd-chengalpet-maraimalai-nagar",latitude:12.7912159,longitude:80.0329128,lookupSource:"https://www.openstreetmap.org/",matchingEvidence:"Exact Government Primary Health Centre and Maraimalai Nagar locality match",retrievedOn:"2026-09-03",confidence:"HIGH",routingLevel:"PHC"},
  {facilityId:"primary-health-centre-sadras",sourceRowId:"imhd-chengalpet-sadras",latitude:12.5274531,longitude:80.1631378,lookupSource:"https://www.openstreetmap.org/",matchingEvidence:"Exact Government Primary Health Centre, Sadras and Chengalpattu district match",retrievedOn:"2026-09-03",confidence:"HIGH",routingLevel:"PHC"},
];

// Operational values remain simulated, at field level, only for the rerouting demo.
const syntheticCapacity: Record<
  string,
  Partial<Record<Service, ServiceCapacity>>
> = {
  "government-hospital-madurantakam": {
    PRIMARY_CARE: {
      status: "UNAVAILABLE",
      estimatedWaitMinutes: 0,
      availableBeds: 0,
      note: "SIMULATED_FOR_PROTOTYPE · OPD unavailable to demonstrate rerouting",
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
  "government-hospital-cheyyur": {
    PRIMARY_CARE: {
      status: "AVAILABLE",
      estimatedWaitMinutes: 20,
      availableBeds: 0,
      note: "SIMULATED_FOR_PROTOTYPE",
    },
    MATERNITY: {
      status: "LIMITED",
      estimatedWaitMinutes: 50,
      availableBeds: 1,
      note: "SIMULATED_FOR_PROTOTYPE",
    },
    CHILD_HEALTH: {
      status: "AVAILABLE",
      estimatedWaitMinutes: 25,
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
  "government-hospital-chromepet": {
    PRIMARY_CARE: {
      status: "AVAILABLE",
      estimatedWaitMinutes: 30,
      availableBeds: 2,
      note: "SIMULATED_FOR_PROTOTYPE",
    },
    MATERNITY: {
      status: "AVAILABLE",
      estimatedWaitMinutes: 35,
      availableBeds: 2,
      note: "SIMULATED_FOR_PROTOTYPE",
    },
    CHILD_HEALTH: {
      status: "AVAILABLE",
      estimatedWaitMinutes: 30,
      availableBeds: 2,
      note: "SIMULATED_FOR_PROTOTYPE",
    },
    EMERGENCY: {
      status: "AVAILABLE",
      estimatedWaitMinutes: 10,
      availableBeds: 3,
      note: "SIMULATED_FOR_PROTOTYPE",
    },
  },
  "chengalpattu-government-medical-college": {
    PRIMARY_CARE: {
      status: "AVAILABLE",
      estimatedWaitMinutes: 40,
      availableBeds: 6,
      note: "SIMULATED_FOR_PROTOTYPE",
    },
    MATERNITY: {
      status: "AVAILABLE",
      estimatedWaitMinutes: 30,
      availableBeds: 4,
      note: "SIMULATED_FOR_PROTOTYPE",
    },
    CHILD_HEALTH: {
      status: "AVAILABLE",
      estimatedWaitMinutes: 25,
      availableBeds: 4,
      note: "SIMULATED_FOR_PROTOTYPE",
    },
    EMERGENCY: {
      status: "AVAILABLE",
      estimatedWaitMinutes: 8,
      availableBeds: 5,
      note: "SIMULATED_FOR_PROTOTYPE",
    },
  },
};

export const demoOrigin = { latitude: 12.514, longitude: 79.884 };
const referenceServices: Record<Facility["type"], Service[]> = {
  AAM: ["PRIMARY_CARE"],
  DISPENSARY: ["PRIMARY_CARE"],
  PHC: ["PRIMARY_CARE", "MATERNITY", "CHILD_HEALTH"],
  CHC: ["PRIMARY_CARE", "MATERNITY", "CHILD_HEALTH", "EMERGENCY"],
  DISTRICT_HOSPITAL: ["PRIMARY_CARE", "MATERNITY", "CHILD_HEALTH", "EMERGENCY"],
};

export function buildFacilityRecords(): Facility[] {
  return coordinateEnrichments.map((enrichment) => {
    const source = tamilNaduPublicDirectory.find(
      (record) => record.sourceRowId === enrichment.sourceRowId,
    );
    if (!source)
      throw new Error(`Invalid facility source: ${enrichment.facilityId}`);
    const explicit = new Set(source.explicitlySourcedServices),
      services = [
        ...new Set([
          ...source.explicitlySourcedServices,
          ...referenceServices[enrichment.routingLevel],
        ]),
      ];
    const serviceSources = Object.fromEntries(
      services.map((service) => [
        service,
        explicit.has(service)
          ? "SOURCED_FROM_DIRECTORY"
          : "INFERRED_FROM_FACILITY_TYPE",
      ]),
    ) as Partial<Record<Service, CapabilitySource>>;
    return {
      id: enrichment.facilityId,
      name: source.name,
      type: enrichment.routingLevel,
      services,
      capabilitySource: explicit.size
        ? "SOURCED_FROM_DIRECTORY"
        : "INFERRED_FROM_FACILITY_TYPE",
      serviceSources,
      available: true,
      hours: "Hours not published — verify before travel",
      address: source.address,
      phone: source.phone,
      latitude: enrichment.latitude,
      longitude: enrichment.longitude,
      distanceKm: calculateDistanceKm(demoOrigin, enrichment),
      capacity: syntheticCapacity[enrichment.facilityId]||Object.fromEntries(services.map(service=>[service,{status:"AVAILABLE",estimatedWaitMinutes:30,availableBeds:0,note:"SIMULATED_FOR_PROTOTYPE · no live operational feed"}])) as Partial<Record<Service,ServiceCapacity>>,
      lastUpdated: "Operational values: SIMULATED_FOR_PROTOTYPE",
    };
  });
}

export function facilityProvenance() {
  const records = buildFacilityRecords(),
    serviceEntries = records.flatMap((record) =>
      record.services.map((service) => record.serviceSources?.[service]),
    );
  return {
    source:
      "Official Tamil Nadu Chengalpattu district, municipality and Indian Medicine facility directories",
    sourceUrl: "https://chengalpattu.nic.in/public-utility-category/hospitals/",
    additionalSourceUrl:
      "https://www.tnurbantree.tn.gov.in/chengalpattu/hospitals/",
    filter: { district: "Chengalpattu", ownership: "Public/ Government" },
    sourceRecords: tamilNaduPublicDirectory.length,
    chengalpattuRecords: tamilNaduPublicDirectory.length,
    validCoordinateRecords: coordinateEnrichments.length,
    includedFacilities: coordinateEnrichments.map(
      ({
        facilityId,
        sourceRowId,
        lookupSource,
        matchingEvidence,
        retrievedOn,
        confidence,
      }) => ({
        facilityId,
        sourceRowId,
        lookupSource,
        matchingEvidence,
        retrievedOn,
        confidence,
      }),
    ),
    capabilities: {
      sourced: serviceEntries.filter(
        (value) => value === "SOURCED_FROM_DIRECTORY",
      ).length,
      inferred: serviceEntries.filter(
        (value) => value === "INFERRED_FROM_FACILITY_TYPE",
      ).length,
    },
    labels: [
      "Official government directory identity/address/phone",
      "Coordinates separately enriched and provenance-labelled",
      "INFERRED_FROM_FACILITY_TYPE is not verified local capability",
      "Wait, bed and availability values are SIMULATED_FOR_PROTOTYPE",
      "Verify facility availability before travel",
    ],
  };
}

export function facilityReviewQueue(){
  const included=new Map(coordinateEnrichments.map(item=>[item.sourceRowId,item]));
  return tamilNaduPublicDirectory.map(record=>{
    const coordinate=included.get(record.sourceRowId),routeable=Boolean(coordinate);
    return {sourceRowId:record.sourceRowId,name:record.name,careType:record.careType,district:record.district,address:record.address,phone:record.phone,sourceUrl:record.sourceUrl,retrievedOn:record.retrievedOn,routeable,facilityId:coordinate?.facilityId||null,coordinateConfidence:coordinate?.confidence||null,missing:routeable?[]:[record.address.includes("exact street address not published")?"VERIFIED_STREET_ADDRESS":"VERIFIED_COORDINATES","VERIFIED_COORDINATES"].filter((value,index,items)=>items.indexOf(value)===index),serviceBoundary:record.explicitlySourcedServices.length?record.explicitlySourcedServices:"No modern-medicine service capability verified"};
  });
}
