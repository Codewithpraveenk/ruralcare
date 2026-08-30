PRAGMA foreign_keys=OFF;

CREATE TABLE "User_auth_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "passwordHash" TEXT,
  "googleSub" TEXT,
  "avatarUrl" TEXT,
  "role" TEXT NOT NULL,
  "facilityId" TEXT,
  "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
  "village" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

INSERT INTO "User_auth_new" ("id","name","email","phone","passwordHash","role","facilityId","preferredLanguage","village","createdAt","updatedAt")
SELECT "id","name",lower("email"),"phone","passwordHash","role","facilityId",coalesce("preferredLanguage",'en'),"village","createdAt","updatedAt" FROM "User";

DROP TABLE "User";
ALTER TABLE "User_auth_new" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
