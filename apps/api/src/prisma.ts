import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({path:new URL("../../../.env",import.meta.url)});
process.env.DATABASE_URL||="file:./ruralcare.db";

export const prisma=new PrismaClient();
