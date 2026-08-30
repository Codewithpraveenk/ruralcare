CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "facilityId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
ALTER TABLE "Referral" ADD COLUMN "selectedFacilityId" TEXT;
ALTER TABLE "Referral" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "Referral" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Referral" ADD COLUMN "assistedByUserId" TEXT;
ALTER TABLE "Referral" ADD COLUMN "previousFacilityId" TEXT;
ALTER TABLE "Referral" ADD COLUMN "recommendedFacilityId" TEXT;
ALTER TABLE "ReferralStatusEvent" ADD COLUMN "actorUserId" TEXT;
ALTER TABLE "ReferralStatusEvent" ADD COLUMN "action" TEXT;

