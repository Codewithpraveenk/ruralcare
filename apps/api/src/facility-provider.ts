import type { Facility, Service, CapacityStatus } from "@ruralcare/shared";
import { db } from "./db.ts";
import { demoFacilities } from "./data.ts";

export interface FacilityDataProvider {
  list(): Facility[];
}
export class ImportedGovernmentFacilityProvider implements FacilityDataProvider {
  list(): Facility[] {
    const overrides = db
      .prepare("SELECT * FROM FacilityServiceStatus WHERE expiresAt IS NULL OR expiresAt > ?")
      .all(new Date().toISOString()) as Array<Record<string, unknown>>;
    return demoFacilities.map((facility) => {
      const capacity = { ...(facility.capacity || {}) };
      for (const item of overrides.filter(
        (row) => row.facilityId === facility.id,
      )) {
        const service = String(item.service) as Service,
          status = String(item.availability) as CapacityStatus,
          current = capacity[service];
        capacity[service] = {
          status,
          estimatedWaitMinutes:
            status === "UNAVAILABLE" ? 0 : current?.estimatedWaitMinutes || 30,
          availableBeds:
            status === "UNAVAILABLE" ? 0 : current?.availableBeds || 0,
          note: `FACILITY_STAFF_REPORTED · ${String(item.verificationNote || "Status confirmed by assigned staff")} · expires ${String(item.expiresAt)}`,
        };
      }
      return {
        ...facility,
        capacity,
        operationalSource: overrides.some((row) => row.facilityId === facility.id)
          ? "FACILITY_STAFF_REPORTED" as const
          : facility.operationalSource || "SIMULATED_FOR_PROTOTYPE" as const,
        lastUpdated: overrides.some((row) => row.facilityId === facility.id)
          ? `Staff report active until ${String(overrides.find((row) => row.facilityId === facility.id)?.expiresAt)}`
          : facility.lastUpdated,
      };
    });
  }
}
export const facilityProvider: FacilityDataProvider =
  new ImportedGovernmentFacilityProvider();
