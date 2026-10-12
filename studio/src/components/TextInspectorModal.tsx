import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Type, Trash2, RotateCcw, Check, Sliders, Palette } from 'lucide-react';
import { TextElementData } from '../types/sceneData';
import { useLanguage } from '../i18n/LanguageContext';

interface TextInspectorModalProps {
  element: TextElementData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: {
    id: string;
    text: string;
    fontSize: number;
    color?: string;
    isDeleted?: boolean;
  }) => Promise<void>;
  isBusy?: boolean;
}

export const TextInspectorModal: React.FC<TextInspectorModalProps> = ({
  element,
  isOpen,
  onClose,
  onSave,
  isBusy = false,
}) => {
  const { language, t } = useLanguage();
  const [text, setText] = useState<string>('');
  const [fontSize, setFontSize] = useState<number>(32);
  const [color, setColor] = useState<string>('#ffffff');
  const [isDeleted, setIsDeleted] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (element) {
      setText(element.text || '');
      setFontSize(element.fontSize || 32);
      setColor(element.color || '#ffffff');
      setIsDeleted(Boolean(element.isDeleted));
      setSavedSuccess(false);
    }
  }, [element, isOpen]);

  // Handle keyboard shortcuts (Escape = close, Ctrl+Enter = save)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, text, fontSize, color, isDeleted, isBusy]);

  if (!isOpen || !element) return null;

  const handleSave = async () => {
    if (isBusy || isSaving) return;
    setIsSaving(true);
    try {
      await onSave({
        id: element.id,
        text,
        fontSize,
        color,
        isDeleted,
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 350);
    } catch (err) {
      console.error('[TextInspector] Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleDelete = () => {
    setIsDeleted((prev) => !prev);
  };

  if (typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        pointerEvents: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '520px',
          maxWidth: '96vw',
          backgroundColor: '#141418',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          direction: 'rtl',
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#18181d',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Type size={18} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#f4f4f5' }}>
                {t.modals.textInspector.title}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#71717a',
                  fontFamily: 'monospace',
                  direction: 'ltr',
                  textAlign: 'right',
                }}
              >
                #{element.id} {element.shotId ? `(${element.shotId})` : ''}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            title={t.common.close}
            style={{
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Lock warning if agent is busy */}
        {isBusy && (
          <div
            style={{
              padding: '10px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>{language === 'ar' ? 'الوكيل الذكي يعمل الآن. تم تأمين التعديل لتفادي تعارض البيانات.' : 'AI Agent is currently active. Editing is locked to prevent conflicts.'}</span>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Text Editor Field */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#a1a1aa',
                marginBottom: '8px',
              }}
            >
              {t.modals.textInspector.textContentLabel}
            </label>
            <textarea
              value={text}
              disabled={isBusy}
              onChange={(e) => setText(e.target.value)}
              placeholder={language === 'ar' ? 'اكتب النص هنا...' : 'Type text content here...'}
              rows={3}
              style={{
                width: '100%',
                backgroundColor: '#0a0a0d',
                border: isDeleted
                  ? '1px dashed #ef4444'
                  : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '12px',
                color: isDeleted ? '#71717a' : '#ffffff',
                fontSize: '15px',
                lineHeight: 1.5,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                textDecoration: isDeleted ? 'line-through' : 'none',
              }}
            />
          </div>

          {/* Font Size Slider and Input */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#a1a1aa',
                }}
              >
                <Sliders size={14} />
                <span>{t.modals.textInspector.fontSizeLabel}</span>
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#0a0a0d',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                }}
              >
                <input
                  type="number"
                  min={12}
                  max={240}
                  value={fontSize}
                  disabled={isBusy}
                  onChange={(e) => setFontSize(Math.max(10, Number(e.target.value) || 12))}
                  style={{
                    width: '48px',
                    background: 'transparent',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '13px',
                    fontWeight: 700,
                    textAlign: 'center',
                    outline: 'none',
                    direction: 'ltr',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#71717a' }}>px</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range"
                min={14}
                max={180}
                value={fontSize}
                disabled={isBusy}
                onChange={(e) => setFontSize(Number(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: '#38bdf8',
                  cursor: isBusy ? 'not-allowed' : 'pointer',
                }}
              />
            </div>
          </div>

          {/* Color & Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#0c0c10',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#a1a1aa',
                }}
              >
                <Palette size={14} />
                <span>{t.modals.textInspector.colorLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={color}
                  disabled={isBusy}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'none',
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    padding: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: '#e4e4e7',
                    direction: 'ltr',
                  }}
                >
                  {color}
                </span>
              </div>
            </div>

            {/* Delete / Restore Toggle */}
            <button
              type="button"
              disabled={isBusy}
              onClick={handleToggleDelete}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                border: isDeleted
                  ? '1px solid rgba(34, 197, 94, 0.3)'
                  : '1px solid rgba(239, 68, 68, 0.3)',
                backgroundColor: isDeleted
                  ? 'rgba(34, 197, 94, 0.1)'
                  : 'rgba(239, 68, 68, 0.1)',
                color: isDeleted ? '#4ade80' : '#f87171',
                cursor: isBusy ? 'not-allowed' : 'pointer',
              }}
            >
              {isDeleted ? (
                <>
                  <RotateCcw size={13} />
                  <span>{language === 'ar' ? 'استعادة العنصر' : 'Restore Element'}</span>
                </>
              ) : (
                <>
                  <Trash2 size={13} />
                  <span>{language === 'ar' ? 'حذف العنصر' : 'Delete Element'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#18181d',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '11px', color: '#71717a' }}>
            {language === 'ar' ? 'Ctrl + Enter للحفظ السريع' : 'Ctrl + Enter to quick save'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onClose}
              disabled={isSaving}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#d4d4d8',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t.common.cancel}
            </button>

            <button
              onClick={handleSave}
              disabled={isBusy || isSaving}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                backgroundColor: savedSuccess ? '#16a34a' : '#2563eb',
                border: 'none',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isBusy || isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                opacity: isBusy ? 0.5 : 1,
              }}
            >
              {savedSuccess ? (
                <>
                  <Check size={14} />
                  <span>{language === 'ar' ? 'تم الحفظ' : 'Saved'}</span>
                </>
              ) : isSaving ? (
                <span>{language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>{t.modals.textInspector.saveButton}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
