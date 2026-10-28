import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scryptAsync = promisify(scrypt);
async function hash(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/app_db" });

async function main() {
  const routeCheck = await pool.query("SELECT id FROM routes LIMIT 1");
  let routeId;
  if (routeCheck.rows.length === 0) {
    const r = await pool.query(
      `INSERT INTO routes (number, carrier, from_city, to_city, from_address, to_address, dispatcher_phone, dispatcher_phone_href, booking_url, booking_label, vk_url, vk_label, max_url, appeal_email, hero_image_url)
       VALUES ('842','АТП Ивангород','КИНГИСЕПП','САНКТ-ПЕТЕРБУРГ','пр. Карла Маркса, 42','ул. Червонного Казачества','+7 931 953 01 02','+79319530102','https://busfor.ru','busfor.ru','https://vk.ru/marshrut842','vk.ru/marshrut842','https://max.ru/','atp-iv@yandex.ru','https://images.pexels.com/photos/12955550/pexels-photo-12955550.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200')
       RETURNING id`
    );
    routeId = r.rows[0].id;
    console.log("route created", routeId);
  } else {
    routeId = routeCheck.rows[0].id;
    console.log("route exists", routeId);
  }

  const depCount = await pool.query("SELECT COUNT(*)::int AS c FROM departures WHERE route_id=$1", [routeId]);
  if (depCount.rows[0].c === 0) {
    const timesK = ["05:00","06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00"];
    const timesS = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];
    for (const t of timesK) {
      await pool.query(`INSERT INTO departures (route_id, direction, time, days_of_week, is_active) VALUES ($1,'from_kingisepp',$2,'{0,1,2,3,4,5,6}',true)`, [routeId, t]);
    }
    for (const t of timesS) {
      await pool.query(`INSERT INTO departures (route_id, direction, time, days_of_week, is_active) VALUES ($1,'from_spb',$2,'{0,1,2,3,4,5,6}',true)`, [routeId, t]);
    }
    console.log("departures seeded");
  } else {
    console.log("departures exist:", depCount.rows[0].c);
  }

  const userCount = await pool.query("SELECT COUNT(*)::int AS c FROM users");
  if (userCount.rows[0].c === 0) {
    const adminHash = await hash("ivangorod842");
    const dispHash = await hash("dispatcher123");
    await pool.query(`INSERT INTO users (login, name, role, password_hash) VALUES ('admin','Администратор','admin',$1)`, [adminHash]);
    await pool.query(`INSERT INTO users (login, name, role, password_hash) VALUES ('dispatcher','Диспетчер','editor',$1)`, [dispHash]);
    console.log("users seeded: admin / ivangorod842, dispatcher / dispatcher123");
  } else {
    console.log("users exist");
  }

  const annCount = await pool.query("SELECT COUNT(*)::int AS c FROM announcements");
  if (annCount.rows[0].c === 0) {
    await pool.query(
      `INSERT INTO announcements (route_id, title, body, level, is_active) VALUES ($1,'Добро пожаловать на новое интерактивное расписание!','Теперь вы видите актуальное время отправления, ближайшие рейсы и все изменения в реальном времени. Сохраните эту страницу в закладки.','info',true)`,
      [routeId]
    );
    console.log("announcement seeded");
  }

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
