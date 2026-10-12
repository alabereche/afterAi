import React from 'react';
import {
  Code2,
  Download,
  Bot,
  FolderKanban,
  Plus,
  ChevronDown,
  Settings,
  LogOut,
  User,
  Square,
  Sparkles,
  Globe,
} from 'lucide-react';
import { UserProfile } from './AuthScreen';
import { useLanguage } from '../i18n/LanguageContext';

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion?: string;
  latestVersion?: string;
  releaseUrl?: string;
}

interface HeaderProps {
  onOpenCode: () => void;
  onOpenExport: () => void;
  isAgentBusy: boolean;
  onStop?: () => void;
  activeSessionTitle?: string;
  onOpenSessions?: () => void;
  onNewSession?: () => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
  onOpenSettings?: () => void;
  updateInfo?: UpdateInfo | null;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCode,
  onOpenExport,
  isAgentBusy,
  onStop,
  activeSessionTitle,
  onOpenSessions,
  onNewSession,
  user,
  onSignOut,
  onOpenSettings,
  updateInfo,
}) => {
  const headerRef = React.useRef<HTMLElement>(null);
  const [headerWidth, setHeaderWidth] = React.useState<number>(1200);
  const [avatarError, setAvatarError] = React.useState<boolean>(false);
  const { language, toggleLanguage, t } = useLanguage();

  React.useEffect(() => {
    setAvatarError(false);
  }, [user?.avatar]);

  const formattedSessionTitle = React.useMemo(() => {
    if (!activeSessionTitle) return t.header.sessions;
    if (language !== 'ar') {
      return activeSessionTitle
        .replace(/^مشروع جديد\s*/i, 'New Project ')
        .replace(/\s*م$/i, ' PM')
        .replace(/\s*ص$/i, ' AM');
    }
    return activeSessionTitle
      .replace(/^New Project\s*/i, 'مشروع جديد ')
      .replace(/\s*PM$/i, ' م')
      .replace(/\s*AM$/i, ' ص');
  }, [activeSessionTitle, language, t.header.sessions]);

  React.useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => {
      if (el) setHeaderWidth(el.clientWidth || 1200);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isHeaderNarrow = headerWidth < 1050;
  const isHeaderCompact = headerWidth < 820;

  return (
    <header
      ref={headerRef}
      style={{
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isHeaderCompact ? '0 10px' : isHeaderNarrow ? '0 14px' : '0 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
        backgroundColor: '#101013',
        zIndex: 50,
        gap: '8px',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none',
        whiteSpace: 'nowrap',
        minWidth: 0,
      }}
    >
      {/* Brand & Active Session Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isHeaderCompact ? '8px' : '14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isHeaderCompact ? '7px' : '10px' }}>
          <img
            src="/logo.png"
            alt="after ai"
            style={{
              width: isHeaderCompact ? '24px' : '28px',
              height: isHeaderCompact ? '24px' : '28px',
              objectFit: 'contain',
              userSelect: 'none',
              filter: 'drop-shadow(0 2px 8px rgba(249, 115, 22, 0.35))',
            }}
            draggable={false}
          />
          <h1
            style={{
              fontSize: isHeaderCompact ? '13.5px' : '15px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#f4f4f5',
              margin: 0,
              userSelect: 'none',
            }}
          >
            after ai
          </h1>
          {updateInfo?.hasUpdate && updateInfo.releaseUrl && (
            <a
              href={updateInfo.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={t.header.updateAvailableTooltip}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 9px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(249, 115, 22, 0.14)',
                border: '1px solid rgba(249, 115, 22, 0.4)',
                color: '#fb923c',
                fontSize: '11px',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.24)';
                e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.14)';
                e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.4)';
              }}
            >
              <Sparkles size={11} color="#f97316" />
              <span>{t.header.updateAvailable}: v{updateInfo.latestVersion}</span>
            </a>
          )}
        </div>

        {/* Sessions Selector & New Session Quick Trigger */}
        {onOpenSessions && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              paddingRight: isHeaderCompact ? '6px' : '10px',
              marginRight: '2px',
            }}
          >
            {/* Session Selector Button */}
            <button
              onClick={onOpenSessions}
              title={t.header.sessionsTooltip}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 9px',
                borderRadius: '7px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#e4e4e7',
                fontSize: '11.5px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              <FolderKanban size={13} color="#f97316" />
              <span
                style={{
                  maxWidth: isHeaderCompact ? '75px' : isHeaderNarrow ? '110px' : '160px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                }}
              >
                {formattedSessionTitle}
              </span>
              <ChevronDown size={11} color="#a1a1aa" />
            </button>

            {/* Quick New Session Button */}
            {onNewSession && (
              <button
                onClick={onNewSession}
                title={t.header.newSessionTooltip}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 8px',
                  borderRadius: '7px',
                  backgroundColor: 'rgba(249, 115, 22, 0.1)',
                  border: '1px solid rgba(249, 115, 22, 0.25)',
                  color: '#fb923c',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.18)';
                  e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.25)';
                }}
              >
                <Plus size={12} />
                {!isHeaderNarrow && <span>{t.header.newSession}</span>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Agent Status Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '999px',
          backgroundColor: isAgentBusy ? 'rgba(249, 115, 22, 0.08)' : 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${isAgentBusy ? 'rgba(249, 115, 22, 0.25)' : 'rgba(255, 255, 255, 0.07)'}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isAgentBusy ? '#f97316' : '#10b981',
            boxShadow: `0 0 8px ${isAgentBusy ? 'rgba(249, 115, 22, 0.6)' : 'rgba(16, 185, 129, 0.6)'}`,
            display: 'inline-block',
          }}
        />
        <Bot size={13} color={isAgentBusy ? '#f97316' : '#a1a1aa'} />
        <span
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: isAgentBusy ? '#fb923c' : '#a1a1aa',
          }}
        >
          {(() => {
            const isApiKey = user?.agentMode === 'api_key';
            const providerName = (user?.provider || 'AI').toUpperCase();
            if (isHeaderCompact) {
              return isAgentBusy ? t.header.agentStatus.busyCompact : isApiKey ? providerName : 'AGY';
            }
            if (isHeaderNarrow) {
              return isAgentBusy ? t.header.agentStatus.busyCompact : isApiKey ? `${providerName} ${t.header.agentStatus.readyCompact}` : t.header.agentStatus.readyCompact;
            }
            return isAgentBusy
              ? t.header.agentStatus.busy
              : isApiKey
              ? `${providerName} ${t.header.agentStatus.readyCustom}`
              : t.header.agentStatus.readyGoogle;
          })()}
        </span>

        {isAgentBusy && onStop && (
          <button
            type="button"
            onClick={onStop}
            title={t.header.agentStatus.stopTooltip}
            style={{
              marginRight: '4px',
              padding: '2px 6px',
              borderRadius: '5px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              color: '#fca5a5',
              fontSize: '10.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.35)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.color = '#fca5a5';
            }}
          >
            <Square size={8} fill="currentColor" strokeWidth={0} />
            <span>{t.header.agentStatus.stop}</span>
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isHeaderCompact ? '4px' : '8px', flexShrink: 0 }}>
        <button
          onClick={onOpenCode}
          title={t.header.codeTooltip}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: isHeaderCompact ? '5px 8px' : '6px 12px',
            borderRadius: '7px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#d4d4d8',
            fontSize: isHeaderCompact ? '11px' : '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)')}
        >
          <Code2 size={14} color="#a1a1aa" />
          {!isHeaderCompact && <span>{t.header.code}</span>}
        </button>

        <button
          onClick={onOpenExport}
          title={t.header.exportTooltip}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: isHeaderCompact ? '5px 9px' : '6px 14px',
            borderRadius: '7px',
            backgroundColor: '#f97316',
            border: '1px solid rgba(249, 115, 22, 0.4)',
            color: '#ffffff',
            fontSize: isHeaderCompact ? '11px' : '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(249, 115, 22, 0.35)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ea580c')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f97316')}
        >
          <Download size={14} color="#ffffff" />
          {!isHeaderCompact && <span>{t.header.exportVideo}</span>}
        </button>

        {/* Language Switcher Button (Clean Satin Pill Toggle) */}
        <button
          onClick={toggleLanguage}
          title={t.header.languageTooltip}
          style={{
            height: '30px',
            padding: '0 9px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#e4e4e7',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.12)';
            e.currentTarget.style.color = '#f97316';
            e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
            e.currentTarget.style.color = '#e4e4e7';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          }}
        >
          <Globe size={13} color="#f97316" />
          <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
        </button>

        {/* Authenticated User Profile & Sign Out */}
        {user && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingLeft: '6px',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              marginLeft: '4px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
              }}
              title={user.email}
            >
              {user.avatar && !avatarError ? (
                <img
                  src={user.avatar}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  alt={user.name}
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: user.isGuest
                      ? '#3f3f46'
                      : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {(user.name.charAt(0) || 'U').toUpperCase()}
                </div>
              )}
              <span style={{ fontSize: '11.5px', color: '#f4f4f5', fontWeight: 500 }}>
                {user.name}
              </span>
            </div>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title={t.header.settingsTooltip}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#a1a1aa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.12)';
                  e.currentTarget.style.color = '#f97316';
                  e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.color = '#a1a1aa';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }}
              >
                <Settings size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
