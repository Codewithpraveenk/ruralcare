import assert from "node:assert/strict";
import test from "node:test";
import { answerNavigationQuestion } from "./navigation-assistant.ts";

test("offline navigation guide explains matching without claiming diagnosis",async()=>{
  const previous=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
  try{const result=await answerNavigationQuestion({message:"Why is this hospital recommended?",language:"en",stage:"recommendation",hasRecommendation:true,rerouted:false});assert.equal(result.provider,"LOCAL_GUIDE");assert.equal(result.suggestedAction,"COMPARE_FACILITIES");assert.match(result.reply,/service fit/i);assert.match(result.safetyBoundary,/not diagnosis/i);}finally{if(previous)process.env.OPENAI_API_KEY=previous;}
});

test("navigation guide sends emergency language back to human help and safety workflow",async()=>{
  const previous=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
  try{const result=await answerNavigationQuestion({message:"There is severe breathing difficulty",language:"en",stage:"input",hasRecommendation:false,rerouted:false});assert.equal(result.suggestedAction,"REVIEW_SAFETY");assert.match(result.reply,/immediate human emergency help/i);}finally{if(previous)process.env.OPENAI_API_KEY=previous;}
});
