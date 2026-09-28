const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5433'),
  database: process.env.DATABASE_NAME || 'rinne',
  user: process.env.DATABASE_USER || 'rinne_user',
  password: process.env.DATABASE_PASSWORD || 'rinne_secret_2026',
});

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, song_id)
      );
      CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
    `);
    console.log('Favorites table created successfully');
  } catch (error) {
    console.error('Error creating table:', error);
  } finally {
    pool.end();
  }
}

migrate();
