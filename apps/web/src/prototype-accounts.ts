export type ClinicalPrototypePortal = "ASHA" | "STAFF" | "DOCTOR";

const accounts: Record<ClinicalPrototypePortal, { email: string; label: string }> = {
  ASHA: { email: "asha.demo@ruralcare.local", label: "ASHA" },
  STAFF: { email: "staff.demo@ruralcare.local", label: "staff" },
  DOCTOR: { email: "doctor.demo@ruralcare.local", label: "doctor" },
};

export const prototypePassword = "RuralCare@2026";

export function prototypeAccount(portal: string) {
  return portal in accounts ? accounts[portal as ClinicalPrototypePortal] : null;
}
