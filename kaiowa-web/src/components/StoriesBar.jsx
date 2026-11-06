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
  const [selectedStory, setSelectedStory] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (token) carregarStories();
  }, [token]);

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

  return (
    <>
      <div style={{ display: 'flex', gap: '12px', paddingBottom: '12px', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px' }}>
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
            {enviando ? 'Enviando...' : 'Seu story'}
          </span>
          <input type="file" accept="image/*" onChange={handleUploadStory} disabled={enviando} style={{ display: 'none' }} />
        </label>

        {/* Lista de Stories (Últimas 24h) */}
        {stories.map((s) => (
          <div key={s.id} onClick={() => setSelectedStory(s)} style={{ textAlign: 'center', cursor: 'pointer', flexShrink: 0 }}>
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

      {/* Modal de Visualização do Story Corrigido */}
      {selectedStory && (
        <div 
          onClick={() => setSelectedStory(null)} 
          style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', 
            alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' 
          }}
        >
          {/* Botão Fechar */}
          <button 
            onClick={() => setSelectedStory(null)} 
            style={{ 
              position: 'absolute', top: '20px', right: '20px', background: 'transparent', 
              border: 'none', color: '#fff', fontSize: '28px', cursor: 'pointer' 
            }}
          >
            ✕
          </button>

          <div onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '100%', maxHeight: '85vh' }}>
            <img 
              src={selectedStory.image_url} 
              alt="Story" 
              style={{ 
                maxWidth: '90vw', 
                maxHeight: '75vh', 
                borderRadius: '12px', 
                objectFit: 'contain',
                boxShadow: '0px 4px 20px rgba(0,0,0,0.5)',
                background: '#111'
              }} 
            />
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <img 
                src={selectedStory.avatar || DEFAULT_AVATAR} 
                alt={selectedStory.username} 
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} 
              />
              <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>
                @{selectedStory.username}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}