const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function dataAPI() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../src/data.js"), "utf8"),
    context,
  );
  return context.window.ARZUData;
}

test("seed is independent, serializable and leaves 25 October empty", () => {
  const api = dataAPI();
  const first = api.seed();
  const second = api.seed();
  assert.equal(first.reports.length, 96);
  assert.equal(first.users.length, 6);
  assert.equal(
    first.reports.find((r) => r.dept === "production").authorId,
    "u-prod",
  );
  assert.ok(
    first.reports.every((r) =>
      first.users.some((u) => u.id === r.authorId && u.dept === r.dept),
    ),
  );
  assert.equal(
    first.reports.some((r) => r.date === "2026-10-25"),
    false,
  );
  first.reports[0].values.output = -1;
  assert.ok(second.reports[0].values.output > 0);
  assert.doesNotThrow(() => JSON.stringify(second));
});

test("aggregates exclude submitted and returned reports and measure missing daily slots", () => {
  const api = dataAPI();
  const data = api.seed();
  const result = api.aggregate(data.reports, "2026-10-01", "2026-10-25");
  const approved = data.reports.filter((r) => r.status === "approved");
  assert.equal(result.approvedCount, 92);
  assert.equal(result.expectedCount, 100);
  assert.equal(result.coverage, 92);
  assert.equal(result.pending.length, 3);
  assert.equal(result.returnCount, 1);
  assert.equal(
    result.revenue,
    approved
      .filter((r) => r.dept === "sales")
      .reduce((s, r) => s + r.values.revenue, 0),
  );
  assert.equal(
    result.output,
    approved
      .filter((r) => r.dept === "production")
      .reduce((s, r) => s + r.values.output, 0),
  );
  assert.equal(result.series[23].revenue, null);
  assert.equal(result.series[24].hasProduction, false);
});

test("cash and inventory are as-of balances, not sums of daily closing balances", () => {
  const api = dataAPI();
  const { reports } = api.seed();
  const result = api.aggregate(
    reports,
    "2026-10-20",
    "2026-10-25",
    "production",
  );
  const finance = reports.filter(
    (r) => r.status === "approved" && r.dept === "finance",
  );
  const expectedBalance =
    8400000 +
    finance.reduce((s, r) => s + r.values.receipts - r.values.payments, 0);
  assert.equal(result.balance, expectedBalance);
  assert.equal(
    result.stock,
    reports.find((r) => r.dept === "warehouse" && r.date === "2026-10-23")
      .values.stock,
  );
  assert.equal(result.receipts, 0);
  assert.equal(result.expectedCount, 6);
  const altered = reports.map((r) =>
    r.dept === "finance"
      ? { ...r, values: { ...r.values, transfers: 999999999 } }
      : r,
  );
  assert.equal(
    api.aggregate(altered, "2026-10-20", "2026-10-25").balance,
    expectedBalance,
  );
});

test("explicit zero activity is distinguishable from an absent report", () => {
  const api = dataAPI();
  const reports = [
    {
      id: "zero",
      date: "2026-10-24",
      dept: "sales",
      status: "approved",
      values: { units: 0, revenue: 0, cost: 0 },
      noOperations: true,
    },
  ];
  const result = api.aggregate(reports, "2026-10-24", "2026-10-25", "sales");
  assert.equal(result.series[0].revenue, 0);
  assert.equal(result.series[0].hasSales, true);
  assert.equal(result.series[1].revenue, null);
  assert.equal(result.series[1].hasSales, false);
  assert.equal(result.coverage, 50);
});

test("date helper handles inclusive ranges, leap days and invalid calendar dates", () => {
  const api = dataAPI();
  assert.equal(api.rangeDays("2026-10-24", "2026-10-25").length, 2);
  assert.equal(api.rangeDays("2024-02-28", "2024-03-01").length, 3);
  assert.equal(api.rangeDays("2026-02-29", "2026-03-01").length, 0);
  assert.equal(api.rangeDays("2026-10-25", "2026-10-01").length, 0);
  assert.equal(api.rangeDays("not-a-date", "2026-10-25").length, 0);
});
