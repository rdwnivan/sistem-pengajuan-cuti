import { Pool } from "pg";

const ADMIN = process.env.DATABASE_URL;
if (!ADMIN) {
  console.error("DATABASE_URL tidak diset");
  process.exit(1);
}
const TEST_DB = "neondb_test";

const pool = new Pool({ connectionString: ADMIN });
const conn = await pool.connect();

try {
  const exists = await conn.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_DB]);
  if (exists.rowCount && exists.rowCount > 0) {
    console.log(`${TEST_DB} sudah ada`);
  } else {
    await conn.query(`CREATE DATABASE ${TEST_DB}`);
    console.log(`${TEST_DB} dibuat`);
  }
  const list = await conn.query(
    "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
  );
  console.log("databases:", list.rows.map((r) => r.datname).join(", "));
} catch (e) {
  console.error("ERR:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  conn.release();
  await pool.end();
}
