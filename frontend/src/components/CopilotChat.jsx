import React, { useState } from 'react';
import { fetchApi } from '../api/client';

export const CopilotChat = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: '¡Hola! 👋 Soy el copiloto de tu negocio. ¿En qué te ayudo hoy?\n\nPuedes preguntarme tus ventas, o registrar ventas, gastos y deudas en lenguaje natural.'
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  const handleSendMessage = async (textToSend) => {
    const messageText = textToSend || inputMessage;
    if (!messageText.trim() || loading) return;

    // Agregar mensaje del usuario al chat
    const userMsg = { id: Date.now(), sender: 'user', text: messageText };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      // 1. Interpretar con el backend de IA
      const parseResult = await fetchApi('/ai/parse', {
        method: 'POST',
        body: JSON.stringify({ message: messageText })
      });

      if (parseResult.requires_confirmation) {
        // Mostrar tarjeta de confirmación previa
        setPendingConfirmation(parseResult);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'assistant',
            text: `Detecté la siguiente acción:\n📌 **${parseResult.summary}**`,
            isConfirmation: true,
            data: parseResult
          }
        ]);
      } else {
        // Ejecutar consulta directa inmediatamente (ej: ¿cuánto vendí hoy?)
        const execResult = await fetchApi('/ai/execute', {
          method: 'POST',
          body: JSON.stringify({ intent: parseResult.intent, params: parseResult.params })
        });

        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, sender: 'assistant', text: execResult.response }
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: 'assistant', text: `⚠️ Error: ${error.message}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (confirmedData) => {
    setLoading(true);
    setPendingConfirmation(null);

    try {
      const execResult = await fetchApi('/ai/execute', {
        method: 'POST',
        body: JSON.stringify({ intent: confirmedData.intent, params: confirmedData.params })
      });

      setMessages((prev) => [
        ...prev,
        { id: Date.now(), sender: 'assistant', text: execResult.response }
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), sender: 'assistant', text: `⚠️ Error al guardar: ${error.message}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAction = () => {
    setPendingConfirmation(null);
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), sender: 'assistant', text: '❌ Acción cancelada.' }
    ]);
  };

  return (
    <div className="copilot-card">
      <div className="copilot-header">
        <div className="brand-icon" style={{ width: '32px', height: '32px', fontSize: '1rem' }}>🤖</div>
        <div>
          <h3 style={{ fontSize: '1.1rem' }}>Pregúntale a tu negocio</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Copiloto de IA conversacional activo</p>
        </div>
      </div>

      {/* Sugerencias Rápidas */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', overflowX: 'auto' }}>
        {[
          '¿Cuánto vendí hoy?',
          '¿Qué tiene poco inventario?',
          '¿Quién me debe dinero?',
          'Vendí 3 cervezas a 5000'
        ].map((sug, idx) => (
          <button
            key={idx}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', whiteSpace: 'nowrap', borderRadius: 'var(--radius-full)' }}
            onClick={() => handleSendMessage(sug)}
          >
            💡 {sug}
          </button>
        ))}
      </div>

      {/* Burbujas del Chat */}
      <div className="copilot-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble ${msg.sender}`}>
            <div style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>

            {/* Tarjeta de Confirmación de Operación */}
            {msg.isConfirmation && pendingConfirmation && pendingConfirmation.summary === msg.data.summary && (
              <div className="confirmation-box">
                <p style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--color-primary)' }}>
                  ¿Confirmas que deseas registrar esta operación?
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }} onClick={() => handleConfirmAction(msg.data)}>
                    ✅ Confirmar y Guardar
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }} onClick={handleCancelAction}>
                    ❌ Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && <div className="chat-bubble assistant">🤖 Pensando respuesta...</div>}
      </div>

      {/* Bar de Entrada */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="copilot-input-bar"
      >
        <input
          type="text"
          className="input-field"
          placeholder="Escribe aquí... (Ej: 'Vendí 5 papas a 3000' o '¿Cuánto vendí hoy?')"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !inputMessage.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
};
