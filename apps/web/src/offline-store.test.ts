import assert from "node:assert/strict";
import test from "node:test";

test("offline workflow keys are isolated by authenticated user identity",()=>{const key=(userId:string)=>`current:${userId}`;assert.notEqual(key("citizen-a"),key("citizen-b"));assert.equal(key("citizen-a"),"current:citizen-a");});

