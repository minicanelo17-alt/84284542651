"use client";

import { useCallback, useEffect, useState } from "react";
import { WEEKDAYS_SHORT } from "@/lib/schedule";
import { apiFetch, clearAuthToken, getAuthToken, installAuthFetch, isInIframe, isStorageAvailable, saveAuthToken } from "@/lib/auth-fetch";

interface Me {
  id: string;
  login: string;
  name: string;
  role: string;
}

interface Dep {
  id: string;
  direction: string;
  time: string;
  daysOfWeek: number[];
  isActive: boolean;
  note: string;
}

interface Exc {
  id: string;
  date: string;
  direction: string;
  time: string;
  status: string;
  note: string;
}

interface Ann {
  id: string;
  title: string;
  body: string;
  level: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

interface RouteInfo {
  id: string;
  number: string;
  carrier: string;
  fromCity: string;
  toCity: string;
  fromAddress: string;
  toAddress: string;
  dispatcherPhone: string;
  dispatcherPhoneHref: string;
  bookingUrl: string;
  bookingLabel: string;
  vkUrl: string;
  vkLabel: string;
  maxUrl: string;
  appealEmail: string;
  heroImageUrl: string;
  bannerImageUrl: string;
  coatKingiseppUrl: string;
  coatSpbUrl: string;
}

type Tab = "schedule" | "exceptions" | "announcements" | "settings" | "users" | "help";

export default function AdminPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [tab, setTab] = useState<Tab>("schedule");
  const [toast, setToast] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const [inIframe, setInIframe] = useState(false);
  const [storageOk, setStorageOk] = useState<boolean | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const fetchMe = useCallback(async () => {
    try {
      const r = await apiFetch("/api/auth/me", { cache: "no-store" });
      const j = await r.json();
      if (j.user) {
        setMe(j.user);
      } else {
        // Протухший токен в браузере — чистим, чтобы не мешал новому входу
        if (getAuthToken()) clearAuthToken();
        setMe(null);
      }
    } catch {
      setMe(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    installAuthFetch();
    setInIframe(isInIframe());
    setStorageOk(isStorageAvailable());
    fetchMe();
  }, [fetchMe]);

  // Если любой запрос кабинета получил 401 (сессия слетела) —
  // возвращаем человека на вход с понятным объяснением.
  useEffect(() => {
    const onUnauthorized = () => {
      clearAuthToken();
      setMe(null);
      setTab("schedule");
      setSessionNote("Сессия истекла или вход не сохранился — войдите снова. Если повторяется: нажмите Ctrl+Shift+R (жёсткое обновление страницы) и войдите заново.");
    };
    window.addEventListener("atp:unauthorized", onUnauthorized);
    return () => window.removeEventListener("atp:unauthorized", onUnauthorized);
  }, []);

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    setSessionNote("");
    try {
      const r = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setLoginError(j.error || "Ошибка входа");
        return;
      }
      if (!j.token || !j.user) {
        setLoginError("Сервер не вернул ключ сессии. Попробуйте ещё раз.");
        return;
      }
      // Сохраняем пропуск (в память + localStorage, если браузер разрешает)
      // и входим СРАЗУ по ответу login — пароль уже проверен сервером.
      // Отдельная проверка /api/auth/me больше не блокирует вход.
      const persisted = saveAuthToken(j.token);
      setMe(j.user);
      setPassword("");
      if (!persisted) {
        setSessionNote(
          "Вход выполнен! Но браузер блокирует сохранение — после обновления страницы придётся войти снова. " +
          "Для надёжной работы откройте сайт в отдельной вкладке (не во встроенном предпросмотре) и разрешите cookie для этого адреса."
        );
      } else if (isInIframe()) {
        setSessionNote(
          "Вход выполнен! Вы во встроенном предпросмотре — если после обновления выкинет на вход, откройте адрес сайта в отдельной вкладке."
        );
      }
    } catch {
      setLoginError("Ошибка соединения");
    } finally {
      setLoggingIn(false);
    }
  };

  const doLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    clearAuthToken();
    setMe(null);
    setSessionNote("");
    setTab("schedule");
  };

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center text-white">
        <div className="text-sm font-bold">Проверяем доступ…</div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center px-4 py-10">
        <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="bg-[#16295e] px-6 py-6 text-center text-white">
            <div className="text-3xl">🔐</div>
            <h1 className="mt-2 text-xl font-black">Вход для сотрудников</h1>
            <p className="mt-1 text-sm text-sky-200">АТП Ивангород • маршрут 842</p>
            <p className="mx-6 mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-sky-100">
              Пассажирам вход не нужен — расписание открыто для всех по основной ссылке
            </p>
          </div>
          <form onSubmit={doLogin} className="space-y-3 p-6">
            <label className="block">
              <span className="text-xs font-black tracking-wider text-slate-500 uppercase">Логин</span>
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#16295e]"
                placeholder="например, dispatcher"
                autoComplete="username"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black tracking-wider text-slate-500 uppercase">Пароль</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#16295e]"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>
            {inIframe && (
              <div className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900">
                ℹ️ Вы открыли кабинет во встроенном предпросмотре. Вход сработает, но если после обновления страницы выкинет обратно — откройте ссылку в новой вкладке браузера.
              </div>
            )}
            {storageOk === false && (
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                ⚠️ Браузер блокирует сохранение данных (режим инкогнито или запрет cookie). Войти получится, но после обновления страницы вход слетит.
              </div>
            )}
            {sessionNote && <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">⚠️ {sessionNote}</div>}
            {loginError && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{loginError}</div>}
            <button
              disabled={loggingIn}
              className="w-full rounded-xl bg-[#16295e] py-3 text-sm font-black text-white hover:brightness-125 disabled:opacity-60"
            >
              {loggingIn ? "Входим…" : "Войти"}
            </button>
            <a href="/" className="block text-center text-xs font-bold text-slate-500 underline">
              ← Вернуться к расписанию для пассажиров
            </a>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-40 bg-[#16295e] text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white/15 px-3 py-1.5 text-lg font-black">842</span>
            <div>
              <div className="text-sm font-black">Панель управления расписанием</div>
              <div className="text-xs text-sky-200">
                {me.name} • {me.role === "admin" ? "администратор" : "редактор"}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <a href="/" target="_blank" className="rounded-xl bg-white/15 px-3 py-2 text-xs font-black hover:bg-white/25">
              👁 Открыть сайт
            </a>
            <button onClick={doLogout} className="rounded-xl bg-red-500/90 px-3 py-2 text-xs font-black hover:bg-red-500">
              Выйти
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-3">
          {(
            [
              ["schedule", "🚌 Расписание"],
              ["exceptions", "📅 Отмены и доп. рейсы"],
              ["announcements", "📢 Объявления"],
              ["settings", "⚙️ Аншлаг и контакты"],
              ["users", "👥 Пользователи"],
              ["help", "❓ Как пользоваться"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-xl px-3 py-2 text-xs font-black whitespace-nowrap ${
                tab === key ? "bg-white text-[#16295e]" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {sessionNote && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div className="rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800 shadow">⚠️ {sessionNote}</div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-6">
        {tab === "schedule" && <ScheduleTab onToast={showToast} />}
        {tab === "exceptions" && <ExceptionsTab onToast={showToast} />}
        {tab === "announcements" && <AnnouncementsTab onToast={showToast} />}
        {tab === "settings" && <SettingsTab onToast={showToast} />}
        {tab === "users" && <UsersTab me={me} onToast={showToast} />}
        {tab === "help" && <HelpTab />}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#16295e] px-5 py-2.5 text-sm font-black text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------------- Расписание ---------------- */
function ScheduleTab({ onToast }: { onToast: (m: string) => void }) {
  const [deps, setDeps] = useState<Dep[]>([]);
  const [loading, setLoading] = useState(true);
  const [dir, setDir] = useState("from_kingisepp");
  const [time, setTime] = useState("");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<Dep | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch("/api/admin/departures", { cache: "no-store" });
    const j = await r.json();
    setDeps(j.departures || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!time) return onToast("Укажите время");
    if (days.length === 0) return onToast("Выберите хотя бы один день");
    const method = editing ? "PUT" : "POST";
    const r = await apiFetch("/api/admin/departures", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing?.id, direction: editing?.direction || dir, time, daysOfWeek: days, note }),
    });
    const j = await r.json();
    if (!r.ok) return onToast(j.error || "Ошибка");
    onToast(editing ? "Рейс обновлён ✓" : "Рейс добавлен ✓");
    setTime("");
    setNote("");
    setEditing(null);
    setDays([0, 1, 2, 3, 4, 5, 6]);
    load();
  };

  const startEdit = (d: Dep) => {
    setEditing(d);
    setTime(d.time);
    setDays(d.daysOfWeek);
    setNote(d.note || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleActive = async (d: Dep) => {
    await apiFetch("/api/admin/departures", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id, isActive: !d.isActive }),
    });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить рейс из постоянного расписания?")) return;
    await apiFetch(`/api/admin/departures?id=${id}`, { method: "DELETE" });
    onToast("Рейс удалён");
    load();
  };

  const groups: { key: string; title: string }[] = [
    { key: "from_kingisepp", title: "Из Кингисеппа" },
    { key: "from_spb", title: "Из Санкт-Петербурга" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow sm:p-5">
        <h2 className="text-base font-black text-[#16295e]">{editing ? `✏️ Редактируем рейс ${editing.time}` : "➕ Новый рейс в постоянном расписании"}</h2>
        <p className="mt-1 text-xs text-slate-500">
          Это основное расписание, которое видят пассажиры каждый день. Разовые отмены делаются во вкладке «Отмены и доп. рейсы».
        </p>
        <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {!editing && (
            <label className="block">
              <span className="text-xs font-black text-slate-500 uppercase">Направление</span>
              <select value={dir} onChange={(e) => setDir(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold">
                <option value="from_kingisepp">Из Кингисеппа</option>
                <option value="from_spb">Из Санкт-Петербурга</option>
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-xs font-black text-slate-500 uppercase">Время отправления</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-black text-slate-500 uppercase">Дни недели</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black ${days.includes(d) ? "bg-[#16295e] text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {WEEKDAYS_SHORT[d]}
                </button>
              ))}
              <button type="button" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                Ежедневно
              </button>
              <button type="button" onClick={() => setDays([1, 2, 3, 4, 5])} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                Будни
              </button>
              <button type="button" onClick={() => setDays([0, 6])} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                Выходные
              </button>
            </div>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-black text-slate-500 uppercase">Пометка (необязательно, видно пассажирам)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="например: только по пятницам, через Ополье…" className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm" />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button className="rounded-xl bg-[#16295e] px-5 py-2.5 text-sm font-black text-white">{editing ? "Сохранить" : "Добавить рейс"}</button>
            {editing && (
              <button type="button" onClick={() => { setEditing(null); setTime(""); setNote(""); setDays([0, 1, 2, 3, 4, 5, 6]); }} className="rounded-xl bg-slate-200 px-5 py-2.5 text-sm font-black text-slate-600">
                Отмена
              </button>
            )}
          </div>
        </form>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center text-sm font-bold text-slate-500">Загружаем…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.key} className="rounded-2xl bg-white p-4 shadow">
              <h3 className="text-sm font-black text-[#16295e]">🚌 {g.title} <span className="text-slate-400">({deps.filter((d) => d.direction === g.key).length})</span></h3>
              <div className="mt-2 space-y-1.5">
                {deps
                  .filter((d) => d.direction === g.key)
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((d) => (
                    <div key={d.id} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${d.isActive ? "bg-slate-50" : "bg-red-50 opacity-70"}`}>
                      <div>
                        <span className="text-lg font-black text-[#16295e] tabular-nums">{d.time}</span>
                        <span className="ml-2 text-[10px] font-bold text-slate-500">
                          {d.daysOfWeek.length === 7 ? "ежедневно" : d.daysOfWeek.sort().map((x) => WEEKDAYS_SHORT[x]).join(" ")}
                        </span>
                        {d.note && <div className="text-[11px] text-amber-700">{d.note}</div>}
                        {!d.isActive && <div className="text-[11px] font-black text-red-500">скрыт от пассажиров</div>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => startEdit(d)} className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-black" title="Редактировать">✏️</button>
                        <button onClick={() => toggleActive(d)} className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-black" title={d.isActive ? "Скрыть" : "Показать"}>
                          {d.isActive ? "👁" : "🚫"}
                        </button>
                        <button onClick={() => remove(d.id)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-black" title="Удалить">🗑</button>
                      </div>
                    </div>
                  ))}
                {deps.filter((d) => d.direction === g.key).length === 0 && (
                  <div className="rounded-xl bg-slate-50 p-4 text-center text-xs font-bold text-slate-400">Рейсов пока нет</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Исключения ---------------- */
function ExceptionsTab({ onToast }: { onToast: (m: string) => void }) {
  const [list, setList] = useState<Exc[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [direction, setDirection] = useState("from_kingisepp");
  const [time, setTime] = useState("");
  const [status, setStatus] = useState("cancelled");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const r = await apiFetch("/api/admin/exceptions", { cache: "no-store" });
    const j = await r.json();
    setList(j.exceptions || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!time) return onToast("Укажите время");
    const r = await apiFetch("/api/admin/exceptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, direction, time, status, note }),
    });
    const j = await r.json();
    if (!r.ok) return onToast(j.error || "Ошибка");
    onToast("Сохранено ✓ Пассажиры сразу увидят изменение");
    setTime("");
    setNote("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить изменение? Расписание вернётся к обычному.")) return;
    await apiFetch(`/api/admin/exceptions?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow sm:p-5">
        <h2 className="text-base font-black text-[#16295e]">📅 Разовое изменение на конкретную дату</h2>
        <p className="mt-1 text-xs text-slate-500">
          Отмена рейса из-за погоды, дополнительный автобус в праздник или пометка «задержка 15 минут» — всё это здесь. Основное расписание не меняется.
        </p>
        <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black text-slate-500 uppercase">Дата</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold" />
          </label>
          <label className="block">
            <span className="text-xs font-black text-slate-500 uppercase">Направление</span>
            <select value={direction} onChange={(e) => setDirection(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold">
              <option value="from_kingisepp">Из Кингисеппа</option>
              <option value="from_spb">Из Санкт-Петербурга</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-black text-slate-500 uppercase">Время</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold" />
          </label>
          <label className="block">
            <span className="text-xs font-black text-slate-500 uppercase">Что случилось</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold">
              <option value="cancelled">⛔ Рейс отменён</option>
              <option value="added">✚ Дополнительный рейс</option>
              <option value="note">📝 Пометка к рейсу</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-black text-slate-500 uppercase">Комментарий для пассажиров</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="например: отмена из-за ремонта дороги, приносим извинения" className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2">
            <button className="rounded-xl bg-[#16295e] px-5 py-2.5 text-sm font-black text-white">Сохранить изменение</button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow">
        <h3 className="text-sm font-black text-[#16295e]">Ближайшие изменения ({list.length})</h3>
        <div className="mt-2 space-y-1.5">
          {list.map((x) => (
            <div key={x.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <div className="text-sm">
                <span className="font-black text-[#16295e]">{x.date}</span>
                <span className="mx-2 font-black tabular-nums">{x.time}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${x.status === "cancelled" ? "bg-red-100 text-red-700" : x.status === "added" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {x.status === "cancelled" ? "отмена" : x.status === "added" ? "доп. рейс" : "пометка"}
                </span>
                <div className="text-xs text-slate-500">
                  {x.direction === "from_kingisepp" ? "Из Кингисеппа" : "Из СПб"}{x.note ? ` • ${x.note}` : ""}
                </div>
              </div>
              <button onClick={() => remove(x.id)} className="shrink-0 rounded-lg bg-red-100 px-2 py-1 text-xs font-black">🗑</button>
            </div>
          ))}
          {list.length === 0 && <div className="rounded-xl bg-slate-50 p-4 text-center text-xs font-bold text-slate-400">Изменений нет — действует обычное расписание</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Объявления ---------------- */
function AnnouncementsTab({ onToast }: { onToast: (m: string) => void }) {
  const [list, setList] = useState<Ann[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState("info");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [editing, setEditing] = useState<Ann | null>(null);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/admin/announcements", { cache: "no-store" });
    const j = await r.json();
    setList(j.announcements || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return onToast("Введите заголовок");
    const method = editing ? "PUT" : "POST";
    const r = await apiFetch("/api/admin/announcements", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing?.id, title, body, level, startsAt: startsAt || null, endsAt: endsAt || null }),
    });
    if (!r.ok) return onToast("Ошибка");
    onToast("Объявление опубликовано ✓");
    setTitle(""); setBody(""); setLevel("info"); setStartsAt(""); setEndsAt(""); setEditing(null);
    load();
  };

  const startEdit = (a: Ann) => {
    setEditing(a);
    setTitle(a.title);
    setBody(a.body || "");
    setLevel(a.level);
    setStartsAt(a.startsAt || "");
    setEndsAt(a.endsAt || "");
  };

  const toggle = async (a: Ann) => {
    await apiFetch("/api/admin/announcements", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, isActive: !a.isActive }),
    });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить объявление?")) return;
    await apiFetch(`/api/admin/announcements?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow sm:p-5">
        <h2 className="text-base font-black text-[#16295e]">{editing ? "✏️ Редактируем объявление" : "📢 Новое объявление для пассажиров"}</h2>
        <form onSubmit={submit} className="mt-3 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок: Изменение расписания в праздники" className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Текст объявления…" className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-black text-slate-500 uppercase">Важность</span>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold">
                <option value="info">ℹ️ Обычное</option>
                <option value="warning">⚠️ Внимание</option>
                <option value="important">🚨 Важно</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500 uppercase">Показывать с</span>
              <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500 uppercase">Показывать до</span>
              <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="flex gap-2">
            <button className="rounded-xl bg-[#16295e] px-5 py-2.5 text-sm font-black text-white">{editing ? "Сохранить" : "Опубликовать"}</button>
            {editing && (
              <button type="button" onClick={() => { setEditing(null); setTitle(""); setBody(""); }} className="rounded-xl bg-slate-200 px-5 py-2.5 text-sm font-black text-slate-600">Отмена</button>
            )}
          </div>
        </form>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow">
        <h3 className="text-sm font-black text-[#16295e]">Все объявления ({list.length})</h3>
        <div className="mt-2 space-y-2">
          {list.map((a) => (
            <div key={a.id} className={`rounded-xl border-l-8 p-3 ${a.level === "important" ? "border-red-500 bg-red-50" : a.level === "warning" ? "border-amber-500 bg-amber-50" : "border-sky-500 bg-sky-50"} ${!a.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-black">{a.title} {!a.isActive && <span className="text-red-600">(скрыто)</span>}</div>
                  {a.body && <div className="mt-0.5 text-xs whitespace-pre-line text-slate-600">{a.body}</div>}
                  <div className="mt-1 text-[11px] text-slate-400">
                    {a.startsAt ? `с ${a.startsAt} ` : ""}{a.endsAt ? `до ${a.endsAt}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => startEdit(a)} className="rounded-lg bg-white px-2 py-1 text-xs font-black shadow">✏️</button>
                  <button onClick={() => toggle(a)} className="rounded-lg bg-white px-2 py-1 text-xs font-black shadow">{a.isActive ? "👁" : "🚫"}</button>
                  <button onClick={() => remove(a.id)} className="rounded-lg bg-white px-2 py-1 text-xs font-black shadow">🗑</button>
                </div>
              </div>
            </div>
          ))}
          {list.length === 0 && <div className="rounded-xl bg-slate-50 p-4 text-center text-xs font-bold text-slate-400">Объявлений пока нет</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Настройки ---------------- */
type ImageSlot = "banner" | "hero" | "coatK" | "coatS";

function SettingsTab({ onToast }: { onToast: (m: string) => void }) {
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<ImageSlot | null>(null);

  // Загрузка картинки с устройства — сразу применяется на сайте
  const uploadImage = async (file: File, slot: ImageSlot) => {
    if (!file.type.startsWith("image/")) return onToast("Выберите файл-картинку (PNG, JPG)");
    if (file.size > 3 * 1024 * 1024) return onToast("Файл больше 3 МБ — выберите картинку поменьше");
    if (!route) return;
    setUploading(slot);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("apply", slot);
      const r = await apiFetch("/api/admin/upload", { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok) return onToast(j.error || "Не загрузилось");
      if (j.field) setRoute({ ...route, [j.field]: j.url });
      onToast("Картинка загружена ✓ Пассажиры уже видят её");
    } catch {
      onToast("Ошибка загрузки");
    } finally {
      setUploading(null);
    }
  };

  // Убрать свою картинку (вернуть стандартную) — применяется сразу
  const clearImage = async (key: "bannerImageUrl" | "heroImageUrl" | "coatKingiseppUrl" | "coatSpbUrl") => {
    if (!route) return;
    setRoute({ ...route, [key]: "" });
    try {
      await apiFetch("/api/admin/route-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: "" }),
      });
      onToast("Вернули стандартную картинку ✓");
    } catch {
      onToast("Ошибка");
    }
  };

  const UploadButton = ({ slot, label }: { slot: ImageSlot; label: string }) => (
    <label
      className={`inline-block cursor-pointer rounded-xl px-4 py-2 text-xs font-black text-white ${
        uploading ? "bg-slate-400" : "bg-[#16295e] hover:brightness-125"
      }`}
    >
      {uploading === slot ? "⏳ Загружаем…" : label}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        disabled={uploading !== null}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void uploadImage(f, slot);
        }}
      />
    </label>
  );

  const load = useCallback(async () => {
    const r = await apiFetch("/api/admin/route-info", { cache: "no-store" });
    const j = await r.json();
    if (j.route) setRoute(j.route);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!route) return;
    setSaving(true);
    const r = await apiFetch("/api/admin/route-info", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(route),
    });
    setSaving(false);
    if (!r.ok) return onToast("Ошибка сохранения");
    onToast("Аншлаг обновлён ✓");
  };

  if (!route) return <div className="rounded-2xl bg-white p-8 text-center text-sm font-bold text-slate-500">Загружаем…</div>;

  const field = (key: keyof RouteInfo, label: string, hint?: string) => (
    <label className="block" key={key}>
      <span className="text-xs font-black text-slate-500 uppercase">{label}</span>
      <input
        value={String(route[key] || "")}
        onChange={(e) => setRoute({ ...route, [key]: e.target.value })}
        className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-semibold"
        placeholder={hint}
      />
    </label>
  );

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow sm:p-5">
        <h2 className="text-base font-black text-[#16295e]">⚙️ Текст аншлага и контакты</h2>
        <p className="mt-1 text-xs text-slate-500">Всё, что видят пассажиры: название, адреса остановок, телефон, ссылки и QR-коды (QR перегенерируются автоматически).</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("carrier", "Перевозчик")}
          {field("number", "Номер маршрута")}
          {field("fromCity", "Город отправления (слева)")}
          {field("toCity", "Город прибытия (справа)")}
          {field("fromAddress", "Адрес остановки в Кингисеппе")}
          {field("toAddress", "Адрес остановки в СПб")}
          {field("dispatcherPhone", "Телефон диспетчера (красиво)")}
          {field("dispatcherPhoneHref", "Телефон для звонка (+7…)")}
          {field("bookingUrl", "Ссылка на покупку билетов")}
          {field("bookingLabel", "Подпись под QR билетов")}
          {field("vkUrl", "Ссылка VK")}
          {field("vkLabel", "Подпись VK")}
          {field("maxUrl", "Ссылка MAX")}
          {field("appealEmail", "Email для жалоб")}
        </div>
        <div className="mt-4 rounded-2xl bg-sky-50 p-3">
          <div className="text-sm font-black text-[#16295e]">🖼 Картинки аншлага — загрузка с устройства</div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Нажмите «Выбрать файл» — картинка сразу загрузится и появится у пассажиров, сохранять ничего не надо.
            Подходят PNG и JPG до 3 МБ. Никаких ссылок не нужно!
          </p>

          <div className="mt-2 rounded-xl bg-white p-3">
            <div className="text-xs font-black text-[#16295e] uppercase">Баннер в шапке (ваш логотип)</div>
            {route.bannerImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={route.bannerImageUrl} alt="Ваш баннер" className="mt-2 h-16 rounded-xl object-contain" />
            ) : (
              <div className="mt-2 text-[11px] text-slate-500">Сейчас: стандартная шапка</div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <UploadButton slot="banner" label="📤 Выбрать файл с устройства" />
              {route.bannerImageUrl && (
                <button
                  type="button"
                  onClick={() => void clearImage("bannerImageUrl")}
                  className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-300"
                >
                  ✕ Вернуть стандартную
                </button>
              )}
            </div>
            <div className="mt-2">{field("bannerImageUrl", "…или вставьте ссылку на картинку (потом нажмите Сохранить)")}</div>
          </div>

          <div className="mt-2 rounded-xl bg-white p-3">
            <div className="text-xs font-black text-[#16295e] uppercase">Фото автобуса</div>
            {route.heroImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={route.heroImageUrl} alt="Фото автобуса" className="mt-2 h-20 w-full rounded-xl object-cover" />
            ) : (
              <div className="mt-2 text-[11px] text-slate-500">Фото не задано</div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <UploadButton slot="hero" label="📤 Выбрать файл с устройства" />
            </div>
            <div className="mt-2">{field("heroImageUrl", "…или вставьте ссылку на фото (потом нажмите Сохранить)")}</div>
          </div>

          <div className="mt-2 rounded-xl bg-white p-3">
            <div className="text-xs font-black text-[#16295e] uppercase">Гербы в таблице (если хотите свои)</div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-2 text-center">
                <div className="text-[11px] font-bold text-slate-500">Кингисепп</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={route.coatKingiseppUrl || "/images/coat-kingisepp.png"} alt="Герб Кингисеппа" className="mx-auto mt-1 h-12 w-12 object-contain" />
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  <UploadButton slot="coatK" label="📤 Свой герб" />
                  {route.coatKingiseppUrl && (
                    <button
                      type="button"
                      onClick={() => void clearImage("coatKingiseppUrl")}
                      className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-300"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 text-center">
                <div className="text-[11px] font-bold text-slate-500">Санкт-Петербург</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={route.coatSpbUrl || "/images/coat-spb.png"} alt="Герб Санкт-Петербурга" className="mx-auto mt-1 h-12 w-12 object-contain" />
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  <UploadButton slot="coatS" label="📤 Свой герб" />
                  {route.coatSpbUrl && (
                    <button
                      type="button"
                      onClick={() => void clearImage("coatSpbUrl")}
                      className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-300"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <button disabled={saving} className="mt-4 rounded-xl bg-[#16295e] px-6 py-2.5 text-sm font-black text-white disabled:opacity-60">
          {saving ? "Сохраняем…" : "Сохранить изменения"}
        </button>
      </div>
    </form>
  );
}

/* ---------------- Пользователи ---------------- */
function UsersTab({ me, onToast }: { me: Me; onToast: (m: string) => void }) {
  const [list, setList] = useState<{ id: string; login: string; name: string; role: string; isActive: boolean }[]>([]);
  const [login, setLogin] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("editor");
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/admin/users", { cache: "no-store" });
    if (r.status === 403) {
      setDenied(true);
      return;
    }
    const j = await r.json();
    setList(j.users || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (denied || me.role !== "admin") {
    return (
      <div className="rounded-2xl bg-white p-8 text-center">
        <div className="text-3xl">🔒</div>
        <div className="mt-2 text-sm font-black text-[#16295e]">Раздел только для администратора</div>
        <p className="mt-1 text-xs text-slate-500">Редакторы могут менять расписание, отмены, объявления и контакты, но не могут создавать пользователей. Обратитесь к администратору.</p>
      </div>
    );
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await apiFetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, name, password, role }),
    });
    const j = await r.json();
    if (!r.ok) return onToast(j.error || "Ошибка");
    onToast("Пользователь создан ✓");
    setLogin(""); setName(""); setPassword(""); setRole("editor");
    load();
  };

  const toggle = async (u: { id: string; isActive: boolean }) => {
    await apiFetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, isActive: !u.isActive }),
    });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить пользователя? Он потеряет доступ.")) return;
    const r = await apiFetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) return onToast(j.error || "Ошибка");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow sm:p-5">
        <h2 className="text-base font-black text-[#16295e]">👥 Новый сотрудник</h2>
        <p className="mt-1 text-xs text-slate-500">Дайте диспетчерам роль «Редактор» — они смогут править расписание, но не пользователей.</p>
        <form onSubmit={create} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black text-slate-500 uppercase">Логин</span>
            <input value={login} onChange={(e) => setLogin(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold" placeholder="dispatcher2" />
          </label>
          <label className="block">
            <span className="text-xs font-black text-slate-500 uppercase">Имя</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Иванова Мария" />
          </label>
          <label className="block">
            <span className="text-xs font-black text-slate-500 uppercase">Пароль (мин. 6 символов)</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold" placeholder="••••••••" />
          </label>
          <label className="block">
            <span className="text-xs font-black text-slate-500 uppercase">Роль</span>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold">
              <option value="editor">Редактор (расписание)</option>
              <option value="admin">Администратор (всё + пользователи)</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <button className="rounded-xl bg-[#16295e] px-5 py-2.5 text-sm font-black text-white">Создать доступ</button>
          </div>
        </form>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow">
        <h3 className="text-sm font-black text-[#16295e]">Все пользователи ({list.length})</h3>
        <div className="mt-2 space-y-1.5">
          {list.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <div className="text-sm">
                <span className="font-black">{u.name}</span>
                <span className="ml-2 text-xs text-slate-500">@{u.login}</span>
                <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"}`}>
                  {u.role === "admin" ? "админ" : "редактор"}
                </span>
                {!u.isActive && <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700 uppercase">заблокирован</span>}
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => toggle(u)} className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-black">{u.isActive ? "🚫" : "✅"}</button>
                <button onClick={() => remove(u.id)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-black">🗑</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Помощь ---------------- */
function HelpTab() {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const copyLink = async () => {
    if (!origin) return;
    try {
      await navigator.clipboard.writeText(`${origin}/`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Скопируйте ссылку:", `${origin}/`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow">
        <h2 className="text-base font-black text-[#16295e]">❓ Как это работает — короткая инструкция</h2>
        <div className="mt-3 space-y-3 text-sm text-slate-700">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="font-black text-[#16295e]">1. Что видят пассажиры</div>
            <p className="mt-1">Главная страница — это ваш аншлаг, но живой: московское время, подсветка ближайшего рейса, обратный отсчёт, пометки об отменах и доп. рейсах. Всё обновляется само каждые 30 секунд. Пассажирам ничего устанавливать не нужно — достаточно ссылки или QR-кода.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="font-black text-[#16295e]">2. Постоянное расписание</div>
            <p className="mt-1">Вкладка «Расписание» — это база: рейсы каждый день / по будням / по выходным. Меняете один раз — применяется всегда. Можно скрыть рейс глазом 👁, не удаляя.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="font-black text-[#16295e]">3. Отмена или доп. рейс на конкретный день</div>
            <p className="mt-1">Вкладка «Отмены и доп. рейсы»: выбираете дату, время и что случилось. Пассажиры мгновенно увидят красный бейдж «отмена» или зелёный «доп». Идеально для праздников, погоды и поломок.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="font-black text-[#16295e]">4. Объявления</div>
            <p className="mt-1">Новости сверху расписания. Можно задать период показа — например, только на новогодние праздники объявление исчезнет само.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="font-black text-[#16295e]">5. Чем это лучше GitHub Pages</div>
            <p className="mt-1">Статичный HTML на GitHub приходится править в коде и перезаливать. Здесь диспетчер меняет время в два клика с телефона, а данные хранятся в базе PostgreSQL — пассажиры всегда видят актуальную версию.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="font-black text-[#16295e]">6. Как дать доступ сотрудникам</div>
            <p className="mt-1">Вкладка «Пользователи» (только для админа): создайте каждому диспетчеру свой логин и пароль с ролью «Редактор». Пароли хранятся в зашифрованном виде. Уволился сотрудник — заблокируйте его одной кнопкой.</p>
          </div>
          <div className="rounded-xl bg-sky-50 p-3">
            <div className="font-black text-[#16295e]">7. Ссылка для пассажиров — скопируйте и разошлите</div>
            {origin ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-white px-3 py-2 font-mono text-sm font-bold break-all text-[#16295e]">
                  {origin}/
                </code>
                <button
                  onClick={copyLink}
                  className="rounded-xl bg-[#16295e] px-4 py-2 text-xs font-black text-white hover:brightness-125"
                >
                  {copied ? "✓ Скопировано!" : "⧉ Скопировать ссылку"}
                </button>
                <a
                  href="/poster"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-green-600 px-4 py-2 text-xs font-black text-white hover:bg-green-500"
                >
                  🖨 Плакат с QR для остановок
                </a>
              </div>
            ) : (
              <p className="mt-1 text-xs">Загружаем адрес…</p>
            )}
            <p className="mt-2 text-xs">
              Разместите эту ссылку в VK, MAX и на busfor.ru вместо старой ссылки на GitHub.
              А плакат с QR распечатайте и повесьте на остановках — пассажиры сканируют код
              и всегда видят актуальное время, даже если рейс отменили 5 минут назад.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="font-black text-[#16295e]">8. Свои картинки: логотип, фото автобуса, гербы</div>
            <p className="mt-1">Вкладка «Аншлаг и контакты» → блок «Картинки аншлага» → кнопка «Выбрать файл с устройства». Картинка загружается прямо с вашего телефона или компьютера, ссылки не нужны, и сразу появляется у пассажиров. Подходят PNG и JPG до 3 МБ.</p>
          </div>
          <div className="rounded-xl bg-green-50 p-3">
            <div className="font-black text-green-800">💡 Совет: QR на остановках</div>
            <p className="mt-1">Распечатайте ссылку на этот сайт в виде QR и повесьте на остановках вместо бумажного расписания — пассажиры сканируют и всегда видят актуальное время, даже если рейс отменили 5 минут назад.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
