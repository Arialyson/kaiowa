import React, { useState, useEffect } from 'react';
import axios from 'axios';
import heic2any from 'heic2any';

const DEFAULT_AVATAR = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png';

const processarFotoStory = async (file) => {
  let arquivo = file;
  const nomeLower = file.name.toLowerCase();
  const ehHeic = nomeLower.endsWith('.heic') || nomeLower.endsWith('.heif') || file.type.includes('heic') || file.type.includes('heif');

  if (ehHeic) {
    try {
      const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
      const blobFinal = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      arquivo = new File([blobFinal], file.name.replace(/\.[^/.]+$/, '.jpg'), { type: 'image/jpeg' });
    } catch (e) {
      console.warn('Conversão HEIC ignorada:', e);
    }
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(arquivo);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxWidth = 1080;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], arquivo.name.replace(/\.[^/.]+$/, '.jpg'), { type: 'image/jpeg' }));
          } else {
            resolve(arquivo);
          }
        }, 'image/jpeg', 0.82);
      };
      img.onerror = () => resolve(arquivo);
    };
    reader.onerror = () => resolve(arquivo);
  });
};

export default function StoriesBar({ token, usuario, API_URL }) {
  const [stories, setStories] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    if (token) carregarStories();
  }, [token]);

  // Suporte a navegação pelas setas do teclado e fechar com ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedIndex === null) return;
      if (e.key === 'ArrowLeft') proximoStory(-1);
      if (e.key === 'ArrowRight') proximoStory(1);
      if (e.key === 'Escape') setSelectedIndex(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, stories]);

  const carregarStories = async () => {
    try {
      const res = await axios.get(`${API_URL}/stories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStories(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar stories:', err);
    }
  };

  const handleUploadStory = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setEnviando(true);
    try {
      const fotoProcessada = await processarFotoStory(file);
      const formData = new FormData();
      formData.append('story', fotoProcessada);

      await axios.post(`${API_URL}/stories`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      await carregarStories();
    } catch (err) {
      console.error('Detalhe do erro no upload do story:', err.response?.data || err.message);
      alert(err.response?.data?.erro || 'Erro ao enviar story.');
    } finally {
      setEnviando(false);
    }
  };

  const handleExcluirStory = async (storyId) => {
    if (!window.confirm('Tem a certeza que deseja eliminar este story?')) return;

    setExcluindo(true);
    try {
      await axios.delete(`${API_URL}/stories/${storyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSelectedIndex(null);
      await carregarStories();
    } catch (err) {
      console.error('Erro ao eliminar story:', err);
      alert(err.response?.data?.erro || 'Erro ao eliminar story.');
    } finally {
      setExcluindo(false);
    }
  };

  const proximoStory = (direcao) => {
    if (selectedIndex === null) return;
    const novoIndice = selectedIndex + direcao;

    if (novoIndice >= 0 && novoIndice < stories.length) {
      setSelectedIndex(novoIndice);
    }
  };

  const currentStory = selectedIndex !== null ? stories[selectedIndex] : null;
  const ehDonoDoStory = currentStory && usuario && Number(currentStory.user_id) === Number(usuario.id);

  return (
    <>
      {/* Container Fluido e Transparente da Barra de Stories */}
      <div 
        style={{ 
          display: 'flex', 
          gap: '12px', 
          paddingBottom: '12px', 
          overflowX: 'auto', 
          borderBottom: '1px solid rgba(255,255,255,0.1)', 
          marginBottom: '12px' 
        }}
      >
        {/* Botão de Adicionar Story */}
        <label style={{ textAlign: 'center', cursor: enviando ? 'wait' : 'pointer', flexShrink: 0, opacity: enviando ? 0.6 : 1 }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            border: '2px dashed #4caf50', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '22px', color: '#4caf50', background: 'rgba(76, 175, 80, 0.1)'
          }}>
            {enviando ? '⌛' : '+'}
          </div>
          <span style={{ fontSize: '11px', color: '#ccc', marginTop: '4px', display: 'block' }}>
            {enviando ? 'A enviar...' : 'Seu story'}
          </span>
          <input type="file" accept="image/*" onChange={handleUploadStory} disabled={enviando} style={{ display: 'none' }} />
        </label>

        {/* Lista de Stories de Utilizadores (Últimas 24h) */}
        {stories.map((s, index) => (
          <div key={s.id} onClick={() => setSelectedIndex(index)} style={{ textAlign: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <img
              src={s.avatar || DEFAULT_AVATAR}
              alt={s.username}
              style={{ width: '56px', height: '56px', borderRadius: '50%', border: '3px solid #ff4757', objectFit: 'cover' }}
            />
            <span style={{ fontSize: '11px', color: '#fff', marginTop: '4px', display: 'block' }}>
              @{s.username}
            </span>
          </div>
        ))}
      </div>

      {/* Modal de Visualização Fullscreen */}
      {currentStory && (
        <div 
          onClick={() => setSelectedIndex(null)} 
          style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.92)', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' 
          }}
        >
          {/* Botão Fechar */}
          <button 
            onClick={() => setSelectedIndex(null)} 
            style={{ 
              position: 'absolute', top: '20px', right: '20px', background: 'transparent', 
              border: 'none', color: '#fff', fontSize: '28px', cursor: 'pointer', zIndex: 100000 
            }}
          >
            ✕
          </button>

          {/* Botão Voltar (Anterior) */}
          {selectedIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); proximoStory(-1); }}
              style={{
                position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                fontSize: '24px', width: '45px', height: '45px', borderRadius: '50%',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s', zIndex: 100000
              }}
              title="Story anterior"
            >
              ❮
            </button>
          )}

          {/* Conteúdo Central do Story */}
          <div onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '100%', maxHeight: '85vh', position: 'relative' }}>
            <img 
              src={currentStory.image_url} 
              alt="Story" 
              style={{ 
                maxWidth: '90vw', 
                maxHeight: '70vh', 
                borderRadius: '12px', 
                objectFit: 'contain',
                boxShadow: '0px 4px 20px rgba(0,0,0,0.6)',
                background: '#111'
              }} 
            />
            
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img 
                  src={currentStory.avatar || DEFAULT_AVATAR} 
                  alt={currentStory.username} 
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} 
                />
                <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>
                  @{currentStory.username}
                </span>
              </div>

              {/* Botão Eliminar (Exclusivo para o Autor do Story) */}
              {ehDonoDoStory && (
                <button
                  onClick={() => handleExcluirStory(currentStory.id)}
                  disabled={excluindo}
                  style={{
                    background: 'rgba(255, 71, 87, 0.2)',
                    border: '1px solid #ff4757',
                    color: '#ff4757',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    cursor: excluindo ? 'wait' : 'pointer',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  🗑️ {excluindo ? 'A eliminar...' : 'Eliminar'}
                </button>
              )}
            </div>
          </div>

          {/* Botão Avançar (Próximo) */}
          {selectedIndex < stories.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); proximoStory(1); }}
              style={{
                position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                fontSize: '24px', width: '45px', height: '45px', borderRadius: '50%',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s', zIndex: 100000
              }}
              title="Próximo story"
            >
              ❯
            </button>
          )}
        </div>
      )}
    </>
  );
}