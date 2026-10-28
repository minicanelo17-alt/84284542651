import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------- Пользователи (редакторы / админы) ----------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  login: varchar("login", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  role: varchar("role", { length: 16 }).notNull().default("editor"), // admin | editor
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Маршрут (аншлаг) ----------
export const routes = pgTable("routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: varchar("number", { length: 16 }).notNull().default("842"),
  carrier: varchar("carrier", { length: 128 }).notNull().default("АТП Ивангород"),
  fromCity: varchar("from_city", { length: 128 }).notNull().default("КИНГИСЕПП"),
  toCity: varchar("to_city", { length: 128 }).notNull().default("САНКТ-ПЕТЕРБУРГ"),
  fromAddress: varchar("from_address", { length: 256 }).notNull().default("пр. Карла Маркса, 42"),
  toAddress: varchar("to_address", { length: 256 }).notNull().default("ул. Червонного Казачества"),
  dispatcherPhone: varchar("dispatcher_phone", { length: 32 }).notNull().default("+7 931 953 01 02"),
  dispatcherPhoneHref: varchar("dispatcher_phone_href", { length: 32 }).notNull().default("+79319530102"),
  bookingUrl: varchar("booking_url", { length: 512 }).notNull().default("https://busfor.ru"),
  bookingLabel: varchar("booking_label", { length: 128 }).notNull().default("busfor.ru"),
  vkUrl: varchar("vk_url", { length: 512 }).notNull().default("https://vk.ru/marshrut842"),
  vkLabel: varchar("vk_label", { length: 128 }).notNull().default("vk.ru/marshrut842"),
  maxUrl: varchar("max_url", { length: 512 }).notNull().default("https://max.ru/channel_id4707050010_biz"),
  appealEmail: varchar("appeal_email", { length: 256 }).notNull().default("atp-iv@yandex.ru"),
  heroImageUrl: text("hero_image_url").notNull().default(
    "https://images.pexels.com/photos/12955550/pexels-photo-12955550.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"
  ),
  bannerImageUrl: text("banner_image_url").notNull().default(""),
  coatKingiseppUrl: text("coat_kingisepp_url").notNull().default(""),
  coatSpbUrl: text("coat_spb_url").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Загруженные картинки (логотип, фото, гербы) ----------
// Хранятся в базе (base64), поэтому переживают любой переезд хостинга.
// Отдаются пассажирам через /api/images/<id>.
export const siteImages = pgTable("site_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  mime: varchar("mime", { length: 64 }).notNull(),
  size: integer("size").notNull().default(0),
  data: text("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Рейсы расписания ----------
// direction: 'from_kingisepp' — из Кингисеппа, 'from_spb' — из Санкт-Петербурга
export const departures = pgTable("departures", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  direction: varchar("direction", { length: 32 }).notNull(),
  time: varchar("time", { length: 5 }).notNull(), // HH:MM
  daysOfWeek: integer("days_of_week").array().notNull().default(sql`'{0,1,2,3,4,5,6}'`),
  isActive: boolean("is_active").notNull().default(true),
  note: varchar("note", { length: 256 }).notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Точечные изменения на конкретную дату ----------
// status: cancelled | added | note
export const dayExceptions = pgTable("day_exceptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  date: date("date").notNull(), // YYYY-MM-DD
  direction: varchar("direction", { length: 32 }).notNull(),
  time: varchar("time", { length: 5 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("cancelled"),
  note: varchar("note", { length: 256 }).notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Объявления для пассажиров ----------
export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id").references(() => routes.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 256 }).notNull(),
  body: text("body").notNull().default(""),
  level: varchar("level", { length: 16 }).notNull().default("info"), // info | warning | important
  isActive: boolean("is_active").notNull().default(true),
  startsAt: date("starts_at"),
  endsAt: date("ends_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Route = typeof routes.$inferSelect;
export type Departure = typeof departures.$inferSelect;
export type DayException = typeof dayExceptions.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
