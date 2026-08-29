import type { Facility } from "@ruralcare/shared";

export const demoFacilities: Facility[] = [
  { id: "aam-kallur", name: "Kallur Ayushman Arogya Mandir", type: "AAM", distanceKm: 1.8, services: ["PRIMARY_CARE", "CHILD_HEALTH", "TELECONSULT"], available: true, hours: "Mon-Sat, 9:00-16:00", address: "Kallur village (synthetic)", phone: "00000 00001", latitude: 11.01, longitude: 78.01 },
  { id: "phc-melur", name: "Melur Public Health Centre", type: "PHC", distanceKm: 5.6, services: ["PRIMARY_CARE", "CHILD_HEALTH", "MATERNITY", "TELECONSULT"], available: true, hours: "24x7 maternity; OPD 9:00-17:00", address: "Melur block (synthetic)", phone: "00000 00002", latitude: 11.04, longitude: 78.05 },
  { id: "chc-vadakku", name: "Vadakku Community Health Centre", type: "CHC", distanceKm: 14.2, services: ["PRIMARY_CARE", "CHILD_HEALTH", "MATERNITY", "EMERGENCY"], available: true, hours: "24x7 emergency", address: "Vadakku town (synthetic)", phone: "00000 00003", latitude: 11.12, longitude: 78.11 },
  { id: "dh-demo", name: "District Government Hospital", type: "DISTRICT_HOSPITAL", distanceKm: 27.5, services: ["PRIMARY_CARE", "CHILD_HEALTH", "MATERNITY", "EMERGENCY"], available: true, hours: "24x7", address: "Demo district HQ (synthetic)", phone: "00000 00004", latitude: 11.24, longitude: 78.2 },
  { id: "phc-unavailable", name: "Eastbank Public Health Centre", type: "PHC", distanceKm: 3.4, services: ["PRIMARY_CARE", "MATERNITY"], available: false, hours: "Service unavailable in demo", address: "Eastbank (synthetic)", phone: "00000 00005", latitude: 11.03, longitude: 78.03 }
];
