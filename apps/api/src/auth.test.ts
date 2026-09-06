import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { app } from "./index.ts";
import { db, initializeDatabase } from "./db.ts";

type CallResult = { status: number; data: any; cookie: string };
test("Milestone 4 authentication, ownership, and facility authorization", async (t) => {
  initializeDatabase();
  const server = app.listen(0),
    address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const call = async (
    path: string,
    init: RequestInit = {},
    cookie = "",
  ): Promise<CallResult> => {
    const response = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
          ...(init.headers || {}),
        },
      }),
      setCookie = response.headers.get("set-cookie") || "";
    return {
      status: response.status,
      data: await response.json().catch(() => ({})),
      cookie: setCookie.split(";")[0] || cookie,
    };
  };
  let citizenCookie = "",
    otherCookie = "",
    ashaCookie = "",
    staffCookie = "",
    otherStaffCookie = "",
    referralId = "",
    ashaReferralId = "";
  try {
    await t.test(
      "Citizen registration hashes the password and restores auth/me",
      async () => {
        const email = `citizen-${Date.now()}@test.local`,
          result = await call("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
              name: "Test Citizen",
              email,
              password: "StrongPass@123",
              confirmPassword: "StrongPass@123",
            }),
          });
        assert.equal(result.status, 201);
        citizenCookie = result.cookie;
        const stored = db
          .prepare("SELECT passwordHash,role FROM User WHERE email=?")
          .get(email) as { passwordHash: string; role: string };
        assert.notEqual(stored.passwordHash, "StrongPass@123");
        assert.ok(await bcrypt.compare("StrongPass@123", stored.passwordHash));
        assert.equal(stored.role, "CITIZEN");
        const me = await call("/api/auth/me", {}, citizenCookie);
        assert.equal(me.status, 200);
        assert.equal(me.data.user.role, "CITIZEN");
      },
    );
    await t.test(
      "Public registration cannot claim privileged role or facility",
      async () => {
        const email = `attack-${Date.now()}@test.local`,
          attempt = await call("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
              name: "Role attacker",
              email,
              password: "StrongPass@123",
              confirmPassword: "StrongPass@123",
              role: "STAFF",
              facilityId: "government-hospital-madurantakam",
            }),
          });
        assert.equal(attempt.status, 400);
        assert.equal(
          db.prepare("SELECT id FROM User WHERE email=?").get(email),
          undefined,
        );
      },
    );
    await t.test("Duplicate normalized email is rejected", async () => {
      const duplicate = await call("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: "Duplicate",
          email: "CITIZEN.DEMO@RURALCARE.LOCAL",
          password: "StrongPass@123",
          confirmPassword: "StrongPass@123",
        }),
      });
      assert.equal(duplicate.status, 409);
    });
    await t.test(
      "Invalid password fails and unauthenticated protected API is rejected",
      async () => {
        const bad = await call("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            identifier: "citizen.demo@ruralcare.local",
            password: "wrong-password",
          }),
        });
        assert.equal(bad.status, 401);
        assert.equal((await call("/api/referrals")).status, 401);
      },
    );
    await t.test(
      "Citizen creates and sees only their own referral",
      async () => {
        const created = await call(
          "/api/referrals",
          {
            method: "POST",
            body: JSON.stringify({
              clientId: crypto.randomUUID(),
              patientLabel: "Ownership test",
              sourceFacility: "Citizen pathway",
              destinationFacility: "Government Hospital, Madurantakam",
              selectedFacilityId: "government-hospital-madurantakam",
              service: "PRIMARY_CARE",
              urgency: "ROUTINE",
              nextAction: "Prototype care visit",
              sourceMode: "CITIZEN",
            }),
          },
          citizenCookie,
        );
        assert.equal(created.status, 201);
        referralId = created.data.referral.id;
        const locatedRoute=await call("/api/routing",{method:"POST",body:JSON.stringify({message:"I am an adult with a mild headache since this morning.",origin:{latitude:12.349,longitude:80.003,label:"Cheyyur"}})},citizenCookie);
        assert.equal(locatedRoute.status,200);
        assert.ok(locatedRoute.data.decision.candidates.find((item:any)=>item.id==="government-hospital-cheyyur").distanceKm<1);
        assert.equal(
          (await call(`/api/referrals/${referralId}`, {}, citizenCookie))
            .status,
          200,
        );
        const guide = await call(
          "/api/navigation-assistant",
          {
            method: "POST",
            body: JSON.stringify({
              message: "What happens next?",
              language: "en",
              stage: "input",
              hasRecommendation: false,
              rerouted: false,
            }),
          },
          citizenCookie,
        );
        assert.equal(guide.status, 200);
        assert.ok(["OPENAI", "LOCAL_GUIDE"].includes(guide.data.provider));
        const email = `other-${Date.now()}@test.local`,
          other = await call("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
              name: "Other Citizen",
              email,
              password: "StrongPass@123",
              confirmPassword: "StrongPass@123",
            }),
          });
        otherCookie = other.cookie;
        assert.equal(
          (await call(`/api/referrals/${referralId}`, {}, otherCookie)).status,
          403,
        );
        assert.equal(
          (await call("/api/coordination", {}, citizenCookie)).status,
          403,
        );
      },
    );
    await t.test(
      "ASHA sees assisted referrals they created, not unrelated citizen referrals",
      async () => {
        const login = await call("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            identifier: "asha.demo@ruralcare.local",
            password: "RuralCare@2026",
          }),
        });
        ashaCookie = login.cookie;
        const created = await call(
          "/api/referrals",
          {
            method: "POST",
            body: JSON.stringify({
              clientId: crypto.randomUUID(),
              patientLabel: "Assisted demo",
              sourceFacility: "ASHA-assisted pathway",
              destinationFacility: "Government Hospital, Madurantakam",
              selectedFacilityId: "government-hospital-madurantakam",
              service: "CHILD_HEALTH",
              urgency: "ROUTINE",
              nextAction: "Prototype child-health visit",
              sourceMode: "ASHA_ASSISTED",
            }),
          },
          ashaCookie,
        );
        assert.equal(created.status, 201);
        ashaReferralId = created.data.referral.id;
        assert.equal(
          (await call(`/api/referrals/${ashaReferralId}`, {}, ashaCookie))
            .status,
          200,
        );
        assert.equal(
          (await call(`/api/referrals/${referralId}`, {}, ashaCookie)).status,
          403,
        );
      },
    );
    await t.test(
      "Staff is facility-scoped for referrals, worklist, and capacity",
      async () => {
        const login = await call("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            identifier: "staff.demo@ruralcare.local",
            password: "RuralCare@2026",
          }),
        });
        staffCookie = login.cookie;
        assert.equal(
          login.data.user.facilityId,
          "government-hospital-madurantakam",
        );
        assert.equal(
          (await call(`/api/referrals/${referralId}`, {}, staffCookie)).status,
          200,
        );
        const worklist = await call("/api/staff/worklist", {}, staffCookie);
        assert.equal(worklist.status, 200);
        assert.equal(worklist.data.workspace, "STAFF");
        assert.equal(
          worklist.data.facility.id,
          "government-hospital-madurantakam",
        );
        assert.ok(Array.isArray(worklist.data.cases));
        assert.equal(
          (await call("/api/doctor/worklist", {}, staffCookie)).status,
          403,
        );
        assert.equal((await call("/api/facility-data/review",{},staffCookie)).status,403);
        assert.equal(
          (
            await call(
              "/api/capacity/government-hospital-madurantakam/PRIMARY_CARE",
              {
                method: "PUT",
                body: JSON.stringify({ availability: "LIMITED" }),
              },
              staffCookie,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await call(
              "/api/capacity/chengalpattu-government-medical-college/PRIMARY_CARE",
              {
                method: "PUT",
                body: JSON.stringify({ availability: "LIMITED" }),
              },
              staffCookie,
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "Doctor receives a purpose-built assigned worklist but cannot manage capacity",
      async () => {
        const login = await call("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            identifier: "doctor.demo@ruralcare.local",
            password: "RuralCare@2026",
          }),
        });
        assert.equal(login.status, 200);
        assert.equal(login.data.user.role, "DOCTOR");
        const worklist = await call("/api/doctor/worklist", {}, login.cookie);
        assert.equal(worklist.status, 200);
        assert.equal(worklist.data.workspace, "DOCTOR");
        assert.equal(
          worklist.data.facility.id,
          "government-hospital-madurantakam",
        );
        assert.ok(worklist.data.cases.length > 0);
        assert.equal(
          (await call("/api/staff/worklist", {}, login.cookie)).status,
          403,
        );
        assert.equal(
          (await call(`/api/referrals/${referralId}`, {}, login.cookie)).status,
          200,
        );
        assert.equal(
          (
            await call(
              "/api/navigation-assistant",
              {
                method: "POST",
                body: JSON.stringify({
                  message: "What next?",
                  language: "en",
                  stage: "followup",
                  hasRecommendation: true,
                  rerouted: false,
                }),
              },
              login.cookie,
            )
          ).status,
          403,
        );
        assert.equal(
          (await call("/api/capacity", {}, login.cookie)).status,
          403,
        );
      },
    );
    await t.test(
      "Facility admin can manage only assigned facility capacity",
      async () => {
        const login = await call("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            identifier: "admin.demo@ruralcare.local",
            password: "RuralCare@2026",
          }),
        });
        assert.equal(login.status, 200);
        assert.equal(login.data.user.role, "FACILITY_ADMIN");
        const review=await call("/api/facility-data/review",{},login.cookie);
        assert.equal(review.status,200);
        assert.equal(review.data.summary.total,17);
        assert.equal(review.data.summary.routeable,9);
        assert.equal(review.data.summary.pending,8);
        assert.equal(
          (await call("/api/capacity", {}, login.cookie)).status,
          200,
        );
        assert.equal(
          (
            await call(
              "/api/capacity/government-hospital-madurantakam/PRIMARY_CARE",
              {
                method: "PUT",
                body: JSON.stringify({ availability: "AVAILABLE" }),
              },
              login.cookie,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await call(
              "/api/capacity/chengalpattu-government-medical-college/PRIMARY_CARE",
              {
                method: "PUT",
                body: JSON.stringify({ availability: "AVAILABLE" }),
              },
              login.cookie,
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "Valid status transitions succeed and invalid transitions fail",
      async () => {
        assert.equal(
          (
            await call(
              `/api/referrals/${referralId}`,
              { method: "PATCH", body: JSON.stringify({ status: "ACCEPTED" }) },
              staffCookie,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await call(
              `/api/referrals/${referralId}`,
              {
                method: "PATCH",
                body: JSON.stringify({ status: "COMPLETED" }),
              },
              staffCookie,
            )
          ).status,
          409,
        );
      },
    );
    await t.test("Confirmed reroute moves active staff ownership", async () => {
      const hash = await bcrypt.hash("RuralCare@2026", 12),
        timestamp = new Date().toISOString();
      db.prepare(
        "INSERT OR REPLACE INTO User (id,name,email,phone,passwordHash,role,facilityId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)",
      ).run(
        "test-staff-gh",
        "Test Hospital Staff",
        "staff.gh@test.local",
        null,
        hash,
        "STAFF",
        "chengalpattu-government-medical-college",
        timestamp,
        timestamp,
      );
      const login = await call("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: "staff.gh@test.local",
          password: "RuralCare@2026",
        }),
      });
      otherStaffCookie = login.cookie;
      db.prepare(
        "UPDATE Referral SET recommendedFacility=?,recommendedFacilityId=?,rerouteStatus='REROUTE_RECOMMENDED' WHERE id=?",
      ).run(
        "Government Chengalpattu Medical College Hospital",
        "chengalpattu-government-medical-college",
        referralId,
      );
      assert.equal(
        (
          await call(
            `/api/referrals/${referralId}/reroute/confirm`,
            { method: "POST" },
            citizenCookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (await call(`/api/referrals/${referralId}`, {}, staffCookie)).status,
        403,
      );
      assert.equal(
        (await call(`/api/referrals/${referralId}`, {}, otherStaffCookie))
          .status,
        200,
      );
    });
    await t.test("Logout invalidates browser session", async () => {
      const logout = await call(
        "/api/auth/logout",
        { method: "POST" },
        otherCookie,
      );
      assert.equal(logout.status, 200);
      assert.equal((await call("/api/auth/me", {}, logout.cookie)).status, 401);
    });
    assert.ok(ashaReferralId);
  } finally {
    db.exec(
      "DELETE FROM ReferralStatusEvent WHERE referralId IN (SELECT id FROM Referral WHERE patientLabel IN ('Ownership test','Assisted demo')); DELETE FROM FollowUpOutcome WHERE referralId IN (SELECT id FROM Referral WHERE patientLabel IN ('Ownership test','Assisted demo')); DELETE FROM Referral WHERE patientLabel IN ('Ownership test','Assisted demo'); DELETE FROM User WHERE email LIKE '%@test.local'; DELETE FROM FacilityServiceStatus WHERE facilityId='government-hospital-madurantakam' AND service='PRIMARY_CARE';",
    );
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
