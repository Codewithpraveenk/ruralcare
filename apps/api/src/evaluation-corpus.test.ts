import assert from "node:assert/strict";
import test from "node:test";
import { assessNeed, evaluationCorpus, routeFacilities } from "@ruralcare/shared";
import { buildFacilityRecords } from "./facility-directory.ts";

test("multilingual evaluation corpus preserves expected urgency, service, language, and rule",()=>{
  assert.ok(evaluationCorpus.length>=300);
  const mismatches=evaluationCorpus.flatMap(item=>{const actual=assessNeed(item.inputText),expectedLanguage=item.language==="en"?"en":item.language==="ta"?"ta":"mixed",issues=[];if(actual.urgency!==item.expectedUrgency)issues.push(`urgency ${actual.urgency}`);if(actual.service!==item.expectedService)issues.push(`service ${actual.service}`);if(actual.language!==expectedLanguage)issues.push(`language ${actual.language}`);if(item.expectedRuleId&&!actual.triggeredRules.some(rule=>rule.triggeredRuleId===item.expectedRuleId))issues.push(`missing rule ${item.expectedRuleId}`);return issues.length?[{caseId:item.caseId,expected:`${item.expectedUrgency}/${item.expectedService}/${expectedLanguage}`,actual:issues.join(", ")}]:[];});
  assert.deepEqual(mismatches,[]);
});

test("fever-only scenarios never become emergency without a configured danger sign",()=>{
  const feverCases=evaluationCorpus.filter(item=>item.semanticGroup.includes("fever")&&!item.expectedRuleId);
  assert.ok(feverCases.length>=30);
  assert.equal(feverCases.filter(item=>assessNeed(item.inputText).urgency==="EMERGENCY").length,0);
});

test("every routable corpus case produces the expected direct or rerouted pathway",()=>{
  const facilities=buildFacilityRecords(),mismatches=evaluationCorpus.flatMap(item=>{const assessment=assessNeed(item.inputText);if(item.expectedRoute==="NO_ROUTE")return assessment.urgency==="INSUFFICIENT_INFORMATION"?[]:[{caseId:item.caseId,actual:"unexpectedly routable"}];const decision=routeFacilities(facilities,assessment,item.caseId),actual=decision.selectedFacilityId?(decision.rerouted?"REROUTED":"DIRECT"):"NO_ROUTE";return actual===item.expectedRoute?[]:[{caseId:item.caseId,expected:item.expectedRoute,actual,service:assessment.service}];});
  assert.deepEqual(mismatches,[]);
});
