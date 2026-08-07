// Exercises the REAL repository method against staging, rather than a copy of its SQL — the copy is
// what made the first version of this probe agree with itself while the bug stayed.
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { getShopTaskRepository } from '../src/repositories/ShopTaskRepository';

(async () => {
  const c = new Client({host:process.env.DB_HOST,port:+(process.env.DB_PORT||25060),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const repo = getShopTaskRepository();
  const t = await repo.create({ shopId: 'peanut', title: 'probe' });
  try {
    const done = await repo.setStatus('peanut', t.id, 'done');
    console.log('done  ->', done ? `${done.status}, completed_at ${done.completedAt ? 'set' : 'NULL'}` : 'null');
    const reopened = await repo.setStatus('peanut', t.id, 'open');
    console.log('open  ->', reopened ? `${reopened.status}, completed_at ${reopened.completedAt ? 'set' : 'NULL'}` : 'null');
    const wrongShop = await repo.setStatus('1111', t.id, 'done');
    console.log('other shop ->', wrongShop === null ? 'null (correctly refused)' : 'WROTE — ownership hole');
  } catch (e:any) {
    console.log('FAILED:', e.message);
  }
  await c.query(`DELETE FROM shop_tasks WHERE id=$1`, [t.id]);
  await c.end();
})();
