const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const CREDENTIALS_KEY = "arzu.demo.credentials.v1";
const SESSION_KEY = "arzu.demo.session.v2";
const defaults = [
  ["u-dir", "ernar", "Ernar2026!"],
  ["u-admin", "admin", "Admin2026!"],
  ["u-prod", "worker", "Worker2026!"],
  ["u-wh", "sklad", "Sklad2026!"],
  ["u-sales", "sales", "Sales2026!"],
  ["u-fin", "finance", "Finance2026!"],
];

function storage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    entries,
    getItem: (key) => (entries.has(key) ? entries.get(key) : null),
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
  };
}

function setup(options = {}) {
  const localStorage = options.localStorage || storage();
  const sessionStorage = options.sessionStorage || storage();
  const context = vm.createContext({
    window: { localStorage, sessionStorage, crypto: webcrypto },
    TextEncoder,
  });
  for (const file of ["data.js", "auth.js"])
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
      context,
    );
  return {
    auth: context.window.ARZUAuth,
    users: context.window.ARZUData.seed().users,
    localStorage,
    sessionStorage,
  };
}

test("every documented demo account signs in and resolves its active user", async () => {
  const { auth, users } = setup();
  for (const [id, login, password] of defaults) {
    assert.equal(await auth.signIn(login, password, users), id);
    assert.equal(auth.getSession(users), id);
    assert.equal(auth.getLogin(id), login);
    auth.signOut();
    assert.equal(auth.getSession(users), null);
  }
});

test("login normalizes whitespace and case; password preserves case and whitespace", async () => {
  const { auth, users } = setup();
  assert.equal(await auth.signIn("  ERNAR  ", "Ernar2026!", users), "u-dir");
  for (const password of ["ernar2026!", " Ernar2026!", "Ernar2026! "])
    await assert.rejects(
      auth.signIn("ernar", password, users),
      /^Error: Неверный логин или пароль\.$/,
    );
});

test("unknown, invited and disabled users share the same invalid-login error", async () => {
  const { auth, users } = setup();
  for (const [login, password] of [
    ["missing", "Some2026!"],
    ["ernar", "wrong"],
  ])
    await assert.rejects(
      auth.signIn(login, password, users),
      /Неверный логин или пароль\./,
    );
  const director = users.find((user) => user.id === "u-dir");
  for (const status of ["disabled", "invited"]) {
    director.status = status;
    await assert.rejects(
      auth.signIn("ernar", "Ernar2026!", users),
      /Неверный логин или пароль\./,
    );
  }
});

test("legacy role-picker storage cannot create an authenticated session", () => {
  const { auth, users, localStorage, sessionStorage } = setup();
  localStorage.setItem("arzu.demo.user", "u-admin");
  sessionStorage.setItem("arzu.demo.user", "u-admin");
  assert.equal(auth.getSession(users), null);
});

test("session survives reload in the same tab and is revoked when a user is disabled", async () => {
  const first = setup();
  await first.auth.signIn("ernar", "Ernar2026!", first.users);
  const reloaded = setup(first);
  assert.equal(reloaded.auth.getSession(reloaded.users), "u-dir");
  reloaded.users.find((user) => user.id === "u-dir").status = "disabled";
  assert.equal(reloaded.auth.getSession(reloaded.users), null);
  assert.equal(reloaded.sessionStorage.getItem(SESSION_KEY), null);
  const otherTab = setup({ localStorage: first.localStorage });
  assert.equal(otherTab.auth.getSession(otherTab.users), null);
});

test("credential updates require a current active administrator rather than actor properties", async () => {
  const { auth, users } = setup();
  await assert.rejects(
    auth.upsertCredential(
      "u-dir",
      "ernar",
      "Newpass2026!",
      { id: "u-dir", role: "admin", status: "active" },
      users,
    ),
    /Недостаточно прав/,
  );
  users.find((user) => user.id === "u-admin").status = "disabled";
  await assert.rejects(
    auth.upsertCredential("u-dir", "ernar", "Newpass2026!", "u-admin", users),
    /Недостаточно прав/,
  );
});

test("admin changes persist hashed passwords, random salts and revoke the previous session", async () => {
  const { auth, users, localStorage, sessionStorage } = setup();
  await auth.signIn("ernar", "Ernar2026!", users);
  const first = JSON.parse(
    localStorage.getItem(CREDENTIALS_KEY),
  ).credentials.find((entry) => entry.userId === "u-dir");
  const result = await auth.upsertCredential(
    "u-dir",
    "  OTAROV  ",
    "Newpassword2026!",
    "u-admin",
    users,
  );
  assert.equal(result.login, "otarov");
  assert.equal(result.userId, "u-dir");
  const raw = localStorage.getItem(CREDENTIALS_KEY);
  const changed = JSON.parse(raw).credentials.find(
    (entry) => entry.userId === "u-dir",
  );
  assert.equal(raw.includes("Newpassword2026!"), false);
  assert.notEqual(changed.hash, first.hash);
  assert.notEqual(changed.salt, first.salt);
  assert.equal(changed.salt.length, 32);
  assert.ok(changed.iterations >= 100000);
  assert.equal(auth.getSession(users), null);
  assert.equal(sessionStorage.getItem(SESSION_KEY), null);
  await assert.rejects(
    auth.signIn("ernar", "Ernar2026!", users),
    /Неверный логин или пароль/,
  );
  const reloaded = setup({ localStorage });
  assert.equal(
    await reloaded.auth.signIn("OTAROV", "Newpassword2026!", reloaded.users),
    "u-dir",
  );
});

test("blank password preserves the previous hash while a renamed login invalidates sessions", async () => {
  const { auth, users, localStorage } = setup();
  await auth.signIn("ernar", "Ernar2026!", users);
  const before = JSON.parse(
    localStorage.getItem(CREDENTIALS_KEY),
  ).credentials.find((entry) => entry.userId === "u-dir");
  await auth.upsertCredential("u-dir", "ernar.otarov", "", "u-admin", users);
  const after = JSON.parse(
    localStorage.getItem(CREDENTIALS_KEY),
  ).credentials.find((entry) => entry.userId === "u-dir");
  assert.equal(after.hash, before.hash);
  assert.equal(after.salt, before.salt);
  assert.equal(auth.getSession(users), null);
  assert.equal(await auth.signIn("ernar.otarov", "Ernar2026!", users), "u-dir");
});

test("duplicate and invalid logins, short/long passwords are rejected without mutation", async () => {
  const { auth, users, localStorage } = setup();
  auth.getLogin("u-dir");
  const before = localStorage.getItem(CREDENTIALS_KEY);
  for (const login of ["ab", "Имя", "with spaces", "a".repeat(41)])
    await assert.rejects(
      auth.upsertCredential(
        "u-dir",
        login,
        "Newpassword2026!",
        "u-admin",
        users,
      ),
      /Логин/,
    );
  await assert.rejects(
    auth.upsertCredential(
      "u-dir",
      "ADMIN",
      "Newpassword2026!",
      "u-admin",
      users,
    ),
    /уже используется/,
  );
  for (const password of ["1234567", "a".repeat(129)])
    await assert.rejects(
      auth.upsertCredential("u-dir", "ernar", password, "u-admin", users),
      /от 8 до 128/,
    );
  assert.equal(localStorage.getItem(CREDENTIALS_KEY), before);
});

test("new users need explicit credentials; significant password whitespace is preserved", async () => {
  const { auth, users } = setup();
  users.push({
    id: "new-user",
    name: "Новый",
    role: "staff",
    status: "active",
    dept: "sales",
  });
  assert.equal(auth.getLogin("new-user"), "");
  await assert.rejects(
    auth.signIn("new-user", "Password2026!", users),
    /Неверный логин или пароль/,
  );
  await assert.rejects(
    auth.upsertCredential("new-user", "new.user", "", "u-admin", users),
    /от 8 до 128/,
  );
  await auth.upsertCredential(
    "new-user",
    "new.user",
    "  password  ",
    "u-admin",
    users,
  );
  assert.equal(
    await auth.signIn("new.user", "  password  ", users),
    "new-user",
  );
  await assert.rejects(
    auth.signIn("new.user", "password", users),
    /Неверный логин или пароль/,
  );
});

test("reset removes credentials and sessions and restores documented demo accounts", async () => {
  const { auth, users, localStorage, sessionStorage } = setup();
  await auth.upsertCredential(
    "u-dir",
    "otarov",
    "Changed2026!",
    "u-admin",
    users,
  );
  await auth.signIn("otarov", "Changed2026!", users);
  auth.reset();
  assert.equal(localStorage.getItem(CREDENTIALS_KEY), null);
  assert.equal(sessionStorage.getItem(SESSION_KEY), null);
  assert.equal(await auth.signIn("ernar", "Ernar2026!", users), "u-dir");
});

test("corrupt credentials are not silently replaced by default passwords", async () => {
  const { auth, users, localStorage } = setup();
  localStorage.setItem(CREDENTIALS_KEY, "{broken");
  await assert.rejects(auth.signIn("ernar", "Ernar2026!", users), /повреждены/);
  assert.equal(localStorage.getItem(CREDENTIALS_KEY), "{broken");
  auth.reset();
  assert.equal(await auth.signIn("ernar", "Ernar2026!", users), "u-dir");
});

test("session write failure does not report a successful sign-in", async () => {
  const { auth, users, sessionStorage } = setup();
  sessionStorage.setItem = () => {
    throw new Error("Blocked");
  };
  await assert.rejects(
    auth.signIn("ernar", "Ernar2026!", users),
    /Не удалось сохранить демосессию/,
  );
  assert.equal(auth.getSession(users), null);
});

test("concurrent credential edits cannot silently overwrite one another", async () => {
  const { auth, users } = setup();
  const results = await Promise.allSettled([
    auth.upsertCredential("u-dir", "ernar", "Updated2026!", "u-admin", users),
    auth.upsertCredential("u-prod", "worker", "Updated2026!", "u-admin", users),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const rejected = results.find((result) => result.status === "rejected");
  assert.match(rejected.reason.message, /изменились в другой вкладке/);
});

test("setting the same password twice generates independent salts and hashes", async () => {
  const { auth, users, localStorage } = setup();
  await auth.upsertCredential(
    "u-dir",
    "ernar",
    "Repeated2026!",
    "u-admin",
    users,
  );
  const first = JSON.parse(
    localStorage.getItem(CREDENTIALS_KEY),
  ).credentials.find((entry) => entry.userId === "u-dir");
  await auth.upsertCredential(
    "u-dir",
    "ernar",
    "Repeated2026!",
    "u-admin",
    users,
  );
  const second = JSON.parse(
    localStorage.getItem(CREDENTIALS_KEY),
  ).credentials.find((entry) => entry.userId === "u-dir");
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await auth.signIn("ernar", "Repeated2026!", users), "u-dir");
});
