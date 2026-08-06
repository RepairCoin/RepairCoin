import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
import * as jwt from 'jsonwebtoken';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const c = new Client({host:process.env.DB_HOST,port:+(process.env.DB_PORT||25060),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const s = (await c.query(`SELECT wallet_address FROM shops WHERE shop_id='peanut'`)).rows[0];
  const t = jwt.sign({ address: s.wallet_address, role: 'shop', shopId: 'peanut' }, process.env.JWT_SECRET as string, { expiresIn: '5m' });
  const r = await fetch('https://api-staging.repaircoin.ai/api/shops/tasks?status=open', { headers: { Authorization: `Bearer ${t}` } });
  console.log('status:', r.status);
  console.log('raw body:', (await r.text()).slice(0, 300));
  await c.end();
})();
