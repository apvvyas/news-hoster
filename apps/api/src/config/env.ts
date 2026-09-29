// Side-effect module: load apps/api/.env (if present) into process.env.
// Import it first so later imports see the variables. Real environment
// variables always win over the file.
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
