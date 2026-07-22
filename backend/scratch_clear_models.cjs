const mysql = require('mysql2/promise');

(async () => {
  try {
    const pool = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'kroombox_db'
    });

    // Set all packages to have unlimited access ["*"] by default,
    // so there are no hardcoded "dummy" model names. 
    // The user can edit them via the UI later.
    await pool.query(
      "UPDATE packages SET allowedModels = ?",
      [JSON.stringify(["*"])]
    );

    console.log("All dummy models cleared successfully!");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
