import * as dotenv from "dotenv"; import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import { getSharedPool } from "../src/utils/database-pool";

const SHOP = "peanut";
const SVC = { iRobot:"srv_4287324a-51e6-49ce-b556-ceb8907a1499", aqua:"srv_0cbf21d2-5095-4dea-af7d-c7a9be1df637", cyan:"srv_c0a35770-820d-4a10-aa0f-c49de0c05679", mongo:"srv_e073ca83-516a-472b-9d37-fcb80f3b2c08", baker:"srv_b294a818-1938-4a0f-9565-de82bd7a2bf7" };
const C = { a:"0x066cf972a5b9a37cf8c2fe9dd51ec74b012269e0", b:"0x150e4a7bcf6204bebe0efe08fe7479f2ee30a24e", c:"0x20ecb9db0de6aafb641b3ecb0b651e8a482440a2", d:"0x4d6878d34ecca048ee94e62a08d349474227687b", e:"0x6cd036477d1c39da021095a62a32c6bb919993cf" };
const D = (n:number) => new Date(Date.now() - n*86400000);          // n days ago
const F = (n:number) => new Date(Date.now() + n*86400000);          // n days from now
let i = 0;

async function main(){
  const pool = getSharedPool();
  // idempotent: clear any prior seed
  await pool.query(`DELETE FROM service_reviews WHERE order_id LIKE 'ffseed-%' AND shop_id=$1`,[SHOP]);
  await pool.query(`DELETE FROM service_orders  WHERE order_id LIKE 'ffseed-%' AND shop_id=$1`,[SHOP]);

  const ord = async (svc:string, cust:string, status:string, amt:number, created:Date, completed:Date|null, booking:Date|null, noShow=false) => {
    const id = `ffseed-${++i}`;
    await pool.query(
      `INSERT INTO service_orders (order_id, service_id, customer_address, shop_id, status, total_amount, final_amount_usd, created_at, updated_at, completed_at, booking_date, no_show, notes, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$7,$8,$9,$10,'[FIXFLOW-DEMO-SEED]','paid')`,
      [id, svc, cust, SHOP, status, amt, created, completed, booking, noShow]);
    return id;
  };
  const review = async (orderId:string, svc:string, cust:string, rating:number, created:Date) =>
    pool.query(`INSERT INTO service_reviews (service_id, order_id, customer_address, shop_id, rating, comment, created_at) VALUES ($1,$2,$3,$4,$5,'Great service!',$6)`,
      [svc, orderId, cust, SHOP, rating, created]);

  // --- Revenue: current 7d (down) vs prior 7d (higher) ---
  const r1 = await ord(SVC.iRobot, C.a, "completed", 699.99, D(3), D(3), null);
  await ord(SVC.cyan,  C.b, "completed", 200, D(4), D(4), null);                  // current 7d ~ $899.99
  await ord(SVC.iRobot,C.a, "completed", 699.99, D(10), D(10), null);
  await ord(SVC.iRobot,C.c, "completed", 699.99, D(11), D(11), null);
  await ord(SVC.aqua,  C.b, "completed", 455, D(12), D(12), null);
  await ord(SVC.mongo, C.c, "completed", 200, D(9), D(9), null);                  // prior 7d ~ $2054.98 (-56%)

  // --- Review conversion regression: current 30d = 6 completed, 1 review (~17%) ---
  await review(r1, SVC.iRobot, C.a, 5, D(3));

  // prior 30d = 5 completed (40-50d), 4 reviews (80%)
  const p1 = await ord(SVC.baker, C.a, "completed", 99,  D(45), D(45), null);
  const p2 = await ord(SVC.cyan,  C.b, "completed", 200, D(46), D(46), null);
  const p3 = await ord(SVC.mongo, C.c, "completed", 200, D(47), D(47), null);
  const p4 = await ord(SVC.aqua,  C.a, "completed", 455, D(48), D(48), null);
  await ord(SVC.baker, C.b, "completed", 99,  D(50), D(50), null);
  await review(p1, SVC.baker, C.a, 5, D(45));
  await review(p2, SVC.cyan,  C.b, 4, D(46));
  await review(p3, SVC.mongo, C.c, 5, D(47));
  await review(p4, SVC.aqua,  C.a, 5, D(48));

  // --- Upcoming bookings (next 7d), uneven, quiet day = +3d ---
  for (const c of [C.a,C.b,C.c]) await ord(SVC.cyan, c, "pending", 200, D(0), null, F(1));  // +1d: 3
  for (const c of [C.a,C.b])     await ord(SVC.mongo,c, "pending", 200, D(0), null, F(2));  // +2d: 2
  await ord(SVC.baker, C.a, "pending", 99, D(0), null, F(3));                                // +3d: 1 (quietest)
  for (const c of [C.b,C.c])     await ord(SVC.cyan, c, "pending", 200, D(0), null, F(5));  // +5d: 2

  // --- Lapsed customers w/ value (~120d ago, distinct customers) ---
  await ord(SVC.iRobot, C.d, "completed", 699.99, D(120), D(120), null);
  await ord(SVC.aqua,   C.e, "completed", 455,    D(130), D(130), null);

  console.log(`seeded ${i} orders + 5 reviews for peanut (tag: order_id LIKE 'ffseed-%')`);
  await pool.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
