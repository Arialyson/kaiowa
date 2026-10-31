const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'kaiowa.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Tabela de utilizadores
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      avatar TEXT,
      token TEXT
    )
  `);

  // Tabela de posts
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      content TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Tabela de seguidores
  db.run(`
    CREATE TABLE IF NOT EXISTS follows (
      follower_id INTEGER,
      following_id INTEGER,
      PRIMARY KEY (follower_id, following_id)
    )
  `);

  // Tabela de curtidas
  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      post_id INTEGER,
      UNIQUE(user_id, post_id)
    )
  `);

  // Tabela de comentários
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      post_id INTEGER,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de reposts
  db.run(`
    CREATE TABLE IF NOT EXISTS reposts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      post_id INTEGER,
      UNIQUE(user_id, post_id)
    )
  `);

  // Tabela de Notificações
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      actor_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      post_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(actor_id) REFERENCES users(id)
    )
  `);
});

module.exports = db;