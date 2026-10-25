(function () {
  "use strict";

  // This is a browser-local demo store. It does not provide authentication or server security.
  var KEY = "arzu.v1";
  var TODAY = "2026-10-25";
  var MAX_VALUE = 1e12;
  var FIELDS = {
    production: ["output", "defects", "raw"],
    warehouse: ["stock", "received", "issued"],
    sales: ["units", "revenue", "cost"],
    finance: ["receipts", "payments", "opex", "transfers"],
  };
  var DEPTS = Object.keys(FIELDS);
  var STATUSES = ["draft", "submitted", "returned", "approved"];
  var current = null;
  var storage = null;
  var baselineRaw = null;
  var unsafeToOverwrite = false;
  var sequence = 0;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function fail(message) {
    throw new Error(message);
  }
  function now() {
    return new Date().toISOString();
  }
  function id(prefix) {
    sequence += 1;
    return prefix + "-" + Date.now().toString(36) + "-" + sequence.toString(36);
  }
  function plain(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function validDate(date) {
    return (
      typeof date === "string" &&
      window.ARZUData.rangeDays(date, date).length === 1
    );
  }
  function text(value, max, label) {
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") fail(label + ": требуется текст.");
    var result = value.trim();
    if (result.length > max) fail(label + ": слишком длинное значение.");
    return result;
  }
  function ensureLoaded() {
    if (!current) load();
  }

  function normalizeState(parsed) {
    var source = parsed;
    if (plain(source) && !Array.isArray(source.reports)) {
      if (plain(source.state)) source = source.state;
      else if (plain(source.data)) source = source.data;
    }
    if (!plain(source) || !Array.isArray(source.reports))
      fail("Неверный формат сохранённых данных.");
    var defaults = window.ARZUData.seed();
    ["users", "events", "invoices"].forEach(function (field) {
      if (source[field] !== undefined && !Array.isArray(source[field]))
        fail("Повреждён раздел: " + field + ".");
    });
    if (source.settings !== undefined && !plain(source.settings))
      fail("Повреждены настройки.");
    var state = {
      schemaVersion: 1,
      reports: clone(source.reports),
      users: clone(source.users === undefined ? defaults.users : source.users),
      events: clone(source.events === undefined ? [] : source.events),
      settings: Object.assign({}, defaults.settings, source.settings || {}),
      invoices: clone(
        source.invoices === undefined ? defaults.invoices : source.invoices,
      ),
    };
    state.users.forEach(function (user) {
      if (
        !plain(user) ||
        !user.id ||
        typeof user.name !== "string" ||
        typeof user.email !== "string" ||
        ["director", "admin", "staff"].indexOf(user.role) === -1 ||
        (user.role === "staff" && DEPTS.indexOf(user.dept) === -1)
      )
        fail("Повреждена запись сотрудника.");
      if (!user.status) user.status = "active";
      if (["active", "invited", "disabled"].indexOf(user.status) === -1)
        fail("Повреждён статус сотрудника.");
      if (user.role !== "staff") user.dept = null;
      // Rename only the previous seeded profile; keep user edits and historical actors.
      if (user.id === "u-dir" && user.name === "Руслан Есенов")
        user.name = "Ернар Отаров";
    });
    var knownIds = {};
    state.reports.forEach(function (report) {
      if (
        !plain(report) ||
        !report.id ||
        knownIds[report.id] ||
        !validDate(report.date) ||
        DEPTS.indexOf(report.dept) === -1 ||
        !plain(report.values)
      )
        fail("Повреждена запись отчёта.");
      knownIds[report.id] = true;
      var oldStatuses = {
        accepted: "approved",
        pending: "submitted",
        rejected: "returned",
      };
      report.status = oldStatuses[report.status] || report.status;
      if (STATUSES.indexOf(report.status) === -1)
        fail("Неизвестный статус отчёта.");
      if (report.files === undefined) report.files = [];
      if (report.history === undefined) report.history = [];
      if (!Array.isArray(report.files) || !Array.isArray(report.history))
        fail("Повреждена история отчёта.");
      report.comment = typeof report.comment === "string" ? report.comment : "";
      report.noOperations = report.noOperations === true;
      report.createdAt = report.createdAt || report.date + "T18:00:00+05:00";
      if (!report.authorId) {
        var owners = state.users.filter(function (user) {
          return (
            user.role === "staff" &&
            user.dept === report.dept &&
            user.name === report.author
          );
        });
        if (owners.length === 1) report.authorId = owners[0].id;
      }
    });
    return state;
  }

  function load() {
    if (!window.ARZUData || typeof window.ARZUData.seed !== "function")
      fail("Не загружен модуль демонстрационных данных.");
    unsafeToOverwrite = false;
    storage = null;
    baselineRaw = null;
    var raw = null;
    try {
      storage = window.localStorage;
      if (storage) raw = storage.getItem(KEY);
    } catch (error) {
      storage = null;
    }
    baselineRaw = raw;
    if (raw !== null) {
      try {
        current = normalizeState(JSON.parse(raw));
        // Persist successful legacy migrations; a quota error must not invalidate readable data.
        if (storage && JSON.stringify(current) !== raw) {
          try {
            var migrated = JSON.stringify(current);
            storage.setItem(KEY, migrated);
            baselineRaw = migrated;
          } catch (migrationError) {
            /* Retry on the next explicit save. */
          }
        }
        return clone(current);
      } catch (error) {
        // Archive the exact original before allowing a seed to replace the primary key.
        try {
          if (!storage) throw new Error("storage unavailable");
          storage.setItem(
            KEY + ".corrupt." + Date.now() + "." + ++sequence,
            raw,
          );
        } catch (backupError) {
          unsafeToOverwrite = true;
        }
      }
    }
    current = normalizeState(window.ARZUData.seed());
    if (storage && !unsafeToOverwrite) {
      try {
        var seeded = JSON.stringify(current);
        storage.setItem(KEY, seeded);
        baselineRaw = seeded;
      } catch (error) {
        /* Keep the usable in-memory demo. */
      }
    }
    return clone(current);
  }

  function get() {
    ensureLoaded();
    return clone(current);
  }

  function write(next) {
    if (unsafeToOverwrite)
      fail(
        "Повреждённые данные сохранены в исходном ключе. Недостаточно места для резервной копии; изменения не записаны.",
      );
    if (!storage)
      fail(
        "Локальное хранилище недоступно. Разрешите хранение данных в браузере.",
      );
    var actual;
    try {
      actual = storage.getItem(KEY);
    } catch (readError) {
      fail(
        "Не удалось проверить актуальность данных в браузере. Изменения не записаны.",
      );
    }
    if (actual !== baselineRaw) {
      load();
      fail(
        "Данные изменились в другой вкладке. Проверьте обновлённые данные и повторите действие.",
      );
    }
    try {
      var encoded = JSON.stringify(next);
      storage.setItem(KEY, encoded);
      baselineRaw = encoded;
    } catch (error) {
      fail(
        "Не удалось сохранить изменения в браузере. Проверьте свободное место и доступ к хранилищу.",
      );
    }
    current = next;
    return clone(current);
  }

  function persist() {
    ensureLoaded();
    return write(clone(current));
  }

  function actorFor(actor, role, dept) {
    ensureLoaded();
    var actorId = typeof actor === "string" ? actor : actor && actor.id;
    var user = current.users.find(function (entry) {
      return entry.id === actorId;
    });
    if (!user || user.status !== "active")
      fail("Действие доступно только активному пользователю.");
    if (user.role !== role || (dept && user.dept !== dept))
      fail("Недостаточно прав для этого действия.");
    return user;
  }

  function log(next, actor, action, detail, type, reportId, extras) {
    var event = Object.assign(
      {
        id: id("e"),
        at: now(),
        actor: actor.name,
        actorId: actor.id,
        action: action,
        detail: detail,
        type: type || "info",
        reportId: reportId || null,
      },
      extras || {},
    );
    next.events.unshift(event);
  }

  function lastStock(date) {
    var latest = null;
    current.reports.forEach(function (report) {
      if (
        report.dept === "warehouse" &&
        report.status === "approved" &&
        report.date <= date &&
        (!latest || report.date > latest.date)
      )
        latest = report;
    });
    return latest && typeof latest.values.stock === "number"
      ? latest.values.stock
      : null;
  }

  function valuesFor(payload, required) {
    var source = payload.values === undefined ? {} : payload.values;
    if (!plain(source))
      fail("Показатели должны быть заполнены в форме отчёта.");
    var result = {};
    FIELDS[payload.dept].forEach(function (field) {
      var value = source[field];
      var missing = value === undefined || value === null || value === "";
      if (
        !missing &&
        (typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > MAX_VALUE)
      ) {
        fail("Все показатели должны быть числами от 0 до 1 000 000 000 000.");
      }
      if (
        !missing &&
        ["output", "defects", "units"].indexOf(field) !== -1 &&
        !Number.isInteger(value)
      ) {
        fail("Количество продукции, выпуск и брак должны быть целыми числами.");
      }
      if (payload.noOperations === true) {
        if (field === "stock") {
          var previousStock = lastStock(payload.date);
          if (previousStock !== null) result.stock = previousStock;
          else if (!missing) result.stock = value;
          else
            fail(
              "Для склада нужен начальный остаток или предыдущий подтверждённый отчёт.",
            );
        } else {
          if (!missing && value !== 0)
            fail(
              "При отметке «Операций не было» показатели операций должны быть нулевыми.",
            );
          result[field] = 0;
        }
      } else {
        if (required && missing)
          fail("Заполните все обязательные показатели участка.");
        result[field] = missing ? null : value;
      }
    });
    if (
      payload.dept === "production" &&
      result.output !== null &&
      result.defects !== null &&
      result.defects > result.output
    ) {
      fail("Брак не может превышать общий выпуск.");
    }
    if (
      payload.dept === "finance" &&
      result.opex !== null &&
      result.payments !== null &&
      result.opex > result.payments
    ) {
      fail(
        "Операционные расходы входят во внешние выплаты и не могут превышать их сумму.",
      );
    }
    return result;
  }

  function reportSnapshot(report) {
    return {
      values: clone(report.values),
      comment: report.comment,
      files: clone(report.files),
      noOperations: report.noOperations,
      status: report.status,
    };
  }

  function saveReport(payload, actor, submit) {
    ensureLoaded();
    if (!plain(payload) || DEPTS.indexOf(payload.dept) === -1)
      fail("Выберите корректный участок.");
    var user = actorFor(actor, "staff", payload.dept);
    if (!validDate(payload.date)) fail("Укажите корректную рабочую дату.");
    if (payload.date > TODAY)
      fail(
        "Нельзя сдавать отчёт за будущую дату. Демонстрационная дата: 25 октября 2026.",
      );
    var existing = payload.id
      ? current.reports.find(function (report) {
          return report.id === payload.id;
        })
      : null;
    if (payload.id && !existing) fail("Отчёт не найден.");
    if (
      existing &&
      (existing.date !== payload.date || existing.dept !== payload.dept)
    )
      fail("Дата и участок существующего отчёта не могут быть изменены.");
    var sameSlot = current.reports.filter(function (report) {
      return report.date === payload.date && report.dept === payload.dept;
    });
    if (!existing && sameSlot.length === 1) existing = sameSlot[0];
    if (
      sameSlot.some(function (report) {
        return report !== existing;
      })
    )
      fail("За эту дату уже существует отчёт участка.");
    if (existing && ["draft", "returned"].indexOf(existing.status) === -1)
      fail(
        "Отправленный или подтверждённый отчёт нельзя изменить. Дождитесь возврата на исправление.",
      );
    if (
      existing &&
      ((existing.authorId && existing.authorId !== user.id) ||
        (!existing.authorId && existing.author !== user.name))
    )
      fail("Можно изменять только собственные отчёты.");
    if (
      existing &&
      !existing.authorId &&
      current.users.filter(function (entry) {
        return (
          entry.role === "staff" &&
          entry.dept === existing.dept &&
          entry.name === existing.author
        );
      }).length !== 1
    ) {
      fail(
        "Не удалось однозначно определить автора старого отчёта. Проверьте записи сотрудников.",
      );
    }
    var reason = text(payload.reason, 2000, "Причина исправления");
    if (existing && existing.status === "returned" && !reason)
      fail("Укажите причину исправления возвращённого отчёта.");
    var values = valuesFor(payload, submit);
    var files =
      payload.files === undefined
        ? existing
          ? existing.files
          : []
        : payload.files;
    if (!Array.isArray(files) || files.length > 20)
      fail("Можно прикрепить не более 20 файлов.");
    try {
      files = clone(files);
    } catch (error) {
      fail("Не удалось сохранить сведения о вложениях.");
    }
    if (
      files.some(function (file) {
        return !(
          typeof file === "string" ||
          (plain(file) && typeof file.name === "string")
        );
      })
    )
      fail("Некорректные сведения о вложении.");
    var at = now();
    var report = existing
      ? clone(existing)
      : {
          id: "r-" + payload.dept + "-" + payload.date,
          date: payload.date,
          dept: payload.dept,
          author: user.name,
          authorId: user.id,
          createdAt: at,
          history: [],
        };
    var before = existing ? reportSnapshot(existing) : null;
    report.authorId = user.id;
    report.author = user.name;
    report.values = values;
    report.comment = text(payload.comment, 4000, "Комментарий");
    report.files = files;
    report.noOperations = payload.noOperations === true;
    report.status = submit ? "submitted" : "draft";
    report.updatedAt = at;
    if (reason) report.revisionReason = reason;
    var after = reportSnapshot(report);
    if (existing && JSON.stringify(before) === JSON.stringify(after) && !reason)
      return clone(existing);
    var action = submit
      ? "Отчёт отправлен на проверку"
      : existing
        ? "Черновик сохранён"
        : "Создан черновик отчёта";
    report.history.push({
      at: at,
      actor: user.name,
      actorId: user.id,
      action: action,
      reason: reason || report.revisionReason || "",
      oldValues: before ? clone(before.values) : null,
      newValues: clone(values),
      before: before,
      after: after,
    });
    var next = clone(current);
    var index = existing
      ? next.reports.findIndex(function (entry) {
          return entry.id === existing.id;
        })
      : -1;
    if (index === -1) next.reports.push(report);
    else next.reports[index] = report;
    log(
      next,
      user,
      action,
      payload.date + " · " + payload.dept,
      submit ? "submitted" : "draft",
      report.id,
    );
    write(next);
    return clone(report);
  }

  function saveDraft(payload, actor) {
    return saveReport(payload, actor, false);
  }
  function submitReport(payload, actor) {
    return saveReport(payload, actor, true);
  }

  function reviewReport(reportId, reason, actor, approveIt) {
    var user = actorFor(actor, "director");
    var report = current.reports.find(function (entry) {
      return entry.id === reportId;
    });
    if (!report) fail("Отчёт не найден.");
    if (report.status !== "submitted")
      fail("Проверить можно только отправленный отчёт.");
    reason = text(reason, 2000, "Причина возврата");
    if (!approveIt && !reason) fail("Укажите причину возврата на исправление.");
    if (approveIt) valuesFor(report, true);
    var updated = clone(report);
    updated.status = approveIt ? "approved" : "returned";
    updated.updatedAt = now();
    var action = approveIt
      ? "Отчёт подтверждён"
      : "Отчёт возвращён на исправление";
    if (approveIt) updated.approvedAt = updated.updatedAt;
    else updated.returnReason = reason;
    updated.history.push({
      at: updated.updatedAt,
      actor: user.name,
      actorId: user.id,
      action: action,
      reason: reason,
      oldStatus: report.status,
      newStatus: updated.status,
    });
    var next = clone(current);
    next.reports[
      next.reports.findIndex(function (entry) {
        return entry.id === reportId;
      })
    ] = updated;
    log(
      next,
      user,
      action,
      report.date + " · " + report.dept + (reason ? " · " + reason : ""),
      updated.status,
      report.id,
    );
    write(next);
    return clone(updated);
  }

  function approve(reportId, actor) {
    return reviewReport(reportId, "", actor, true);
  }
  function returnReport(reportId, reason, actor) {
    return reviewReport(reportId, reason, actor, false);
  }

  function upsertUser(data, actor) {
    var admin = actorFor(actor, "admin");
    if (!plain(data)) fail("Некорректные данные сотрудника.");
    var existing = data.id
      ? current.users.find(function (user) {
          return user.id === data.id;
        })
      : null;
    if (data.id && !existing)
      fail("Пользователь не найден. Для создания не указывайте id.");
    var merged = Object.assign({}, existing || {}, data);
    var name = text(merged.name, 160, "Имя");
    var email = text(merged.email, 254, "Email").toLowerCase();
    if (!name) fail("Укажите имя сотрудника.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail("Укажите корректный email.");
    if (
      current.users.some(function (user) {
        return (
          user.id !== (existing && existing.id) &&
          user.email.toLowerCase() === email
        );
      })
    )
      fail("Пользователь с таким email уже существует.");
    if (["director", "admin", "staff"].indexOf(merged.role) === -1)
      fail("Выберите корректную роль.");
    if (merged.role === "staff" && DEPTS.indexOf(merged.dept) === -1)
      fail("Для сотрудника необходимо выбрать участок.");
    var status = merged.status || "invited";
    if (["active", "invited", "disabled"].indexOf(status) === -1)
      fail("Выберите корректный статус пользователя.");
    var user = {
      id: existing ? existing.id : id("u"),
      name: name,
      email: email,
      role: merged.role,
      dept: merged.role === "staff" ? merged.dept : null,
      status: status,
    };
    var next = clone(current);
    if (existing)
      next.users[
        next.users.findIndex(function (entry) {
          return entry.id === existing.id;
        })
      ] = user;
    else next.users.push(user);
    if (
      !next.users.some(function (entry) {
        return entry.role === "admin" && entry.status === "active";
      })
    )
      fail("В системе должен остаться хотя бы один активный администратор.");
    log(
      next,
      admin,
      existing ? "Пользователь обновлён" : "Пользователь добавлен",
      user.name + " · " + user.email,
      "user",
      null,
      { before: existing ? clone(existing) : null, after: clone(user) },
    );
    write(next);
    return clone(user);
  }

  function updateSettings(data, actor) {
    var admin = actorFor(actor, "admin");
    if (!plain(data)) fail("Некорректные настройки.");
    var settings = Object.assign({}, current.settings);
    ["dailyPlan", "defectLimit", "stockMin"].forEach(function (field) {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        var value = data[field];
        if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > MAX_VALUE ||
          (field === "dailyPlan" &&
            (value === 0 || !Number.isInteger(value))) ||
          (field === "defectLimit" && value > 100)
        )
          fail("Проверьте числовые значения планов и порогов.");
        settings[field] = value;
      }
    });
    var next = clone(current);
    next.settings = settings;
    log(
      next,
      admin,
      "Настройки обновлены",
      "Изменены демонстрационные планы и пороги.",
      "settings",
      null,
      { before: clone(current.settings), after: clone(settings) },
    );
    return write(next);
  }

  window.ARZUStore = {
    KEY: KEY,
    TODAY: TODAY,
    load: load,
    get: get,
    persist: persist,
    saveDraft: saveDraft,
    submitReport: submitReport,
    approve: approve,
    returnReport: returnReport,
    upsertUser: upsertUser,
    updateSettings: updateSettings,
  };
})();
