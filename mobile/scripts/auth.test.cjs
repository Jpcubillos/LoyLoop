const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");

function load(file, deps = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (name) => {
        if (!(name in deps)) throw new Error(`Unexpected dependency ${name}`);
        return deps[name];
      },
    },
  );
  return module.exports;
}
const rules = load("src/lib/auth-rules.ts");
const { createCustomerAuth } = load("src/lib/auth-service.ts", {
  "./auth-rules": rules,
});
const { createSecureSessionStorage } = load(
  "src/lib/secure-session-storage.ts",
);

function fixture(overrides = {}, rpcError = null) {
  const calls = [];
  const ok = { data: { session: { user: { id: "user-one" } } }, error: null };
  const auth = {};
  for (const name of [
    "signInWithPassword",
    "signUp",
    "verifyOtp",
    "resend",
    "resetPasswordForEmail",
    "updateUser",
    "signOut",
  ]) {
    auth[name] = async (...args) => {
      calls.push([name, ...args]);
      const answer = overrides[name] ?? ok;
      if (answer instanceof Error) throw answer;
      return answer;
    };
  }
  const client = {
    auth,
    rpc: async (...args) => {
      calls.push(["rpc", ...args]);
      return { data: "customer-one", error: rpcError };
    },
  };
  return { service: createCustomerAuth(client, true), calls, client };
}

test("normalizes identity email without altering passwords", async () => {
  const { service, calls } = fixture();
  await service.signIn("  Person@Example.COM ", " old secret ");
  assert.equal(calls[0][1].email, "person@example.com");
  assert.equal(calls[0][1].password, " old secret ");
  assert.equal(calls[1][1], "ensure_loyloop_customer_identity");
  assert.equal(calls[1].length, 2); // No caller-supplied identity input.
});
test("login never reveals missing, unconfirmed or banned accounts", async () => {
  const messages = [];
  for (const code of [
    "invalid_credentials",
    "email_not_confirmed",
    "user_banned",
    "user_not_found",
  ]) {
    const { service } = fixture({
      signInWithPassword: {
        data: { session: null },
        error: { code, message: "private@example.com exists" },
      },
    });
    try {
      await service.signIn("a@example.com", "123456");
      assert.fail();
    } catch (e) {
      messages.push(e.message);
    }
  }
  assert.equal(new Set(messages).size, 1);
  assert.ok(!messages[0].includes("private"));
});
test("signup duplicates, obfuscated accounts and email throttling yield same result", async () => {
  for (const code of [
    null,
    "user_already_exists",
    "email_exists",
    "over_email_send_rate_limit",
  ]) {
    const { service, calls } = fixture({
      signUp: {
        data: { session: null, user: { identities: [] } },
        error: code ? { code } : null,
      },
    });
    assert.equal(
      await service.signUp(
        "A@example.com",
        "password123",
        "password123",
        " Ana ",
      ),
      null,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1].options.data.full_name, "Ana");
  }
});
test("new passwords validate but legacy short login passwords still work", async () => {
  const { service, calls } = fixture();
  await assert.rejects(
    service.signUp("a@example.com", "short", "short", ""),
    /8 caracteres/,
  );
  await assert.rejects(
    service.signUp("a@example.com", "password123", "different", ""),
    /no coinciden/,
  );
  assert.equal(calls.length, 0);
  await service.signIn("a@example.com", "short");
});
test("missing service and invalid email cause no provider call", async () => {
  const { service, calls, client } = fixture();
  await assert.rejects(service.requestRecovery("not-email"), /correo válido/);
  await assert.rejects(
    createCustomerAuth(client, false).signIn("a@example.com", "secret"),
    /no está disponible/,
  );
  assert.equal(calls.length, 0);
});
test("identity failure closes newly opened session and hides database details", async () => {
  const { service, calls } = fixture({}, { message: "private DB constraint" });
  await assert.rejects(
    service.signIn("a@example.com", "password"),
    /preparar tu perfil/,
  );
  assert.equal(calls.at(-1)[0], "signOut");
  assert.equal(calls.at(-1)[1].scope, "local");
});
test("confirmation uses signup OTP before creating identity", async () => {
  const { service, calls } = fixture();
  await service.confirmRegistration(" A@example.com ", "12345678");
  assert.equal(calls[0][1].type, "signup");
  assert.equal(calls[0][1].email, "a@example.com");
  assert.equal(calls[1][0], "rpc");
});
test("recovery request is neutral for unknown emails and email throttling", async () => {
  for (const code of [
    null,
    "over_email_send_rate_limit",
    "user_not_found",
    "email_not_confirmed",
    "user_banned",
  ]) {
    const { service, calls } = fixture({
      resetPasswordForEmail: { error: code ? { code, status: 429 } : null },
    });
    await service.requestRecovery(" A@example.com ");
    assert.equal(calls[0][1], "a@example.com");
    assert.equal(calls.length, 1);
  }
});
test("expired recovery codes cannot change a password", async () => {
  const { service, calls } = fixture({
    verifyOtp: {
      data: { session: null },
      error: { code: "otp_expired", message: "private" },
    },
  });
  await assert.rejects(
    service.recoverPassword(
      "a@example.com",
      "123456",
      "password123",
      "password123",
    ),
    /código no es válido o venció/,
  );
  assert.equal(calls.length, 1);
});
test("successful recovery updates then ends recovery session globally", async () => {
  const { service, calls } = fixture();
  await service.recoverPassword(
    "a@example.com",
    "123456",
    "password123",
    "password123",
  );
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["verifyOtp", "updateUser", "signOut"],
  );
  assert.equal(calls[0][1].type, "recovery");
  assert.equal(calls[2][1].scope, "global");
});
test("failed password update still closes recovery session", async () => {
  const { service, calls } = fixture({
    updateUser: { error: { code: "weak_password", message: "sensitive" } },
  });
  await assert.rejects(
    service.recoverPassword(
      "a@example.com",
      "123456",
      "password123",
      "password123",
    ),
    /guardar la contraseña/,
  );
  assert.equal(calls.at(-1)[0], "signOut");
});
test("recovery falls back to local cleanup if global revocation fails", async () => {
  const { service, calls } = fixture({ signOut: { error: { status: 503 } } });
  await service.recoverPassword(
    "a@example.com",
    "123456",
    "password123",
    "password123",
  );
  assert.deepEqual(
    calls.filter((c) => c[0] === "signOut").map((c) => c[1].scope),
    ["global", "local"],
  );
});
test("production recovery can use an isolated auth client without signing into the primary client", async () => {
  const primary = fixture();
  const ephemeral = fixture();
  primary.client.auth.getSession = async () => ({
    data: { session: null },
    error: null,
  });
  const service = createCustomerAuth(
    primary.client,
    true,
    ephemeral.client.auth,
  );
  await service.requestRecovery("a@example.com");
  await service.recoverPassword(
    "a@example.com",
    "123456",
    "password123",
    "password123",
  );
  assert.equal(primary.calls.length, 0);
  assert.deepEqual(
    ephemeral.calls.map((c) => c[0]),
    ["resetPasswordForEmail", "verifyOtp", "updateUser", "signOut"],
  );
});

function memoryStorage() {
  const secure = new Map(),
    legacy = new Map();
  let fail = false;
  return {
    secure,
    legacy,
    failNextWrite: () => {
      fail = true;
    },
    storage: createSecureSessionStorage(
      {
        getItemAsync: async (key) => secure.get(key) ?? null,
        setItemAsync: async (key, value) => {
          if (fail) {
            fail = false;
            throw new Error("disk full");
          }
          assert.ok(Buffer.byteLength(value) <= 1800);
          secure.set(key, value);
        },
        deleteItemAsync: async (key) => {
          secure.delete(key);
        },
      },
      {
        getItem: async (key) => legacy.get(key) ?? null,
        removeItem: async (key) => {
          legacy.delete(key);
        },
      },
    ),
  };
}
test("secure storage round trips large Unicode sessions and cleans old generations", async () => {
  const { storage, secure } = memoryStorage();
  const value = JSON.stringify({ token: "token".repeat(3000), name: "Ana 👑" });
  await storage.setItem("sb-auth", value);
  assert.equal(await storage.getItem("sb-auth"), value);
  await storage.setItem("sb-auth", "new session");
  assert.equal(await storage.getItem("sb-auth"), "new session");
  assert.equal(secure.size, 2);
  await storage.removeItem("sb-auth");
  assert.equal(secure.size, 0);
  assert.equal(await storage.getItem("sb-auth"), null);
});
test("legacy session moves to secure storage and cannot reappear after logout", async () => {
  const { storage, legacy } = memoryStorage();
  legacy.set("sb-auth", "old session");
  assert.equal(await storage.getItem("sb-auth"), "old session");
  assert.equal(legacy.size, 0);
  assert.equal(await storage.getItem("sb-auth"), "old session");
  await storage.removeItem("sb-auth");
  assert.equal(await storage.getItem("sb-auth"), null);
});
test("failed write preserves previous secure session", async () => {
  const { storage, failNextWrite } = memoryStorage();
  await storage.setItem("sb-auth", "original");
  failNextWrite();
  await assert.rejects(storage.setItem("sb-auth", "replacement"), /disk full/);
  assert.equal(await storage.getItem("sb-auth"), "original");
});
test("corrupt and incomplete sessions are removed without reviving a legacy account", async () => {
  const { storage, secure, legacy } = memoryStorage();
  secure.set("loyloop.sb-auth", "not JSON");
  legacy.set("sb-auth", "stale account");
  assert.equal(await storage.getItem("sb-auth"), null);
  assert.equal(legacy.size, 0);
  await storage.setItem("sb-auth", "current account");
  secure.delete([...secure.keys()].find((k) => k !== "loyloop.sb-auth"));
  assert.equal(await storage.getItem("sb-auth"), null);
  assert.equal(secure.size, 0);
  await storage.setItem("sb-auth", "fresh login");
  assert.equal(await storage.getItem("sb-auth"), "fresh login");
});
