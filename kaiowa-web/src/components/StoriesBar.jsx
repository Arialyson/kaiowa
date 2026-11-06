import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DEFAULT_AVATAR = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png';

export default function StoriesBar({ token, usuario, API_URL }) {
  const [stories, setStories] = useState([]);
  const [selectedStory, setSelectedStory] = useState(null);

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

    const formData = new FormData();
    formData.append('story', file);

    try {
      await axios.post(`${API_URL}/stories`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      carregarStories();
    } catch (err) {
      alert('Erro ao enviar story');
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '12px', paddingBottom: '12px', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px' }}>
        {/* Botão de Adicionar Story */}
        <label style={{ textAlign: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            border: '2px dashed #4caf50', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '22px', color: '#4caf50', background: 'rgba(76, 175, 80, 0.1)'
          }}>
            +
          </div>
          <span style={{ fontSize: '11px', color: '#ccc', marginTop: '4px', display: 'block' }}>Seu story</span>
          <input type="file" accept="image/*" onChange={handleUploadStory} style={{ display: 'none' }} />
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

      {/* Modal para visualizar o Story clicado */}
      {selectedStory && (
        <div 
          onClick={() => setSelectedStory(null)} 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '80vh' }}>
            <img src={selectedStory.image_url} alt="Story" style={{ maxHeight: '80vh', borderRadius: '12px', display: 'block' }} />
            <p style={{ color: '#fff', textAlign: 'center', marginTop: '8px' }}>@{selectedStory.username}</p>
          </div>
        </div>
      )}
    </>
  );
}