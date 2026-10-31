import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:3000';
const DEFAULT_AVATAR = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [usuario, setUsuario] = useState(JSON.parse(localStorage.getItem('usuario')) || null);
  const [isRegister, setIsRegister] = useState(false);

  const [userStats, setUserStats] = useState({ followers_count: 0, following_count: 0 });

  const [modalFollowType, setModalFollowType] = useState(null);
  const [listaUsuariosModal, setListaUsuariosModal] = useState([]);

  const [termoBusca, setTermoBusca] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState([]);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');

  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [msgConfig, setMsgConfig] = useState('');

  const [posts, setPosts] = useState([]);
  const [novoPost, setNovoPost] = useState('');
  const [imagemPost, setImagemPost] = useState(null);
  const [previewImagem, setPreviewImagem] = useState('');

  const [comentarioAberto, setComentarioAberto] = useState(null);
  const [comentarios, setComentarios] = useState({});
  const [novoComentario, setNovoComentario] = useState('');

  useEffect(() => {
    if (token) {
      carregarPosts();
      if (usuario && usuario.id) {
        carregarEstatisticas(usuario.id);
      }
    } else {
      setPosts([]);
    }
  }, [token]);

  const carregarPosts = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/posts?page=1&limit=20`, { headers });
      setPosts(res.data.posts);
    } catch (err) {
      console.error('Erro ao carregar posts:', err);
    }
  };

  const carregarEstatisticas = async (userId) => {
    if (!userId) return;
    try {
      const res = await axios.get(`${API_URL}/users/${userId}/stats`);
      setUserStats(res.data);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  };

  const execBuscarUsuarios = async (query) => {
    if (!query || query.trim().length === 0) {
      setResultadosBusca([]);
      return;
    }
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_URL}/users/search?q=${encodeURIComponent(query.trim())}`, { headers });
      setResultadosBusca(res.data);
    } catch (err) {
      console.error('Erro ao buscar utilizadores:', err);
    }
  };

  const handleFormBusca = (e) => {
    e.preventDefault();
    execBuscarUsuarios(termoBusca);
  };

  const handleInputBusca = (e) => {
    const val = e.target.value;
    setTermoBusca(val);
    if (val.trim().length === 0) {
      setResultadosBusca([]);
    } else {
      execBuscarUsuarios(val);
    }
  };

  const handleAbrirModalFollowers = async (tipo) => {
    if (!usuario) return;
    setModalFollowType(tipo);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_URL}/users/${usuario.id}/${tipo}`, { headers });
      setListaUsuariosModal(res.data);
    } catch (err) {
      console.error('Erro ao buscar lista do modal:', err);
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
        carregarEstatisticas(res.data.user.id);
      }
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro na operação.');
    }
  };

  const handleLogout = () => {
    setToken('');
    setUsuario(null);
    setMostrarConfig(false);
    setResultadosBusca([]);
    setTermoBusca('');
    setModalFollowType(null);
    setPosts([]);
    localStorage.clear();
  };

  const handleUploadAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await axios.post(`${API_URL}/users/avatar`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      const usuarioAtualizado = { ...usuario, avatar: res.data.avatar };
      setUsuario(usuarioAtualizado);
      localStorage.setItem('usuario', JSON.stringify(usuarioAtualizado));
      alert('Foto de perfil atualizada!');
      carregarPosts();
    } catch (err) {
      alert('Erro ao atualizar avatar.');
    }
  };

  const handleAlterarSenha = async (e) => {
    e.preventDefault();
    setMsgConfig('');
    try {
      const res = await axios.put(
        `${API_URL}/users/password`,
        { senhaAtual, novaSenha },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMsgConfig(res.data.mensagem);
      setSenhaAtual('');
      setNovaSenha('');
    } catch (err) {
      setMsgConfig(err.response?.data?.erro || 'Erro ao alterar senha.');
    }
  };

  const handleExcluirConta = async () => {
    const confirmacao = window.confirm(
      'ATENÇÃO: Deseja realmente excluir sua conta? Todas as suas postagens serão deletadas permanentemente.'
    );
    if (!confirmacao) return;

    try {
      await axios.delete(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Sua conta foi excluída.');
      handleLogout();
    } catch (err) {
      alert('Erro ao excluir conta.');
    }
  };

  const handleSeguir = async (targetUserId) => {
    if (!token) return alert('Faça login para seguir usuários!');
    try {
      await axios.post(
        `${API_URL}/users/${targetUserId}/follow`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await carregarPosts();
      if (usuario && usuario.id) await carregarEstatisticas(usuario.id);

      if (termoBusca) execBuscarUsuarios(termoBusca);
      if (modalFollowType) handleAbrirModalFollowers(modalFollowType);
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao seguir.');
    }
  };

  const handleCriarPost = async (e) => {
    e.preventDefault();
    if (!novoPost.trim() && !imagemPost) return;

    const formData = new FormData();
    formData.append('content', novoPost);
    if (imagemPost) formData.append('image', imagemPost);

    try {
      await axios.post(`${API_URL}/posts`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setNovoPost('');
      setImagemPost(null);
      setPreviewImagem('');
      carregarPosts();
    } catch (err) {
      alert('Erro ao publicar post.');
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

  const handleKeyDownComentario = (e, postId) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviarComentario(postId);
    }
  };

  const handleDeletarPost = async (postId) => {
    if (!window.confirm('Excluir este post?')) return;
    try {
      await axios.delete(`${API_URL}/posts/${postId}`, { headers: { Authorization: `Bearer ${token}` } });
      carregarPosts();
    } catch (err) {
      alert('Erro ao deletar post.');
    }
  };

  return (
    <div className="kaiowa-app-wrapper">
      <div className="kaiowa-container">
        <header className="kaiowa-header">
          <div className="logo-area">
            <img src="/logo-vazado.png" alt="Kaiowá Logo" className="kaiowa-logo-header" />
          </div>
          {usuario && (
            <div className="user-profile-bar">
              <label htmlFor="avatar-upload" className="avatar-label" title="Alterar foto de perfil">
                <img src={usuario.avatar || DEFAULT_AVATAR} alt="Avatar" className="user-avatar-header" />
                <span className="avatar-overlay">📷</span>
              </label>
              <input id="avatar-upload" type="file" accept="image/*" onChange={handleUploadAvatar} style={{ display: 'none' }} />
              
              <span className="user-name">@{usuario.username}</span>
              <button onClick={() => setMostrarConfig(!mostrarConfig)} className="btn-icon" title="Configurações">⚙️</button>
              <button onClick={handleLogout} className="btn-logout">Sair</button>
            </div>
          )}
        </header>

        {mostrarConfig && (
          <div className="settings-modal">
            <div className="settings-header">
              <h3>⚙️ Configurações da Conta</h3>
              <button onClick={() => setMostrarConfig(false)} className="btn-close">✕</button>
            </div>

            {msgConfig && <div className="info-message">{msgConfig}</div>}

            <form onSubmit={handleAlterarSenha} className="settings-form">
              <h4>Trocar Senha</h4>
              <input
                type="password"
                placeholder="Senha Atual"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Nova Senha"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary">Atualizar Senha</button>
            </form>

            <div className="danger-zone">
              <h4>Zona de Perigo</h4>
              <button onClick={handleExcluirConta} className="btn-delete-account">
                🗑️ Excluir Minha Conta
              </button>
            </div>
          </div>
        )}

        {modalFollowType && (
          <div className="settings-modal">
            <div className="settings-header">
              <h3>{modalFollowType === 'following' ? '👥 Pessoas que Você Segue' : '👥 Seus Seguidores'}</h3>
              <button onClick={() => setModalFollowType(null)} className="btn-close">✕</button>
            </div>
            <div className="search-results-list">
              {listaUsuariosModal.length === 0 ? (
                <p style={{ color: '#a8e0a3', fontSize: '13px' }}>Nenhum utilizador encontrado.</p>
              ) : (
                listaUsuariosModal.map((u) => (
                  <div key={u.id} className="search-user-item">
                    <div className="user-info">
                      <img src={u.avatar || DEFAULT_AVATAR} alt="Avatar" className="comment-avatar" />
                      <strong>@{u.username}</strong>
                    </div>
                    {usuario && usuario.id !== u.id && (
                      <button
                        onClick={() => handleSeguir(u.id)}
                        className={u.is_following ? 'btn-following' : 'btn-follow'}
                      >
                        {u.is_following ? 'Seguindo' : '+ Seguir'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <main className="kaiowa-main">
          {usuario && (
            <div className="profile-summary-card">
              <div className="stats-box">
                <span onClick={() => handleAbrirModalFollowers('following')} className="clickable-stat">
                  <strong>{userStats.following_count}</strong> Seguindo
                </span>
                <span onClick={() => handleAbrirModalFollowers('followers')} className="clickable-stat">
                  <strong>{userStats.followers_count}</strong> Seguidores
                </span>
              </div>

              <form onSubmit={handleFormBusca} className="search-user-box">
                <input
                  type="text"
                  placeholder="Procurar utilizadores..."
                  value={termoBusca}
                  onChange={handleInputBusca}
                />
                <button type="submit" className="btn-search">
                  🔍 Buscar
                </button>
              </form>

              {resultadosBusca.length > 0 && (
                <div className="search-results-list">
                  {resultadosBusca.map((u) => (
                    <div key={u.id} className="search-user-item">
                      <div className="user-info">
                        <img src={u.avatar || DEFAULT_AVATAR} alt="Avatar" className="comment-avatar" />
                        <div>
                          <strong>@{u.username}</strong>
                          <small>{u.followers_count} seguidores</small>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSeguir(u.id)}
                        className={u.is_following ? 'btn-following' : 'btn-follow'}
                      >
                        {u.is_following ? 'Seguindo' : '+ Seguir'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!token ? (
            <div className="auth-box">
              <h2>{isRegister ? 'Criar Conta' : 'Entrar na Kaiowá'}</h2>
              {erro && <div className="error-message">{erro}</div>}
              <form onSubmit={handleAuth}>
                {isRegister && (
                  <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                )}
                <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="submit" className="btn-primary">{isRegister ? 'Cadastrar' : 'Entrar'}</button>
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
                    <button type="button" className="btn-remove-preview" onClick={() => { setImagemPost(null); setPreviewImagem(''); }}>✕</button>
                  </div>
                )}

                <div className="post-form-footer">
                  <label htmlFor="post-image-upload" className="btn-attach-image">🖼️ Foto</label>
                  <input id="post-image-upload" type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) { setImagemPost(file); setPreviewImagem(URL.createObjectURL(file)); }
                  }} style={{ display: 'none' }} />
                  <button type="submit" className="btn-primary">Publicar</button>
                </div>
              </form>
            </div>
          )}

          <div className="feed-container">
            <h3>Feed da Kaiowá</h3>
            {!token ? (
              <div className="login-required-card">
                🔒 <strong>Conteúdo Exclusivo da Comunidade</strong>
                <p>Faça login ou crie sua conta para ver as publicações do feed.</p>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="post-card">
                  <div className="post-card-header">
                    <img src={post.avatar || DEFAULT_AVATAR} alt="Avatar" className="post-avatar" />
                    <div className="post-user-info">
                      <div className="user-follow-line">
                        <strong>@{post.username}</strong>
                        {usuario && usuario.id !== post.user_id && (
                          <button
                            onClick={() => handleSeguir(post.user_id)}
                            className={post.is_following ? 'btn-following' : 'btn-follow'}
                          >
                            {post.is_following ? 'Seguindo' : '+ Seguir'}
                          </button>
                        )}
                      </div>
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
                            placeholder="Escreva um comentário e pressione Enter..."
                            value={novoComentario}
                            onChange={(e) => setNovoComentario(e.target.value)}
                            onKeyDown={(e) => handleKeyDownComentario(e, post.id)}
                          />
                          <button onClick={() => handleEnviarComentario(post.id)}>Responder</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;