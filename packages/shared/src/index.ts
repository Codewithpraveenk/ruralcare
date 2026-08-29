export type Urgency = "EMERGENCY" | "URGENT" | "ROUTINE";
export type Service = "PRIMARY_CARE" | "MATERNITY" | "CHILD_HEALTH" | "EMERGENCY" | "TELECONSULT";

export type Assessment = {
  urgency: Urgency;
  service: Service;
  symptoms: string[];
  duration: string;
  explanation: string;
  nextAction: string;
  language: "ta" | "en" | "mixed";
  redFlags: string[];
};

export type Facility = {
  id: string;
  name: string;
  type: "AAM" | "PHC" | "CHC" | "DISTRICT_HOSPITAL" | "DISPENSARY";
  distanceKm: number;
  services: Service[];
  available: boolean;
  hours: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
};

const emergencyWords = ["chest pain", "unconscious", "not breathing", "severe bleeding", "seizure", "poison", "suicide", "கடுமையான இரத்தப்போக்கு", "மூச்சு திணறல்", "மயக்கம்", "வலிப்பு"];
const urgentWords = ["high fever", "fever", "pregnant", "pregnancy", "labour", "labor", "baby", "child", "vomit", "vomiting", "கர்ப்ப", "காய்ச்சல்", "குழந்தை", "வாந்தி"];

export function assessNeed(message: string): Assessment {
  const normalized = message.toLowerCase();
  const redFlags = emergencyWords.filter((word) => normalized.includes(word));
  const language = /[\u0B80-\u0BFF]/.test(message) ? (/[a-z]/i.test(message) ? "mixed" : "ta") : "en";
  if (redFlags.length) return { urgency: "EMERGENCY", service: "EMERGENCY", symptoms: redFlags, duration: "Not assessed", language, redFlags, explanation: "Possible emergency warning signs were detected. This prototype cannot diagnose the cause.", nextAction: "Seek immediate in-person emergency help. Do not wait for an app response." };
  const hits = urgentWords.filter((word) => normalized.includes(word));
  const maternity = /pregnant|pregnancy|labour|labor|கர்ப்ப/.test(normalized);
  const child = /baby|child|குழந்தை/.test(normalized);
  const urgency: Urgency = hits.length ? "URGENT" : "ROUTINE";
  const service: Service = maternity ? "MATERNITY" : child ? "CHILD_HEALTH" : "PRIMARY_CARE";
  return { urgency, service, symptoms: hits.length ? hits : ["General health concern"], duration: /day|week|நாள்/.test(normalized) ? "Mentioned by user" : "Not specified", language, redFlags: [], explanation: urgency === "URGENT" ? "Your message suggests a concern that should be assessed by a public facility today." : "This is a navigation suggestion, not a medical diagnosis.", nextAction: urgency === "URGENT" ? "Visit a suitable public facility today." : "Visit a suitable public primary-care facility." };
}

const levelScore: Record<Facility["type"], number> = { AAM: 1, DISPENSARY: 1, PHC: 2, CHC: 3, DISTRICT_HOSPITAL: 4 };
export function calculateDistanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = radians(to.latitude - from.latitude);
  const deltaLongitude = radians(to.longitude - from.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}
export function rankFacilities(facilities: Facility[], service: Service): Facility[] {
  return facilities.filter((facility) => facility.available && facility.services.includes(service)).sort((a, b) => {
    const aScore = levelScore[a.type] * 2 - a.distanceKm;
    const bScore = levelScore[b.type] * 2 - b.distanceKm;
    return bScore - aScore;
  });
}
