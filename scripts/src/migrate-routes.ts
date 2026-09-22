import pg from "pg";

const { Client } = pg;

async function migrate() {
  const client = new Client({ connectionString: process.env["DATABASE_URL"] });
  await client.connect();

  const statements = [
    `ALTER TABLE routes ADD COLUMN IF NOT EXISTS origin_city text`,
    `ALTER TABLE routes ADD COLUMN IF NOT EXISTS origin_flag text`,
    `ALTER TABLE routes ADD COLUMN IF NOT EXISTS destination_city text`,
    `ALTER TABLE routes ADD COLUMN IF NOT EXISTS destination_flag text`,
    `ALTER TABLE routes ADD COLUMN IF NOT EXISTS airline_emoji text`,
    `ALTER TABLE routes ADD COLUMN IF NOT EXISTS aircraft text`,
    `ALTER TABLE routes DROP COLUMN IF EXISTS distance`,
  ];

  for (const stmt of statements) {
    await client.query(stmt);
    console.log("OK:", stmt);
  }

  await client.end();
  console.log("Migration complete");
}

migrate().catch((e) => { console.error(e); process.exit(1); });
