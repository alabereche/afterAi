import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

type WindowControlStyle = React.CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag';
};

interface TitleBarProps {
  activeSessionTitle?: string;
}

const MinimizeIcon: React.FC = () => (
  <svg width="10" height="1" viewBox="0 0 10 1">
    <rect width="10" height="1" fill="currentColor" />
  </svg>
);

const MaximizeIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <path fill="none" stroke="currentColor" strokeWidth="1" d="M0.5 0.5h9v9h-9z" />
  </svg>
);

const RestoreIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <path fill="none" stroke="currentColor" strokeWidth="1" d="M2.5 0.5h7v7h-7z" />
    <rect x="0.5" y="2.5" width="7" height="7" fill="#0b0b0e" stroke="currentColor" strokeWidth="1" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const TitleBar: React.FC<TitleBarProps> = ({ activeSessionTitle }) => {
  const { t } = useLanguage();
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isElectron) return;

    if (window.electronAPI?.isMaximized) {
      window.electronAPI.isMaximized().then((max) => setIsMaximized(Boolean(max)));
    }

    if (window.electronAPI?.onWindowStateChange) {
      const cleanup = window.electronAPI.onWindowStateChange((state) => {
        setIsMaximized(state.isMaximized);
      });
      return cleanup;
    }
  }, [isElectron]);

  if (!isElectron) {
    return null;
  }

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.electronAPI?.minimize?.();
  };

  const handleMaximize = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.electronAPI?.maximize?.();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.electronAPI?.close?.();
  };

  const handleDoubleClickTitle = () => {
    window.electronAPI?.maximize?.();
  };

  const buttonBaseStyle: WindowControlStyle = {
    width: '46px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: '#a1a1aa',
    cursor: 'pointer',
    outline: 'none',
    transition: 'background-color 0.15s ease, color 0.15s ease',
    WebkitAppRegion: 'no-drag',
  };

  const rootContainerStyle: WindowControlStyle = {
    height: '30px',
    minHeight: '30px',
    backgroundColor: '#0b0b0e',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    userSelect: 'none',
    WebkitAppRegion: 'drag',
    zIndex: 9999,
    paddingLeft: '12px',
    flexShrink: 0,
  };

  const brandContainerStyle: WindowControlStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    WebkitAppRegion: 'drag',
    minWidth: 0,
  };

  const spacerStyle: WindowControlStyle = {
    flex: 1,
    height: '100%',
    WebkitAppRegion: 'drag',
  };

  const controlsContainerStyle: WindowControlStyle = {
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    WebkitAppRegion: 'no-drag',
  };

  return (
    <div onDoubleClick={handleDoubleClickTitle} dir="ltr" style={rootContainerStyle}>
      {/* Brand & Window Title */}
      <div style={brandContainerStyle}>
        <img
          src="/logo.png"
          alt="after ai"
          style={{
            width: '15px',
            height: '15px',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
          draggable={false}
        />
        <span
          style={{
            fontSize: '11.5px',
            fontWeight: 600,
            color: '#e4e4e7',
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}
        >
          after ai
        </span>
      </div>

      {/* Draggable spacer */}
      <div style={spacerStyle} />

      {/* Window Controls (Minimize, Maximize/Restore, Close) */}
      <div style={controlsContainerStyle}>
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          title={t.titleBar.minimize}
          style={buttonBaseStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)';
            e.currentTarget.style.color = '#f4f4f5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#a1a1aa';
          }}
        >
          <MinimizeIcon />
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={handleMaximize}
          title={isMaximized ? t.titleBar.restore : t.titleBar.maximize}
          style={buttonBaseStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)';
            e.currentTarget.style.color = '#f4f4f5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#a1a1aa';
          }}
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          title={t.titleBar.close}
          style={buttonBaseStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e81123';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#a1a1aa';
          }}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
};
