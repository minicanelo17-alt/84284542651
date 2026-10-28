"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import {
  DIRECTION_LABEL,
  WEEKDAYS_FULL,
  formatCountdown,
  moscowNow,
  resolveDaySchedule,
  type DepartureDto,
  type ExceptionDto,
  type ResolvedDeparture,
} from "@/lib/schedule";

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

interface AnnouncementDto {
  id: string;
  title: string;
  body: string;
  level: string;
  startsAt: string | null;
  endsAt: string | null;
}

interface ScheduleResponse {
  route: RouteInfo;
  departures: DepartureDto[];
  exceptions: ExceptionDto[];
  announcements: AnnouncementDto[];
  date: string;
  weekday: number;
}

function todayMoscowStr(): string {
  return moscowNow().dateStr;
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function prettyDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const wd = WEEKDAYS_FULL[d.getUTCDay()];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = d.toLocaleDateString("ru-RU", { month: "long", timeZone: "UTC" });
  return `${wd}, ${day} ${month}`;
}

export default function ScheduleApp() {
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState(todayMoscowStr());
  const [clock, setClock] = useState(() => moscowNow());
  const [onlyUpcoming, setOnlyUpcoming] = useState(false);
  const [mobileDir, setMobileDir] = useState<"from_kingisepp" | "from_spb">("from_kingisepp");
  const [selected, setSelected] = useState<ResolvedDeparture | null>(null);
  const [copied, setCopied] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");

  const isToday = date === todayMoscowStr();

  const load = useCallback(async (d: string, silent = false) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await fetch(`/api/schedule?date=${d}`, { cache: "no-store" });
      if (!res.ok) throw new Error("network");
      const json = (await res.json()) as ScheduleResponse;
      setData(json);
      setUpdatedAt(moscowNow().timeStr);
    } catch {
      if (!silent) setError("Не удалось загрузить расписание. Проверьте соединение и обновите страницу.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  useEffect(() => {
    const t = setInterval(() => setClock(moscowNow()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isToday) return;
    const t = setInterval(() => load(date, true), 30000);
    return () => clearInterval(t);
  }, [isToday, date, load]);

  const schedule = useMemo(() => {
    if (!data) return [];
    return resolveDaySchedule(data.departures, data.exceptions, data.weekday);
  }, [data]);

  const byDir = useMemo(
    () => ({
      from_kingisepp: schedule.filter((s) => s.direction === "from_kingisepp"),
      from_spb: schedule.filter((s) => s.direction === "from_spb"),
    }),
    [schedule]
  );

  const filtered = useMemo(() => {
    if (!onlyUpcoming || !isToday) return byDir;
    return {
      from_kingisepp: byDir.from_kingisepp.filter((s) => s.minutes >= clock.minutes - 2),
      from_spb: byDir.from_spb.filter((s) => s.minutes >= clock.minutes - 2),
    };
  }, [byDir, onlyUpcoming, isToday, clock.minutes]);

  const nextByDir = useMemo(() => {
    if (!isToday) {
      return {
        from_kingisepp: byDir.from_kingisepp.filter((s) => s.status !== "cancelled").slice(0, 2),
        from_spb: byDir.from_spb.filter((s) => s.status !== "cancelled").slice(0, 2),
      };
    }
    return {
      from_kingisepp: byDir.from_kingisepp.filter((s) => s.status !== "cancelled" && s.minutes > clock.minutes).slice(0, 2),
      from_spb: byDir.from_spb.filter((s) => s.status !== "cancelled" && s.minutes > clock.minutes).slice(0, 2),
    };
  }, [byDir, clock.minutes, isToday]);

  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Скопируйте ссылку:", url);
    }
  };

  const route = data?.route;

  return (
    <div className="min-h-screen px-2 py-4 sm:px-4 sm:py-8">
      <div className="card-sky mx-auto w-full max-w-3xl overflow-hidden rounded-[28px] shadow-[0_30px_80px_rgba(0,0,0,0.5)] ring-1 ring-white/60">
        {/* Шапка */}
        <div className="flex items-center gap-2 px-4 pt-5 sm:gap-3 sm:px-8">
          {route?.bannerImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={route.bannerImageUrl}
              alt={route.carrier || "АТП Ивангород"}
              className="h-[56px] min-w-0 flex-1 rounded-2xl object-contain sm:h-[84px]"
            />
          ) : (
          <div className="navy-panel flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-3 sm:gap-3 sm:px-4 sm:py-5">
            <svg viewBox="0 0 64 40" className="h-7 w-10 shrink-0 text-white sm:h-9 sm:w-14" fill="currentColor" aria-hidden>
              <rect x="2" y="8" width="52" height="22" rx="6" />
              <rect x="6" y="12" width="12" height="8" rx="1.5" fill="#16295e" />
              <rect x="20" y="12" width="12" height="8" rx="1.5" fill="#16295e" />
              <rect x="34" y="12" width="16" height="8" rx="1.5" fill="#9fc3e8" />
              <circle cx="16" cy="32" r="5" />
              <circle cx="16" cy="32" r="2" fill="#9fc3e8" />
              <circle cx="46" cy="32" r="5" />
              <circle cx="46" cy="32" r="2" fill="#9fc3e8" />
              <rect x="54" y="14" width="6" height="10" rx="2" />
            </svg>
            <div className="min-w-0 text-center">
              <div className="font-display text-base font-black whitespace-nowrap text-white sm:text-2xl">{route?.carrier || "АТП Ивангород"}</div>
              <div className="text-[9px] tracking-widest text-sky-200 uppercase sm:text-[11px]">официальное расписание</div>
            </div>
          </div>
          )}
          <div className="badge-route w-20 shrink-0 rounded-2xl px-2 py-2 text-center sm:w-32 sm:-rotate-3 sm:py-4">
            <div className="text-[9px] font-bold tracking-[0.2em] text-[#4a1020] uppercase sm:text-[10px]">маршрут</div>
            <div className="font-display text-3xl font-black text-[#12295e] drop-shadow sm:text-5xl">{route?.number || "842"}</div>
          </div>
        </div>

        {/* Направление */}
        <div className="navy-panel mt-4 flex items-center justify-center gap-3 px-4 py-3 sm:gap-6">
          <span className="font-display text-sm font-black tracking-wider text-white sm:text-lg">{route?.fromCity || "КИНГИСЕПП"}</span>
          <svg viewBox="0 0 80 24" className="h-6 w-16 text-white sm:w-20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <line x1="4" y1="7" x2="66" y2="7" strokeDasharray="4 4" />
            <polygon points="66,2 78,7 66,12" fill="currentColor" stroke="none" />
            <line x1="76" y1="17" x2="14" y2="17" strokeDasharray="4 4" />
            <polygon points="14,12 2,17 14,22" fill="currentColor" stroke="none" />
          </svg>
          <span className="font-display text-sm font-black tracking-wider text-white sm:text-lg">{route?.toCity || "САНКТ-ПЕТЕРБУРГ"}</span>
        </div>

        {/* Фото */}
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={route?.heroImageUrl || ""}
            alt="Автобус маршрута 842"
            className="h-44 w-full object-cover sm:h-60"
            loading="eager"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0e1c46]/85 to-transparent px-4 pt-10 pb-2 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2 text-white">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-green-400" />
                <span className="tabular-nums">МСК {clock.timeStr}</span>
                <span className="hidden sm:inline">• {prettyDate(todayMoscowStr())}</span>
              </div>
              <button
                onClick={share}
                className="no-print rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur transition hover:bg-white/30"
              >
                {copied ? "✓ Ссылка скопирована" : "⧉ Поделиться расписанием"}
              </button>
            </div>
          </div>
        </div>

        {/* Объявления */}
        {data && data.announcements.length > 0 && (
          <div className="space-y-2 px-4 pt-4 sm:px-8">
            {data.announcements.map((a) => (
              <div
                key={a.id}
                className={`flex items-start gap-3 rounded-2xl border-l-8 px-4 py-3 shadow ${
                  a.level === "important"
                    ? "border-red-600 bg-red-50"
                    : a.level === "warning"
                      ? "border-amber-500 bg-amber-50"
                      : "border-sky-600 bg-sky-50"
                }`}
              >
                <span className="mt-0.5 text-lg">{a.level === "info" ? "ℹ️" : a.level === "warning" ? "⚠️" : "🚨"}</span>
                <div>
                  <div className="text-sm font-black text-[#16295e]">{a.title}</div>
                  {a.body && <div className="mt-0.5 text-sm whitespace-pre-line text-slate-700">{a.body}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Заголовок расписания */}
        <div className="flex items-center justify-center gap-4 px-4 pt-6 sm:px-8">
          <span className="h-1 w-10 rounded bg-white shadow sm:w-16" />
          <h1 className="font-display text-center text-lg font-black tracking-wide text-[#16295e] uppercase sm:text-2xl">
            Расписание движения
          </h1>
          <span className="h-1 w-10 rounded bg-white shadow sm:w-16" />
        </div>

        {/* Панель даты и ближайших рейсов */}
        <div className="px-4 pt-4 sm:px-8">
          <div className="rounded-2xl bg-[#16295e] p-3 text-white shadow-lg sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDate(addDays(date, -1))}
                  className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold hover:bg-white/30"
                  aria-label="Предыдущий день"
                >
                  ←
                </button>
                <div className="text-center">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => e.target.value && setDate(e.target.value)}
                    className="rounded-lg bg-white/15 px-2 py-1.5 text-sm font-bold text-white [color-scheme:dark]"
                  />
                  <div className="mt-0.5 text-[11px] text-sky-200">{prettyDate(date)}</div>
                </div>
                <button
                  onClick={() => setDate(addDays(date, 1))}
                  className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold hover:bg-white/30"
                  aria-label="Следующий день"
                >
                  →
                </button>
                {!isToday && (
                  <button
                    onClick={() => setDate(todayMoscowStr())}
                    className="rounded-full bg-green-500 px-3 py-1.5 text-xs font-bold hover:bg-green-400"
                  >
                    Сегодня
                  </button>
                )}
              </div>
              <label className="no-print flex cursor-pointer items-center gap-2 text-xs font-semibold text-sky-100">
                <input
                  type="checkbox"
                  checked={onlyUpcoming}
                  onChange={(e) => setOnlyUpcoming(e.target.checked)}
                  className="h-4 w-4 accent-green-400"
                />
                Только предстоящие
              </label>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["from_kingisepp", "from_spb"] as const).map((dir) => {
                const next = nextByDir[dir][0];
                const after = nextByDir[dir][1];
                return (
                  <div key={dir} className="rounded-xl bg-white/10 p-3">
                    <div className="text-[11px] font-bold tracking-wider text-sky-200 uppercase">
                      {dir === "from_kingisepp" ? `◉ ${data?.route.fromCity || "Кингисепп"}` : `◉ ${data?.route.toCity || "Санкт-Петербург"}`}
                    </div>
                    {next ? (
                      <>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="font-display text-3xl font-black tabular-nums">{next.time}</span>
                          <span className="rounded-full bg-green-400 px-2 py-0.5 text-[11px] font-black text-[#0b1a3d]">
                            {isToday ? formatCountdown(next.minutes, clock.minutes) : next.status === "added" ? "доп. рейс" : "первый рейс"}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-sky-200">
                          {after ? `следующий: ${after.time}` : "последний рейс дня"}
                          {next.note ? ` • ${next.note}` : ""}
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 text-sm font-bold text-amber-200">Рейсов больше нет — смотрите завтра</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Переключатель для мобильных */}
        <div className="no-print px-4 pt-4 sm:hidden sm:px-8">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#16295e]/10 p-1.5">
            {(["from_kingisepp", "from_spb"] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setMobileDir(dir)}
                className={`rounded-xl px-2 py-2 text-center text-xs font-black uppercase ${
                  mobileDir === dir ? "bg-[#16295e] text-white shadow" : "text-[#16295e]"
                }`}
              >
                {DIRECTION_LABEL[dir]}
              </button>
            ))}
          </div>
        </div>

        {/* Таблица */}
        <div className="px-4 pt-4 pb-2 sm:px-8">
          {loading ? (
            <div className="rounded-2xl bg-white/70 p-10 text-center text-sm font-bold text-[#16295e]">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#16295e]/20 border-t-[#16295e]" />
              Загружаем актуальное расписание…
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-red-50 p-6 text-center">
              <div className="text-sm font-bold text-red-700">{error}</div>
              <button
                onClick={() => load(date)}
                className="mt-3 rounded-full bg-[#16295e] px-5 py-2 text-sm font-bold text-white"
              >
                Попробовать снова
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl shadow-[0_18px_44px_rgba(14,28,70,0.35)] ring-1 ring-[#16295e]/20">
              <div className="grid grid-cols-1 bg-[#1d3a8f] text-white sm:grid-cols-2">
                <div className={`px-2 py-3 text-center sm:px-4 ${mobileDir !== "from_kingisepp" ? "hidden sm:block" : ""}`}>
                  <div className="flex items-center justify-center gap-2 text-xs font-black tracking-wide uppercase sm:text-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={route?.coatKingiseppUrl || "/images/coat-kingisepp.png"} alt="Герб Кингисеппа" className="h-8 w-8 object-contain drop-shadow sm:h-9 sm:w-9" />
                    Из г. Кингисепп
                  </div>
                  <div className="mt-1 text-[10px] tracking-[0.15em] text-sky-200 uppercase sm:text-[11px]">
                    {route?.fromAddress}
                  </div>
                </div>
                <div className={`border-white/20 px-2 py-3 text-center sm:border-l sm:px-4 ${mobileDir !== "from_spb" ? "hidden sm:block" : ""}`}>
                  <div className="flex items-center justify-center gap-2 text-xs font-black tracking-wide uppercase sm:text-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={route?.coatSpbUrl || "/images/coat-spb.png"} alt="Герб Санкт-Петербурга" className="h-8 w-8 object-contain drop-shadow sm:h-9 sm:w-9" />
                    Из г. Санкт-Петербург
                  </div>
                  <div className="mt-1 text-[10px] tracking-[0.15em] text-sky-200 uppercase sm:text-[11px]">
                    {route?.toAddress}
                  </div>
                </div>
              </div>

              <div className="schedule-scroll max-h-[560px] overflow-y-auto">
                {(() => {
                  const left = filtered.from_kingisepp;
                  const right = filtered.from_spb;
                  const rows = Math.max(left.length, right.length);
                  if (rows === 0) {
                    return <div className="bg-white p-8 text-center text-sm font-bold text-slate-500">На эту дату рейсов нет</div>;
                  }
                  return Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className={`grid grid-cols-1 sm:grid-cols-2 ${i % 2 === 0 ? "bg-white" : "bg-sky-100/70"}`}>
                      <TimeCell
                        item={left[i]}
                        nowMinutes={clock.minutes}
                        isToday={isToday}
                        isNext={isToday && nextByDir.from_kingisepp[0] && left[i]?.key === nextByDir.from_kingisepp[0].key}
                        hiddenOnMobile={mobileDir !== "from_kingisepp"}
                        onSelect={setSelected}
                      />
                      <div className={`${mobileDir !== "from_spb" ? "hidden sm:block" : ""} border-[#16295e]/10 sm:border-l`}>
                        <TimeCell
                          item={right[i]}
                          nowMinutes={clock.minutes}
                          isToday={isToday}
                          isNext={isToday && nextByDir.from_spb[0] && right[i]?.key === nextByDir.from_spb[0].key}
                          hiddenOnMobile={mobileDir !== "from_spb"}
                          onSelect={setSelected}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-semibold text-[#16295e]/80">
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-green-500 align-middle" />ближайший рейс</span>
            <span><span className="mr-1 inline-block rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-black text-green-700 align-middle">ДОП</span>дополнительный</span>
            <span><span className="mr-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700 align-middle line-through">00:00</span>отменён</span>
            <span className="text-[#16295e]/60">нажмите на время, чтобы узнать детали</span>
          </div>
        </div>

        {/* QR + диспетчер */}
        <div className="grid grid-cols-[auto_1fr] items-start gap-4 px-4 pt-4 sm:px-8">
          <div className="text-center">
            <a href={route?.bookingUrl} target="_blank" rel="noreferrer" className="block rounded-2xl bg-white p-2 shadow-lg ring-2 ring-[#16295e]">
              {route?.bookingUrl ? (
                <QRCode value={route.bookingUrl} size={112} style={{ height: "auto", width: "100%", maxWidth: 112 }} />
              ) : (
                <div className="h-28 w-28" />
              )}
            </a>
            <div className="mt-2 max-w-[130px] text-[10px] leading-tight font-black tracking-wide text-[#16295e] uppercase">
              Сканируйте для бронирования билетов или на сайте:
            </div>
            <a
              href={route?.bookingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block rounded-xl bg-[#1d3a8f] px-4 py-1.5 text-sm font-black text-white shadow"
            >
              {route?.bookingLabel || "busfor.ru"}
            </a>
          </div>
          <div>
            <a
              href={`tel:${route?.dispatcherPhoneHref}`}
              className="navy-panel block rounded-2xl px-4 py-4 text-center text-white transition hover:brightness-110"
            >
              <div className="flex items-center justify-center gap-2 text-xs font-black tracking-widest uppercase">
                <span className="text-base">📞</span> Диспетчерская служба:
              </div>
              <div className="font-display mt-1 text-xl font-black tracking-wide sm:text-2xl">{route?.dispatcherPhone}</div>
              <div className="mt-1 text-[11px] text-sky-200">нажмите, чтобы позвонить</div>
            </a>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-xl border-2 border-[#ff8f9d] bg-[#f3c9d4]/60 px-3 py-1.5 text-[11px] font-bold text-[#16295e]">
                ✓ Комфортабельные автобусы
              </span>
              <span className="rounded-xl border-2 border-[#ff8f9d] bg-[#f3c9d4]/60 px-3 py-1.5 text-[11px] font-bold text-[#16295e]">
                ◷ Рейсы каждый час
              </span>
            </div>
          </div>
        </div>

        {/* Полезные ссылки */}
        <div className="px-4 pt-5 sm:px-8">
          <div className="rounded-3xl border-2 border-dashed border-[#16295e]/30 bg-white/30 p-3 sm:p-4">
            <div className="pb-3 text-center text-xs font-black tracking-[0.2em] text-[#16295e] uppercase">
              Ещё полезные ссылки и контакты
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <a href={route?.vkUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-white p-2 text-center shadow transition hover:-translate-y-0.5 hover:shadow-lg sm:p-3">
                <div className="mx-auto w-full max-w-[84px] rounded-xl border-2 border-[#16295e] p-1 sm:p-1.5">
                  {route?.vkUrl ? <QRCode value={route.vkUrl} size={168} style={{ height: "auto", width: "100%" }} /> : null}
                </div>
                <div className="mt-1.5 text-[9px] leading-tight font-black tracking-wider text-[#16295e] uppercase sm:mt-2 sm:text-[11px]">Новости в VK</div>
                <div className="text-[10px] font-bold break-all text-[#1d3a8f] sm:text-xs">{route?.vkLabel}</div>
              </a>
              <a href={route?.maxUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-white p-2 text-center shadow transition hover:-translate-y-0.5 hover:shadow-lg sm:p-3">
                <div className="mx-auto w-full max-w-[84px] rounded-xl border-2 border-[#16295e] p-1 sm:p-1.5">
                  {route?.maxUrl ? <QRCode value={route.maxUrl} size={168} style={{ height: "auto", width: "100%" }} /> : null}
                </div>
                <div className="mt-1.5 text-[9px] leading-tight font-black tracking-wider text-[#16295e] uppercase sm:mt-2 sm:text-[11px]">Оперативные новости в MAX</div>
                <div className="text-[10px] font-bold text-[#1d3a8f] sm:text-xs">нажмите, чтобы открыть</div>
              </a>
              <a href={`mailto:${route?.appealEmail}`} className="rounded-2xl bg-white p-2 text-center shadow transition hover:-translate-y-0.5 hover:shadow-lg sm:p-3">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[#3a8fd1] text-3xl font-black text-amber-400 ring-2 ring-[#16295e] sm:h-[100px] sm:w-[100px] sm:text-5xl">
                  @
                </div>
                <div className="mt-1.5 text-[9px] leading-tight font-black tracking-wider text-[#16295e] uppercase sm:mt-2 sm:text-[11px]">Жалобы и обращения</div>
                <div className="text-[10px] font-bold break-all text-[#1d3a8f] sm:text-xs">{route?.appealEmail}</div>
              </a>
            </div>
          </div>
        </div>

        {/* Футер */}
        <div className="no-print flex flex-wrap items-center justify-center gap-2 px-4 py-4 text-[11px] font-bold text-[#16295e]/70">
          <span>Обновлено {updatedAt ? `в ${updatedAt}` : "автоматически"} • время московское</span>
        </div>
        <div className="h-2.5 bg-gradient-to-r from-[#ff5f7e] via-[#ffb02e] via-30% via-[#37e0ff] via-55% to-[#ff5f7e]" />
      </div>

      {/* Модалка рейса */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-xs font-black tracking-widest text-slate-500 uppercase">
                {selected.direction === "from_kingisepp" ? `Из Кингисеппа • ${route?.fromAddress}` : `Из Санкт-Петербурга • ${route?.toAddress}`}
              </div>
              <div className="font-display mt-1 text-5xl font-black text-[#16295e] tabular-nums">{selected.time}</div>
              <div className="mt-1 text-sm font-bold text-slate-500">{prettyDate(date)} • маршрут {route?.number}</div>
              <div className="mt-3">
                {selected.status === "cancelled" ? (
                  <span className="rounded-full bg-red-100 px-4 py-1.5 text-sm font-black text-red-700">⛔ Рейс отменён</span>
                ) : selected.status === "added" ? (
                  <span className="rounded-full bg-green-100 px-4 py-1.5 text-sm font-black text-green-700">✚ Дополнительный рейс</span>
                ) : isToday && selected.minutes > clock.minutes ? (
                  <span className="rounded-full bg-green-500 px-4 py-1.5 text-sm font-black text-white">
                    {formatCountdown(selected.minutes, clock.minutes)}
                  </span>
                ) : isToday ? (
                  <span className="rounded-full bg-slate-200 px-4 py-1.5 text-sm font-black text-slate-600">Рейс уже ушёл</span>
                ) : (
                  <span className="rounded-full bg-sky-100 px-4 py-1.5 text-sm font-black text-sky-800">Запланирован</span>
                )}
              </div>
              {selected.note && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">📝 {selected.note}</div>}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a
                  href={`tel:${route?.dispatcherPhoneHref}`}
                  className="rounded-xl bg-[#16295e] px-3 py-2.5 text-center text-sm font-black text-white"
                >
                  📞 Диспетчер
                </a>
                <a
                  href={route?.bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-[#ff6b4a] px-3 py-2.5 text-center text-sm font-black text-white"
                >
                  🎫 Купить билет
                </a>
              </div>
              <button onClick={() => setSelected(null)} className="mt-3 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-slate-600">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeCell({
  item,
  nowMinutes,
  isToday,
  isNext,
  hiddenOnMobile,
  onSelect,
}: {
  item?: ResolvedDeparture;
  nowMinutes: number;
  isToday: boolean;
  isNext?: boolean | null;
  hiddenOnMobile: boolean;
  onSelect: (d: ResolvedDeparture) => void;
}) {
  if (!item) {
    return <div className={`py-2.5 text-center text-slate-300 ${hiddenOnMobile ? "hidden sm:block" : ""}`}>—</div>;
  }
  const isPast = isToday && item.minutes <= nowMinutes;
  const cancelled = item.status === "cancelled";
  return (
    <button
      onClick={() => onSelect(item)}
      className={`relative w-full py-2 text-center transition hover:bg-[#16295e]/10 ${hiddenOnMobile ? "hidden sm:block" : ""} ${
        isNext ? "next-glow bg-green-100" : ""
      }`}
    >
      <span
        className={`font-display text-base font-black tabular-nums sm:text-lg ${
          cancelled ? "text-red-400 line-through" : isPast ? "text-slate-400" : "text-[#16295e]"
        }`}
      >
        {item.time}
      </span>
      {cancelled && (
        <span className="ml-1.5 rounded bg-red-500 px-1.5 py-0.5 align-middle text-[9px] font-black text-white uppercase">отмена</span>
      )}
      {item.status === "added" && !cancelled && (
        <span className="ml-1.5 rounded bg-green-500 px-1.5 py-0.5 align-middle text-[9px] font-black text-white uppercase">доп</span>
      )}
      {isNext && !cancelled && (
        <span className="ml-1.5 rounded-full bg-green-500 px-2 py-0.5 align-middle text-[9px] font-black text-white uppercase">
          следующий
        </span>
      )}
      {item.note && !cancelled && (
        <span className="block truncate px-4 text-[10px] font-semibold text-amber-700" title={item.note}>
          {item.note}
        </span>
      )}
      {cancelled && item.note && (
        <span className="block truncate px-4 text-[10px] font-semibold text-red-400" title={item.note}>
          {item.note}
        </span>
      )}
    </button>
  );
}
