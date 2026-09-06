import "./env.ts";
import { PrismaClient } from "@prisma/client";
process.env.DATABASE_URL||="file:./ruralcare.db";

export const prisma=new PrismaClient();
