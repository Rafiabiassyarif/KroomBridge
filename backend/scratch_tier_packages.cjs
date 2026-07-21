const mysql = require('mysql2/promise');

(async () => {
  try {
    const pool = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'kroombox_db'
    });

    // Tier 1: Free
    await pool.query(
      "UPDATE packages SET name = ?, price = ?, monthlyQuota = ?, allowedModels = ? WHERE id = 'pkg_f51d041a'",
      ["Free Tier", 0, 10000, JSON.stringify(["gpt-4o-mini", "gemini-1.5-flash", "qwen", "llama-3-8b"])]
    );

    // Tier 2: Standard
    await pool.query(
      "UPDATE packages SET name = ?, price = ?, monthlyQuota = ?, allowedModels = ? WHERE id = 'pkg_1783486234006_lds1rq'",
      ["Standard", 50000, 50000, JSON.stringify(["gpt-4o-mini", "claude-3-haiku", "gemini-1.5-flash", "llama-3", "qwen", "gpt-4o", "claude-3-5-sonnet"])]
    );

    // Tier 3: Pro
    await pool.query(
      "UPDATE packages SET name = ?, price = ?, monthlyQuota = ?, allowedModels = ? WHERE id = 'pkg_1783486234008_w6jz3l'",
      ["Pro", 100000, 250000, JSON.stringify(["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro", "llama-3-70b", "qwen-72b", "gpt-4o-mini", "claude-3-haiku", "gemini-1.5-flash"])]
    );

    // Tier 4: Ultra (Unlimited Models)
    await pool.query(
      "UPDATE packages SET name = ?, price = ?, monthlyQuota = ?, allowedModels = ? WHERE id = 'pkg_1783486234004_9b249w'",
      ["Ultra (Enterprise)", 250000, 1000000, JSON.stringify(["*"])]
    );

    console.log("Packages updated successfully!");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
