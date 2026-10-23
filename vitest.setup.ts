import "@testing-library/jest-dom"

import { loadEnvFile } from "./lib/load-env"

/* integration tests import lib/db, which reads DATABASE_URL at import time;
   Next.js loads .env.local automatically, vitest does not. */
loadEnvFile()
