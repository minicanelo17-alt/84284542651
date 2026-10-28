import { pool } from "@/db";
import { db } from "@/db";
import { announcements, departures, routes, users } from "@/db/schema";
import { hashPassword } from "./auth";

/**
 * Самонастройка базы данных для переезда на постоянный хостинг.
 * При первом открытии сайта на пустой базе создаёт все таблицы
 * (зеркало src/db/schema.ts) и загружает стартовые данные:
 * маршрут 842, расписание с аншлага, пользователей и объявление.
 * На готовой базе — безопасная пустая операция.
 */
const INIT_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login varchar(64) NOT NULL UNIQUE,
  name varchar(128) NOT NULL,
  role varchar(16) NOT NULL DEFAULT 'editor',
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token varchar(128) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number varchar(16) NOT NULL DEFAULT '842',
  carrier varchar(128) NOT NULL DEFAULT 'АТП Ивангород',
  from_city varchar(128) NOT NULL DEFAULT 'КИНГИСЕПП',
  to_city varchar(128) NOT NULL DEFAULT 'САНКТ-ПЕТЕРБУРГ',
  from_address varchar(256) NOT NULL DEFAULT 'пр. Карла Маркса, 42',
  to_address varchar(256) NOT NULL DEFAULT 'ул. Червонного Казачества',
  dispatcher_phone varchar(32) NOT NULL DEFAULT '+7 931 953 01 02',
  dispatcher_phone_href varchar(32) NOT NULL DEFAULT '+79319530102',
  booking_url varchar(512) NOT NULL DEFAULT 'https://busfor.ru',
  booking_label varchar(128) NOT NULL DEFAULT 'busfor.ru',
  vk_url varchar(512) NOT NULL DEFAULT 'https://vk.ru/marshrut842',
  vk_label varchar(128) NOT NULL DEFAULT 'vk.ru/marshrut842',
  max_url varchar(512) NOT NULL DEFAULT 'https://max.ru/channel_id4707050010_biz',
  appeal_email varchar(256) NOT NULL DEFAULT 'atp-iv@yandex.ru',
  hero_image_url text NOT NULL DEFAULT 'https://images.pexels.com/photos/12955550/pexels-photo-12955550.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
  banner_image_url text NOT NULL DEFAULT '',
  coat_kingisepp_url text NOT NULL DEFAULT '',
  coat_spb_url text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  direction varchar(32) NOT NULL,
  time varchar(5) NOT NULL,
  days_of_week integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  is_active boolean NOT NULL DEFAULT true,
  note varchar(256) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS day_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  date date NOT NULL,
  direction varchar(32) NOT NULL,
  time varchar(5) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'cancelled',
  note varchar(256) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES routes(id) ON DELETE CASCADE,
  title varchar(256) NOT NULL,
  body text NOT NULL DEFAULT '',
  level varchar(16) NOT NULL DEFAULT 'info',
  is_active boolean NOT NULL DEFAULT true,
  starts_at date,
  ends_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mime varchar(64) NOT NULL,
  size integer NOT NULL DEFAULT 0,
  data text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

let readyAt = 0;
let inflight: Promise<void> | null = null;
const TTL_MS = 5 * 60 * 1000;

export function ensureDbReady(): Promise<void> {
  const now = Date.now();
  if (readyAt && now - readyAt < TTL_MS) return Promise.resolve();
  if (inflight) return inflight;
  inflight = doInit()
    .then(() => {
      readyAt = Date.now();
    })
    .catch((e) => {
      console.error("[init-db] failed (will retry later):", e);
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function doInit(): Promise<void> {
  await pool.query(INIT_SQL);

  // Маршрут
  const existingRoutes = await db.select({ id: routes.id }).from(routes).limit(1);
  let routeId: string;
  if (existingRoutes.length === 0) {
    const [r] = await db
      .insert(routes)
      .values({
        number: "842",
        carrier: "АТП Ивангород",
        fromCity: "КИНГИСЕПП",
        toCity: "САНКТ-ПЕТЕРБУРГ",
        fromAddress: "пр. Карла Маркса, 42",
        toAddress: "ул. Червонного Казачества",
        dispatcherPhone: "+7 931 953 01 02",
        dispatcherPhoneHref: "+79319530102",
        bookingUrl: "https://busfor.ru",
        bookingLabel: "busfor.ru",
        vkUrl: "https://vk.ru/marshrut842",
        vkLabel: "vk.ru/marshrut842",
        maxUrl: "https://max.ru/channel_id4707050010_biz",
        appealEmail: "atp-iv@yandex.ru",
        heroImageUrl:
          "https://images.pexels.com/photos/12955550/pexels-photo-12955550.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
        bannerImageUrl: "",
        coatKingiseppUrl: "",
        coatSpbUrl: "",
      })
      .returning({ id: routes.id });
    routeId = r.id;
    console.log("[init-db] route seeded");
  } else {
    routeId = existingRoutes[0].id;
  }

  // Расписание с аншлага
  const existingDeps = await db.select({ id: departures.id }).from(departures).limit(1);
  if (existingDeps.length === 0) {
    const timesK = ["05:00", "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
    const timesS = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];
    for (const t of timesK) {
      await db.insert(departures).values({ routeId, direction: "from_kingisepp", time: t, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], isActive: true, note: "" });
    }
    for (const t of timesS) {
      await db.insert(departures).values({ routeId, direction: "from_spb", time: t, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], isActive: true, note: "" });
    }
    console.log("[init-db] departures seeded");
  }

  // Стартовые пользователи (пароли смените сразу после переезда!)
  const existingUsers = await db.select({ id: users.id }).from(users).limit(1);
  if (existingUsers.length === 0) {
    await db.insert(users).values({
      login: "admin",
      name: "Администратор",
      role: "admin",
      passwordHash: await hashPassword("ivangorod842"),
    });
    await db.insert(users).values({
      login: "dispatcher",
      name: "Диспетчер",
      role: "editor",
      passwordHash: await hashPassword("dispatcher123"),
    });
    console.log("[init-db] users seeded");
  }

  // Приветственное объявление
  const existingAnn = await db.select({ id: announcements.id }).from(announcements).limit(1);
  if (existingAnn.length === 0) {
    await db.insert(announcements).values({
      routeId,
      title: "Добро пожаловать на новое интерактивное расписание!",
      body: "Теперь вы видите актуальное время отправления, ближайшие рейсы и все изменения в реальном времени. Сохраните эту страницу в закладки.",
      level: "info",
      isActive: true,
    });
    console.log("[init-db] announcement seeded");
  }
}
