import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

if (!process.env.JWT_SECRET?.trim()) {
  process.env.JWT_SECRET = "test-secret-for-unit-tests";
}

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
