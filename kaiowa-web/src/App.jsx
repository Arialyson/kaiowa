import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:3000';
const DEFAULT_AVATAR = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [usuario, setUsuario] = useState(JSON.parse(localStorage.getItem('usuario')) || null);
  const [isRegister, setIsRegister] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');

  const [posts, setPosts] = useState([]);
  const [novoPost, setNovoPost] = useState('');
  const [imagemPost, setImagemPost] = useState(null);
  const [previewImagem, setPreviewImagem] = useState('');

  const [comentarioAberto, setComentarioAberto] = useState(null);
  const [comentarios, setComentarios] = useState({});
  const [novoComentario, setNovoComentario] = useState('');

  useEffect(() => {
    carregarPosts();
  }, []);

  const carregarPosts = async () => {
    try {
      const res = await axios.get(`${API_URL}/posts?page=1&limit=20`);
      setPosts(res.data.posts);
    } catch (err) {
      console.error('Erro ao carregar posts:', err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      if (isRegister) {
        await axios.post(`${API_URL}/users`, { username: username.trim(), email: email.trim(), password });
        setIsRegister(false);
        alert('Conta criada com sucesso! Faça login.');
      } else {
        const res = await axios.post(`${API_URL}/login`, { email: email.trim(), password });
        setToken(res.data.token);
        setUsuario(res.data.user);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('usuario', JSON.stringify(res.data.user));
      }
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro na operação.');
    }
  };

  const handleLogout = () => {
    setToken('');
    setUsuario(null);
    localStorage.clear();
  };

  // Upload de Foto de Perfil
  const handleUploadAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await axios.post(`${API_URL}/users/avatar`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const usuarioAtualizado = { ...usuario, avatar: res.data.avatar };
      setUsuario(usuarioAtualizado);
      localStorage.setItem('usuario', JSON.stringify(usuarioAtualizado));
      alert('Foto de perfil atualizada!');
      carregarPosts();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao atualizar foto de perfil.');
    }
  };

  // Excluir Conta do Usuário
  const handleExcluirConta = async () => {
    const confirmacao = window.confirm(
      'ATENÇÃO: Você tem certeza que deseja excluir sua conta? Todas as suas postagens e dados serão deletados permanentemente.'
    );
    if (!confirmacao) return;

    try {
      await axios.delete(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Sua conta foi excluída com sucesso.');
      handleLogout();
      carregarPosts();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao excluir conta.');
    }
  };

  // Manipular imagem anexada ao Post
  const handleImagemPostChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImagemPost(file);
      setPreviewImagem(URL.createObjectURL(file));
    }
  };

  // Criar Post com Texto e/ou Imagem
  const handleCriarPost = async (e) => {
    e.preventDefault();
    if (!novoPost.trim() && !imagemPost) return;

    const formData = new FormData();
    formData.append('content', novoPost);
    if (imagemPost) {
      formData.append('image', imagemPost);
    }

    try {
      await axios.post(`${API_URL}/posts`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setNovoPost('');
      setImagemPost(null);
      setPreviewImagem('');
      carregarPosts();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao publicar.');
    }
  };

  const handleCurtir = async (postId) => {
    if (!token) return alert('Faça login!');
    try {
      await axios.post(`${API_URL}/likes`, { post_id: postId }, { headers: { Authorization: `Bearer ${token}` } });
      carregarPosts();
    } catch (err) {
      alert('Erro ao curtir.');
    }
  };

  const handleRepostar = async (postId) => {
    if (!token) return alert('Faça login!');
    try {
      await axios.post(`${API_URL}/reposts`, { post_id: postId }, { headers: { Authorization: `Bearer ${token}` } });
      carregarPosts();
    } catch (err) {
      alert('Erro ao repostar.');
    }
  };

  const toggleComentarios = async (postId) => {
    if (comentarioAberto === postId) {
      setComentarioAberto(null);
    } else {
      setComentarioAberto(postId);
      const res = await axios.get(`${API_URL}/posts/${postId}/comments`);
      setComentarios((prev) => ({ ...prev, [postId]: res.data }));
    }
  };

  const handleEnviarComentario = async (postId) => {
    if (!token) return alert('Faça login!');
    if (!novoComentario.trim()) return;

    try {
      await axios.post(
        `${API_URL}/posts/${postId}/comments`,
        { content: novoComentario },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNovoComentario('');
      toggleComentarios(postId);
      carregarPosts();
    } catch (err) {
      alert('Erro ao enviar comentário.');
    }
  };

  const handleDeletarPost = async (postId) => {
    if (!window.confirm('Excluir este post?')) return;
    try {
      await axios.delete(`${API_URL}/posts/${postId}`, { headers: { Authorization: `Bearer ${token}` } });
      carregarPosts();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao deletar.');
    }
  };

  return (
    <div className="kaiowa-app-wrapper">
      <div className="kaiowa-container">
        <header className="kaiowa-header">
          <div className="logo-area">
            <h1>Kaiowá</h1>
          </div>
          {usuario && (
            <div className="user-profile-bar">
              <label htmlFor="avatar-upload" className="avatar-label" title="Clique para alterar a foto de perfil">
                <img src={usuario.avatar || DEFAULT_AVATAR} alt="Avatar" className="user-avatar-header" />
                <span className="avatar-overlay">📷</span>
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleUploadAvatar}
                style={{ display: 'none' }}
              />
              <span className="user-name">@{usuario.username}</span>
              <button onClick={handleLogout} className="btn-logout">Sair</button>
              <button onClick={handleExcluirConta} className="btn-delete-account" title="Excluir minha conta">
                🗑️ Conta
              </button>
            </div>
          )}
        </header>

        <main className="kaiowa-main">
          {!token ? (
            <div className="auth-box">
              <h2>{isRegister ? 'Criar Conta' : 'Entrar na Kaiowá'}</h2>
              {erro && <div className="error-message">{erro}</div>}
              <form onSubmit={handleAuth}>
                {isRegister && (
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                )}
                <input
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="submit" className="btn-primary">
                  {isRegister ? 'Cadastrar' : 'Entrar'}
                </button>
              </form>
              <button onClick={() => setIsRegister(!isRegister)} className="btn-toggle">
                {isRegister ? 'Já tem conta? Entre.' : 'Não tem conta? Cadastre-se.'}
              </button>
            </div>
          ) : (
            <div className="post-create-box">
              <form onSubmit={handleCriarPost}>
                <div className="post-input-wrapper">
                  <img src={usuario.avatar || DEFAULT_AVATAR} alt="Avatar" className="user-avatar-post" />
                  <textarea
                    placeholder="O que está acontecendo?"
                    value={novoPost}
                    onChange={(e) => setNovoPost(e.target.value)}
                    rows="3"
                  />
                </div>

                {previewImagem && (
                  <div className="image-preview-container">
                    <img src={previewImagem} alt="Pré-visualização" className="image-preview" />
                    <button
                      type="button"
                      className="btn-remove-preview"
                      onClick={() => { setImagemPost(null); setPreviewImagem(''); }}
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="post-form-footer">
                  <label htmlFor="post-image-upload" className="btn-attach-image">
                    🖼️ Foto
                  </label>
                  <input
                    id="post-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImagemPostChange}
                    style={{ display: 'none' }}
                  />
                  <button type="submit" className="btn-primary">Publicar</button>
                </div>
              </form>
            </div>
          )}

          <div className="feed-container">
            <h3>Feed da Kaiowá</h3>
            {posts.map((post) => (
              <div key={post.id} className="post-card">
                <div className="post-card-header">
                  <img src={post.avatar || DEFAULT_AVATAR} alt="Avatar" className="post-avatar" />
                  <div className="post-user-info">
                    <strong>@{post.username}</strong>
                    <small>{new Date(post.created_at).toLocaleDateString()}</small>
                  </div>
                </div>

                {post.content && <p className="post-content">{post.content}</p>}

                {post.image_url && (
                  <div className="post-media">
                    <img src={post.image_url} alt="Mídia do post" className="post-image" />
                  </div>
                )}

                <div className="post-actions">
                  <button onClick={() => handleCurtir(post.id)}>❤️ {post.likes_count || 0}</button>
                  <button onClick={() => handleRepostar(post.id)}>🔄 {post.reposts_count || 0}</button>
                  <button onClick={() => toggleComentarios(post.id)}>💬 {post.comments_count || 0}</button>

                  {usuario && usuario.username === post.username && (
                    <button onClick={() => handleDeletarPost(post.id)} className="btn-delete">🗑️</button>
                  )}
                </div>

                {comentarioAberto === post.id && (
                  <div className="comments-section">
                    <div className="comments-list">
                      {(comentarios[post.id] || []).map((c) => (
                        <div key={c.id} className="comment-item">
                          <img src={c.avatar || DEFAULT_AVATAR} alt="Avatar" className="comment-avatar" />
                          <div className="comment-body">
                            <strong>@{c.username}</strong>
                            <p>{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {token && (
                      <div className="comment-input-box">
                        <input
                          type="text"
                          placeholder="Escreva um comentário..."
                          value={novoComentario}
                          onChange={(e) => setNovoComentario(e.target.value)}
                        />
                        <button onClick={() => handleEnviarComentario(post.id)}>Responder</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;