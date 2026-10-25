const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function setup(initial, options = {}) {
  const entries = new Map(Object.entries(initial || {}));
  const storage = {
    getItem: (key) => (entries.has(key) ? entries.get(key) : null),
    setItem(key, value) {
      if (
        options.failWrite ||
        (options.failBackup && key.includes(".corrupt."))
      )
        throw new Error("QuotaExceededError");
      entries.set(key, String(value));
    },
    removeItem: (key) => entries.delete(key),
  };
  const context = vm.createContext({ window: { localStorage: storage } });
  for (const file of ["data.js", "store.js"])
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
      context,
    );
  const store = context.window.ARZUStore;
  const data = store.load();
  return { store, data, entries, options, api: context.window.ARZUData };
}

function production(overrides = {}) {
  return {
    date: "2026-10-25",
    dept: "production",
    values: { output: 12000, defects: 140, raw: 5760 },
    comment: "Дневная смена",
    files: [],
    noOperations: false,
    ...overrides,
  };
}

test("load seeds and persists, and public snapshots cannot mutate approved records", () => {
  const { store, entries } = setup();
  const state = store.get();
  state.reports[0].values.output = 1;
  assert.notEqual(store.get().reports[0].values.output, 1);
  assert.equal(JSON.parse(entries.get("arzu.v1")).reports.length, 96);
  assert.equal(store.persist().users.length, 6);
});

test("valid legacy v1 state is migrated without losing reports", () => {
  const fresh = setup();
  const legacy = {
    reports: fresh.data.reports.map((r) => {
      const { authorId, ...withoutId } = r;
      return {
        ...withoutId,
        status: r.status === "approved" ? "accepted" : r.status,
      };
    }),
  };
  const { store, entries } = setup({
    "arzu.v1": JSON.stringify({ data: legacy }),
  });
  assert.equal(store.get().reports.length, 96);
  assert.equal(store.get().reports[0].status, "approved");
  assert.equal(store.get().reports[0].authorId, "u-prod");
  assert.equal(store.get().settings.dailyPlan, 12000);
  assert.equal(
    JSON.parse(entries.get("arzu.v1")).reports[0].status,
    "approved",
  );
});

test("director default-name migration preserves reports, attachments, custom fields and audit history", () => {
  const fresh = setup();
  const legacy = JSON.parse(JSON.stringify(fresh.data));
  legacy.users.find((user) => user.id === "u-dir").name = "Руслан Есенов";
  const report = legacy.reports[0];
  report.values.output = 12781;
  report.customField = { note: "Сохранённое поле клиента", version: 3 };
  report.files = [
    {
      id: "legacy-attachment",
      name: "Журнал смены.pdf",
      type: "application/pdf",
      size: 8,
      data: "data:application/pdf;base64,JVBERi0xLjc=",
    },
  ];
  report.history.push({
    actor: "Руслан Есенов",
    at: "2026-10-25T10:00:00+05:00",
    action: "Подтверждена сверка",
    reason: "Сверено с журналом",
    customAuditField: true,
  });
  legacy.events[0].actor = "Руслан Есенов";
  legacy.invoices[0].paid = 1650000;
  legacy.settings.dailyPlan = 14500;

  const { store, entries } = setup({ "arzu.v1": JSON.stringify(legacy) });
  const state = JSON.parse(JSON.stringify(store.get()));
  assert.equal(state.users.find((user) => user.id === "u-dir").name, "Ернар Отаров");
  assert.deepEqual(state.reports, legacy.reports);
  assert.deepEqual(state.events, legacy.events);
  assert.deepEqual(state.invoices, legacy.invoices);
  assert.deepEqual(state.settings, legacy.settings);
  const persisted = JSON.parse(entries.get("arzu.v1"));
  assert.equal(persisted.users.find((user) => user.id === "u-dir").name, "Ернар Отаров");
  assert.deepEqual(persisted.reports, legacy.reports);
});

test("director migration keeps an explicitly edited profile name", () => {
  const fresh = setup();
  const saved = JSON.parse(JSON.stringify(fresh.data));
  saved.users.find((user) => user.id === "u-dir").name = "Назначенный руководитель";
  const { store } = setup({ "arzu.v1": JSON.stringify(saved) });
  assert.equal(
    store.get().users.find((user) => user.id === "u-dir").name,
    "Назначенный руководитель",
  );
});

test("legacy author migration does not guess between two employees with the same name", () => {
  const fresh = setup();
  const legacy = fresh.data;
  legacy.users.push({
    ...legacy.users.find((u) => u.id === "u-wh"),
    id: "u-wh-other",
    email: "warehouse-other@example.com",
  });
  legacy.reports
    .filter((r) => r.dept === "warehouse")
    .forEach((r) => delete r.authorId);
  const { store } = setup({ "arzu.v1": JSON.stringify(legacy) });
  const report = store
    .get()
    .reports.find((r) => r.id === "r-warehouse-2026-10-24");
  assert.equal(report.authorId, undefined);
  assert.throws(
    () =>
      store.saveDraft(
        {
          date: report.date,
          dept: "warehouse",
          values: report.values,
          reason: "Сверка",
        },
        "u-wh",
      ),
    /однозначно определить автора/,
  );
});

test("malformed saved data is backed up exactly before seeded replacement", () => {
  for (const raw of ["{invalid json", JSON.stringify({ reports: "broken" })]) {
    const { store, entries } = setup({ "arzu.v1": raw });
    const backup = Array.from(entries.keys()).find((k) =>
      k.startsWith("arzu.v1.corrupt."),
    );
    assert.ok(backup);
    assert.equal(entries.get(backup), raw);
    assert.equal(store.get().reports.length, 96);
    assert.notEqual(entries.get("arzu.v1"), raw);
  }
});

test("failed recovery backup preserves the damaged original and rejects writes", () => {
  const raw = "{invalid";
  const { store, entries } = setup({ "arzu.v1": raw }, { failBackup: true });
  assert.equal(store.get().reports.length, 96);
  assert.throws(
    () => store.saveDraft(production(), "u-prod"),
    /резервной копии/,
  );
  assert.equal(entries.get("arzu.v1"), raw);
  assert.equal(
    store.get().reports.some((r) => r.date === "2026-10-25"),
    false,
  );
});

test("draft allows incomplete fields; submission requires every field", () => {
  const { store } = setup();
  const draft = store.saveDraft(
    production({ values: { output: 12000 } }),
    "u-prod",
  );
  assert.equal(draft.values.raw, null);
  assert.equal(draft.status, "draft");
  assert.throws(
    () =>
      store.submitReport(production({ values: { output: 12000 } }), "u-prod"),
    /обязательные/,
  );
  const submitted = store.submitReport(production(), "u-prod");
  assert.equal(submitted.id, draft.id);
  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.authorId, "u-prod");
  assert.equal(
    store
      .get()
      .reports.filter((r) => r.date === "2026-10-25" && r.dept === "production")
      .length,
    1,
  );
});

test("invalid amounts, impossible defects and future dates never alter state", () => {
  const { store } = setup();
  const before = JSON.stringify(store.get());
  for (const raw of [-1, Infinity, NaN, 1e12 + 1, "12000"]) {
    assert.throws(
      () =>
        store.submitReport(
          production({ values: { output: raw, defects: 0, raw: 100 } }),
          "u-prod",
        ),
      /показатели/,
    );
  }
  assert.throws(
    () =>
      store.submitReport(
        production({ values: { output: 10, defects: 11, raw: 100 } }),
        "u-prod",
      ),
    /Брак/,
  );
  assert.throws(
    () => store.submitReport(production({ date: "2026-10-26" }), "u-prod"),
    /будущую/,
  );
  assert.throws(
    () => store.submitReport(production({ date: "2026-02-30" }), "u-prod"),
    /корректную рабочую дату/,
  );
  assert.equal(JSON.stringify(store.get()), before);
});

test("piece quantities are integers while material weights and money allow decimals", () => {
  const { store } = setup();
  assert.throws(
    () =>
      store.saveDraft(
        production({ values: { output: 12000.5, defects: 140, raw: 5760 } }),
        "u-prod",
      ),
    /целыми/,
  );
  assert.throws(
    () =>
      store.submitReport(
        production({ values: { output: 12000, defects: 140.5, raw: 5760 } }),
        "u-prod",
      ),
    /целыми/,
  );
  assert.throws(
    () =>
      store.submitReport(
        {
          date: "2026-10-25",
          dept: "sales",
          values: { units: 1.5, revenue: 100, cost: 50 },
        },
        "u-sales",
      ),
    /целыми/,
  );
  const report = store.submitReport(
    production({ values: { output: 12000, defects: 140, raw: 5760.25 } }),
    "u-prod",
  );
  assert.equal(report.values.raw, 5760.25);
  const sale = store.submitReport(
    {
      date: "2026-10-25",
      dept: "sales",
      values: { units: 10, revenue: 1234.5, cost: 810.25 },
    },
    "u-sales",
  );
  assert.equal(sale.values.revenue, 1234.5);
});

test("operating expenses are a subset of external payments, including in drafts", () => {
  const { store } = setup();
  const finance = {
    date: "2026-10-25",
    dept: "finance",
    values: { receipts: 1000, payments: 100, opex: 101, transfers: 50 },
  };
  assert.throws(
    () => store.submitReport(finance, "u-fin"),
    /не могут превышать/,
  );
  assert.throws(() => store.saveDraft(finance, "u-fin"), /не могут превышать/);
  const draft = store.saveDraft({ ...finance, values: { opex: 101 } }, "u-fin");
  assert.equal(draft.values.payments, null);
  const sent = store.submitReport(
    { ...finance, values: { ...finance.values, payments: 101 } },
    "u-fin",
  );
  assert.equal(sent.values.opex, sent.values.payments);
});

test("duplicate submission and editing approved reports are blocked", () => {
  const { store } = setup();
  store.submitReport(production(), "u-prod");
  assert.throws(
    () => store.submitReport(production(), "u-prod"),
    /нельзя изменить/,
  );
  assert.throws(
    () => store.saveDraft(production({ date: "2026-10-23" }), "u-prod"),
    /нельзя изменить/,
  );
});

test("rights come from current users, not forged actor properties", () => {
  const { store } = setup();
  assert.throws(
    () =>
      store.submitReport(production(), {
        id: "u-sales",
        role: "staff",
        dept: "production",
        status: "active",
      }),
    /Недостаточно прав/,
  );
  assert.throws(
    () =>
      store.approve("r-production-2026-10-24", {
        id: "u-admin",
        role: "director",
      }),
    /Недостаточно прав/,
  );
  store.upsertUser({ id: "u-prod", status: "disabled" }, "u-admin");
  assert.throws(
    () => store.saveDraft(production(), { id: "u-prod", status: "active" }),
    /активному/,
  );
});

test("director approval changes totals only once and records an audit event", () => {
  const { store, api } = setup();
  const before = api.aggregate(store.get().reports, "2026-10-24", "2026-10-24");
  const approved = store.approve("r-production-2026-10-24", "u-dir");
  const after = api.aggregate(store.get().reports, "2026-10-24", "2026-10-24");
  assert.equal(before.output, 0);
  assert.equal(after.output, approved.values.output);
  assert.equal(approved.history.at(-1).newStatus, "approved");
  assert.equal(store.get().events[0].type, "approved");
  assert.throws(
    () => store.approve(approved.id, "u-dir"),
    /только отправленный/,
  );
});

test("return requires a reason; corrected reports preserve old/new values and reasons", () => {
  const { store } = setup();
  assert.throws(
    () => store.returnReport("r-production-2026-10-24", "", "u-dir"),
    /причину возврата/,
  );
  const returned = store.returnReport(
    "r-production-2026-10-24",
    "Проверьте выпуск",
    "u-dir",
  );
  assert.equal(returned.status, "returned");
  const payload = production({ date: "2026-10-24" });
  assert.throws(
    () => store.saveDraft(payload, "u-prod"),
    /причину исправления/,
  );
  const revised = store.submitReport(
    { ...payload, reason: "Выпуск сверен с журналом смены" },
    "u-prod",
  );
  const edit = revised.history.at(-1);
  assert.equal(edit.oldValues.output, returned.values.output);
  assert.equal(edit.newValues.output, 12000);
  assert.equal(edit.reason, "Выпуск сверен с журналом смены");
  assert.equal(revised.history.length, returned.history.length + 1);
});

test("no-operations reports are explicit zeros and warehouse retains the last stock", () => {
  const { store } = setup();
  const empty = store.submitReport(
    production({ values: {}, noOperations: true }),
    "u-prod",
  );
  assert.equal(empty.values.output, 0);
  assert.equal(empty.noOperations, true);
  const stock = store
    .get()
    .reports.find((r) => r.dept === "warehouse" && r.date === "2026-10-23")
    .values.stock;
  const warehouse = store.submitReport(
    { date: "2026-10-25", dept: "warehouse", values: {}, noOperations: true },
    "u-wh",
  );
  assert.equal(warehouse.values.stock, stock);
  assert.equal(warehouse.values.received, 0);
  assert.throws(
    () =>
      store.saveDraft(
        {
          date: "2026-10-25",
          dept: "sales",
          noOperations: true,
          values: { revenue: 100 },
        },
        "u-sales",
      ),
    /нулевыми/,
  );
});

test("only admin can manage users and settings; unique emails and last active admin are protected", () => {
  const { store } = setup();
  assert.throws(
    () => store.upsertUser({ name: "Другой" }, "u-dir"),
    /Недостаточно прав/,
  );
  assert.throws(
    () => store.updateSettings({ dailyPlan: 14000 }, "u-dir"),
    /Недостаточно прав/,
  );
  assert.throws(
    () =>
      store.upsertUser(
        {
          name: "Другой",
          email: "PRODUCTION@arzu.demo",
          role: "staff",
          dept: "production",
        },
        "u-admin",
      ),
    /уже существует/,
  );
  assert.throws(
    () =>
      store.upsertUser(
        { name: "Другой", email: "x@example.com", role: "staff" },
        "u-admin",
      ),
    /выбрать участок/,
  );
  assert.throws(
    () => store.upsertUser({ id: "u-admin", status: "disabled" }, "u-admin"),
    /активный администратор/,
  );
  const created = store.upsertUser(
    {
      name: "Новый сотрудник",
      email: "new@example.com",
      role: "staff",
      dept: "sales",
    },
    "u-admin",
  );
  assert.equal(created.status, "invited");
  assert.throws(
    () =>
      store.submitReport(
        {
          date: "2026-10-25",
          dept: "sales",
          values: { units: 1, revenue: 1, cost: 1 },
        },
        created,
      ),
    /активному/,
  );
  const updated = store.updateSettings(
    { dailyPlan: 14000, defectLimit: 1.5, stockMin: 14000 },
    "u-admin",
  );
  assert.equal(updated.settings.dailyPlan, 14000);
  assert.throws(
    () => store.updateSettings({ defectLimit: 101 }, "u-admin"),
    /числовые/,
  );
  assert.throws(
    () => store.updateSettings({ dailyPlan: 12000.5 }, "u-admin"),
    /числовые/,
  );
});

test("role and department changes immediately revoke outdated actor permissions", () => {
  const { store } = setup();
  const oldActor = store.get().users.find((u) => u.id === "u-prod");
  store.upsertUser({ id: oldActor.id, dept: "sales" }, "u-admin");
  assert.throws(
    () => store.saveDraft(production(), oldActor),
    /Недостаточно прав/,
  );
  const extraAdmin = store.upsertUser(
    {
      name: "Второй администратор",
      email: "second@example.com",
      role: "admin",
      status: "active",
    },
    "u-admin",
  );
  store.upsertUser({ id: "u-admin", role: "director" }, "u-admin");
  assert.throws(
    () =>
      store.updateSettings(
        { dailyPlan: 10000 },
        { id: "u-admin", role: "admin" },
      ),
    /Недостаточно прав/,
  );
  assert.equal(
    store.updateSettings({ dailyPlan: 10000 }, extraAdmin).settings.dailyPlan,
    10000,
  );
});

test("resetting the primary key reloads seed roles, reports and settings", () => {
  const { store, entries } = setup();
  store.upsertUser({ id: "u-prod", status: "disabled" }, "u-admin");
  store.updateSettings({ dailyPlan: 15000 }, "u-admin");
  entries.delete("arzu.v1");
  const fresh = store.load();
  assert.equal(fresh.users.find((u) => u.id === "u-prod").status, "active");
  assert.equal(fresh.settings.dailyPlan, 12000);
  assert.equal(fresh.reports.length, 96);
  assert.equal(fresh.events.length, 6);
});

test("stale tabs cannot silently overwrite changes from a different tab", () => {
  const { store, entries } = setup();
  const changedElsewhere = JSON.parse(entries.get("arzu.v1"));
  changedElsewhere.settings.dailyPlan = 16000;
  entries.set("arzu.v1", JSON.stringify(changedElsewhere));
  assert.throws(
    () => store.saveDraft(production(), "u-prod"),
    /другой вкладке/,
  );
  assert.equal(store.get().settings.dailyPlan, 16000);
  assert.equal(
    store.get().reports.some((r) => r.date === "2026-10-25"),
    false,
  );
  assert.equal(JSON.parse(entries.get("arzu.v1")).settings.dailyPlan, 16000);
});

test("failed writes are atomic and a reload retains a successfully saved report", () => {
  const { store, entries, options } = setup();
  const original = JSON.stringify(store.get());
  options.failWrite = true;
  assert.throws(
    () => store.submitReport(production(), "u-prod"),
    /Не удалось сохранить/,
  );
  assert.equal(JSON.stringify(store.get()), original);
  options.failWrite = false;
  const saved = store.submitReport(production(), "u-prod");
  const reloaded = setup(Object.fromEntries(entries)).store.get();
  assert.equal(
    reloaded.reports.find((r) => r.id === saved.id).status,
    "submitted",
  );
});
