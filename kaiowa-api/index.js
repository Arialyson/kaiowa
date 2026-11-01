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

// Configuração do CORS aberta para permitir requisições da Vercel
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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
  limits: { fileSize: 50 * 1024 * 1024 }
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

const criarNotificacao = (userId, actorId, type, postId = null) => {
  if (userId === actorId) return;
  const query = 'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)';
  db.run(query, [userId, actorId, type, postId]);
};

// ROTAS DE USUÁRIOS
app.post('/users', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
  }

  const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
  db.run(query, [username.trim(), email.trim(), password], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ erro: 'Nome de usuário ou e-mail já cadastrado.' });
      }
      return res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
    }
    res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso!' });
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ erro: 'Preencha e-mail e senha.' });
  }

  db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email.trim(), password], (err, user) => {
    if (err || !user) {
      return res.status(400).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const token = 'token-' + Date.now() + Math.round(Math.random() * 1000);
    db.run('UPDATE users SET token = ? WHERE id = ?', [token, user.id], (upErr) => {
      if (upErr) return res.status(500).json({ erro: 'Erro ao gerar sessão.' });

      delete user.password;
      user.token = token;
      res.json({ token, user });
    });
  });
});

app.post('/users/avatar', authenticateToken, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Nenhuma imagem enviada.' });

  const hostUrl = `${req.protocol}://${req.get('host')}`;
  const avatarUrl = `${hostUrl}/uploads/${req.file.filename}`;
  db.run('UPDATE users SET avatar = ? WHERE id = ?', [req.user.id], (err) => {
    if (err) return res.status(500).json({ erro: 'Erro ao atualizar avatar.' });
    res.json({ avatar: avatarUrl });
  });
});

app.get('/users/search', authenticateToken, (req, res) => {
  const q = req.query.q || '';
  const query = `
    SELECT id, username, avatar,
    (SELECT COUNT(*) FROM follows WHERE following_id = users.id) AS followers_count,
    EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = users.id) AS is_following
    FROM users
    WHERE username LIKE ? AND id != ?
    LIMIT 10
  `;
  db.all(query, [req.user.id, `%${q}%`, req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao pesquisar usuários.' });
    res.json(rows);
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
    if (err) return res.status(500).json({ erro: 'Erro ao carregar estatísticas.' });
    res.json(row || { followers_count: 0, following_count: 0 });
  });
});

app.post('/users/:id/follow', authenticateToken, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ erro: 'Não pode seguir a si mesmo.' });
  }

  db.get('SELECT * FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, targetId], (err, row) => {
    if (row) {
      db.run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, targetId], () => {
        res.json({ mensagem: 'Deixou de seguir.' });
      });
    } else {
      db.run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [req.user.id, targetId], () => {
        criarNotificacao(targetId, req.user.id, 'follow');
        res.json({ mensagem: 'Seguindo com sucesso.' });
      });
    }
  });
});

app.put('/users/password', authenticateToken, (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  if (req.user.password !== senhaAtual) {
    return res.status(400).json({ erro: 'Senha atual incorreta.' });
  }

  db.run('UPDATE users SET password = ? WHERE id = ?', [novaSenha, req.user.id], (err) => {
    if (err) return res.status(500).json({ erro: 'Erro ao alterar senha.' });
    res.json({ mensagem: 'Senha alterada com sucesso!' });
  });
});

app.delete('/users/me', authenticateToken, (req, res) => {
  db.run('DELETE FROM users WHERE id = ?', [req.user.id], (err) => {
    if (err) return res.status(500).json({ erro: 'Erro ao excluir conta.' });
    res.json({ mensagem: 'Conta excluída.' });
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
    LIMIT 10
  `;
  db.all(query, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao carregar notificações.' });
    res.json(rows || []);
  });
});

app.put('/notifications/read', authenticateToken, (req, res) => {
  db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id], (err) => {
    if (err) return res.status(500).json({ erro: 'Erro ao atualizar notificações.' });
    res.json({ mensagem: 'Notificações marcadas como lidas.' });
  });
});

// ROTAS DE POSTS
app.post('/posts', authenticateToken, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ erro: `Erro no upload: ${err.message}` });

    const content = req.body.content || '';
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = req.file ? `${hostUrl}/uploads/${req.file.filename}` : null;

    if (!content.trim() && !imageUrl) {
      return res.status(400).json({ erro: 'O post precisa de texto ou imagem.' });
    }

    const query = 'INSERT INTO posts (user_id, content, image_url, created_at) VALUES (?, ?, ?, DATETIME("now"))';
    db.run(query, [req.user.id, content, imageUrl], function (dbErr) {
      if (dbErr) return res.status(500).json({ erro: 'Erro ao salvar post.' });
      res.status(201).json({ mensagem: 'Post criado com sucesso!', postId: this.lastID });
    });
  });
});

app.get('/posts', authenticateToken, (req, res) => {
  const query = `
    SELECT posts.*, users.username, users.avatar,
    (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS likes_count,
    (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments_count,
    EXISTS(SELECT 1 FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) AS user_liked,
    EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = posts.user_id) AS is_following
    FROM posts
    JOIN users ON posts.user_id = users.id
    ORDER BY posts.created_at DESC
  `;

  db.all(query, [req.user.id, req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao carregar os posts.' });
    res.json({ posts: rows || [] });
  });
});

app.delete('/posts/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM posts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function (err) {
    if (err || this.changes === 0) return res.status(400).json({ erro: 'Erro ao excluir post.' });
    res.json({ mensagem: 'Post removido.' });
  });
});

// ROTA DE CURTIDAS
app.post('/likes', authenticateToken, (req, res) => {
  const postId = Number(req.body.post_id || req.body.postId);

  if (!postId || isNaN(postId)) {
    return res.status(400).json({ erro: 'ID do post é inválido.' });
  }

  db.get('SELECT * FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, postId], (err, row) => {
    if (err) return res.status(500).json({ erro: 'Erro ao consultar curtidas.' });

    if (row) {
      db.run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, postId], (delErr) => {
        if (delErr) return res.status(500).json({ erro: 'Erro ao remover curtida.' });
        res.json({ mensagem: 'Descurtido' });
      });
    } else {
      db.run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [req.user.id, postId], (insErr) => {
        if (insErr) return res.status(500).json({ erro: 'Erro ao registrar curtida.' });

        db.get('SELECT user_id FROM posts WHERE id = ?', [postId], (pErr, post) => {
          if (post) criarNotificacao(post.user_id, req.user.id, 'like', postId);
        });
        res.json({ mensagem: 'Curtido' });
      });
    }
  });
});

app.get('/posts/:id/comments', (req, res) => {
  const query = `
    SELECT comments.*, users.username, users.avatar,
    (SELECT JSON_GROUP_ARRAY(JSON_OBJECT('emoji', emoji, 'count', cnt))
     FROM (SELECT emoji, COUNT(*) as cnt FROM comment_reactions WHERE comment_id = comments.id GROUP BY emoji)) AS reactions
    FROM comments 
    JOIN users ON comments.user_id = users.id 
    WHERE comments.post_id = ? 
    ORDER BY comments.created_at ASC
  `;
  db.all(query, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao carregar comentários.' });
    const formatted = (rows || []).map((row) => ({
      ...row,
      reactions: row.reactions ? JSON.parse(row.reactions) : []
    }));
    res.json(formatted);
  });
});

app.post('/posts/:id/comments', authenticateToken, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ erro: 'Comentário vazio.' });

  db.run('INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)', [req.user.id, req.params.id, content.trim()], function (err) {
    if (err) return res.status(500).json({ erro: 'Erro ao comentar.' });
    db.get('SELECT user_id FROM posts WHERE id = ?', [req.params.id], (pErr, post) => {
      if (post) criarNotificacao(post.user_id, req.user.id, 'comment', req.params.id);
    });
    res.status(201).json({ mensagem: 'Comentário adicionado!' });
  });
});

app.post('/comments/:id/react', authenticateToken, (req, res) => {
  const { emoji } = req.body;
  const commentId = req.params.id;

  db.get('SELECT * FROM comment_reactions WHERE user_id = ? AND comment_id = ? AND emoji = ?', [req.user.id, commentId, emoji], (err, row) => {
    if (row) {
      db.run('DELETE FROM comment_reactions WHERE id = ?', [row.id], () => res.json({ mensagem: 'Reação removida' }));
    } else {
      db.run('INSERT INTO comment_reactions (user_id, comment_id, emoji) VALUES (?, ?, ?)', [req.user.id, commentId, emoji], () => res.json({ mensagem: 'Reagido' }));
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor kaiowa-api rodando na porta ${PORT}`);
});