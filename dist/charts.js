(function () {
  "use strict";

  // Pure rendering helpers. Every amount is supplied by approved source records.
  var DAY = 86400000;
  var BLUE = "var(--chart-blue, #315fdf)";
  var VIOLET = "var(--chart-violet, #8270d6)";
  var GOLD = "var(--chart-gold, #c39a45)";
  var LABEL = "var(--chart-label, #7a8494)";
  var GRID = "var(--chart-grid, #e8ebf0)";
  var TRACK = "var(--chart-track, #edf0f5)";
  var SERIES = [
    { key: "revenue", label: "Выручка", color: BLUE },
    { key: "receipts", label: "Поступления", color: VIOLET },
    { key: "payments", label: "Выплаты", color: GOLD },
  ];

  function escape(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[character];
    });
  }

  function number(value, digits) {
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: digits === undefined ? 2 : digits,
    }).format(value);
  }

  function money(value) {
    return number(value) + " ₸";
  }

  function amount(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
  }

  function dayTime(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return null;
    var time = Date.parse(value + "T12:00:00Z");
    return Number.isFinite(time) &&
      new Date(time).toISOString().slice(0, 10) === value
      ? time
      : null;
  }

  function dateLabel(value, short) {
    if (dayTime(value) === null) return "Некорректная дата";
    return new Date(value + "T12:00:00Z")
      .toLocaleDateString("ru-RU", {
        day: short ? "2-digit" : "numeric",
        month: short ? "short" : "long",
        timeZone: "UTC",
      })
      .replace(/\./g, "");
  }

  function datesInRange(from, to) {
    var start = dayTime(from),
      end = dayTime(to),
      days = [];
    if (
      start === null ||
      end === null ||
      start > end ||
      (end - start) / DAY > 10000
    )
      return days;
    for (var time = start; time <= end; time += DAY)
      days.push(new Date(time).toISOString().slice(0, 10));
    return days;
  }

  function normalizeRows(rows) {
    return (Array.isArray(rows) ? rows : [])
      .filter(function (row) {
        return row && dayTime(row.date) !== null;
      })
      .slice()
      .sort(function (left, right) {
        return left.date.localeCompare(right.date);
      });
  }

  function rounded(value) {
    return Math.round(value * 100) / 100;
  }

  function scaleTop(value) {
    if (!(value > 0)) return 1;
    var rough = value / 4;
    var power = Math.pow(10, Math.floor(Math.log10(rough)));
    var normalized = rough / power;
    var step =
      (normalized <= 1
        ? 1
        : normalized <= 2
          ? 2
          : normalized <= 2.5
            ? 2.5
            : normalized <= 5
              ? 5
              : 10) * power;
    return step * 4;
  }

  function axisGrid(maximum, y, left, right, unit) {
    var markup =
      '<text class="bi-axis-unit" x="' +
      left +
      '" y="12" fill="' +
      LABEL +
      '">' +
      unit +
      "</text>";
    for (var tick = 0; tick <= 4; tick += 1) {
      var value = (maximum * tick) / 4;
      var label =
        unit === "млн ₸"
          ? number(value / 1000000, maximum < 1000000 ? 3 : 2)
          : number(value, 0);
      var position = rounded(y(value));
      markup +=
        '<line class="grid" x1="' +
        left +
        '" y1="' +
        position +
        '" x2="' +
        right +
        '" y2="' +
        position +
        '" stroke="' +
        GRID +
        '" stroke-width="1"/><text x="' +
        (left - 10) +
        '" y="' +
        (position + 3) +
        '" text-anchor="end" fill="' +
        LABEL +
        '">' +
        label +
        "</text>";
    }
    return markup;
  }

  function dateTicks(rows, x, baseline) {
    var interval = Math.max(1, Math.ceil(rows.length / 6));
    return rows
      .map(function (row, index) {
        if (index !== 0 && index !== rows.length - 1 && index % interval !== 0)
          return "";
        // Suppress labels very close to the last tick in longer ranges.
        if (
          index !== 0 &&
          index !== rows.length - 1 &&
          rows.length - 1 - index < interval * 0.55
        )
          return "";
        return (
          '<text x="' +
          rounded(x(index)) +
          '" y="' +
          baseline +
          '" text-anchor="middle" fill="' +
          LABEL +
          '">' +
          escape(dateLabel(row.date, true)) +
          "</text>"
        );
      })
      .join("");
  }

  function financeSVG(input, options) {
    options = options || {};
    var rows = normalizeRows(input);
    var type =
      options.type === "bar" || options.type === "area" ? options.type : "line";
    var enabled = options.seriesOn || {
      revenue: true,
      receipts: true,
      payments: true,
    };
    var selected = SERIES.filter(function (series) {
      return enabled[series.key];
    });
    var left = 58,
      right = 623,
      top = 27,
      bottom = 166,
      width = right - left;
    var step = width / Math.max(rows.length, 1);
    var x = function (index) {
      return left + (index + 0.5) * step;
    };
    var largest = Math.max.apply(
      null,
      [0].concat(
        rows.flatMap(function (row) {
          return selected.map(function (series) {
            return amount(row[series.key]) ? row[series.key] : 0;
          });
        }),
      ),
    );
    var maximum = scaleTop(largest || 1000000);
    var y = function (value) {
      return bottom - (value / maximum) * (bottom - top);
    };
    var hasData = rows.some(function (row) {
      return selected.some(function (series) {
        return amount(row[series.key]);
      });
    });
    var grid = axisGrid(maximum, y, left, right, "млн ₸");
    var paths = selected
      .map(function (series, seriesIndex) {
        if (type === "bar") {
          var barWidth = Math.max(
            1,
            Math.min(14, (step * 0.7) / Math.max(selected.length, 1)),
          );
          return rows
            .map(function (row, index) {
              if (!amount(row[series.key])) return "";
              var value = row[series.key];
              var position =
                x(index) +
                (seriesIndex - (selected.length - 1) / 2) * barWidth -
                barWidth * 0.42;
              return (
                '<rect class="series-bar" data-series="' +
                series.key +
                '" data-date="' +
                row.date +
                '" x="' +
                rounded(position) +
                '" y="' +
                rounded(y(value)) +
                '" width="' +
                rounded(barWidth * 0.84) +
                '" height="' +
                rounded(bottom - y(value)) +
                '" rx="1.5" fill="' +
                series.color +
                '"><title>' +
                escape(
                  dateLabel(row.date) +
                    ": " +
                    series.label +
                    " " +
                    money(value),
                ) +
                "</title></rect>"
              );
            })
            .join("");
        }
        var segments = [],
          segment = [];
        rows.forEach(function (row, index) {
          if (amount(row[series.key]))
            segment.push([x(index), y(row[series.key])]);
          else if (segment.length) {
            segments.push(segment);
            segment = [];
          }
        });
        if (segment.length) segments.push(segment);
        return segments
          .map(function (points) {
            var line =
              "M" +
              points
                .map(function (point) {
                  return rounded(point[0]) + "," + rounded(point[1]);
                })
                .join(" L");
            var area =
              type === "area" && points.length > 1
                ? '<path class="series-area" data-series="' +
                  series.key +
                  '" d="' +
                  line +
                  " L" +
                  rounded(points[points.length - 1][0]) +
                  "," +
                  bottom +
                  " L" +
                  rounded(points[0][0]) +
                  "," +
                  bottom +
                  ' Z" fill="' +
                  series.color +
                  '" fill-opacity="0.09"/>'
                : "";
            var single =
              points.length === 1
                ? '<circle cx="' +
                  rounded(points[0][0]) +
                  '" cy="' +
                  rounded(points[0][1]) +
                  '" r="3" fill="' +
                  series.color +
                  '"/>'
                : "";
            return (
              area +
              '<path class="series-line" data-series="' +
              series.key +
              '" d="' +
              line +
              '" fill="none" stroke="' +
              series.color +
              '" stroke-width="' +
              (series.key === "revenue" ? 2.7 : 2.2) +
              '" stroke-linejoin="round" stroke-linecap="round"/>' +
              single
            );
          })
          .join("");
      })
      .join("");
    var hits = rows
      .map(function (row, index) {
        var label =
          dateLabel(row.date) +
          ". " +
          SERIES.map(function (series) {
            return (
              series.label +
              ": " +
              (amount(row[series.key])
                ? money(row[series.key])
                : "нет подтверждённого отчёта")
            );
          }).join(". ") +
          ". Открыть записи за день.";
        var points = selected
          .map(function (series) {
            return amount(row[series.key])
              ? '<circle class="chart-point" cx="' +
                  rounded(x(index)) +
                  '" cy="' +
                  rounded(y(row[series.key])) +
                  '" r="4" style="fill:' +
                  series.color +
                  '"/>'
              : "";
          })
          .join("");
        return (
          '<g class="chart-day" tabindex="0" role="button" data-action="chart-day" data-date="' +
          row.date +
          '" aria-label="' +
          escape(label) +
          '"><title>' +
          escape(label) +
          '</title><rect class="hit" x="' +
          rounded(left + index * step) +
          '" y="' +
          top +
          '" width="' +
          rounded(step) +
          '" height="' +
          (bottom - top) +
          '"/>' +
          points +
          "</g>"
        );
      })
      .join("");
    var message = !selected.length
      ? "Выберите ряды в легенде"
      : !hasData
        ? "Нет подтверждённых данных за период"
        : "";
    return (
      '<svg class="chart-svg bi-finance-svg" viewBox="0 0 640 205" role="group" aria-label="Финансовая динамика в миллионах тенге. Выберите день для исходных записей.">' +
      grid +
      paths +
      hits +
      dateTicks(rows, x, 189) +
      (message
        ? '<text class="bi-chart-message" x="340" y="98" text-anchor="middle" fill="' +
          LABEL +
          '">' +
          message +
          "</text>"
        : "") +
      "</svg>"
    );
  }

  function productionCard(input, options) {
    options = options || {};
    var inputRows = normalizeRows(input);
    var dates = datesInRange(options.from, options.to);
    if (!dates.length && !options.from && !options.to)
      dates = inputRows.map(function (row) {
        return row.date;
      });
    var byDate = {};
    inputRows.forEach(function (row) {
      byDate[row.date] = row;
    });
    var rows = dates.map(function (date) {
      return byDate[date] || { date: date, output: null, defects: null };
    });
    var dailyPlan = amount(options.dailyPlan) ? options.dailyPlan : null;
    var confirmed = rows.filter(function (row) {
      return amount(row.output);
    });
    var total = confirmed.reduce(function (sum, row) {
      return sum + row.output;
    }, 0);
    var plan =
      dailyPlan === null || !dates.length ? null : dailyPlan * dates.length;
    var ratio = plan && confirmed.length ? (total / plan) * 100 : null;
    var left = 57,
      right = 622,
      top = 27,
      bottom = 165,
      width = right - left;
    var step = width / Math.max(rows.length, 1);
    var x = function (index) {
      return left + (index + 0.5) * step;
    };
    var maximum = scaleTop(
      Math.max.apply(
        null,
        [4, dailyPlan || 0].concat(
          confirmed.map(function (row) {
            return row.output;
          }),
        ),
      ),
    );
    var y = function (value) {
      return bottom - (value / maximum) * (bottom - top);
    };
    var bars = rows
      .map(function (row, index) {
        var present = amount(row.output);
        var label =
          dateLabel(row.date) +
          ". " +
          (present
            ? "Выпуск: " +
              number(row.output) +
              " ед. Брак: " +
              (amount(row.defects)
                ? number(row.defects) + " ед."
                : "нет данных.")
            : "Нет подтверждённого производственного отчёта.") +
          (dailyPlan !== null
            ? " Демо-план: " + number(dailyPlan) + " ед."
            : " Демо-план не задан.") +
          " Открыть записи за день.";
        var barWidth = Math.min(22, step * 0.6);
        var bar = !present
          ? ""
          : row.output === 0
            ? '<line class="production-zero" x1="' +
              rounded(x(index) - barWidth / 2) +
              '" x2="' +
              rounded(x(index) + barWidth / 2) +
              '" y1="' +
              bottom +
              '" y2="' +
              bottom +
              '" stroke="' +
              BLUE +
              '" stroke-width="2"/>'
            : '<rect class="production-bar" x="' +
              rounded(x(index) - barWidth / 2) +
              '" y="' +
              rounded(y(row.output)) +
              '" width="' +
              rounded(barWidth) +
              '" height="' +
              rounded(bottom - y(row.output)) +
              '" rx="2" fill="' +
              BLUE +
              '"/>';
        return (
          '<g class="production-day" tabindex="0" role="button" data-action="chart-day" data-date="' +
          row.date +
          '" aria-label="' +
          escape(label) +
          '"><title>' +
          escape(label) +
          '</title><rect class="hit" x="' +
          rounded(left + index * step) +
          '" y="' +
          top +
          '" width="' +
          rounded(step) +
          '" height="' +
          (bottom - top + 3) +
          '" fill="transparent"/>' +
          bar +
          "</g>"
        );
      })
      .join("");
    var planLine =
      dailyPlan === null
        ? ""
        : '<line class="bi-plan-line" x1="' +
          left +
          '" y1="' +
          rounded(y(dailyPlan)) +
          '" x2="' +
          right +
          '" y2="' +
          rounded(y(dailyPlan)) +
          '" stroke="' +
          GOLD +
          '" stroke-width="1.7" stroke-dasharray="6 4" pointer-events="none"/>';
    var chart =
      '<svg class="chart-svg bi-production-svg" viewBox="0 0 640 205" role="group" aria-label="Выпуск продукции по дням и демонстрационный план, в единицах">' +
      axisGrid(maximum, y, left, right, "ед.") +
      bars +
      planLine +
      dateTicks(rows, x, 189) +
      (!confirmed.length
        ? '<text class="bi-chart-message" x="340" y="103" text-anchor="middle" fill="' +
          LABEL +
          '">Нет подтверждённых производственных данных</text>'
        : "") +
      "</svg>";
    var note =
      rows.length > confirmed.length
        ? "Неполные данные · без подтверждения: " +
          (rows.length - confirmed.length) +
          " дн. Пропуски оставлены пустыми."
        : "Только подтверждённые отчёты. Выберите день для детализации.";
    return (
      '<section class="card bi-card bi-production"><div class="card-head"><div><h2>Выпуск по дням</h2><p>Подтверждено: ' +
      confirmed.length +
      " из " +
      rows.length +
      ' дней · единицы продукции</p></div><span class="subtle-tag">План / факт</span></div><div class="bi-metrics"><div><span>Подтверждённый выпуск</span><strong>' +
      (confirmed.length ? number(total) : "—") +
      " <small>ед.</small></strong></div><div><span>Демо-план периода</span><strong>" +
      (plan === null ? "—" : number(plan)) +
      " <small>ед.</small></strong><small>" +
      (dailyPlan === null
        ? "План не задан"
        : number(dailyPlan) + " ед. / день") +
      "</small></div><div><span>Выполнение плана</span><strong>" +
      (ratio === null ? "—" : number(ratio, 1) + "%") +
      '</strong><small>по подтверждённым данным</small></div></div><div class="bi-chart-wrap">' +
      chart +
      '</div><div class="bi-chart-footer"><span class="bi-legend-item"><i style="background:' +
      BLUE +
      '"></i>Факт</span><span class="bi-legend-item"><i class="bi-plan-swatch" style="border-color:' +
      GOLD +
      '"></i>Демо-план</span><span class="bi-note">' +
      note +
      "</span></div></section>"
    );
  }

  function paymentsCard(input, options) {
    options = options || {};
    var days = datesInRange(options.from, options.to);
    var reports = (Array.isArray(input) ? input : []).filter(function (report) {
      return (
        report &&
        report.dept === "finance" &&
        report.status === "approved" &&
        dayTime(report.date) !== null &&
        days.length &&
        report.date >= options.from &&
        report.date <= options.to
      );
    });
    var heading =
      '<div class="card-head"><div><h2>Структура выплат</h2><p>Внешние выплаты · подтверждённые финансовые отчёты</p></div><button class="btn text small" data-action="metric" data-key="payments">Исходные отчёты <span aria-hidden="true">→</span></button></div>';
    var covered = new Set(
      reports.map(function (report) {
        return report.date;
      }),
    ).size;
    var coverage =
      "Подтверждено: " +
      covered +
      " из " +
      days.length +
      " дней." +
      (covered < days.length
        ? " Неполные данные · без подтверждения: " +
          (days.length - covered) +
          " дн."
        : "");
    var valid = reports.every(function (report) {
      return (
        report.values &&
        amount(report.values.payments) &&
        amount(report.values.opex) &&
        report.values.opex <= report.values.payments
      );
    });
    if (!reports.length || !valid)
      return (
        '<section class="card bi-card bi-payments">' +
        heading +
        '<div class="bi-empty">' +
        (!reports.length
          ? "Нет подтверждённых финансовых отчётов за период"
          : "Состав выплат заполнен не полностью. Проверьте исходные отчёты.") +
        '</div><div class="bi-chart-footer"><span class="bi-note">' +
        coverage +
        " Отсутствующие отчёты не считаются нулевыми выплатами.</span></div></section>"
      );
    var total = reports.reduce(function (sum, report) {
      return sum + report.values.payments;
    }, 0);
    var opex = reports.reduce(function (sum, report) {
      return sum + report.values.opex;
    }, 0);
    var other = total - opex;
    var circumference = 2 * Math.PI * 62;
    var opexArc = total ? (circumference * opex) / total : 0;
    var otherArc = total ? (circumference * other) / total : 0;
    var label =
      "Внешние выплаты " +
      money(total) +
      ": операционные расходы " +
      money(opex) +
      ", остальные выплаты " +
      money(other) +
      ". Операционные расходы входят в общую сумму.";
    var donut =
      '<svg class="bi-donut" viewBox="0 0 180 180" role="img" aria-label="' +
      escape(label) +
      '"><title>' +
      escape(label) +
      '</title><circle cx="90" cy="90" r="62" fill="none" stroke="' +
      TRACK +
      '" stroke-width="19"/>' +
      (total
        ? '<circle cx="90" cy="90" r="62" fill="none" stroke="' +
          BLUE +
          '" stroke-width="19" stroke-dasharray="' +
          rounded(otherArc) +
          " " +
          rounded(circumference - otherArc) +
          '" transform="rotate(-90 90 90)"/><circle cx="90" cy="90" r="62" fill="none" stroke="' +
          GOLD +
          '" stroke-width="19" stroke-dasharray="' +
          rounded(opexArc) +
          " " +
          rounded(circumference - opexArc) +
          '" stroke-dashoffset="-' +
          rounded(otherArc) +
          '" transform="rotate(-90 90 90)"/>'
        : "") +
      '<text x="90" y="88" text-anchor="middle" fill="' +
      LABEL +
      '" font-size="13" font-weight="600">' +
      (total ? "Внешние" : "Без") +
      '</text><text x="90" y="107" text-anchor="middle" fill="' +
      LABEL +
      '" font-size="13">' +
      (total ? "выплаты" : "выплат") +
      "</text></svg>";
    function category(title, value, color) {
      return (
        '<div><dt><i style="background:' +
        color +
        '"></i>' +
        title +
        "</dt><dd><strong>" +
        money(value) +
        "</strong><small>" +
        (total ? number((value / total) * 100, 1) + "%" : "—") +
        " от выплат</small></dd></div>"
      );
    }
    return (
      '<section class="card bi-card bi-payments">' +
      heading +
      '<div class="bi-payment-body">' +
      donut +
      '<div><div class="bi-payments-total"><span>Всего внешних выплат</span><strong>' +
      money(total) +
      '</strong></div><dl class="bi-breakdown">' +
      category("Операционные расходы", opex, GOLD) +
      category("Остальные внешние выплаты", other, BLUE) +
      '</dl></div></div><div class="bi-chart-footer"><span class="bi-note">' +
      coverage +
      " Операционные расходы входят в выплаты. Внутренние переводы исключены.</span></div></section>"
    );
  }

  window.ARZUCharts = {
    financeSVG: financeSVG,
    productionCard: productionCard,
    paymentsCard: paymentsCard,
  };
})();
