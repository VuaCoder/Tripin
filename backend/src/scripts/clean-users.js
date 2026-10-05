const path = require('path');
const { Client } = require(path.resolve(__dirname, '../../node_modules/pg'));

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_j0GWab1dTPnR@ep-wild-king-b31i00f1-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  await client.connect();
  console.log('Connected to Database successfully!');

  await client.query('DELETE FROM "Otp"').catch(e => console.log('Otp:', e.message));
  await client.query('DELETE FROM "WishlistItem"').catch(e => console.log('WishlistItem:', e.message));
  await client.query('DELETE FROM "Review"').catch(e => console.log('Review:', e.message));
  await client.query('DELETE FROM "Booking"').catch(e => console.log('Booking:', e.message));
  await client.query('DELETE FROM "RefreshToken"').catch(e => console.log('RefreshToken:', e.message));
  
  const res = await client.query('DELETE FROM "User" WHERE role <> \'SUPER_ADMIN\'').catch(e => console.log('User delete:', e.message));
  if (res) {
    console.log(`✅ SUCCESS: Deleted ${res.rowCount} test user accounts!`);
  }

  await client.end();
}

run().catch(console.error);
