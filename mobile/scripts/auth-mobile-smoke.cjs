// UI test with mocked Auth/REST transport. No real email, password or DB changes.
const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

async function main() {
  const readyDeadline=Date.now()+120000;
  const testUrl=process.env.LOYLOOP_TEST_URL || "http://localhost:8091/login";
  for (;;) {
    try { if ((await fetch(testUrl)).ok) break; } catch {}
    if(Date.now()>readyDeadline)throw new Error("Expo auth screen did not become ready");
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  const browser = await chromium.launch({ ...(process.env.CI ? {} : {channel: "chrome"}), headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let recoveryValid = false;
  let duplicate = false;
  let loginValid = false;
  let passwordUpdates = 0;
  const user = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "test@example.com",
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: { full_name: "Ana" },
    identities: [],
  };
  const payload = Buffer.from(
    JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  const session = {
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.fake`,
    refresh_token: "test-refresh",
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
  await page.route("**/api/**", async route => {
    const request=route.request();const path=new URL(request.url()).pathname;
    if(request.method()==="OPTIONS")return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"authorization,content-type","access-control-allow-methods":"GET,POST,OPTIONS"}});
    const body=path==="/api/customer-identity/"?{customer_id:"10000000-0000-0000-0000-000000000001"}:path==="/api/discovery/"?{catalog:[],memberships:[],activity:[],rewards:[],campaigns:[]}:{};
    assert.ok(request.headers().authorization || path==="/api/discovery/");
    return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(body)});
  });
  await page.route("**/*.supabase.co/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: {
          "x-supabase-api-version": "2024-01-01",
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "X-Supabase-Api-Version",
        },
        body: JSON.stringify(
          body?.code ? { ...body, error_code: body.code } : body,
        ),
      });
    if (path.endsWith("/signup"))
      return duplicate
        ? json(
            { code: "user_already_exists", msg: "SECRET_ACCOUNT_EXISTS" },
            422,
          )
        : json(user);
    if (path.endsWith("/token"))
      return loginValid
        ? json(session)
        : json(
            { code: "invalid_credentials", msg: "SECRET_ACCOUNT_MISSING" },
            400,
          );
    if (
      path.endsWith("/recover") ||
      path.endsWith("/resend") ||
      path.endsWith("/logout")
    )
      return json({});
    if (path.endsWith("/verify")) {
      const body = request.postDataJSON();
      if (body.type === "recovery" && !recoveryValid)
        return json({ code: "otp_expired", msg: "SECRET_OTP_DETAILS" }, 403);
      return json(session);
    }
    if (path.endsWith("/user")) {
      if (request.method() === "PUT") passwordUpdates++;
      return json(user);
    }
    if (path.includes("/rpc/") || path.startsWith("/rest/")) throw new Error("Unexpected direct business database access");
    return route.abort();
  });
  fs.mkdirSync(".design-reference/qa/ll11", { recursive: true });
  try {
    await page.goto(
      process.env.LOYLOOP_TEST_URL || "http://localhost:8091/login",
      { waitUntil: "networkidle", timeout: 120000 },
    );
    await page
      .getByLabel("Correo electrónico", { exact: true })
      .fill("test@example.com");
    await page.getByLabel("Contraseña", { exact: true }).fill("oldpass");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page
      .getByText(
        "No pudimos iniciar sesión. Revisa tus datos o recupera tu acceso.",
        { exact: true },
      )
      .waitFor();
    assert.ok(!(await page.locator("body").innerText()).includes("SECRET_"));
    await page.getByRole("tab", { name: "Crear cuenta", exact: true }).click();
    await page.getByLabel("Nombre", { exact: true }).fill("Ana");
    await page.getByLabel("Contraseña", { exact: true }).fill("password123");
    await page
      .getByLabel("Confirmar contraseña", { exact: true })
      .fill("different");
    await page
      .getByRole("button", { name: "Crear cuenta", exact: true })
      .click();
    await page
      .getByText("Las contraseñas no coinciden.", { exact: true })
      .waitFor();
    await page
      .getByLabel("Confirmar contraseña", { exact: true })
      .fill("password123");
    duplicate = true;
    await page
      .getByRole("button", { name: "Crear cuenta", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar y entrar", exact: true })
      .waitFor();
    assert.ok(
      (await page.locator("body").innerText()).includes(
        "Si el correo puede registrarse",
      ),
    );
    assert.ok(!(await page.locator("body").innerText()).includes("SECRET_"));
    await page.screenshot({
      path: ".design-reference/qa/ll11/confirmation.png",
      fullPage: true,
    });
    // A real new signup follows the same UI, then OTP creates the own profile.
    await page
      .getByRole("button", { name: "Volver al acceso", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Tengo un código de confirmación",
        exact: true,
      })
      .click();
    await page.getByLabel("Código del correo", { exact: true }).fill("123456");
    await page
      .getByRole("button", { name: "Confirmar y entrar", exact: true })
      .click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 30000 });
    await page.goto("http://localhost:8091/login", {
      waitUntil: "networkidle",
    });
    await page
      .getByRole("button", { name: "Olvidé mi contraseña", exact: true })
      .click();
    await page
      .getByLabel("Correo electrónico", { exact: true })
      .fill("test@example.com");
    await page
      .getByRole("button", { name: "Enviar código", exact: true })
      .click();
    await page
      .getByText(
        "Si existe una cuenta para ese correo, recibirás un código para recuperar tu acceso.",
        { exact: true },
      )
      .waitFor();
    await page.getByLabel("Código del correo", { exact: true }).fill("123456");
    await page
      .getByLabel("Nueva contraseña", { exact: true })
      .fill("newpassword123");
    await page
      .getByLabel("Confirmar contraseña", { exact: true })
      .fill("newpassword123");
    await page
      .getByRole("button", { name: "Guardar nueva contraseña", exact: true })
      .click();
    await page
      .getByText(
        "El código no es válido o venció. Solicita uno nuevo e inténtalo otra vez.",
        { exact: true },
      )
      .waitFor();
    assert.equal(passwordUpdates, 0);
    await page.screenshot({
      path: ".design-reference/qa/ll11/recovery.png",
      fullPage: true,
    });
    recoveryValid = true;
    await page
      .getByRole("button", { name: "Guardar nueva contraseña", exact: true })
      .click();
    await page
      .getByText(
        "Tu contraseña se actualizó. Inicia sesión con tu nueva contraseña.",
        { exact: true },
      )
      .waitFor();
    assert.equal(passwordUpdates, 1);
    const storedSessions = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => /auth-token$|recovery/.test(k)),
    );
    assert.deepEqual(storedSessions, []);
    await page.setViewportSize({ width: 320, height: 720 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page.screenshot({
      path: ".design-reference/qa/ll11/login-320.png",
      fullPage: true,
    });
    loginValid = true;
    await page
      .getByLabel("Correo electrónico", { exact: true })
      .fill("test@example.com");
    await page.getByLabel("Contraseña", { exact: true }).fill("newpassword123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await page.goto("http://localhost:8091/perfil", {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: /Cerrar sesión/ }).click();
    await page
      .getByRole("button", { name: "Cerrar sesión", exact: true })
      .last()
      .click();
    await page.waitForURL((url) => url.pathname === "/login");
    await page.goto("http://localhost:8091/perfil", {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: /Iniciar sesión/ }).waitFor();
    assert.equal(
      await page.getByText("test@example.com", { exact: true }).count(),
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      "LL-40 UI OK: validation, neutral duplicate signup, confirmation, login failure/success, expired/valid recovery, logout, no stale account, 320px.",
    );
  } catch (error) {
    await page.screenshot({
      path: ".design-reference/qa/ll11/failure.png",
      fullPage: true,
    });
    console.error((await page.locator("body").innerText()).slice(-2000));
    throw error;
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
