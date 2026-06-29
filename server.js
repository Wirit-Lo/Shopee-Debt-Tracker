const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;

let pool = null;
let databaseReady = false;

if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false }
  });
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

function normalizeDebt(value) {
  const rawMonths = parseInt(value.months, 10);
  const months = Number.isFinite(rawMonths) ? Math.max(rawMonths, 1) : 0;
  const billingDay = parseInt(value.billingDay, 10);
  const principal = Number(value.principal) || 0;

  return {
    id: String(value.id || ""),
    name: String(value.name || "").trim(),
    startDate: String(value.startDate || ""),
    principal,
    months,
    interestRate: Number(value.interestRate) || 0,
    billingDay: Number.isFinite(billingDay) ? Math.min(Math.max(billingDay, 1), 31) : null,
    paidInstallments: Math.min(Math.max(parseInt(value.paidInstallments, 10) || 0, 0), months),
    createdAt: value.createdAt || new Date().toISOString()
  };
}

function validateDebt(debt) {
  return debt.id && debt.name && debt.startDate && debt.principal > 0 && debt.months > 0;
}

async function ensureDatabase() {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (databaseReady) return;

  await pool.query(`
    create table if not exists debts (
      id text primary key,
      data jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  databaseReady = true;
}

app.get("/api/health", async (req, res) => {
  try {
    await ensureDatabase();
    res.json({ ok: true, storage: "database" });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.get("/api/debts", async (req, res, next) => {
  try {
    await ensureDatabase();
    const result = await pool.query("select data from debts order by created_at desc, updated_at desc");
    res.json(result.rows.map((row) => row.data));
  } catch (error) {
    next(error);
  }
});

app.put("/api/debts/:id", async (req, res, next) => {
  try {
    await ensureDatabase();
    const debt = normalizeDebt({ ...req.body, id: req.params.id });

    if (!validateDebt(debt)) {
      res.status(400).json({ error: "Invalid debt data" });
      return;
    }

    await pool.query(
      `
        insert into debts (id, data, created_at, updated_at)
        values ($1, $2::jsonb, coalesce(($2->>'createdAt')::timestamptz, now()), now())
        on conflict (id) do update set
          data = excluded.data,
          updated_at = now()
      `,
      [debt.id, JSON.stringify(debt)]
    );

    res.json(debt);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/debts/:id", async (req, res, next) => {
  try {
    await ensureDatabase();
    await pool.query("delete from debts where id = $1", [req.params.id]);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.delete("/api/debts", async (req, res, next) => {
  try {
    await ensureDatabase();
    await pool.query("delete from debts");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/debts/import", async (req, res, next) => {
  let client;

  try {
    await ensureDatabase();
    client = await pool.connect();
    const debts = Array.isArray(req.body?.debts) ? req.body.debts.map(normalizeDebt).filter(validateDebt) : [];

    await client.query("begin");
    await client.query("delete from debts");

    for (const debt of debts) {
      await client.query(
        `
          insert into debts (id, data, created_at, updated_at)
          values ($1, $2::jsonb, coalesce(($2->>'createdAt')::timestamptz, now()), now())
        `,
        [debt.id, JSON.stringify(debt)]
      );
    }

    await client.query("commit");
    res.json(debts);
  } catch (error) {
    if (client) await client.query("rollback");
    next(error);
  } finally {
    if (client) client.release();
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Server error" });
});

app.listen(port, () => {
  console.log(`Shopee Debt Tracker running on port ${port}`);
});
