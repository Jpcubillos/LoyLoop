// Runs the actual migration in isolated PostgreSQL/WASM; never connects to Supabase.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");

test("LL-39 migration: ownership, confirmed identity, legacy preservation and permissions", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      create table public.customer_profiles(id uuid primary key default gen_random_uuid(), email text unique, full_name text not null, phone text);
      insert into auth.users(id,email,email_confirmed_at) values
        ('00000000-0000-0000-0000-000000000001','ONE@example.com',now()),
        ('00000000-0000-0000-0000-000000000002','two@example.com',now()),
        ('00000000-0000-0000-0000-000000000003','unconfirmed@example.com',null);
      insert into public.customer_profiles(id,email,full_name,phone) values
        ('10000000-0000-0000-0000-000000000001','one@EXAMPLE.com','Legacy name','555');
    `);
    const migration = fs.readFileSync(
      "supabase/migrations/202610290001_customer_identity.sql",
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration); // Repeat application must preserve data and grants.
    async function asUser(number, action) {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
        `00000000-0000-0000-0000-${String(number).padStart(12, "0")}`,
      ]);
      await db.exec("set role authenticated");
      try {
        return await action();
      } finally {
        await db.exec("reset role");
      }
    }
    const ensure = async () =>
      (await db.query("select public.ensure_loyloop_customer_identity() as id"))
        .rows[0].id;
    const first = await asUser(1, async () => {
      const id = await ensure();
      assert.equal(id, "10000000-0000-0000-0000-000000000001");
      assert.equal(await ensure(), id);
      await assert.rejects(
        db.exec(
          "insert into public.customer_identities(auth_user_id,customer_id) select auth_user_id,customer_id from public.customer_identities",
        ),
        /permission denied/,
      );
      await assert.rejects(
        db.exec(
          "update public.customer_identities set auth_user_id='00000000-0000-0000-0000-000000000002'",
        ),
        /permission denied/,
      );
      return id;
    });
    const second = await asUser(2, async () => {
      assert.equal(
        (await db.query("select * from public.customer_identities")).rows
          .length,
        0,
      );
      const id = await ensure();
      const rows = (await db.query("select * from public.customer_identities"))
        .rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].customer_id, id);
      return id;
    });
    assert.notEqual(first, second);
    const legacy = (
      await db.query(
        "select full_name,phone from public.customer_profiles where id=$1",
        [first],
      )
    ).rows[0];
    assert.deepEqual(legacy, { full_name: "Legacy name", phone: "555" });
    await asUser(3, () =>
      assert.rejects(ensure(), /Verified identity required/),
    );
    await db.exec("set role anon");
    await assert.rejects(ensure(), /permission denied/);
    await db.exec("reset role");
    // Email changes keep the immutable profile id and its historical associations.
    await db.exec(
      "update auth.users set email='new@example.com' where id='00000000-0000-0000-0000-000000000001'",
    );
    assert.equal(await asUser(1, ensure), first);
    assert.equal(
      (
        await db.query(
          "select email from public.customer_profiles where id=$1",
          [first],
        )
      ).rows[0].email,
      "new@example.com",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.customer_profiles",
        )
      ).rows[0].n,
      2,
    );
  } finally {
    await db.close();
  }
});
