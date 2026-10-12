import React, { useEffect, useState } from 'react';
import { X, Copy, Check, FileCode } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface CodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CodeModal: React.FC<CodeModalProps> = ({ isOpen, onClose }) => {
  const { language, t } = useLanguage();
  const [code, setCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setCode(language === 'ar' ? 'جاري تحميل الكود...' : 'Loading scene code...');
      fetch('/api/scene-code')
        .then((res) => res.json())
        .then((data) => {
          if (data.code) setCode(data.code);
          else setCode(language === 'ar' ? 'تعذر قراءة ملف Scene.tsx' : 'Unable to read Scene.tsx');
        })
        .catch((err) => setCode(`${language === 'ar' ? 'خطأ في جلب الكود:' : 'Error fetching code:'} ${err.message}`));
    }
  }, [isOpen, language]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '900px',
          maxWidth: '95vw',
          maxHeight: '85vh',
          backgroundColor: '#161619',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#131316',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCode size={17} color="#a1a1aa" />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f4f4f5' }}>
              {language === 'ar' ? 'كود المشهد المولد (templates/motion-starter/src/Scene.tsx)' : 'Generated Scene Code (Scene.tsx)'}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleCopy}
              title={copied ? t.modals.code.copiedButton : t.modals.code.copyButton}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '7px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: copied ? '#34d399' : '#d4d4d8',
                fontSize: '11.5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? t.modals.code.copiedButton : t.modals.code.copyButton}</span>
            </button>

            <button
              onClick={onClose}
              title={t.common.close}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            backgroundColor: '#0e0e11',
            direction: 'ltr',
          }}
        >
          <pre
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12.5px',
              lineHeight: 1.6,
              color: '#d4d4d8',
            }}
          >
            <code>{code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
