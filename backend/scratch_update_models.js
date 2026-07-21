const mysql = require('mysql2/promise');

(async () => {
  try {
    const pool = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'kroombox_db'
    });

    const basicModels = ["gpt-4o-mini", "claude-3-haiku", "gemini-1.5-flash", "llama-3", "qwen"];
    await pool.query('UPDATE packages SET allowedModels = ? WHERE name = ?', [JSON.stringify(basicModels), 'Basic']);

    const premiumModels = ["*"];
    await pool.query('UPDATE packages SET allowedModels = ? WHERE name = ?', [JSON.stringify(premiumModels), 'Premium']);
    await pool.query('UPDATE packages SET allowedModels = ? WHERE name = ?', [JSON.stringify(premiumModels), 'minibox testing']);

    console.log('Successfully updated package models in DB!');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
