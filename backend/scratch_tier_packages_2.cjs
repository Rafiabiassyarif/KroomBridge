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
      "UPDATE packages SET allowedModels = ? WHERE name = 'Free Tier'",
      [JSON.stringify(["gemma4:26b", "qwen2.5:7b", "glm-4", "llama-3-8b"])]
    );

    // Tier 2: Standard
    await pool.query(
      "UPDATE packages SET allowedModels = ? WHERE name = 'Standard'",
      [JSON.stringify(["gemma4:26b", "qwen2.5:7b", "glm-5.2", "kimi-k2.7-code", "llama-3-8b", "gpt-4o-mini", "claude-3-haiku"])]
    );

    // Tier 3: Pro
    await pool.query(
      "UPDATE packages SET allowedModels = ? WHERE name = 'Pro'",
      [JSON.stringify(["gemma4:26b", "qwen2.5:7b", "glm-5.2", "kimi-k2.7-code", "qwen-image-2.0-pro-2026-06-22", "gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro"])]
    );

    // Tier 4: Ultra (Unlimited Models)
    await pool.query(
      "UPDATE packages SET allowedModels = ? WHERE name LIKE 'Ultra%'",
      [JSON.stringify(["*"])]
    );

    console.log("Packages models updated successfully!");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
