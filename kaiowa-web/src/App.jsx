// ==========================================
// IMPORTAÇÕES DE COMPONENTES E BIBLIOTECAS
// ==========================================
import StoriesBar from './components/StoriesBar';
import toast, { Toaster } from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import heic2any from 'heic2any';
import EmojiPicker from 'emoji-picker-react';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import './App.css';

// Configuração da URL da API e Avatar Padrão
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const DEFAULT_AVATAR = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png';

// Limite máximo de caracteres por postagem
const MAX_CHAR_COUNT = 280;

// ==========================================
// FUNÇÕES AUXILIARES DE TRATAMENTO DE IMAGEM
// ==========================================

/**
 * Processa imagens em formato HEIC/HEIF (comuns no iOS), converte para JPG
 * e comprime antes de enviar para o servidor para economizar largura de banda.
 */
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

// ==========================================
// COMPONENTES DE ÍCONES (SVG)
// ==========================================
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

const IconEye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// ==========================================
// COMPONENTE: PLAYER DE VÍDEO NO FEED
// ==========================================
const RenderVideoEmbed = ({ text }) => {
  if (!text) return null;

  const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const ytMatch = text.match(ytRegex);

  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return (
      <div className="post-media" style={{ marginTop: '10px' }}>
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '12px', background: '#000' }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          />
        </div>
      </div>
    );
  }

  const mp4Regex = /(https?:\/\/[^\s]+\.(?:mp4|webm))/i;
  const mp4Match = text.match(mp4Regex);

  if (mp4Match && mp4Match[1]) {
    return (
      <div className="post-media" style={{ marginTop: '10px' }}>
        <video
          src={mp4Match[1]}
          controls
          style={{ width: '100%', maxHeight: '450px', borderRadius: '12px', background: '#000' }}
        />
      </div>
    );
  }

  return null;
};

// ==========================================
// COMPONENTE PRINCIPAL (APP)
// ==========================================
function App() {
  // Autenticação e Estados Globais
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

  // ==========================================
  // NAVEGAÇÃO POR PÁGINA DE PERFIL (/@username)
  // ==========================================
  const [perfilAtivoUsername, setPerfilAtivoUsername] = useState(() => {
    const path = window.location.pathname;
    if (path.startsWith('/@') && path.length > 2) {
      return decodeURIComponent(path.slice(2));
    }
    return null;
  });
  const [dadosPerfil, setDadosPerfil] = useState(null);
  const [postsPerfil, setPostsPerfil] = useState([]);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState('');

  // Estatísticas de Seguidores/Seguindo
  const [userStats, setUserStats] = useState({ followers_count: 0, following_count: 0 });

  // Pesquisa de Utilizadores
  const [termoBusca, setTermoBusca] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState([]);

  // Campos dos Formulários de Registro e Login
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');

  // Estados das Configurações do Utilizador
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [novoUsername, setNovoUsername] = useState('');
  const [novaBio, setNovaBio] = useState(usuario?.bio || '');
  const [msgConfig, setMsgConfig] = useState('');

  // Feed e Criação de Posts
  const [posts, setPosts] = useState([]);
  const [novoPost, setNovoPost] = useState('');
  const [imagemPost, setImagemPost] = useState(null);
  const [previewImagem, setPreviewImagem] = useState('');
  const [comprimindo, setComprimindo] = useState(false);
  const [mostrarEmojis, setMostrarEmojis] = useState(false);

  // Notificações
  const [notificacoes, setNotificacoes] = useState([]);
  const [mostrarNotificacoes, setMostrarNotificacoes] = useState(false);

  // Comentários
  const [comentarioAberto, setComentarioAberto] = useState(null);
  const [comentarios, setComentarios] = useState({});
  const [novoComentario, setNovoComentario] = useState({});

  // Sincroniza botões Voltar/Avançar do navegador com o estado de perfil
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/@') && path.length > 2) {
        setPerfilAtivoUsername(decodeURIComponent(path.slice(2)));
      } else {
        setPerfilAtivoUsername(null);
        setDadosPerfil(null);
        setErroPerfil('');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Carrega os dados do perfil sempre que `perfilAtivoUsername` muda
  useEffect(() => {
    if (perfilAtivoUsername) {
      carregarPerfilUsuario(perfilAtivoUsername, true);
    }
  }, [perfilAtivoUsername, token]);

  // Efeito para carregar dados do utilizador e atualizar ciclicamente
  useEffect(() => {
    if (token) {
      carregarPosts();
      carregarNotificacoes();
      if (usuario && usuario.id) {
        carregarEstatisticas(usuario.id);
      }

      const interval = setInterval(() => {
        carregarNotificacoes();
        if (perfilAtivoUsername) {
          carregarPerfilUsuario(perfilAtivoUsername, false);
        } else {
          carregarPosts();
        }
      }, 3000);

      return () => clearInterval(interval);
    } else {
      setPosts([]);
      setNotificacoes([]);
    }
  }, [token, perfilAtivoUsername]);

  // Navega para a página própria de um utilizador (/@username)
  const abrirPerfil = (targetUsername) => {
    if (!targetUsername) return;
    const limpo = targetUsername.replace(/^@/, '');
    window.history.pushState({}, '', `/@${encodeURIComponent(limpo)}`);
    setPerfilAtivoUsername(limpo);
    setResultadosBusca([]);
    setTermoBusca('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Retorna para o feed principal (/)
  const voltarAoFeed = () => {
    window.history.pushState({}, '', '/');
    setPerfilAtivoUsername(null);
    setDadosPerfil(null);
    setErroPerfil('');
    if (token) carregarPosts();
  };

  // Busca os dados e posts de um perfil específico
  const carregarPerfilUsuario = async (targetUsername, showLoading = true) => {
    if (showLoading) setCarregandoPerfil(true);
    setErroPerfil('');
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_URL}/users/${encodeURIComponent(targetUsername)}/profile`, { headers });
      setDadosPerfil(res.data.user);
      setPostsPerfil(res.data.posts || []);
    } catch (err) {
      setErroPerfil(err.response?.data?.erro || 'Utilizador não encontrado.');
      setDadosPerfil(null);
      setPostsPerfil([]);
    } finally {
      if (showLoading) setCarregandoPerfil(false);
    }
  };

  // Carrega lista de postagens do backend
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

  // Carrega notificações do utilizador
  const carregarNotificacoes = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_URL}/notifications`, { headers });
      setNotificacoes(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar notificações:', err);
    }
  };

  // Alterna o dropdown de notificações e marca como lidas
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

  // Obtém o número de seguidores e seguindo
  const carregarEstatisticas = async (userId) => {
    if (!userId) return;
    try {
      const res = await axios.get(`${API_URL}/users/${userId}/stats`);
      setUserStats(res.data);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  };

  // Pesquisa de utilizadores por termo
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

  // Handler de Login e Cadastro
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
        setNovaBio(res.data.user.bio || '');
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('usuario', JSON.stringify(res.data.user));
        carregarEstatisticas(res.data.user.id);
      }
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro na operação.');
    } finally {
      setLoadingAuth(false);
    }
  };

  // Termina a sessão do utilizador
  const handleLogout = () => {
    setToken('');
    setUsuario(null);
    setMostrarConfig(false);
    setMostrarNotificacoes(false);
    setResultadosBusca([]);
    setTermoBusca('');
    setPosts([]);
    setNotificacoes([]);
    voltarAoFeed();
    localStorage.clear();
  };

  // Atualiza foto de perfil
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
      if (perfilAtivoUsername) carregarPerfilUsuario(perfilAtivoUsername, false);
    } catch (err) {
      alert('Erro ao enviar avatar.');
    } finally {
      setComprimindo(false);
    }
  };

  // Trata foto anexada a um novo post
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

  // Insere emoji no texto do post
  const handleEmojiClick = (emojiData) => {
    setNovoPost((prev) => prev + emojiData.emoji);
  };

  // Altera a biografia do utilizador
  const handleAlterarBio = async (e) => {
    e.preventDefault();
    setMsgConfig('');
    try {
      const res = await axios.put(
        `${API_URL}/users/bio`,
        { bio: novaBio },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMsgConfig(res.data.mensagem);

      const usuarioAtualizado = { ...usuario, bio: res.data.bio };
      setUsuario(usuarioAtualizado);
      localStorage.setItem('usuario', JSON.stringify(usuarioAtualizado));

      if (perfilAtivoUsername && perfilAtivoUsername.toLowerCase() === usuario.username.toLowerCase()) {
        carregarPerfilUsuario(perfilAtivoUsername, false);
      }
    } catch (err) {
      setMsgConfig(err.response?.data?.erro || 'Erro ao atualizar biografia.');
    }
  };

  // Altera o nome de utilizador (username)
  const handleAlterarUsername = async (e) => {
    e.preventDefault();
    setMsgConfig('');
    try {
      const res = await axios.put(
        `${API_URL}/users/username`,
        { novoUsername },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMsgConfig(res.data.mensagem);

      const nomeAntigo = usuario.username;
      const usuarioAtualizado = { ...usuario, username: res.data.novoUsername };
      setUsuario(usuarioAtualizado);
      localStorage.setItem('usuario', JSON.stringify(usuarioAtualizado));
      
      setNovoUsername('');
      carregarPosts();

      if (perfilAtivoUsername && perfilAtivoUsername.toLowerCase() === nomeAntigo.toLowerCase()) {
        abrirPerfil(res.data.novoUsername);
      }
    } catch (err) {
      setMsgConfig(err.response?.data?.erro || 'Erro ao alterar nome de utilizador.');
    }
  };

  // Altera a senha do utilizador
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

  // Elimina permanentemente a conta do utilizador
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

  // Seguir / Deixar de seguir utilizadores
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
      if (perfilAtivoUsername) await carregarPerfilUsuario(perfilAtivoUsername, false);
      if (termoBusca) execBuscarUsuarios(termoBusca);
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao seguir.');
    }
  };

  // Publica um novo post no feed
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
      if (perfilAtivoUsername) carregarPerfilUsuario(perfilAtivoUsername, false);
    } catch (err) {
      const erroServidor = err.response?.data?.erro || err.response?.data?.message || err.message;
      alert(`Erro ao publicar post: ${erroServidor}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    }
  };

  // Curte ou descurte uma publicação
  const handleCurtir = async (postId) => {
    if (!token) return alert('Faça login para curtir!');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_URL}/likes`, { post_id: Number(postId) }, { headers });
      carregarPosts();
      if (perfilAtivoUsername) carregarPerfilUsuario(perfilAtivoUsername, false);
    } catch (err) {
      console.error('Erro ao curtir post:', err);
      alert(err.response?.data?.erro || 'Erro ao processar a curtida.');
    }
  };

  // Abre caixa de comentários de um post
  const toggleComentarios = async (postId) => {
    if (comentarioAberto === postId) {
      setComentarioAberto(null);
    } else {
      setComentarioAberto(postId);
      const res = await axios.get(`${API_URL}/posts/${postId}/comments`);
      setComentarios((prev) => ({ ...prev, [postId]: res.data }));
    }
  };

  // Envia um comentário
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
      if (perfilAtivoUsername) carregarPerfilUsuario(perfilAtivoUsername, false);
    } catch (err) {
      alert('Erro ao enviar comentário.');
    }
  };

  // Reage com emojis num comentário
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

  // Elimina um post do próprio utilizador
  const handleDeletarPost = async (postId) => {
    if (!window.confirm('Excluir este post?')) return;
    try {
      await axios.delete(`${API_URL}/posts/${postId}`, { headers: { Authorization: `Bearer ${token}` } });
      carregarPosts();
      if (perfilAtivoUsername) carregarPerfilUsuario(perfilAtivoUsername, false);
    } catch (err) {
      alert('Erro ao deletar post.');
    }
  };

  // Função reutilizável para renderizar cada cartão de post (tanto no feed geral quanto no perfil)
  const renderPostCard = (post) => (
    <div key={post.id} className="post-card">
      <div className="post-card-header">
        <img
          src={post.avatar || DEFAULT_AVATAR}
          alt="Avatar"
          className="post-avatar"
          onClick={() => abrirPerfil(post.username)}
          style={{ cursor: 'pointer' }}
          title={`Ver perfil de @${post.username}`}
        />
        <div className="post-user-info">
          <div className="user-follow-line">
            <strong
              onClick={() => abrirPerfil(post.username)}
              style={{ cursor: 'pointer' }}
              title={`Ver perfil de @${post.username}`}
            >
              @{post.username}
            </strong>
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

      {/* RENDERIZAÇÃO AUTOMÁTICA DE VÍDEOS (YOUTUBE / MP4) */}
      <RenderVideoEmbed text={post.content} />

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
                <img
                  src={c.avatar || DEFAULT_AVATAR}
                  alt="Avatar"
                  className="comment-avatar"
                  onClick={() => abrirPerfil(c.username)}
                  style={{ cursor: 'pointer' }}
                />
                <div className="comment-body">
                  <strong
                    onClick={() => abrirPerfil(c.username)}
                    style={{ cursor: 'pointer' }}
                  >
                    @{c.username}
                  </strong>
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
  );

  const charsRestantes = MAX_CHAR_COUNT - novoPost.length;
  const temNotificacaoNova = notificacoes.some((n) => n.is_read === 0);

  return (
    <div className="kaiowa-app-wrapper">
      <div className="kaiowa-container">
        
        {/* ===================================================================== */}
        {/* BLOCO FIXO DO TOPO (HEADER + PROFILE SUMMARY CARD)                   */}
        {/* ===================================================================== */}
        <div style={{ position: 'sticky', top: 0, zIndex: 1000, marginBottom: '16px' }}>
          <header className="kaiowa-header">
            <div
              className="logo-area"
              onClick={voltarAoFeed}
              style={{ cursor: 'pointer' }}
              title="Voltar ao Feed Principal"
            >
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

                <span
                  className="user-name"
                  onClick={() => abrirPerfil(usuario.username)}
                  style={{ cursor: 'pointer' }}
                  title="Ver meu perfil"
                >
                  @{usuario.username}
                </span>

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
                            <div
                              key={n.id}
                              className={`notification-item ${n.is_read === 0 ? 'unread' : ''}`}
                              onClick={() => {
                                setMostrarNotificacoes(false);
                                abrirPerfil(n.actor_username);
                              }}
                              style={{ cursor: 'pointer' }}
                            >
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

                <button
                  onClick={() => {
                    setMsgConfig('');
                    setNovaBio(usuario?.bio || '');
                    setMostrarConfig(true);
                  }}
                  className="btn-icon"
                  title="Configurações"
                >
                  ⚙️
                </button>
                <button onClick={handleLogout} className="btn-logout">Sair</button>
              </div>
            )}
          </header>

          {usuario && (
            <div className="profile-summary-card">
              <StoriesBar token={token} usuario={usuario} API_URL={API_URL} />
              
              <div className="stats-box">
                <span><strong>{userStats.following_count}</strong> Seguindo</span>
                <span><strong>{userStats.followers_count}</strong> Seguidores</span>
                <span
                  onClick={() => abrirPerfil(usuario.username)}
                  style={{ cursor: 'pointer', textDecoration: 'underline', marginLeft: 'auto', fontSize: '0.85rem' }}
                >
                  👤 Meu Perfil
                </span>
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
                      <div
                        className="user-info"
                        onClick={() => abrirPerfil(u.username)}
                        style={{ cursor: 'pointer' }}
                      >
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
        </div>

        {/* ===================================================================== */}
        {/* MODAL DE CONFIGURAÇÕES (BIOGRAFIA, USERNAME E SENHA)                  */}
        {/* ===================================================================== */}
        {mostrarConfig && (
          <div className="modal-overlay" onClick={() => setMostrarConfig(false)}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="settings-header">
                <h3>⚙️ Configurações da Conta</h3>
                <button onClick={() => setMostrarConfig(false)} className="btn-close">✕</button>
              </div>

              {msgConfig && <div className="info-message">{msgConfig}</div>}

              {/* OPÇÃO 1: FORMULÁRIO DE BIOGRAFIA */}
              <form onSubmit={handleAlterarBio} className="settings-form" style={{ marginBottom: '24px' }}>
                <h4>Biografia do Perfil ({novaBio.length}/160)</h4>
                <div style={{ marginBottom: '10px' }}>
                  <textarea
                    placeholder="Escreva uma breve apresentação sobre você..."
                    value={novaBio}
                    onChange={(e) => setNovaBio(e.target.value)}
                    maxLength={160}
                    rows="2"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', resize: 'none' }}
                  />
                </div>
                <button type="submit" className="btn-primary">Salvar Biografia</button>
              </form>

              {/* OPÇÃO 2: FORMULÁRIO DE ALTERAÇÃO DE USERNAME */}
              <form onSubmit={handleAlterarUsername} className="settings-form" style={{ marginBottom: '24px' }}>
                <h4>Alterar Nome de Utilizador</h4>
                <div style={{ marginBottom: '10px' }}>
                  <input
                    type="text"
                    placeholder={`Atual: @${usuario?.username}`}
                    value={novoUsername}
                    onChange={(e) => setNovoUsername(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <button type="submit" className="btn-primary">Atualizar Utilizador</button>
              </form>

              {/* OPÇÃO 3: FORMULÁRIO DE ALTERAÇÃO DE SENHA */}
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
                    {showPassword ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>

                <button type="submit" className="btn-primary">Atualizar Senha</button>
              </form>

              {/* ZONA DE PERIGO DE CONTA */}
              <div className="danger-zone">
                <h4>Zona de Perigo</h4>
                <button onClick={handleExcluirConta} className="btn-delete-account">
                  🗑️ Excluir Minha Conta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* CONTEÚDO PRINCIPAL: PÁGINA DE PERFIL OU FEED GERAL    */}
        {/* ===================================================== */}
        <main className="kaiowa-main">
          {perfilAtivoUsername ? (
            /* ------------------------------------------------- */
            /* VISUALIZAÇÃO DA PÁGINA PRÓPRIA DO UTILIZADOR      */
            /* ------------------------------------------------- */
            <div className="feed-container">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <button
                  onClick={voltarAoFeed}
                  className="btn-follow"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  ← Voltar ao Feed
                </button>
                <small style={{ opacity: 0.75 }}>kaiowa-flame.vercel.app/@{perfilAtivoUsername}</small>
              </div>

              {carregandoPerfil ? (
                <div className="post-card" style={{ textAlign: 'center', padding: '30px' }}>
                  Carregando perfil...
                </div>
              ) : erroPerfil ? (
                <div className="post-card" style={{ textAlign: 'center', padding: '30px' }}>
                  <strong>😕 {erroPerfil}</strong>
                  <p style={{ marginTop: '8px' }}>Verifique se o nome de utilizador está correto.</p>
                </div>
              ) : dadosPerfil && (
                <>
                  {/* CARTÃO DO PERFIL INDIVIDUAL */}
                  <div className="post-card" style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <img
                        src={dadosPerfil.avatar || DEFAULT_AVATAR}
                        alt={dadosPerfil.username}
                        style={{
                          width: '76px',
                          height: '76px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '3px solid #1b4332'
                        }}
                      />
                      <div style={{ flex: 1, minWidth: '180px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0 }}>@{dadosPerfil.username}</h3>
                          {usuario && usuario.id === dadosPerfil.id ? (
                            <button
                              onClick={() => {
                                setMsgConfig('');
                                setNovaBio(usuario?.bio || '');
                                setMostrarConfig(true);
                              }}
                              className="btn-follow"
                            >
                              ✏️ Editar Perfil
                            </button>
                          ) : usuario ? (
                            <button
                              onClick={() => handleSeguir(dadosPerfil.id)}
                              className={dadosPerfil.is_following ? 'btn-following' : 'btn-follow'}
                            >
                              {dadosPerfil.is_following ? 'Seguindo' : '+ Seguir'}
                            </button>
                          ) : null}
                        </div>

                        <small style={{ display: 'block', marginTop: '4px', opacity: 0.7 }}>
                          Membro desde {new Date(dadosPerfil.created_at).toLocaleDateString()}
                        </small>

                        <p style={{ margin: '10px 0', fontSize: '0.95rem', lineHeight: '1.4' }}>
                          {dadosPerfil.bio ? dadosPerfil.bio : <em style={{ opacity: 0.6 }}>Sem biografia definida.</em>}
                        </p>

                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem' }}>
                          <span><strong>{dadosPerfil.following_count}</strong> Seguindo</span>
                          <span><strong>{dadosPerfil.followers_count}</strong> Seguidores</span>
                          <span><strong>{postsPerfil.length}</strong> Publicações</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SE O VISITANTE ESTIVER NO PRÓPRIO PERFIL, PODE PUBLICAR DIRETO DELE */}
                  {usuario && usuario.id === dadosPerfil.id && (
                    <div className="post-create-box" style={{ marginBottom: '20px' }}>
                      <form onSubmit={handleCriarPost}>
                        <div className="post-input-wrapper">
                          <img src={usuario?.avatar || DEFAULT_AVATAR} alt="Avatar" className="user-avatar-post" />
                          <textarea
                            placeholder="Publique algo no seu perfil..."
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
                            <label htmlFor="post-image-upload-profile" className="btn-attach-image">
                              <IconImage /> {comprimindo ? 'Carregando...' : 'Adicionar Foto'}
                            </label>
                            <input
                              id="post-image-upload-profile"
                              type="file"
                              accept="image/*"
                              onChange={handleSelecaoImagemPost}
                              style={{ display: 'none' }}
                            />
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

                  {/* LISTA DE POSTAGENS EXCLUSIVAS DESTE UTILIZADOR */}
                  <h3>Publicações de @{dadosPerfil.username}</h3>
                  {postsPerfil.length === 0 ? (
                    <div className="post-card" style={{ textAlign: 'center', opacity: 0.75 }}>
                      Este utilizador ainda não fez nenhuma publicação.
                    </div>
                  ) : (
                    postsPerfil.map((post) => renderPostCard(post))
                  )}
                </>
              )}
            </div>
          ) : (
            /* ------------------------------------------------- */
            /* VISUALIZAÇÃO PADRÃO DO FEED PRINCIPAL             */
            /* ------------------------------------------------- */
            <>
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
                        {showPassword ? <IconEyeOff /> : <IconEye />}
                      </button>
                    </div>

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
                        placeholder="O que está acontecendo? (Cole links do YouTube para incorporar vídeos)"
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

              {/* LISTA DE POSTAGENS */}
              <div className="feed-container">
                <h3>Feed da Kaiowá</h3>
                {!token ? (
                  <div className="login-required-card">
                    🔒 <strong>Conteúdo Exclusivo da Comunidade</strong>
                    <p>Faça login ou crie sua conta para ver as publicações do feed.</p>
                  </div>
                ) : (
                  posts.map((post) => renderPostCard(post))
                )}
              </div>
            </>
          )}
        </main>

        <ForgotPasswordModal
          isOpen={isForgotOpen}
          onClose={() => setIsForgotOpen(false)}
        />
      </div>
    </div>
  );
}

export default App;