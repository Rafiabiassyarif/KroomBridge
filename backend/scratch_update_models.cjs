const mysql = require('mysql2/promise');

(async () => {
  try {
    const pool = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'kroombox_db'
    });

    // Run migration manually
    try {
      await pool.query(
        "ALTER TABLE packages ADD COLUMN IF NOT EXISTS allowedModels json DEFAULT NULL",
      );
    } catch (err) {
      if (
        err?.code === "ER_PARSE_ERROR" ||
        String(err?.message || "").includes("syntax")
      ) {
        try {
          const [cols] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packages' AND COLUMN_NAME = 'allowedModels'",
          );
          if (Array.isArray(cols) && cols.length === 0) {
            await pool.query(
              "ALTER TABLE packages ADD COLUMN allowedModels json DEFAULT NULL",
            );
          }
        } catch {}
      }
    }

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
