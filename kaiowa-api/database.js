const { Pool } = require('pg');

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error('ERRO: A variável DATABASE_URL não foi definida.');
}

const connectionString = rawUrl && rawUrl.includes('%40') ? decodeURIComponent(rawUrl) : rawUrl;

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('Conectado ao PostgreSQL (Supabase) com sucesso.');
});

pool.on('error', (err) => {
  console.error('Erro inesperado no cliente PostgreSQL:', err);
});

// Adapter padronizado para PostgreSQL
const db = {
  query: async (text, params = []) => {
    let paramIndex = 1;
    const pgText = text.replace(/\?/g, () => `$${paramIndex++}`);
    const res = await pool.query(pgText, params);
    return res.rows;
  },

  get: async (text, params = []) => {
    let paramIndex = 1;
    const pgText = text.replace(/\?/g, () => `$${paramIndex++}`);
    const res = await pool.query(pgText, params);
    return res.rows[0];
  },

  run: async (text, params = []) => {
    let paramIndex = 1;
    const pgText = text.replace(/\?/g, () => `$${paramIndex++}`);
    
    let finalSql = pgText;
    if (pgText.trim().toUpperCase().startsWith('INSERT INTO') && !pgText.toUpperCase().includes('RETURNING')) {
      finalSql += ' RETURNING id';
    }

    const res = await pool.query(finalSql, params);
    return { 
      lastID: res.rows[0]?.id || null, 
      changes: res.rowCount 
    };
  }
};

let initPromise = null;

async function initTables() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const usersSql = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar TEXT,
        token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const postsSql = `
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const likesSql = `
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const commentsSql = `
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const commentReactionsSql = `
      CREATE TABLE IF NOT EXISTS comment_reactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        emoji VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const notificationsSql = `
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        post_id INTEGER,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const followsSql = `
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      await db.run(usersSql);
      await db.run(postsSql);
      await db.run(likesSql);
      await db.run(commentsSql);
      await db.run(commentReactionsSql);
      await db.run(notificationsSql);
      await db.run(followsSql);
      console.log('Tabelas verificadas/criadas no banco de dados com sucesso.');
    } catch (err) {
      console.error('Erro ao inicializar tabelas:', err);
      throw err;
    }
  })();

  return initPromise;
}

db.init = initTables;
db.init();

module.exports = db;