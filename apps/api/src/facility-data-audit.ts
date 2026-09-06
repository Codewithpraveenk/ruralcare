import { z } from "zod";
import { buildFacilityRecords, facilityProvenance, tamilNaduPublicDirectory } from "./facility-directory.ts";

const officialRecordSchema=z.object({sourceRowId:z.string().min(3),name:z.string().min(3),category:z.literal("Public/ Government"),careType:z.string().min(3),address:z.string().min(5),district:z.literal("Chengalpattu"),pincode:z.string().regex(/^$|^\d{6}$/),phone:z.string().min(5),sourceUrl:z.string().url().refine(value=>value.includes("tn.gov.in")||value.includes("nic.in"),"Facility source must be an official government domain"),retrievedOn:z.string().date(),explicitlySourcedServices:z.array(z.enum(["PRIMARY_CARE","MATERNITY","CHILD_HEALTH","EMERGENCY","TELECONSULT"]))});

export type FacilityDataAudit={valid:boolean;datasetVersion:string;generatedAt:string;counts:{officialRecords:number;chengalpattuRecords:number;routeableRecords:number;validCoordinates:number;sourcedCapabilities:number;inferredCapabilities:number};errors:string[];warnings:string[]};

export function auditFacilityData():FacilityDataAudit{
  const errors:string[]=[],warnings:string[]=[],ids=new Set<string>();
  for(const [index,record] of tamilNaduPublicDirectory.entries()){
    const parsed=officialRecordSchema.safeParse(record);
    if(!parsed.success)errors.push(`Record ${index+1}: ${parsed.error.issues.map(issue=>issue.message).join(", ")}`);
    if(ids.has(record.sourceRowId))errors.push(`Duplicate sourceRowId: ${record.sourceRowId}`);ids.add(record.sourceRowId);
  }
  const facilities=buildFacilityRecords();
  for(const facility of facilities){
    if(!Number.isFinite(facility.latitude)||facility.latitude<8||facility.latitude>14||!Number.isFinite(facility.longitude)||facility.longitude<76||facility.longitude>81)errors.push(`${facility.id}: coordinates fall outside Tamil Nadu bounds`);
    for(const service of facility.services){
      if(!facility.serviceSources?.[service])errors.push(`${facility.id}: ${service} has no capability provenance`);
      const capacity=facility.capacity?.[service];
      if(capacity&&!capacity.note.includes("SIMULATED_FOR_PROTOTYPE"))errors.push(`${facility.id}: ${service} operational data is not simulation-labelled`);
    }
  }
  const provenance=facilityProvenance();
  if(provenance.validCoordinateRecords<provenance.chengalpattuRecords){const pending=provenance.chengalpattuRecords-provenance.validCoordinateRecords;warnings.push(`${pending} official record${pending===1?" is":"s are"} excluded from routing until coordinates are verified.`);}
  warnings.push("Availability, wait time and bed counts are not connected to a live authorised HMIS feed.");
  return {valid:errors.length===0,datasetVersion:"chengalpattu-public-facilities-v3-2026-09-03",generatedAt:new Date().toISOString(),counts:{officialRecords:provenance.sourceRecords,chengalpattuRecords:provenance.chengalpattuRecords,routeableRecords:facilities.length,validCoordinates:provenance.validCoordinateRecords,sourcedCapabilities:provenance.capabilities.sourced,inferredCapabilities:provenance.capabilities.inferred},errors,warnings};
}

if(process.argv[1]?.endsWith("facility-data-audit.ts")){
  const report=auditFacilityData();console.log(JSON.stringify(report,null,2));if(!report.valid)process.exitCode=1;
}
