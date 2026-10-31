const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'kaiowa_chave_secreta_super_segura_123';

const uploadsFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsFolder)) {
    fs.mkdirSync(uploadsFolder);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimeType = allowedTypes.test(file.mimetype);
        if (extName && mimeType) return cb(null, true);
        cb(new Error('Apenas imagens são permitidas!'));
    }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

function autenticarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ erro: 'Token não fornecido!' });

    jwt.verify(token, JWT_SECRET, (err, usuarioDecodificado) => {
        if (err) return res.status(403).json({ erro: 'Token inválido ou expirado!' });
        req.usuario = usuarioDecodificado;
        next();
    });
}

// Opcional para rotas públicas que se adaptam se o usuário estiver logado
function identificarUsuarioOpcional(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, decodificado) => {
            if (!err) req.usuario = decodificado;
            next();
        });
    } else {
        next();
    }
}

// ==========================================
// USUÁRIOS E AUTENTICAÇÃO
// ==========================================

app.post('/users', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ erro: 'Preencha todos os campos!' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`, [username, email, hashedPassword], function(err) {
            if (err) return res.status(400).json({ erro: 'Username ou E-mail já estão em uso.' });
            res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso!', userId: this.lastID, username });
        });
    } catch (error) {
        res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ erro: 'Informe o e-mail e a senha!' });

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) return res.status(401).json({ erro: 'Credenciais inválidas.' });

        const senhaValida = await bcrypt.compare(password, user.password);
        if (!senhaValida) return res.status(401).json({ erro: 'Credenciais inválidas.' });

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ 
            mensagem: 'Login realizado com sucesso!', 
            token, 
            user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar || '' } 
        });
    });
});

app.post('/users/avatar', autenticarToken, upload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Nenhuma imagem enviada!' });

    const avatarUrl = `http://localhost:3000/uploads/${req.file.filename}`;
    db.run(`UPDATE users SET avatar = ? WHERE id = ?`, [avatarUrl, req.usuario.id], function(err) {
        if (err) return res.status(500).json({ erro: 'Erro ao atualizar foto de perfil.' });
        res.json({ mensagem: 'Foto de perfil atualizada!', avatar: avatarUrl });
    });
});

// Alterar Senha (Configurações da Conta)
app.put('/users/password', autenticarToken, async (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) return res.status(400).json({ erro: 'Informe a senha atual e a nova senha.' });

    db.get(`SELECT * FROM users WHERE id = ?`, [req.usuario.id], async (err, user) => {
        if (err || !user) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        const senhaValida = await bcrypt.compare(senhaAtual, user.password);
        if (!senhaValida) return res.status(400).json({ erro: 'A senha atual está incorreta.' });

        const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
        db.run(`UPDATE users SET password = ? WHERE id = ?`, [novaSenhaHash, req.usuario.id], (err) => {
            if (err) return res.status(500).json({ erro: 'Erro ao alterar a senha.' });
            res.json({ mensagem: 'Senha alterada com sucesso!' });
        });
    });
});

// Excluir Conta do Usuário
app.delete('/users/me', autenticarToken, (req, res) => {
    db.run(`DELETE FROM users WHERE id = ?`, [req.usuario.id], function(err) {
        if (err) return res.status(500).json({ erro: 'Erro ao excluir a conta.' });
        res.json({ mensagem: 'Sua conta foi excluída com sucesso.' });
    });
});

// Seguir / Deixar de Seguir (Toggle)
app.post('/users/:id/follow', autenticarToken, (req, res) => {
    const targetUserId = parseInt(req.params.id);
    const followerId = req.usuario.id;

    if (targetUserId === followerId) {
        return res.status(400).json({ erro: 'Você não pode seguir a si mesmo!' });
    }

    db.run(`INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`, [followerId, targetUserId], function(err) {
        if (err) {
            db.run(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`, [followerId, targetUserId], () => {
                return res.json({ mensagem: 'Deixou de seguir!', seguindo: false });
            });
        } else {
            res.status(201).json({ mensagem: 'Seguindo usuário!', seguindo: true });
        }
    });
});

// ==========================================
// POSTS E FEED
// ==========================================

app.post('/posts', autenticarToken, upload.single('image'), (req, res) => {
    const { content } = req.body;
    const imageUrl = req.file ? `http://localhost:3000/uploads/${req.file.filename}` : '';

    if (!content && !imageUrl) {
        return res.status(400).json({ erro: 'O post deve conter texto ou uma imagem!' });
    }

    db.run(`INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)`, [req.usuario.id, content || '', imageUrl], function(err) {
        if (err) return res.status(500).json({ erro: 'Erro ao salvar o post.' });
        res.status(201).json({ mensagem: 'Post publicado!', postId: this.lastID });
    });
});

app.delete('/posts/:id', autenticarToken, (req, res) => {
    db.run(`DELETE FROM posts WHERE id = ? AND user_id = ?`, [req.params.id, req.usuario.id], function(err) {
        if (err) return res.status(500).json({ erro: 'Erro ao deletar post.' });
        if (this.changes === 0) return res.status(403).json({ erro: 'Ação negada!' });
        res.json({ mensagem: 'Post excluído!' });
    });
});

app.get('/posts', identificarUsuarioOpcional, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const usuarioLogadoId = req.usuario ? req.usuario.id : 0;

    const query = `
        SELECT posts.id, posts.user_id, posts.content, posts.image_url, posts.created_at, 
               users.username, users.avatar,
        (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS likes_count,
        (SELECT COUNT(*) FROM reposts WHERE reposts.post_id = posts.id) AS reposts_count,
        (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments_count,
        (SELECT COUNT(*) FROM follows WHERE follows.follower_id = ? AND follows.following_id = posts.user_id) AS is_following
        FROM posts
        JOIN users ON posts.user_id = users.id
        ORDER BY posts.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.all(query, [usuarioLogadoId, limit, offset], (err, rows) => {
        if (err) return res.status(500).json({ erro: 'Erro ao carregar o feed.' });
        res.json({ page, limit, totalPostsPagina: rows.length, posts: rows });
    });
});

// Interações (Curtir, Repostar, Comentar)
app.post('/likes', autenticarToken, (req, res) => {
    const { post_id } = req.body;
    db.run(`INSERT INTO likes (user_id, post_id) VALUES (?, ?)`, [req.usuario.id, post_id], function(err) {
        if (err) {
            db.run(`DELETE FROM likes WHERE user_id = ? AND post_id = ?`, [req.usuario.id, post_id], () => {
                return res.json({ mensagem: 'Curtida removida!' });
            });
        } else {
            res.status(201).json({ mensagem: 'Post curtido!' });
        }
    });
});

app.post('/reposts', autenticarToken, (req, res) => {
    const { post_id } = req.body;
    db.run(`INSERT INTO reposts (user_id, post_id) VALUES (?, ?)`, [req.usuario.id, post_id], function(err) {
        if (err) {
            db.run(`DELETE FROM reposts WHERE user_id = ? AND post_id = ?`, [user_id, post_id], () => {
                return res.json({ mensagem: 'Repost removido!' });
            });
        } else {
            res.status(201).json({ mensagem: 'Post repostado!' });
        }
    });
});

app.get('/posts/:id/comments', (req, res) => {
    const query = `
        SELECT comments.id, comments.content, comments.created_at, users.username, users.avatar 
        FROM comments
        JOIN users ON comments.user_id = users.id
        WHERE comments.post_id = ?
        ORDER BY comments.created_at ASC
    `;
    db.all(query, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ erro: 'Erro ao buscar comentários.' });
        res.json(rows);
    });
});

app.post('/posts/:id/comments', autenticarToken, (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ erro: 'Escreva um comentário!' });

    db.run(`INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)`, [req.usuario.id, req.params.id, content], function(err) {
        if (err) return res.status(500).json({ erro: 'Erro ao salvar comentário.' });
        res.status(201).json({ mensagem: 'Comentário enviado!', commentId: this.lastID, username: req.usuario.username, content });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor da Kaiowá rodando em http://localhost:${PORT}`);
});