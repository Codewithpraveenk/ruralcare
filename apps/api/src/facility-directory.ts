import { calculateDistanceKm, type CapabilitySource, type Facility, type Service, type ServiceCapacity } from "@ruralcare/shared";

export type DirectoryRecord = { sourceRowId: string; name: string; category: string; careType: string; address: string; district: string; pincode: string; originalCoordinates: string; specialties: string; facilities: string };
type CoordinateEnrichment = { facilityId: string; sourceRowId: string; latitude: number; longitude: number; lookupSource: string; matchingEvidence: string; retrievedOn: string; confidence: "HIGH"; routingLevel: Facility["type"] };

// Versioned extraction from hospital_directory.csv: State = Tamil Nadu and Hospital_Category = Public/ Government.
// The supplied Location_Coordinates column was blank for every record in this extract.
const sourceTsv = `23749|Government General Hospital|Public/ Government|0|Government General Hospital|Chennai|600003||0|0
24035|Public Health Centre|Public/ Government|0|174, Lake View Road, West Mambalam, Near Ayodhya Mandapam|Chennai|600033||0|0
24194|Adyar Dispensary|Public/ Government|Dispensary|Block No l.122/169-170, CPWD Quarters, Indira Nagar, Adyar|Chennai|600020||0|0
24195|Ana Nagar Dispensary and Polyclinic Central|Public/ Government|Dispensary/ Poly Clinic|Revenue Quarters, No.15, Ranganathan Garden, Anna Nagar|Chennai|600040||0|0
24196|George Town Dispensary|Public/ Government|Dispensary|No.64, Thathamuthiappan Street, George Town|Chennai|600001||0|0
24197|Gopalapuram Dispensary|Public/ Government|Dispensary|No.1, 1st Street, Gopalapuram|Chennai|600086||0|0
24198|Guindy Dispensary|Public/ Government|Dispensary|Block No.6/1-5, BCG Staff Quarters, Guindy|Chennai|600032||0|0
24199|K.K.Nagar Dispensary and Polyclinic|Public/ Government|Dispensary/ Poly Clinic|GPRA Complex, CPWD Quarters, K.K.Nagar|Chennai|600078||0|0
24200|Meenambakkam Dispensary|Public/ Government|Dispensary|DGQA Complex, Meenambakkam|Chennai|600114||0|0
24201|Nandambakkam Dispensary|Public/ Government|Dispensary|Quarter No.16-19 CDA Residential Complex, Nandambakkam|Chennai|600089||0|0
24202|Nungambakkam Dispensary CandB Block|Public/ Government|Dispensary|Nungambakkam Dispensary CandB Block, 1st Floor, Shastri Bhavan, Haddows Road|Chennai|600006||0|0
24203|Perambur Dispensary|Public/ Government|Dispensary|No 28, Perambur High Road, Perambur|Chennai|600012||0|0
24204|Raja Annamalai Puram Dispensary No.6|Public/ Government|Dispensary|Kamaraj Saalai, R.A.Puram|Chennai|600028||0|0
24205|Royapuram Dispensary, No.108 and 109|Public/ Government|Dispensary|Mannar Swami Koil Street, Royapuram|Chennai|600013||0|0
24206|Triplicane Dispensary|Public/ Government|Dispensary|No.54, Akbar Sahib Street, Triplicane|Chennai|600005||0|0
24207|Vepery Dispensary|Public/ Government|Dispensary|No.143, Perambur Barracks Road Vepery|Chennai|600007||0|0
24230|Sree Balaji Medical College and Hospital|Public/ Government|Hospital|No.7, Works Road|Chennai|600044||Anatomy, Physiology, Biochemistry, Pathology, Microbiology, Forensic Medicine and Toxicology, Pharmacology, Paediatrics, Community Medicine, Anaesthesiology and Pain Clinic, ENT and Head Neck Surgery, Ophthalmology, General Medicine, General Surgery, Obstetrics and Gynaecology, Orthopaedics, Psychiatry, Chest and TB, Dermatology, Casualty (Accident and Emergency Medicine), Radiology and Imaging Sciences, Cardiac Care Center, Urology and Nephrology, Neuro Surgery, Neurology, Surgical Gastroenterology|0
25037|Kanyakumari Government Hospital and College|Public/ Government|Hospital|Asaripallam|Kanniyakumari|629201||||
25039|Government Hospital|Public/ Government|Hospital|Government Hospital Campus|Kanniyakumari|629702|||Ambulance Service, Chemist, General Ward, X-ray, Blood Bank, Causality, I.C.C.U., CT SCAN
25398|Vinayaka Missions Medical College|Public/ Government|Hospital|Sankari Main Road|Salem|636308||||`;

export const tamilNaduPublicDirectory: DirectoryRecord[] = sourceTsv.split("\n").map((line) => {
  const [sourceRowId, name, category, careType, address, district, pincode, originalCoordinates, specialties, facilities] = line.split("|");
  return { sourceRowId, name, category, careType, address, district, pincode, originalCoordinates, specialties, facilities };
});

// Public-map enrichments are intentionally separate from the government-directory facts.
const coordinateEnrichments: CoordinateEnrichment[] = [
  { facilityId: "public-health-centre-west-mambalam", sourceRowId: "24035", latitude: 13.036565, longitude: 80.22176, lookupSource: "https://www.hospitalsnearme.in/tamilnadu-tn/public-health-centre-hospital-chennai/", matchingEvidence: "Exact facility name, 174 Lake View Road, West Mambalam, Chennai 600033", retrievedOn: "2026-08-30", confidence: "HIGH", routingLevel: "PHC" },
  { facilityId: "gopalapuram-dispensary", sourceRowId: "24197", latitude: 13.049097, longitude: 80.257621, lookupSource: "https://cghshospitals.com/wellness-centres/chennai", matchingEvidence: "Exact facility name, No.1 1st Street, Gopalapuram, Chennai 600086", retrievedOn: "2026-08-30", confidence: "HIGH", routingLevel: "DISPENSARY" },
  { facilityId: "kk-nagar-dispensary", sourceRowId: "24199", latitude: 13.0368, longitude: 80.2079107, lookupSource: "https://www.latlong.net/poi/k-k-nagar-dispensary-and-polyclinic-402035", matchingEvidence: "Exact facility name, GPRA Complex, CPWD Quarters, K.K.Nagar, Chennai 600078", retrievedOn: "2026-08-30", confidence: "HIGH", routingLevel: "DISPENSARY" },
  { facilityId: "kanyakumari-government-medical-college", sourceRowId: "25037", latitude: 8.1738722, longitude: 77.3938778, lookupSource: "https://mapcarta.com/W551805512", matchingEvidence: "Kanyakumari Government Medical College Hospital at Asaripallam, Kanniyakumari 629201", retrievedOn: "2026-08-30", confidence: "HIGH", routingLevel: "DISTRICT_HOSPITAL" },
  { facilityId: "government-hospital-kanniyakumari", sourceRowId: "25039", latitude: 8.0834769, longitude: 77.5474128, lookupSource: "https://www.latlong.net/poi/government-hospital-kanniyakumari-374920", matchingEvidence: "Exact facility name and Kanniyakumari 629702 pincode", retrievedOn: "2026-08-30", confidence: "HIGH", routingLevel: "DISTRICT_HOSPITAL" }
];

const shiftAvailability: Record<string, { available: boolean; note: string }> = {
  "public-health-centre-west-mambalam": { available: true, note: "Availability simulated for demo" },
  "gopalapuram-dispensary": { available: false, note: "Unavailable in this synthetic demo shift" },
  "kk-nagar-dispensary": { available: true, note: "Availability simulated for demo" },
  "kanyakumari-government-medical-college": { available: true, note: "Availability simulated for demo" },
  "government-hospital-kanniyakumari": { available: true, note: "Availability simulated for demo" }
};

const syntheticCapacity: Record<string, Partial<Record<Service, ServiceCapacity>>> = {
  "public-health-centre-west-mambalam": {
    PRIMARY_CARE: { status: "AVAILABLE", estimatedWaitMinutes: 18, availableBeds: 4, note: "General OPD ready in the synthetic demo shift" },
    CHILD_HEALTH: { status: "AVAILABLE", estimatedWaitMinutes: 25, availableBeds: 2, note: "Child-health desk available in the synthetic demo shift" },
    MATERNITY: { status: "LIMITED", estimatedWaitMinutes: 45, availableBeds: 1, note: "One observation bed shown for the synthetic demo" }
  },
  "gopalapuram-dispensary": { PRIMARY_CARE: { status: "UNAVAILABLE", estimatedWaitMinutes: 0, availableBeds: 0, note: "Unavailable in the synthetic demo shift" } },
  "kk-nagar-dispensary": { PRIMARY_CARE: { status: "AVAILABLE", estimatedWaitMinutes: 12, availableBeds: 0, note: "Walk-in public dispensary shown as available in the synthetic demo" } },
  "kanyakumari-government-medical-college": {
    PRIMARY_CARE: { status: "AVAILABLE", estimatedWaitMinutes: 35, availableBeds: 12, note: "Synthetic tertiary-care capacity" },
    CHILD_HEALTH: { status: "AVAILABLE", estimatedWaitMinutes: 28, availableBeds: 6, note: "Synthetic paediatric capacity" },
    MATERNITY: { status: "AVAILABLE", estimatedWaitMinutes: 30, availableBeds: 5, note: "Synthetic maternity capacity" },
    EMERGENCY: { status: "AVAILABLE", estimatedWaitMinutes: 8, availableBeds: 4, note: "Synthetic emergency capacity" }
  },
  "government-hospital-kanniyakumari": {
    PRIMARY_CARE: { status: "LIMITED", estimatedWaitMinutes: 55, availableBeds: 1, note: "Synthetic limited OPD capacity" },
    CHILD_HEALTH: { status: "AVAILABLE", estimatedWaitMinutes: 35, availableBeds: 3, note: "Synthetic child-health capacity" },
    MATERNITY: { status: "LIMITED", estimatedWaitMinutes: 50, availableBeds: 1, note: "Synthetic limited maternity capacity" },
    EMERGENCY: { status: "AVAILABLE", estimatedWaitMinutes: 14, availableBeds: 2, note: "Synthetic emergency capacity" }
  }
};

export const demoOrigin = { latitude: 13.041, longitude: 80.224 };
const referenceServices: Record<Facility["type"], Service[]> = {
  AAM: ["PRIMARY_CARE"], DISPENSARY: ["PRIMARY_CARE"], PHC: ["PRIMARY_CARE", "MATERNITY", "CHILD_HEALTH"], CHC: ["PRIMARY_CARE", "MATERNITY", "CHILD_HEALTH", "EMERGENCY"], DISTRICT_HOSPITAL: ["PRIMARY_CARE", "MATERNITY", "CHILD_HEALTH", "EMERGENCY"]
};
function directorySpecialtyServices(record: DirectoryRecord): Service[] {
  const value = `${record.specialties} ${record.facilities}`.toLowerCase();
  if (!value || value === "0") return [];
  return [["paediatrics", "CHILD_HEALTH"], ["obstetrics", "MATERNITY"], ["gynaecology", "MATERNITY"], ["general medicine", "PRIMARY_CARE"], ["casualty", "EMERGENCY"], ["emergency", "EMERGENCY"]].flatMap(([term, service]) => value.includes(term) ? [service as Service] : []);
}
export function buildFacilityRecords(): Facility[] {
  return coordinateEnrichments.map((enrichment) => {
    const source = tamilNaduPublicDirectory.find((record) => record.sourceRowId === enrichment.sourceRowId);
    const availability = shiftAvailability[enrichment.facilityId];
    if (!source || source.category !== "Public/ Government" || !source.name || !source.address || !source.district || !availability) throw new Error(`Invalid facility source: ${enrichment.facilityId}`);
    if (!Number.isFinite(enrichment.latitude) || !Number.isFinite(enrichment.longitude) || Math.abs(enrichment.latitude) > 90 || Math.abs(enrichment.longitude) > 180) throw new Error(`Invalid coordinates: ${enrichment.facilityId}`);
    const explicitServices = directorySpecialtyServices(source);
    const capabilitySource: CapabilitySource = explicitServices.length ? "SOURCED_FROM_DIRECTORY" : "INFERRED_FROM_FACILITY_TYPE";
    const services = explicitServices.length ? explicitServices : referenceServices[enrichment.routingLevel];
    const serviceSources = Object.fromEntries(services.map((service) => [service, capabilitySource])) as Partial<Record<Service, CapabilitySource>>;
    return { id: enrichment.facilityId, name: source.name, type: enrichment.routingLevel, services, capabilitySource, serviceSources, available: availability.available, hours: availability.note, address: source.address, phone: "Not published in supplied directory", latitude: enrichment.latitude, longitude: enrichment.longitude, distanceKm: calculateDistanceKm(demoOrigin, enrichment), capacity: syntheticCapacity[enrichment.facilityId] || {}, lastUpdated: "Synthetic demo shift · 09:30 IST" };
  });
}
export function facilityProvenance() {
  const records = buildFacilityRecords();
  return { source: "Government of India National Hospital Directory (hospital_directory.csv)", sourceUrl: "https://www.data.gov.in/resource/national-hospital-directory-geo-code-and-additional-parameters-updated-till-last-month", filter: { state: "Tamil Nadu", hospitalCategory: "Public/ Government" }, sourceRecords: tamilNaduPublicDirectory.length, includedFacilities: coordinateEnrichments.map(({ facilityId, sourceRowId, lookupSource, matchingEvidence, retrievedOn, confidence }) => ({ facilityId, sourceRowId, lookupSource, matchingEvidence, retrievedOn, confidence })), capabilities: { sourced: records.filter((record) => record.capabilitySource === "SOURCED_FROM_DIRECTORY").length, inferred: records.filter((record) => record.capabilitySource === "INFERRED_FROM_FACILITY_TYPE").length }, labels: ["Official directory identity", "Coordinate enriched from a separately cited public map source", "Distance calculated only for enriched coordinates", "SOURCED_FROM_DIRECTORY or INFERRED_FROM_FACILITY_TYPE", "Synthetic demo availability"] };
}
