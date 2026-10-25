(function () {
  "use strict";

  // All records in this file are synthetic demonstration data.
  var DAY = 86400000;
  var OPENING_BALANCE = 8400000;
  var DEPARTMENTS = ["production", "warehouse", "sales", "finance"];

  function parseDay(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return null;
    var time = Date.parse(value + "T00:00:00Z");
    if (
      !Number.isFinite(time) ||
      new Date(time).toISOString().slice(0, 10) !== value
    )
      return null;
    return time;
  }

  function rangeDays(from, to) {
    var start = parseDay(from);
    var end = parseDay(to);
    if (start === null || end === null || start > end) return [];
    var result = [];
    for (var time = start; time <= end; time += DAY) {
      result.push(new Date(time).toISOString().slice(0, 10));
    }
    return result;
  }

  function money(value) {
    return Math.round(value / 1000) * 1000;
  }

  function valueOf(report, field) {
    var value = report && report.values && report.values[field];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  function seed() {
    var users = [
      {
        id: "u-dir",
        name: "Ернар Отаров",
        email: "director@arzu.demo",
        role: "director",
        dept: null,
        status: "active",
      },
      {
        id: "u-admin",
        name: "Алия Серикова",
        email: "admin@arzu.demo",
        role: "admin",
        dept: null,
        status: "active",
      },
      {
        id: "u-prod",
        name: "Айдар Омаров",
        email: "production@arzu.demo",
        role: "staff",
        dept: "production",
        status: "active",
      },
      {
        id: "u-wh",
        name: "Мадина Нурланова",
        email: "warehouse@arzu.demo",
        role: "staff",
        dept: "warehouse",
        status: "active",
      },
      {
        id: "u-sales",
        name: "Данияр Ахметов",
        email: "sales@arzu.demo",
        role: "staff",
        dept: "sales",
        status: "active",
      },
      {
        id: "u-fin",
        name: "Асель Касымова",
        email: "finance@arzu.demo",
        role: "staff",
        dept: "finance",
        status: "active",
      },
    ];
    var authors = {};
    var authorIds = {};
    users.forEach(function (user) {
      if (user.dept) {
        authors[user.dept] = user.name;
        authorIds[user.dept] = user.id;
      }
    });
    var reports = [];
    var stock = 18500;

    rangeDays("2026-10-01", "2026-10-24").forEach(function (date, index) {
      var day = index + 1;
      var output =
        Math.round(
          (11900 + Math.sin(day * 0.73) * 740 + (day % 4) * 110) / 10,
        ) * 10;
      var defects = Math.round(output * (0.012 + (day % 5) * 0.0017));
      if (day === 17) defects = Math.round(output * 0.025);
      var raw = Math.round(output * 0.48);
      var received =
        Math.round((raw + Math.cos(day * 0.59) * 1400 + 100) / 50) * 50;
      stock = stock + received - raw;
      var units =
        Math.round((output - defects - 280 + Math.sin(day * 0.41) * 430) / 10) *
        10;
      var revenue = money(units * (122 + (day % 3) * 3));
      var cost = money(revenue * (0.61 + (day % 4) * 0.005));
      var receipts = money(revenue * (0.8 + (day % 5) * 0.025));
      var opex = money(100000 + (day % 6) * 8500);
      var payments = money(
        cost * 0.94 + opex + (day % 7 === 0 ? 160000 : 32000),
      );
      var values = {
        production: { output: output, defects: defects, raw: raw },
        warehouse: { stock: stock, received: received, issued: raw },
        sales: { units: units, revenue: revenue, cost: cost },
        finance: {
          receipts: receipts,
          payments: payments,
          opex: opex,
          transfers: day % 5 === 0 ? 250000 : 0,
        },
      };

      DEPARTMENTS.forEach(function (dept, deptIndex) {
        var status =
          day < 24
            ? "approved"
            : dept === "warehouse"
              ? "returned"
              : "submitted";
        var at =
          date +
          "T18:" +
          String(10 + deptIndex * 7).padStart(2, "0") +
          ":00+05:00";
        var history = [
          {
            at: date + "T17:45:00+05:00",
            actor: authors[dept],
            action: "Создан черновик отчёта",
          },
          {
            at: at,
            actor: authors[dept],
            action: "Отчёт отправлен на проверку",
          },
        ];
        if (status === "approved") {
          history.push({
            at: date + "T19:15:00+05:00",
            actor: "Ернар Отаров",
            action: "Отчёт подтверждён",
          });
        } else if (status === "returned") {
          history.push({
            at: date + "T19:05:00+05:00",
            actor: "Ернар Отаров",
            action:
              "Возвращён: уточните фактический остаток после инвентаризации",
          });
        }
        reports.push({
          id: "r-" + dept + "-" + date,
          date: date,
          dept: dept,
          author: authors[dept],
          authorId: authorIds[dept],
          status: status,
          values: values[dept],
          comment:
            day === 24 && dept === "warehouse"
              ? "Остаток требует сверки с вечерней инвентаризацией."
              : day === 17 && dept === "production"
                ? "Перенастройка линии; повышенный брак на первой партии."
                : "",
          files: [],
          noOperations: false,
          createdAt: date + "T17:45:00+05:00",
          history: history,
        });
      });
    });

    return {
      reports: reports,
      users: users,
      settings: { dailyPlan: 12000, defectLimit: 2, stockMin: 12000 },
      invoices: [
        {
          id: "INV-26041",
          client: "ТОО «Алтын Маркет»",
          amount: 2400000,
          paid: 1600000,
          dueDate: "2026-10-21",
          date: "2026-10-07",
        },
        {
          id: "INV-26048",
          client: "ТОО «Дала Трейд»",
          amount: 1850000,
          paid: 1000000,
          dueDate: "2026-10-24",
          date: "2026-10-10",
        },
        {
          id: "INV-26055",
          client: "ИП «Береке»",
          amount: 1260000,
          paid: 460000,
          dueDate: "2026-10-28",
          date: "2026-10-14",
        },
        {
          id: "INV-26062",
          client: "ТОО «Север Снаб»",
          amount: 3120000,
          paid: 1400000,
          dueDate: "2026-11-02",
          date: "2026-10-19",
        },
        {
          id: "INV-26068",
          client: "ТОО «Орда Retail»",
          amount: 1980000,
          paid: 980000,
          dueDate: "2026-11-06",
          date: "2026-10-23",
        },
      ],
      events: [
        {
          id: "e-1",
          at: "2026-10-24T19:05:00+05:00",
          actor: "Ернар Отаров",
          action: "Отчёт возвращён",
          detail: "Склад · 24 октября. Требуется сверка фактического остатка.",
          type: "returned",
          reportId: "r-warehouse-2026-10-24",
        },
        {
          id: "e-2",
          at: "2026-10-24T18:31:00+05:00",
          actor: "Асель Касымова",
          action: "Отчёт отправлен",
          detail: "Финансы · 24 октября. Ожидает подтверждения.",
          type: "submitted",
          reportId: "r-finance-2026-10-24",
        },
        {
          id: "e-3",
          at: "2026-10-24T18:24:00+05:00",
          actor: "Данияр Ахметов",
          action: "Отчёт отправлен",
          detail: "Продажи · 24 октября. Ожидает подтверждения.",
          type: "submitted",
          reportId: "r-sales-2026-10-24",
        },
        {
          id: "e-4",
          at: "2026-10-24T18:10:00+05:00",
          actor: "Айдар Омаров",
          action: "Отчёт отправлен",
          detail: "Производство · 24 октября. Ожидает подтверждения.",
          type: "submitted",
          reportId: "r-production-2026-10-24",
        },
        {
          id: "e-5",
          at: "2026-10-23T19:15:00+05:00",
          actor: "Ернар Отаров",
          action: "Отчёты подтверждены",
          detail: "Все четыре участка за 23 октября прошли проверку.",
          type: "approved",
          reportId: null,
        },
        {
          id: "e-6",
          at: "2026-10-17T19:15:00+05:00",
          actor: "Ернар Отаров",
          action: "Отклонение принято с пояснением",
          detail:
            "Производство · 17 октября. Повышенный брак при перенастройке линии.",
          type: "info",
          reportId: "r-production-2026-10-17",
        },
      ],
    };
  }

  function aggregate(reports, from, to, dept) {
    dept = dept || "all";
    var days = rangeDays(from, to);
    var validDepartment = dept === "all" || DEPARTMENTS.indexOf(dept) !== -1;
    var input = Array.isArray(reports) ? reports : [];
    var validRange = days.length > 0 && validDepartment;
    var inRange = validRange
      ? input.filter(function (report) {
          return (
            report &&
            DEPARTMENTS.indexOf(report.dept) !== -1 &&
            parseDay(report.date) !== null &&
            report.date >= from &&
            report.date <= to &&
            (dept === "all" || report.dept === dept)
          );
        })
      : [];
    var approved = inRange.filter(function (report) {
      return report.status === "approved";
    });
    var totals = {
      revenue: 0,
      cost: 0,
      receipts: 0,
      payments: 0,
      output: 0,
      defects: 0,
      raw: 0,
    };
    var byDate = {};
    var slots = {};
    approved.forEach(function (report) {
      (byDate[report.date] || (byDate[report.date] = [])).push(report);
      slots[report.date + ":" + report.dept] = true;
      var fields =
        report.dept === "sales"
          ? ["revenue", "cost"]
          : report.dept === "finance"
            ? ["receipts", "payments"]
            : report.dept === "production"
              ? ["output", "defects", "raw"]
              : [];
      fields.forEach(function (field) {
        totals[field] += valueOf(report, field);
      });
    });

    var balance = OPENING_BALANCE;
    var lastStock = null;
    if (parseDay(to) !== null) {
      input.forEach(function (report) {
        if (
          !report ||
          report.status !== "approved" ||
          parseDay(report.date) === null ||
          report.date > to
        )
          return;
        if (report.dept === "finance")
          balance += valueOf(report, "receipts") - valueOf(report, "payments");
        if (
          report.dept === "warehouse" &&
          (!lastStock || report.date >= lastStock.date)
        )
          lastStock = report;
      });
    }

    var expectedCount = validRange
      ? days.length * (dept === "all" ? DEPARTMENTS.length : 1)
      : 0;
    var series = days.map(function (date) {
      var entries = byDate[date] || [];
      var row = {
        date: date,
        revenue: null,
        receipts: null,
        payments: null,
        output: null,
        defects: null,
        plan: 12000,
        hasSales: false,
        hasFinance: false,
        hasProduction: false,
      };
      entries.forEach(function (report) {
        if (report.dept === "sales") {
          row.hasSales = true;
          row.revenue =
            (row.revenue === null ? 0 : row.revenue) +
            valueOf(report, "revenue");
        } else if (report.dept === "finance") {
          row.hasFinance = true;
          row.receipts =
            (row.receipts === null ? 0 : row.receipts) +
            valueOf(report, "receipts");
          row.payments =
            (row.payments === null ? 0 : row.payments) +
            valueOf(report, "payments");
        } else if (report.dept === "production") {
          row.hasProduction = true;
          row.output =
            (row.output === null ? 0 : row.output) + valueOf(report, "output");
          row.defects =
            (row.defects === null ? 0 : row.defects) +
            valueOf(report, "defects");
        }
      });
      return row;
    });

    return Object.assign(totals, {
      balance: balance,
      stock: lastStock ? valueOf(lastStock, "stock") : null,
      coverage: expectedCount
        ? Math.round((Object.keys(slots).length / expectedCount) * 1000) / 10
        : 0,
      approvedCount: approved.length,
      expectedCount: expectedCount,
      series: series,
      pending: inRange.filter(function (report) {
        return report.status === "submitted";
      }),
      returnCount: inRange.filter(function (report) {
        return report.status === "returned";
      }).length,
    });
  }

  window.ARZUData = { seed: seed, aggregate: aggregate, rangeDays: rangeDays };
})();
