const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let pool = null;
let sqliteDb = null;

const isPostgres = !!process.env.DATABASE_URL;

if (isPostgres) {
  // Configuração explícita para evitar falha com caracteres especiais (@) na senha
  pool = new Pool({
    user: 'postgres',
    password: 'Arialyson@1987',
    host: 'db.mzwgvawuvenrouggehpz.supabase.co',
    port: 5432,
    database: 'postgres',
    ssl: {
      rejectUnauthorized: false
    }
  });
  console.log('Conectado ao PostgreSQL (Supabase) via objeto com sucesso.');
} else {
  const dbPath = path.join(__dirname, 'kaiowa.db');
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Erro ao conectar ao SQLite local:', err);
    } else {
      console.log('Conectado ao banco de dados SQLite local.');
    }
  });
}

// Adapter para padronizar chamadas entre pg e sqlite3
const db = {
  query: async (text, params = []) => {
    if (isPostgres) {
      let paramIndex = 1;
      const pgText = text.replace(/\?/g, () => `$${paramIndex++}`);
      const res = await pool.query(pgText, params);
      return res.rows;
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.all(text, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  },

  get: async (text, params = []) => {
    if (isPostgres) {
      let paramIndex = 1;
      const pgText = text.replace(/\?/g, () => `$${paramIndex++}`);
      const res = await pool.query(pgText, params);
      return res.rows[0];
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.get(text, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    }
  },

  run: async (text, params = []) => {
    if (isPostgres) {
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
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.run(text, params, function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    }
  }
};

let initPromise = null;

async function initTables() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const usersSql = isPostgres ? `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar TEXT,
        token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    ` : `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT,
        token TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const postsSql = isPostgres ? `
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    ` : `
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        content TEXT,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
    `;

    const likesSql = isPostgres ? `
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    ` : `
      CREATE TABLE IF NOT EXISTS likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
      );
    `;

    const commentsSql = isPostgres ? `
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    ` : `
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
      );
    `;

    const commentReactionsSql = isPostgres ? `
      CREATE TABLE IF NOT EXISTS comment_reactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        emoji VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    ` : `
      CREATE TABLE IF NOT EXISTS comment_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        comment_id INTEGER NOT NULL,
        emoji TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE
      );
    `;

    const notificationsSql = isPostgres ? `
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        post_id INTEGER,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    ` : `
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        actor_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        post_id INTEGER,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE CASCADE
      );
    `;

    const followsSql = isPostgres ? `
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    ` : `
      CREATE TABLE IF NOT EXISTS follows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        follower_id INTEGER NOT NULL,
        following_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (following_id) REFERENCES users (id) ON DELETE CASCADE
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