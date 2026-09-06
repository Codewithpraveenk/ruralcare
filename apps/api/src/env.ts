import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Workspace scripts run with apps/api as the working directory. Resolve the
// shared project environment explicitly so local development and production
// builds do not depend on the terminal's current directory.
dotenv.config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
