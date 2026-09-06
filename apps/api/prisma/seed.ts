import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: new URL("../../../.env", import.meta.url) });
process.env.DATABASE_URL ||= "file:./ruralcare.db";
const prisma = new PrismaClient(),
  passwordHash = await bcrypt.hash("RuralCare@2026", 12),
  facilityId = "government-hospital-madurantakam",
  timestamp = new Date().toISOString();
const users = [
  {
    id: "demo-citizen",
    name: "Demo Citizen",
    email: "citizen.demo@ruralcare.local",
    role: "CITIZEN",
    facilityId: null,
  },
  {
    id: "demo-asha",
    name: "Demo ASHA",
    email: "asha.demo@ruralcare.local",
    role: "ASHA",
    facilityId: null,
  },
  {
    id: "demo-staff-phc",
    name: "Demo PHC Staff",
    email: "staff.demo@ruralcare.local",
    role: "STAFF",
    facilityId,
  },
  {
    id: "demo-doctor-phc",
    name: "Dr. Meena",
    email: "doctor.demo@ruralcare.local",
    role: "DOCTOR",
    facilityId,
  },
  {
    id: "demo-admin-phc",
    name: "PHC Facility Admin",
    email: "admin.demo@ruralcare.local",
    role: "FACILITY_ADMIN",
    facilityId,
  },
];
for (const user of users)
  await prisma.user.upsert({
    where: { email: user.email },
    update: {
      name: user.name,
      role: user.role,
      facilityId: user.facilityId,
      passwordHash,
      updatedAt: timestamp,
    },
    create: {
      ...user,
      passwordHash,
      preferredLanguage: "en",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  });
await prisma.$disconnect();
