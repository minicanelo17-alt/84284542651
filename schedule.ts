export type Direction = "from_kingisepp" | "from_spb";

export interface DepartureDto {
  id: string;
  direction: string;
  time: string;
  daysOfWeek: number[];
  isActive: boolean;
  note: string;
}

export interface ExceptionDto {
  id: string;
  date: string;
  direction: string;
  time: string;
  status: string;
  note: string;
}

export interface ResolvedDeparture {
  key: string;
  time: string;
  direction: string;
  status: "active" | "cancelled" | "added";
  note: string;
  minutes: number; // minutes from midnight
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Moscow now parts */
export function moscowNow(date = new Date()): { minutes: number; weekday: number; dateStr: string; timeStr: string } {
  const fmt = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dfmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const wfmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Moscow", weekday: "short" });
  const timeStr = fmt.format(date);
  const dateStr = dfmt.format(date); // YYYY-MM-DD
  const [hh, mm] = timeStr.split(":").map(Number);
  const jsDay = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0=Sun
  void wfmt;
  return { minutes: hh * 60 + mm, weekday: jsDay, dateStr, timeStr };
}

export function resolveDaySchedule(
  departures: DepartureDto[],
  exceptions: ExceptionDto[],
  weekday: number
): ResolvedDeparture[] {
  const base = departures
    .filter((d) => d.isActive && d.daysOfWeek.includes(weekday))
    .map((d) => ({
      key: d.id,
      time: d.time,
      direction: d.direction,
      status: "active" as const,
      note: d.note,
      minutes: timeToMinutes(d.time),
    }));

  const cancelled = new Set(
    exceptions.filter((e) => e.status === "cancelled").map((e) => `${e.direction}|${e.time}`)
  );
  const notes = new Map<string, string>();
  for (const e of exceptions) {
    if (e.status === "note" && e.note) notes.set(`${e.direction}|${e.time}`, e.note);
  }

  const result: ResolvedDeparture[] = [];
  for (const b of base) {
    const k = `${b.direction}|${b.time}`;
    if (cancelled.has(k)) {
      result.push({ ...b, status: "cancelled", note: exceptions.find((e) => `${e.direction}|${e.time}` === k)?.note || "Рейс отменён" });
    } else if (notes.has(k)) {
      result.push({ ...b, note: notes.get(k)! });
    } else {
      result.push(b);
    }
  }
  // added
  for (const e of exceptions.filter((e) => e.status === "added")) {
    if (result.some((r) => r.direction === e.direction && r.time === e.time)) continue;
    result.push({
      key: `added-${e.id}`,
      time: e.time,
      direction: e.direction,
      status: "added",
      note: e.note || "Дополнительный рейс",
      minutes: timeToMinutes(e.time),
    });
  }
  result.sort((a, b) => a.minutes - b.minutes || a.direction.localeCompare(b.direction));
  return result;
}

export function nextDepartures(schedule: ResolvedDeparture[], nowMinutes: number, direction: string, count = 3) {
  return schedule
    .filter((s) => s.direction === direction && s.status !== "cancelled" && s.minutes > nowMinutes)
    .slice(0, count);
}

export function formatCountdown(targetMinutes: number, nowMinutes: number): string {
  const diff = targetMinutes - nowMinutes;
  if (diff <= 0) return "отправляется";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h <= 0) return `через ${m} мин`;
  return `через ${h} ч ${String(m).padStart(2, "0")} мин`;
}

export const DIRECTION_LABEL: Record<string, string> = {
  from_kingisepp: "Из Кингисеппа",
  from_spb: "Из Санкт-Петербурга",
};

export const WEEKDAYS_SHORT = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
export const WEEKDAYS_FULL = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];
