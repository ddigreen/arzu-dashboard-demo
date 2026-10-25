const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function setup() {
  const context = vm.createContext({ window: {} });
  for (const file of ["data.js", "charts.js"])
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
      context,
    );
  return { charts: context.window.ARZUCharts, data: context.window.ARZUData };
}

function normalized(html) {
  return html.replace(/[\u00a0\u202f]/g, " ");
}

function financeReport(date, payments, opex, extras = {}) {
  return {
    date,
    dept: "finance",
    status: "approved",
    values: { payments, opex, transfers: 10000 },
    ...extras,
  };
}

test("financial line and area charts preserve null gaps rather than inventing zeros", () => {
  const { charts } = setup();
  const rows = [
    { date: "2026-11-01", revenue: 1000000, receipts: null, payments: null },
    { date: "2026-11-02", revenue: null, receipts: null, payments: null },
    { date: "2026-11-03", revenue: 2000000, receipts: null, payments: null },
  ];
  for (const type of ["line", "area"]) {
    const svg = charts.financeSVG(rows, { type, seriesOn: { revenue: true } });
    assert.equal((svg.match(/class="series-line"/g) || []).length, 2);
    const absentDay = svg.match(
      /<g class="chart-day"[^>]*data-date="2026-11-02"[\s\S]*?<\/g>/,
    )[0];
    assert.match(absentDay, /нет подтверждённого отчёта/);
    assert.doesNotMatch(absentDay, /class="chart-point"/);
    assert.match(svg, /нояб/);
    assert.doesNotMatch(svg, /gradient|NaN|undefined/);
  }
});

test("financial bars distinguish an explicit approved zero from a missing day and honor series selection", () => {
  const { charts } = setup();
  const svg = charts.financeSVG(
    [
      { date: "2026-10-01", revenue: 0, receipts: 500, payments: 300 },
      { date: "2026-10-02", revenue: null, receipts: 700, payments: 400 },
    ],
    {
      type: "bar",
      seriesOn: { revenue: true, receipts: false, payments: false },
    },
  );
  assert.equal((svg.match(/class="series-bar"/g) || []).length, 1);
  assert.match(svg, /data-series="revenue"[^>]*height="0"/);
  assert.doesNotMatch(svg, /class="series-bar" data-series="receipts"/);
  assert.match(svg, /Выручка: 0 ₸/);
  assert.match(svg, /tabindex="0" role="button" data-action="chart-day"/);
});

test("empty financial charts explain absent data and all hidden series", () => {
  const { charts } = setup();
  assert.match(
    charts.financeSVG([], { type: "area" }),
    /Нет подтверждённых данных/,
  );
  assert.match(
    charts.financeSVG([], {
      seriesOn: { revenue: false, receipts: false, payments: false },
    }),
    /Выберите ряды/,
  );
});

test("production uses configured plan for the whole date range, with gaps and exact approved output", () => {
  const { charts } = setup();
  const html = normalized(
    charts.productionCard(
      [
        { date: "2026-10-01", output: 15000, defects: 101, plan: 12000 },
        { date: "2026-10-03", output: 0, defects: 0, plan: 12000 },
      ],
      { dailyPlan: 16000, from: "2026-10-01", to: "2026-10-03" },
    ),
  );
  assert.match(html, /Подтверждено: 2 из 3 дней/);
  assert.match(html, /48 000 <small>ед\.<\/small>/);
  assert.match(html, /31,3%/);
  assert.match(html, /Брак: 101 ед\./);
  assert.match(html, /Демо-план: 16 000 ед\./);
  assert.equal((html.match(/class="production-bar"/g) || []).length, 1);
  assert.equal((html.match(/class="production-zero"/g) || []).length, 1);
  assert.match(
    html,
    /data-date="2026-10-02"[^>]*Нет подтверждённого производственного отчёта/,
  );
  assert.match(html, /class="bi-plan-line"[^>]*stroke-dasharray="6 4"/);
});

test("production totals match the shared approved source aggregation", () => {
  const { charts, data } = setup();
  const db = data.seed();
  const aggregate = data.aggregate(db.reports, "2026-10-20", "2026-10-24");
  const html = normalized(
    charts.productionCard(aggregate.series, {
      dailyPlan: 12000,
      from: "2026-10-20",
      to: "2026-10-24",
    }),
  );
  const output = new Intl.NumberFormat("ru-RU")
    .format(aggregate.output)
    .replace(/\u00a0/g, " ");
  assert.ok(html.includes(output + " <small>ед.</small>"));
  assert.match(html, /Подтверждено: 4 из 5 дней/);
  assert.match(html, /60 000 <small>ед\.<\/small>/);
});

test("payments partition external payments once and exclude transfers, unapproved and out-of-range reports", () => {
  const { charts } = setup();
  const html = normalized(
    charts.paymentsCard(
      [
        financeReport("2026-10-01", 1000, 200),
        financeReport("2026-10-02", 2000, 300),
        financeReport("2026-10-03", 9000, 1000, { status: "submitted" }),
        financeReport("2026-09-30", 8000, 400),
      ],
      { from: "2026-10-01", to: "2026-10-03" },
    ),
  );
  assert.match(html, /Всего внешних выплат<\/span><strong>3 000 ₸/);
  assert.match(html, /Операционные расходы<\/dt><dd><strong>500 ₸/);
  assert.match(html, /Остальные внешние выплаты<\/dt><dd><strong>2 500 ₸/);
  assert.match(html, /Подтверждено: 2 из 3 дней/);
  assert.match(html, /Неполные данные/);
  assert.doesNotMatch(html, /3 500 ₸|20 000 ₸/);
  assert.match(html, /data-action="metric" data-key="payments"/);
});

test("payments without an approved report show an empty state rather than a zero total", () => {
  const { charts } = setup();
  const html = charts.paymentsCard(
    [financeReport("2026-10-01", 1000, 100, { status: "draft" })],
    { from: "2026-10-01", to: "2026-10-02" },
  );
  assert.match(html, /Нет подтверждённых финансовых отчётов/);
  assert.doesNotMatch(html, /<strong>0 ₸/);
  assert.doesNotMatch(html, /class="bi-donut"/);
});

test("payments with explicit zero and invalid composition remain distinguishable", () => {
  const { charts } = setup();
  const options = { from: "2026-10-01", to: "2026-10-01" };
  const zero = charts.paymentsCard(
    [financeReport("2026-10-01", 0, 0)],
    options,
  );
  assert.match(zero, /Всего внешних выплат<\/span><strong>0 ₸/);
  assert.doesNotMatch(zero, /NaN|Infinity/);
  const invalid = charts.paymentsCard(
    [financeReport("2026-10-01", 100, 200)],
    options,
  );
  assert.match(invalid, /Состав выплат заполнен не полностью/);
  assert.doesNotMatch(invalid, /class="bi-donut"/);
});
