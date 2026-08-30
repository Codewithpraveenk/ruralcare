import type { Facility, Service, CapacityStatus } from "@ruralcare/shared";
import { db } from "./db.ts";
import { demoFacilities } from "./data.ts";

export interface FacilityDataProvider { list(): Facility[] }
export class ImportedGovernmentFacilityProvider implements FacilityDataProvider {
  list(): Facility[] {
    const overrides=db.prepare("SELECT * FROM FacilityServiceStatus").all() as Array<Record<string,unknown>>;
    return demoFacilities.map(facility=>{
      const capacity={...(facility.capacity||{})};
      for(const item of overrides.filter(row=>row.facilityId===facility.id)){
        const service=String(item.service) as Service,status=String(item.availability) as CapacityStatus,current=capacity[service];
        capacity[service]={status,estimatedWaitMinutes:status==="UNAVAILABLE"?0:current?.estimatedWaitMinutes||30,availableBeds:status==="UNAVAILABLE"?0:current?.availableBeds||0,note:`Prototype availability changed by staff · ${String(item.updatedAt)}`};
      }
      return {...facility,capacity,lastUpdated:overrides.some(row=>row.facilityId===facility.id)?"Prototype availability updated by staff":facility.lastUpdated};
    });
  }
}
export const facilityProvider:FacilityDataProvider=new ImportedGovernmentFacilityProvider();
