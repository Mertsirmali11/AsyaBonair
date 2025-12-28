const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function fix() {
  const hash = await bcrypt.hash('bonair2025', 10);
  console.log('Yeni hash:', hash);
  
  const pool = new Pool({ 
    connectionString: 'postgresql://postgres.eqxglebntsfviguakkey:2025bonair2025@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' 
  });
  
  await pool.query('UPDATE calisanlar SET password = $1', [hash]);
  console.log('✅ Şifreler güncellendi!');
  
  // Kontrol
  const result = await pool.query('SELECT email, password FROM calisanlar');
  for (const row of result.rows) {
    const match = await bcrypt.compare('bonair2025', row.password);
    console.log(row.email + ':', match ? '✅ OK' : '❌ FAIL');
  }
  
  await pool.end();
}

fix().catch(console.error);

