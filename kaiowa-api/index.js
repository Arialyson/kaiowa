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

// Middleware para garantir a criação das tabelas antes das rotas
app.use(async (req, res, next) => {
  try {
    await db.init();
    next();
  } catch (err) {
    console.error('Erro no middleware de DB:', err);
    res.status(500).json({ erro: 'Erro de conexão com o banco de dados.' });
  }
});

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

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });

  try {
    const user = await db.get('SELECT * FROM users WHERE token = ?', [token]);
    if (!user) return res.status(403).json({ erro: 'Token inválido ou expirado.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ erro: 'Erro na autenticação.' });
  }
};

const criarNotificacao = async (userId, actorId, type, postId = null) => {
  if (userId === actorId) return;
  const query = 'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)';
  try {
    await db.run(query, [userId, actorId, type, postId]);
  } catch (err) {
    console.error('Erro ao criar notificação:', err);
  }
};

// ROTAS DE USUÁRIOS
app.post('/users', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
  }

  const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
  try {
    await db.run(query, [username.trim(), email.trim(), password]);
    res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso!' });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    if (err.message && (err.message.includes('UNIQUE') || err.message.includes('unique') || err.code === '23505')) {
      return res.status(400).json({ erro: 'Nome de usuário ou e-mail já cadastrado.' });
    }
    res.status(500).json({ erro: `Erro ao cadastrar: ${err.message}` });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ erro: 'Preencha e-mail e senha.' });
  }

  try {
    const user = await db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email.trim(), password]);
    if (!user) {
      return res.status(400).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const token = 'token-' + Date.now() + Math.round(Math.random() * 1000);
    await db.run('UPDATE users SET token = ? WHERE id = ?', [token, user.id]);

    delete user.password;
    user.token = token;
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar sessão.' });
  }
});

app.post('/users/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Nenhuma imagem enviada.' });

  const hostUrl = `${req.protocol}://${req.get('host')}`;
  const avatarUrl = `${hostUrl}/uploads/${req.file.filename}`;
  
  try {
    await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.id]);
    res.json({ avatar: avatarUrl });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar avatar.' });
  }
});

app.get('/users/search', authenticateToken, async (req, res) => {
  const q = req.query.q || '';
  const query = `
    SELECT id, username, avatar,
    (SELECT COUNT(*) FROM follows WHERE following_id = users.id) AS followers_count,
    EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = users.id) AS is_following
    FROM users
    WHERE username LIKE ? AND id != ?
    LIMIT 10
  `;
  try {
    const rows = await db.query(query, [req.user.id, `%${q}%`, req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao pesquisar usuários.' });
  }
});

app.get('/users/:id/stats', async (req, res) => {
  const userId = req.params.id;
  const query = `
    SELECT 
      (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers_count,
      (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following_count
  `;
  try {
    const row = await db.get(query, [userId, userId]);
    res.json(row || { followers_count: 0, following_count: 0 });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao carregar estatísticas.' });
  }
});

app.post('/users/:id/follow', authenticateToken, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ erro: 'Não pode seguir a si mesmo.' });
  }

  try {
    const row = await db.get('SELECT * FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, targetId]);
    if (row) {
      await db.run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, targetId]);
      res.json({ mensagem: 'Deixou de seguir.' });
    } else {
      await db.run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [req.user.id, targetId]);
      await criarNotificacao(targetId, req.user.id, 'follow');
      res.json({ mensagem: 'Seguindo com sucesso.' });
    }
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao processar ação de seguir.' });
  }
});

app.put('/users/password', authenticateToken, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  if (req.user.password !== senhaAtual) {
    return res.status(400).json({ erro: 'Senha atual incorreta.' });
  }

  try {
    await db.run('UPDATE users SET password = ? WHERE id = ?', [novaSenha, req.user.id]);
    res.json({ mensagem: 'Senha alterada com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao alterar senha.' });
  }
});

app.delete('/users/me', authenticateToken, async (req, res) => {
  try {
    await db.run('DELETE FROM users WHERE id = ?', [req.user.id]);
    res.json({ mensagem: 'Conta excluída.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir conta.' });
  }
});

// ROTAS DE NOTIFICAÇÕES
app.get('/notifications', authenticateToken, async (req, res) => {
  const query = `
    SELECT notifications.*, users.username AS actor_username, users.avatar AS actor_avatar
    FROM notifications
    JOIN users ON notifications.actor_id = users.id
    WHERE notifications.user_id = ?
    ORDER BY notifications.created_at DESC
    LIMIT 10
  `;
  try {
    const rows = await db.query(query, [req.user.id]);
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao carregar notificações.' });
  }
});

app.put('/notifications/read', authenticateToken, async (req, res) => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ mensagem: 'Notificações marcadas como lidas.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar notificações.' });
  }
});

// ROTAS DE POSTS
app.post('/posts', authenticateToken, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ erro: `Erro no upload: ${err.message}` });

    const content = req.body.content || '';
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = req.file ? `${hostUrl}/uploads/${req.file.filename}` : null;

    if (!content.trim() && !imageUrl) {
      return res.status(400).json({ erro: 'O post precisa de texto ou imagem.' });
    }

    const query = 'INSERT INTO posts (user_id, content, image_url, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)';
    try {
      const result = await db.run(query, [req.user.id, content, imageUrl]);
      res.status(201).json({ mensagem: 'Post criado com sucesso!', postId: result.lastID });
    } catch (dbErr) {
      res.status(500).json({ erro: 'Erro ao salvar post.' });
    }
  });
});

app.get('/posts', authenticateToken, async (req, res) => {
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
  try {
    const rows = await db.query(query, [req.user.id, req.user.id]);
    res.json({ posts: rows || [] });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao carregar os posts.' });
  }
});

app.delete('/posts/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.run('DELETE FROM posts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (result.changes === 0) return res.status(400).json({ erro: 'Erro ao excluir post.' });
    res.json({ mensagem: 'Post removido.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir post.' });
  }
});

// ROTA DE CURTIDAS
app.post('/likes', authenticateToken, async (req, res) => {
  const postId = Number(req.body.post_id || req.body.postId);

  if (!postId || isNaN(postId)) {
    return res.status(400).json({ erro: 'ID do post é inválido.' });
  }

  try {
    const row = await db.get('SELECT * FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, postId]);
    if (row) {
      await db.run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, postId]);
      res.json({ mensagem: 'Descurtido' });
    } else {
      await db.run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [req.user.id, postId]);
      const post = await db.get('SELECT user_id FROM posts WHERE id = ?', [postId]);
      if (post) await criarNotificacao(post.user_id, req.user.id, 'like', postId);
      res.json({ mensagem: 'Curtido' });
    }
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao processar curtida.' });
  }
});

app.get('/posts/:id/comments', async (req, res) => {
  const query = `
    SELECT comments.*, users.username, users.avatar 
    FROM comments 
    JOIN users ON comments.user_id = users.id 
    WHERE comments.post_id = ? 
    ORDER BY comments.created_at ASC
  `;
  try {
    const comments = await db.query(query, [req.params.id]);
    
    const formatted = await Promise.all((comments || []).map(async (comment) => {
      const reactions = await db.query(
        'SELECT emoji, COUNT(*) as count FROM comment_reactions WHERE comment_id = ? GROUP BY emoji',
        [comment.id]
      );
      return {
        ...comment,
        reactions: reactions || []
      };
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao carregar comentários.' });
  }
});

app.post('/posts/:id/comments', authenticateToken, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ erro: 'Comentário vazio.' });

  try {
    await db.run('INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)', [req.user.id, req.params.id, content.trim()]);
    const post = await db.get('SELECT user_id FROM posts WHERE id = ?', [req.params.id]);
    if (post) await criarNotificacao(post.user_id, req.user.id, 'comment', req.params.id);
    res.status(201).json({ mensagem: 'Comentário adicionado!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao comentar.' });
  }
});

app.post('/comments/:id/react', authenticateToken, async (req, res) => {
  const { emoji } = req.body;
  const commentId = req.params.id;

  try {
    const row = await db.get('SELECT * FROM comment_reactions WHERE user_id = ? AND comment_id = ? AND emoji = ?', [req.user.id, commentId, emoji]);
    if (row) {
      await db.run('DELETE FROM comment_reactions WHERE id = ?', [row.id]);
      res.json({ mensagem: 'Reação removida' });
    } else {
      await db.run('INSERT INTO comment_reactions (user_id, comment_id, emoji) VALUES (?, ?, ?)', [req.user.id, commentId, emoji]);
      res.json({ mensagem: 'Reagido' });
    }
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao processar reação.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor kaiowa-api rodando na porta ${PORT}`);
});