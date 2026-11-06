import React, { useState } from 'react';

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('https://kaiowa-api.onrender.com/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.erro || 'Erro ao redefinir a senha.');
      }

      setMessage({ type: 'success', text: data.mensagem });
      setTimeout(() => {
        onClose();
        setMessage({ type: '', text: '' });
        setEmail('');
        setNewPassword('');
      }, 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ margin: '0 0 10px 0', color: '#1b3b22' }}>Redefinir Senha</h3>
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>
          Confirme o seu e-mail registado e defina uma nova senha.
        </p>

        {message.text && (
          <div style={{
            padding: '10px',
            borderRadius: '6px',
            marginBottom: '10px',
            fontSize: '0.85rem',
            backgroundColor: message.type === 'error' ? '#ffebee' : '#e8f5e9',
            color: message.type === 'error' ? '#c62828' : '#2e7d32'
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Nova Senha"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            style={inputStyle}
          />

          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ ...btnStyle, backgroundColor: '#ccc', color: '#333' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ ...btnStyle, backgroundColor: '#76b834', color: '#fff' }}
            >
              {loading ? <span className="spinner-btn"></span> : 'Redefinir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
  justifyContent: 'center', alignItems: 'center', zIndex: 1000
};

const modalStyle = {
  backgroundColor: '#fff', padding: '25px', borderRadius: '12px',
  width: '90%', maxWidth: '380px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
};

const inputStyle = {
  width: '100%', padding: '10px', marginBottom: '10px',
  borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box'
};

const btnStyle = {
  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
  fontWeight: 'bold', cursor: 'pointer'
};