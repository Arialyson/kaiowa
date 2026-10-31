const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'kaiowa_chave_secreta_super_segura_123';

app.use(cors());
app.use(express.json());

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
        res.json({ mensagem: 'Login realizado com sucesso!', token, user: { id: user.id, username: user.username, email: user.email } });
    });
});

// ==========================================
// POSTS & FEED (Com contadores de Likes, Reposts e Comentários)
// ==========================================

app.post('/posts', autenticarToken, (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ erro: 'Informe o conteúdo do post!' });

    db.run(`INSERT INTO posts (user_id, content) VALUES (?, ?)`, [req.usuario.id, content], function(err) {
        if (err) return res.status(500).json({ erro: 'Erro ao salvar o post.' });
        res.status(201).json({ mensagem: 'Post publicado!', postId: this.lastID, autor: req.usuario.username, content });
    });
});

app.delete('/posts/:id', autenticarToken, (req, res) => {
    db.run(`DELETE FROM posts WHERE id = ? AND user_id = ?`, [req.params.id, req.usuario.id], function(err) {
        if (err) return res.status(500).json({ erro: 'Erro ao deletar post.' });
        if (this.changes === 0) return res.status(403).json({ erro: 'Ação negada!' });
        res.json({ mensagem: 'Post excluído!' });
    });
});

app.get('/posts', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const query = `
        SELECT posts.id, posts.content, posts.created_at, users.username,
        (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS likes_count,
        (SELECT COUNT(*) FROM reposts WHERE reposts.post_id = posts.id) AS reposts_count,
        (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments_count
        FROM posts
        JOIN users ON posts.user_id = users.id
        ORDER BY posts.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.all(query, [limit, offset], (err, rows) => {
        if (err) return res.status(500).json({ erro: 'Erro ao carregar o feed.' });
        res.json({ page, limit, totalPostsPagina: rows.length, posts: rows });
    });
});

// ==========================================
// INTERAÇÕES: CURTIR, REPOSTAR, COMENTAR
// ==========================================

// Curtir / Descurtir (Toggle)
app.post('/likes', autenticarToken, (req, res) => {
    const { post_id } = req.body;
    const user_id = req.usuario.id;

    db.run(`INSERT INTO likes (user_id, post_id) VALUES (?, ?)`, [user_id, post_id], function(err) {
        if (err) {
            // Se já curtiu, descurte
            db.run(`DELETE FROM likes WHERE user_id = ? AND post_id = ?`, [user_id, post_id], () => {
                return res.json({ mensagem: 'Curtida removida!' });
            });
        } else {
            res.status(201).json({ mensagem: 'Post curtido!' });
        }
    });
});

// Repostar / Desfazer Repost (Toggle)
app.post('/reposts', autenticarToken, (req, res) => {
    const { post_id } = req.body;
    const user_id = req.usuario.id;

    db.run(`INSERT INTO reposts (user_id, post_id) VALUES (?, ?)`, [user_id, post_id], function(err) {
        if (err) {
            db.run(`DELETE FROM reposts WHERE user_id = ? AND post_id = ?`, [user_id, post_id], () => {
                return res.json({ mensagem: 'Repost removido!' });
            });
        } else {
            res.status(201).json({ mensagem: 'Post repostado!' });
        }
    });
});

// Buscar comentários de um post
app.get('/posts/:id/comments', (req, res) => {
    const query = `
        SELECT comments.id, comments.content, comments.created_at, users.username 
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

// Adicionar Comentário
app.post('/posts/:id/comments', autenticarToken, (req, res) => {
    const { content } = req.body;
    const post_id = req.params.id;
    const user_id = req.usuario.id;

    if (!content) return res.status(400).json({ erro: 'Escreva um comentário!' });

    db.run(`INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)`, [user_id, post_id, content], function(err) {
        if (err) return res.status(500).json({ erro: 'Erro ao salvar comentário.' });
        res.status(201).json({ mensagem: 'Comentário enviado!', commentId: this.lastID, username: req.usuario.username, content });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor da Kaiowá rodando em http://localhost:${PORT}`);
});