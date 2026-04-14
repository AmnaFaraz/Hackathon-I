import React from 'react';

export default function AskButton({ title }: { title: string }) {
  return (
    <button
      onClick={() => {
        const btn = document.getElementById('chatbot-toggle');
        if (btn) btn.click();
        // Option to pre-fill would require exposing state from ChatBot, 
        // but simple toggle is standard.
      }}
      style={{
        background: 'rgba(0, 212, 255, 0.1)',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        borderRadius: '8px',
        color: 'var(--ifm-color-primary)',
        padding: '8px 16px',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '13px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '12px'
      }}
    >
      🤖 Ask AI about {title}
    </button>
  );
}
