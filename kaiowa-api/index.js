const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });

  db.get('SELECT * FROM users WHERE token = ?', [token], (err, user) => {
    if (err || !user) return res.status(403).json({ erro: 'Token inválido ou expirado.' });
    req.user = user;
    next();
  });
};

// Função para registar notificação na BD
const criarNotificacao = (userId, actorId, type, postId = null) => {
  if (parseInt(userId) === parseInt(actorId)) return; // Não gera notificação para si próprio
  const query = 'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)';
  db.run(query, [userId, actorId, type, postId], (err) => {
    if (err) console.error('Erro ao criar notificação:', err);
  });
};

// ROTAS DE AUTENTICAÇÃO E PERFIL
app.post('/users', (req, res) => {
  const { username, email, password } = req.body;
  db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, password], function (err) {
    if (err) return res.status(400).json({ erro: 'Utilizador ou e-mail já existe.' });
    res.status(201).json({ mensagem: 'Conta criada com sucesso!' });
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, user) => {
    if (err || !user) return res.status(400).json({ erro: 'Credenciais inválidas.' });
    const token = 'token-' + Date.now();
    db.run('UPDATE users SET token = ? WHERE id = ?', [token, user.id], () => {
      res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar } });
    });
  });
});

app.post('/users/avatar', authenticateToken, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Nenhum ficheiro enviado.' });
  const avatarUrl = `http://localhost:3000/uploads/${req.file.filename}`;
  db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.id], (err) => {
    if (err) return res.status(500).json({ erro: 'Erro ao atualizar avatar.' });
    res.json({ avatar: avatarUrl });
  });
});

app.get('/users/:id/stats', (req, res) => {
  const userId = req.params.id;
  const query = `
    SELECT 
      (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers_count,
      (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following_count
  `;
  db.get(query, [userId, userId], (err, row) => {
    if (err) return res.status(500).json({ erro: 'Erro ao obter estatísticas.' });
    res.json(row);
  });
});

app.get('/users/search', authenticateToken, (req, res) => {
  const q = req.query.q || '';
  const query = `
    SELECT users.id, users.username, users.avatar,
    (SELECT COUNT(*) FROM follows WHERE follows.following_id = users.id) AS followers_count,
    (SELECT COUNT(*) FROM follows WHERE follows.follower_id = ? AND follows.following_id = users.id) AS is_following
    FROM users
    WHERE users.username LIKE ? AND users.id != ?
    LIMIT 10
  `;
  db.all(query, [req.user.id, `%${q}%`, req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro na busca.' });
    res.json(rows);
  });
});

app.post('/users/:id/follow', authenticateToken, (req, res) => {
  const targetId = parseInt(req.params.id);
  db.get('SELECT * FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, targetId], (err, row) => {
    if (row) {
      db.run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, targetId], () => {
        res.json({ mensagem: 'Deixou de seguir.' });
      });
    } else {
      db.run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [req.user.id, targetId], () => {
        criarNotificacao(targetId, req.user.id, 'follow');
        res.json({ mensagem: 'Começou a seguir.' });
      });
    }
  });
});

app.get('/users/:id/followers', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const query = `
    SELECT users.id, users.username, users.avatar,
    (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = users.id) AS is_following
    FROM follows
    JOIN users ON follows.follower_id = users.id
    WHERE follows.following_id = ?
  `;
  db.all(query, [req.user.id, userId], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao carregar seguidores.' });
    res.json(rows);
  });
});

app.get('/users/:id/following', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const query = `
    SELECT users.id, users.username, users.avatar,
    (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = users.id) AS is_following
    FROM follows
    JOIN users ON follows.following_id = users.id
    WHERE follows.follower_id = ?
  `;
  db.all(query, [req.user.id, userId], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao carregar pessoas seguidas.' });
    res.json(rows);
  });
});

// ROTAS DE POSTS, CURTIDAS E COMENTÁRIOS
app.post('/posts', authenticateToken, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ erro: `Erro no upload: ${err.message}` });

    const content = req.body.content || '';
    const imageUrl = req.file ? `http://localhost:3000/uploads/${req.file.filename}` : null;

    if (!content.trim() && !imageUrl) {
      return res.status(400).json({ erro: 'O post precisa de ter texto ou uma imagem.' });
    }

    const query = 'INSERT INTO posts (user_id, content, image_url, created_at) VALUES (?, ?, ?, DATETIME("now"))';
    db.run(query, [req.user.id, content, imageUrl], function (dbErr) {
      if (dbErr) return res.status(500).json({ erro: `Erro na base de dados: ${dbErr.message}` });
      res.status(201).json({ mensagem: 'Post criado com sucesso!', postId: this.lastID });
    });
  });
});

app.get('/posts', authenticateToken, (req, res) => {
  const query = `
    SELECT posts.*, users.username, users.avatar,
    (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = posts.user_id) AS is_following,
    (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS likes_count,
    (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments_count,
    (SELECT COUNT(*) FROM reposts WHERE reposts.post_id = posts.id) AS reposts_count
    FROM posts
    JOIN users ON posts.user_id = users.id
    ORDER BY posts.created_at DESC
  `;
  db.all(query, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao carregar os posts.' });
    res.json({ posts: rows });
  });
});

app.delete('/posts/:id', authenticateToken, (req, res) => {
  const postId = req.params.id;
  db.run('DELETE FROM posts WHERE id = ? AND user_id = ?', [postId, req.user.id], function (err) {
    if (err || this.changes === 0) return res.status(400).json({ erro: 'Não foi possível excluir o post.' });
    res.json({ mensagem: 'Post excluído com sucesso.' });
  });
});

app.post('/likes', authenticateToken, (req, res) => {
  const { post_id } = req.body;
  db.get('SELECT * FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, post_id], (err, row) => {
    if (row) {
      db.run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, post_id], () => {
        res.json({ mensagem: 'Curtida removida.' });
      });
    } else {
      db.run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [req.user.id, post_id], () => {
        db.get('SELECT user_id FROM posts WHERE id = ?', [post_id], (err, post) => {
          if (post) criarNotificacao(post.user_id, req.user.id, 'like', post_id);
        });
        res.json({ mensagem: 'Post curtido.' });
      });
    }
  });
});

app.get('/posts/:id/comments', (req, res) => {
  const query = `
    SELECT comments.*, users.username, users.avatar
    FROM comments
    JOIN users ON comments.user_id = users.id
    WHERE comments.post_id = ?
    ORDER BY comments.created_at ASC
  `;
  db.all(query, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao carregar comentários.' });
    res.json(rows);
  });
});

app.post('/posts/:id/comments', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const { content } = req.body;
  db.run('INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)', [req.user.id, postId, content], function (err) {
    if (err) return res.status(500).json({ erro: 'Erro ao comentar.' });
    db.get('SELECT user_id FROM posts WHERE id = ?', [postId], (err, post) => {
      if (post) criarNotificacao(post.user_id, req.user.id, 'comment', postId);
    });
    res.status(201).json({ mensagem: 'Comentário enviado!' });
  });
});

app.post('/reposts', authenticateToken, (req, res) => {
  const { post_id } = req.body;
  db.get('SELECT * FROM reposts WHERE user_id = ? AND post_id = ?', [req.user.id, post_id], (err, row) => {
    if (row) {
      db.run('DELETE FROM reposts WHERE user_id = ? AND post_id = ?', [req.user.id, post_id], () => {
        res.json({ mensagem: 'Repost removido.' });
      });
    } else {
      db.run('INSERT INTO reposts (user_id, post_id) VALUES (?, ?)', [req.user.id, post_id], () => {
        res.json({ mensagem: 'Post repostado.' });
      });
    }
  });
});

// ROTAS DE NOTIFICAÇÕES
app.get('/notifications', authenticateToken, (req, res) => {
  const query = `
    SELECT notifications.*, users.username AS actor_username, users.avatar AS actor_avatar
    FROM notifications
    JOIN users ON notifications.actor_id = users.id
    WHERE notifications.user_id = ?
    ORDER BY notifications.created_at DESC
    LIMIT 20
  `;
  db.all(query, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao carregar notificações.' });
    res.json(rows);
  });
});

app.put('/notifications/read', authenticateToken, (req, res) => {
  db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id], (err) => {
    if (err) return res.status(500).json({ erro: 'Erro ao atualizar notificações.' });
    res.json({ mensagem: 'Notificações lidas.' });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor kaiowa-api a rodar na porta ${PORT}`);
});