const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();

// Garante a existência da pasta de uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve ficheiros estáticos da diretoria uploads
app.use('/uploads', express.static(uploadsDir));

// Configuração do Multer com limite de 50 MB
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

// Middleware de autenticação via Token
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

// Rota de criação de posts
app.post('/posts', authenticateToken, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Erro no upload (Multer):', err);
      return res.status(400).json({ erro: `Erro no upload: ${err.message}` });
    }

    const content = req.body.content || '';
    const imageUrl = req.file ? `http://localhost:3000/uploads/${req.file.filename}` : null;

    if (!content.trim() && !imageUrl) {
      return res.status(400).json({ erro: 'O post precisa de ter texto ou uma imagem.' });
    }

    const query = 'INSERT INTO posts (user_id, content, image_url, created_at) VALUES (?, ?, ?, DATETIME("now"))';
    db.run(query, [req.user.id, content, imageUrl], function (dbErr) {
      if (dbErr) {
        console.error('Erro na base de dados:', dbErr);
        return res.status(500).json({ erro: `Erro na base de dados: ${dbErr.message}` });
      }
      res.status(201).json({ mensagem: 'Post criado com sucesso!', postId: this.lastID });
    });
  });
});

// Rota de listagem de posts
app.get('/posts', authenticateToken, (req, res) => {
  const query = `
    SELECT posts.*, users.username, users.avatar,
    (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS likes_count,
    (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments_count,
    (SELECT COUNT(*) FROM reposts WHERE reposts.post_id = posts.id) AS reposts_count
    FROM posts
    JOIN users ON posts.user_id = users.id
    ORDER BY posts.created_at DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao carregar os posts.' });
    res.json({ posts: rows });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor kaiowa-api a rodar na porta ${PORT}`);
});