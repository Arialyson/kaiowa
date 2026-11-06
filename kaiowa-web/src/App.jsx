import React, { useState, useEffect } from 'react';
import axios from 'axios';
import heic2any from 'heic2any';
import EmojiPicker from 'emoji-picker-react';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const DEFAULT_AVATAR = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png';

const MAX_CHAR_COUNT = 280;

const processarEComprimirImagem = async (file, maxWidth = 1920, quality = 0.82) => {
  let arquivoParaProcessar = file;

  const nomeLower = file.name.toLowerCase();
  const ehHeic = nomeLower.endsWith('.heic') || nomeLower.endsWith('.heif') || file.type.includes('heic') || file.type.includes('heif');

  if (ehHeic) {
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.9,
      });

      const blobFinal = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      arquivoParaProcessar = new File([blobFinal], file.name.replace(/\.[^/.]+$/, '.jpg'), {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
    } catch (err) {
      console.warn('Conversão HEIC ignorada, usando ficheiro original:', err);
    }
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(arquivoParaProcessar);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], arquivoParaProcessar.name.replace(/\.[^/.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                return resolve(compressedFile);
              }
              resolve(arquivoParaProcessar);
            },
            'image/jpeg',
            quality
          );
        } catch {
          resolve(arquivoParaProcessar);
        }
      };
      img.onerror = () => resolve(arquivoParaProcessar);
    };
    reader.onerror = () => resolve(arquivoParaProcessar);
  });
};

const IconHeart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.72-8.72 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const IconMessage = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const IconImage = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const IconSend = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

function App() {
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [usuario, setUsuario] = useState(() => {
    try {
      const saved = localStorage.getItem('usuario');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  const [isRegister, setIsRegister] = useState(false);
  
  const [userStats, setUserStats] = useState({ followers_count: 0, following_count: 0 });

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
  const [comprimindo, setComprimindo] = useState(false);
  const [mostrarEmojis, setMostrarEmojis] = useState(false);

  const [notificacoes, setNotificacoes] = useState([]);
  const [mostrarNotificacoes, setMostrarNotificacoes] = useState(false);

  const [comentarioAberto, setComentarioAberto] = useState(null);
  const [comentarios, setComentarios] = useState({});
  const [novoComentario, setNovoComentario] = useState({});

  useEffect(() => {
    if (token) {
      carregarPosts();
      carregarNotificacoes();
      if (usuario && usuario.id) {
        carregarEstatisticas(usuario.id);
      }

      const interval = setInterval(() => {
        carregarNotificacoes();
        carregarPosts();
      }, 3000);

      return () => clearInterval(interval);
    } else {
      setPosts([]);
      setNotificacoes([]);
    }
  }, [token]);

  const carregarPosts = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/posts`, { headers });
      setPosts(res.data.posts || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    }
  };

  const carregarNotificacoes = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/notifications`, { headers });
      setNotificacoes(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar notificações:', err);
    }
  };

  const toggleNotificacoes = async () => {
    const novoEstado = !mostrarNotificacoes;
    setMostrarNotificacoes(novoEstado);

    if (novoEstado && temNotificacaoNova) {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        await axios.put(`${API_URL}/notifications/read`, {}, { headers });
        setNotificacoes((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      } catch (err) {
        console.error('Erro ao marcar notificações como lidas:', err);
      }
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

  const handleAuth = async (e) => {
    e.preventDefault();
    setErro('');
    setLoadingAuth(true);
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
    } finally {
      setLoadingAuth(false); // <-- Desativa o spinner após a resposta da API
  }
  };

  const handleLogout = () => {
    setToken('');
    setUsuario(null);
    setMostrarConfig(false);
    setMostrarNotificacoes(false);
    setResultadosBusca([]);
    setTermoBusca('');
    setPosts([]);
    setNotificacoes([]);
    localStorage.clear();
  };

  const handleUploadAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setComprimindo(true);
      const fotoOtimizada = await processarEComprimirImagem(file, 800, 0.85);
      const formData = new FormData();
      formData.append('avatar', fotoOtimizada);

      const res = await axios.post(`${API_URL}/users/avatar`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      const usuarioAtualizado = { ...usuario, avatar: res.data.avatar };
      setUsuario(usuarioAtualizado);
      localStorage.setItem('usuario', JSON.stringify(usuarioAtualizado));
      alert('Foto de perfil atualizada!');
      carregarPosts();
    } catch (err) {
      alert('Erro ao enviar avatar.');
    } finally {
      setComprimindo(false);
    }
  };

  const handleSelecaoImagemPost = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setComprimindo(true);
      const fotoOtimizada = await processarEComprimirImagem(file, 1920, 0.82);
      setImagemPost(fotoOtimizada);
      setPreviewImagem(URL.createObjectURL(fotoOtimizada));
    } catch (err) {
      setImagemPost(file);
      setPreviewImagem(URL.createObjectURL(file));
    } finally {
      setComprimindo(false);
    }
  };

  const handleEmojiClick = (emojiData) => {
    setNovoPost((prev) => prev + emojiData.emoji);
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
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao seguir.');
    }
  };

  const handleCriarPost = async (e) => {
    e.preventDefault();
    if (!novoPost.trim() && !imagemPost) return;

    if (novoPost.length > MAX_CHAR_COUNT) {
      return alert(`O post excede o limite máximo de ${MAX_CHAR_COUNT} caracteres.`);
    }

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
      setMostrarEmojis(false);
      carregarPosts();
    } catch (err) {
      const erroServidor = err.response?.data?.erro || err.response?.data?.message || err.message;
      alert(`Erro ao publicar post: ${erroServidor}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    }
  };

  const handleCurtir = async (postId) => {
    if (!token) return alert('Faça login para curtir!');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_URL}/likes`, { post_id: Number(postId) }, { headers });
      carregarPosts();
    } catch (err) {
      console.error('Erro ao curtir post:', err);
      alert(err.response?.data?.erro || 'Erro ao processar a curtida.');
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
    const textoComentario = novoComentario[postId] || '';
    if (!textoComentario.trim()) return;

    try {
      await axios.post(
        `${API_URL}/posts/${postId}/comments`,
        { content: textoComentario },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNovoComentario((prev) => ({ ...prev, [postId]: '' }));
      const res = await axios.get(`${API_URL}/posts/${postId}/comments`);
      setComentarios((prev) => ({ ...prev, [postId]: res.data }));
      carregarPosts();
    } catch (err) {
      alert('Erro ao enviar comentário.');
    }
  };

  const handleReagirComentario = async (commentId, postId, emoji) => {
    if (!token) return alert('Faça login!');
    try {
      await axios.post(`${API_URL}/comments/${commentId}/react`, { emoji }, { headers: { Authorization: `Bearer ${token}` } });
      const res = await axios.get(`${API_URL}/posts/${postId}/comments`);
      setComentarios((prev) => ({ ...prev, [postId]: res.data }));
    } catch (err) {
      console.error('Erro ao reagir ao comentário:', err);
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

  const charsRestantes = MAX_CHAR_COUNT - novoPost.length;
  const temNotificacaoNova = notificacoes.some((n) => n.is_read === 0);

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
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleUploadAvatar}
                style={{ display: 'none' }}
              />

              <span className="user-name">@{usuario.username}</span>

              <div className="notification-wrapper">
                <button
                  onClick={toggleNotificacoes}
                  className={`btn-icon ${temNotificacaoNova ? 'bell-glowing' : ''}`}
                  title="Notificações"
                >
                  🔔
                  {temNotificacaoNova && <span className="beacon-glow"></span>}
                </button>

                {mostrarNotificacoes && (
                  <div className="notifications-dropdown">
                    <div className="notifications-header">
                      <h4>🔔 Notificações</h4>
                    </div>

                    {notificacoes.length === 0 ? (
                      <p className="no-notifications">Sem notificações recentes.</p>
                    ) : (
                      <div className="notifications-list">
                        {notificacoes.map((n) => (
                          <div key={n.id} className={`notification-item ${n.is_read === 0 ? 'unread' : ''}`}>
                            <img src={n.actor_avatar || DEFAULT_AVATAR} alt="Avatar" className="comment-avatar" />
                            <div className="notification-text">
                              <strong>@{n.actor_username}</strong>{' '}
                              {n.type === 'like' && 'curtiu o seu post.'}
                              {n.type === 'comment' && 'comentou no seu post.'}
                              {n.type === 'follow' && 'começou a seguir-te.'}
                              <small>{new Date(n.created_at).toLocaleDateString()}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button onClick={() => setMostrarConfig(true)} className="btn-icon" title="Configurações">⚙️</button>
              <button onClick={handleLogout} className="btn-logout">Sair</button>
            </div>
          )}
        </header>

        {mostrarConfig && (
          <div className="modal-overlay" onClick={() => setMostrarConfig(false)}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
              <div className="settings-header">
                <h3>⚙️ Configurações da Conta</h3>
                <button onClick={() => setMostrarConfig(false)} className="btn-close">✕</button>
              </div>

              {msgConfig && <div className="info-message">{msgConfig}</div>}

 <form onSubmit={handleAlterarSenha} className="settings-form">
        <h4>Trocar Senha</h4>
        
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Senha Atual"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            required
            style={{ width: '100%', paddingRight: '40px' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#666'
            }}
          >
            {showPassword ? '👁️' : '🙈'}
          </button>
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Nova Senha"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            required
            style={{ width: '100%', paddingRight: '40px' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#666'
            }}
          >
            {showPassword ? '👁️' : '🙈'}
          </button>
        </div>

        <button type="submit" className="btn-primary">Atualizar Senha</button>
      </form>

              <div className="danger-zone">
                <h4>Zona de Perigo</h4>
                <button onClick={handleExcluirConta} className="btn-delete-account">
                  🗑️ Excluir Minha Conta
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="kaiowa-main">
          {usuario && (
            <div className="profile-summary-card">
              <div className="stats-box">
                <span><strong>{userStats.following_count}</strong> Seguindo</span>
                <span><strong>{userStats.followers_count}</strong> Seguidores</span>
              </div>

              <form onSubmit={handleFormBusca} className="search-user-box">
                <input
                  type="text"
                  placeholder="Procurar utilizadores..."
                  value={termoBusca}
                  onChange={handleInputBusca}
                />
                <button type="submit" className="btn-search">🔍 Buscar</button>
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
            <div className="auth-social-card">
              <div className="auth-social-brand">
                <img src="/logo-vazado.png" alt="Kaiowá" className="auth-social-logo" />
                <h2>O que está acontecendo agora</h2>
                <p className="auth-social-subtitle">Junte-se à comunidade Kaiowá hoje mesmo.</p>
              </div>

              <form onSubmit={handleAuth} className="auth-social-form">
              {isRegister && (
                <div className="input-field-social">
                  <input
                    type="text"
                    placeholder="Nome de utilizador"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="input-field-social">
                <input
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="input-field-social" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: '100%', paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: '#666'
                    }}
                  >
                    {showPassword ? '👁️' : '🙈'}
                  </button>
                </div>

              {/* BOTÃO ESQUECEU A SENHA */}
              {!isRegister && (
                <button 
                  type="button" 
                  className="btn-forgot-password"
                  onClick={() => setIsForgotOpen(true)}
                >
                  Esqueceu a senha?
                </button>
              )}

              {erro && <div className="error-message">{erro}</div>}

              {/* BOTÃO COM SPINNER */}
              <button type="submit" className="btn-social-primary" disabled={loadingAuth}>
                {loadingAuth ? (
                  <span className="spinner-btn"></span>
                ) : (
                  isRegister ? 'Inscrever-se' : 'Entrar'
                )}
              </button>
            </form>
              <div className="auth-divider">
                <span>ou</span>
              </div>

              <div className="auth-social-footer">
                <p>{isRegister ? 'Já tem uma conta?' : 'Não tem uma conta?'}</p>
                <button
                  type="button"
                  className="btn-social-secondary"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setErro('');
                  }}
                >
                  {isRegister ? 'Entrar' : 'Criar conta'}
                </button>
              </div>
            </div>
          ) : (
            <div className="post-create-box">
              <form onSubmit={handleCriarPost}>
                <div className="post-input-wrapper">
                  <img src={usuario?.avatar || DEFAULT_AVATAR} alt="Avatar" className="user-avatar-post" />
                  <textarea
                    placeholder="O que está acontecendo?"
                    value={novoPost}
                    onChange={(e) => setNovoPost(e.target.value)}
                    maxLength={MAX_CHAR_COUNT}
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
                  <div className="post-form-actions">
                    <label htmlFor="post-image-upload" className="btn-attach-image">
                      <IconImage /> {comprimindo ? 'Carregando...' : 'Adicionar Foto'}
                    </label>
                    <input
                      id="post-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleSelecaoImagemPost}
                      style={{ display: 'none' }}
                    />

                    <div className="emoji-picker-container">
                      <button
                        type="button"
                        className="btn-attach-image"
                        onClick={() => setMostrarEmojis(!mostrarEmojis)}
                      >
                        😊 Emoji
                      </button>

                      {mostrarEmojis && (
                        <div className="emoji-popover">
                          <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={380} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="post-footer-right">
                    <span className={`char-counter ${charsRestantes < 20 ? 'warning' : ''}`}>
                      {charsRestantes}
                    </span>
                    <button
                      type="submit"
                      className="btn-publish-pill"
                      disabled={(!novoPost.trim() && !imagemPost) || charsRestantes < 0 || comprimindo}
                    >
                      <IconSend /> Publicar
                    </button>
                  </div>
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
                    <button onClick={() => handleCurtir(post.id)} className={post.user_liked ? 'action-liked' : ''}>
                      <IconHeart /> {post.likes_count || 0}
                    </button>
                    <button onClick={() => toggleComentarios(post.id)}>
                      <IconMessage /> {post.comments_count || 0}
                    </button>

                    {usuario && usuario.username === post.username && (
                      <button onClick={() => handleDeletarPost(post.id)} className="btn-delete" title="Excluir post">
                        <IconTrash />
                      </button>
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

                              <div className="comment-reactions-bar">
                                {['👍', '❤️', '🔥', '😂'].map((emoji) => {
                                  const rData = (c.reactions || []).find((r) => r.emoji === emoji);
                                  const count = rData ? rData.count : 0;
                                  return (
                                    <button
                                      key={emoji}
                                      onClick={() => handleReagirComentario(c.id, post.id, emoji)}
                                      className={`btn-reaction ${count > 0 ? 'active' : ''}`}
                                    >
                                      {emoji} {count > 0 && <span>{count}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {token && (
                        <div className="comment-input-box">
                          <input
                            type="text"
                            placeholder="Escreva um comentário e pressione Enter..."
                            value={novoComentario[post.id] || ''}
                            onChange={(e) => setNovoComentario({ ...novoComentario, [post.id]: e.target.value })}
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
        {/* Modal de redefinição de senha */}
        <ForgotPasswordModal
          isOpen={isForgotOpen}
          onClose={() => setIsForgotOpen(false)}
        />
      </div>
    </div>
  );
}

export default App;