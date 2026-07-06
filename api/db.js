const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    let connString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    
    // Vercel Supabase integration often adds ?sslmode=require to the URL
    // This overrides our ssl: { rejectUnauthorized: false } setting in the pg library, causing the certificate chain error.
    // We strip it here to ensure our custom SSL config is respected.
    if (connString) {
      connString = connString.replace(/[\?&]sslmode=[^&]*/g, '');
    }

    pool = new Pool({
      connectionString: connString,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  return pool;
}

async function initDb() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      username VARCHAR(255) PRIMARY KEY,
      score INTEGER DEFAULT 0,
      predictions_made INTEGER DEFAULT 0
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS predictions (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) REFERENCES users(username),
      question_id INTEGER,
      answer VARCHAR(50),
      status VARCHAR(50) DEFAULT 'PENDING',
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(username, question_id)
    )
  `);
}

module.exports = {
  query: async (text, params) => {
    // Ensure tables exist on first query (in a real app, use migrations, but this works for serverless demo)
    await initDb();
    const db = getPool();
    return db.query(text, params);
  }
};
