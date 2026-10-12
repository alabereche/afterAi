import React, { useState } from 'react';
import {
  Settings,
  User,
  Sliders,
  Video,
  Info,
  LogOut,
  X,
  Check,
  ShieldCheck,
  Cpu,
  Monitor,
  Sparkles,
  Layers,
  Key,
  Eye,
  EyeOff,
  Bot,
  Zap,
  Loader2,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { UserProfile } from './AuthScreen';
import { useLanguage } from '../i18n/LanguageContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
}

type SettingsTab = 'account' | 'agent' | 'general' | 'engine' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onSignOut,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // Dual-Agent Engine States
  const [agentMode, setAgentMode] = useState<'google' | 'api_key'>(user?.agentMode || 'google');
  const [agentProvider, setAgentProvider] = useState<string>(user?.provider || 'openrouter');
  const [agentApiKey, setAgentApiKey] = useState<string>('');
  const [showAgentApiKey, setShowAgentApiKey] = useState<boolean>(false);
  const [agentModelId, setAgentModelId] = useState<string>(user?.modelId || 'liquid/lfm-2.5-2.6b:free');
  const [agentCustomBaseUrl, setAgentCustomBaseUrl] = useState<string>('');
  const [agentHasExistingKey, setAgentHasExistingKey] = useState<boolean>(false);
  const [isSavingAgent, setIsSavingAgent] = useState<boolean>(false);
  const [saveAgentSuccess, setSaveAgentSuccess] = useState<boolean>(false);
  const [isTestingAgent, setIsTestingAgent] = useState<boolean>(false);
  const [agentTestResult, setAgentTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      fetch('/api/agent/config')
        .then((r) => r.json())
        .then((cfg) => {
          if (cfg) {
            if (cfg.mode) setAgentMode(cfg.mode);
            if (cfg.provider) setAgentProvider(cfg.provider);
            if (cfg.modelId) setAgentModelId(cfg.modelId);
            if (cfg.hasKey) setAgentHasExistingKey(true);
            if (cfg.customBaseUrl) setAgentCustomBaseUrl(cfg.customBaseUrl);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSwitchAgentMode = async (newMode: 'google' | 'api_key') => {
    setAgentMode(newMode);
    setAgentError(null);
    try {
      await fetch('/api/agent/switch-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      const saved = localStorage.getItem('remotion_user');
      if (saved) {
        const u = JSON.parse(saved);
        u.agentMode = newMode;
        localStorage.setItem('remotion_user', JSON.stringify(u));
      }
    } catch (_) {}
  };

  const handleTestAgent = async () => {
    if (!agentApiKey.trim() && !agentHasExistingKey) {
      setAgentError(language === 'ar' ? 'يرجى إدخال مفتاح API أولاً' : 'Please enter an API key first');
      return;
    }
    setIsTestingAgent(true);
    setAgentTestResult(null);
    setAgentError(null);
    try {
      const res = await fetch('/api/agent/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: agentProvider,
          apiKey: agentApiKey.trim() || undefined,
          modelId: agentModelId.trim(),
          customBaseUrl: agentCustomBaseUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAgentTestResult({ ok: true, message: language === 'ar' ? 'الاتصال ناجح ومستقر' : 'Connection successful and stable' });
      } else {
        setAgentTestResult({ ok: false, message: data.error || (language === 'ar' ? 'فشل الاتصال بالمزود' : 'Failed to connect to provider') });
      }
    } catch (err: any) {
      setAgentTestResult({ ok: false, message: err.message || (language === 'ar' ? 'خطأ في الاتصال بالشبكة' : 'Network connection error') });
    } finally {
      setIsTestingAgent(false);
    }
  };

  const handleSaveAgentConfig = async () => {
    if (agentMode === 'api_key' && !agentApiKey.trim() && !agentHasExistingKey) {
      setAgentError(language === 'ar' ? 'يرجى إدخال مفتاح API للمتابعة' : 'Please enter API key to continue');
      return;
    }
    setIsSavingAgent(true);
    setAgentError(null);
    setSaveAgentSuccess(false);
    try {
      const res = await fetch('/api/agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: agentMode,
          provider: agentProvider,
          apiKey: agentApiKey.trim() || undefined,
          modelId: agentModelId.trim(),
          customBaseUrl: agentCustomBaseUrl.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || (language === 'ar' ? 'تعذر حفظ الإعدادات' : 'Failed to save settings'));
      }
      setSaveAgentSuccess(true);
      if (agentApiKey.trim()) {
        setAgentHasExistingKey(true);
      }
      const saved = localStorage.getItem('remotion_user');
      if (saved) {
        const u = JSON.parse(saved);
        u.agentMode = agentMode;
        u.provider = agentProvider;
        u.modelId = agentModelId.trim();
        localStorage.setItem('remotion_user', JSON.stringify(u));
      }
      setTimeout(() => setSaveAgentSuccess(false), 3000);
    } catch (err: any) {
      setAgentError(err.message || (language === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'An error occurred while saving'));
    } finally {
      setIsSavingAgent(false);
    }
  };

  React.useEffect(() => {
    setAvatarError(false);
  }, [user?.avatar]);

  // Future-ready local preferences
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    return localStorage.getItem('afterai_setting_autosave') !== 'false';
  });
  const [smartSnapping, setSmartSnapping] = useState<boolean>(() => {
    return localStorage.getItem('afterai_setting_snapping') !== 'false';
  });
  const [defaultResolution, setDefaultResolution] = useState<string>(() => {
    return localStorage.getItem('afterai_setting_resolution') || '1080x1920';
  });
  const [defaultFps, setDefaultFps] = useState<number>(() => {
    const val = localStorage.getItem('afterai_setting_fps');
    return val ? parseInt(val, 10) : 30;
  });

  if (!isOpen) return null;

  const handleToggleAutoSave = () => {
    const next = !autoSaveEnabled;
    setAutoSaveEnabled(next);
    localStorage.setItem('afterai_setting_autosave', String(next));
  };

  const handleToggleSnapping = () => {
    const next = !smartSnapping;
    setSmartSnapping(next);
    localStorage.setItem('afterai_setting_snapping', String(next));
  };

  const handleChangeResolution = (res: string) => {
    setDefaultResolution(res);
    localStorage.setItem('afterai_setting_resolution', res);
  };

  const handleChangeFps = (fps: number) => {
    setDefaultFps(fps);
    localStorage.setItem('afterai_setting_fps', String(fps));
  };

  const handleConfirmSignOut = () => {
    onClose();
    if (onSignOut) {
      onSignOut();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        style={{
          width: '760px',
          maxWidth: '94vw',
          height: '560px',
          maxHeight: '90vh',
          backgroundColor: '#121215',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#141418',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                backgroundColor: 'rgba(249, 115, 22, 0.12)',
                border: '1px solid rgba(249, 115, 22, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings size={18} color="#f97316" />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f4f4f5', margin: 0 }}>
                {t.modals.settings.title}
              </h2>
              <p style={{ fontSize: '11.5px', color: '#71717a', margin: '2px 0 0 0' }}>
                {language === 'ar' ? 'تخصيص بيئة العمل، خيارات محرك المونتاج، وإدارة الحساب' : 'Customize workspace, render engine settings, and account'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            title={t.common.close}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#a1a1aa';
            }}
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Body: Sidebar + Main Content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Sidebar Navigation */}
          <div
            style={{
              width: '210px',
              borderLeft: language === 'ar' ? '1px solid rgba(255, 255, 255, 0.07)' : 'none',
              borderRight: language === 'ar' ? 'none' : '1px solid rgba(255, 255, 255, 0.07)',
              backgroundColor: '#101013',
              padding: '12px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setActiveTab('account')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'account' ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                color: activeTab === 'account' ? '#f97316' : '#a1a1aa',
                fontSize: '12.5px',
                fontWeight: activeTab === 'account' ? 600 : 500,
                cursor: 'pointer',
                textAlign: language === 'ar' ? 'right' : 'left',
                width: '100%',
                transition: 'all 0.15s ease',
              }}
            >
              <User size={15} />
              <span>{t.modals.settings.tabs.account}</span>
            </button>

            <button
              onClick={() => setActiveTab('agent')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'agent' ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                color: activeTab === 'agent' ? '#f97316' : '#a1a1aa',
                fontSize: '12.5px',
                fontWeight: activeTab === 'agent' ? 600 : 500,
                cursor: 'pointer',
                textAlign: language === 'ar' ? 'right' : 'left',
                width: '100%',
                transition: 'all 0.15s ease',
              }}
            >
              <Cpu size={15} />
              <span>{t.modals.settings.tabs.agent}</span>
            </button>

            <button
              onClick={() => setActiveTab('general')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'general' ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                color: activeTab === 'general' ? '#f97316' : '#a1a1aa',
                fontSize: '12.5px',
                fontWeight: activeTab === 'general' ? 600 : 500,
                cursor: 'pointer',
                textAlign: language === 'ar' ? 'right' : 'left',
                width: '100%',
                transition: 'all 0.15s ease',
              }}
            >
              <Sliders size={15} />
              <span>{t.modals.settings.tabs.general}</span>
            </button>

            <button
              onClick={() => setActiveTab('engine')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'engine' ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                color: activeTab === 'engine' ? '#f97316' : '#a1a1aa',
                fontSize: '12.5px',
                fontWeight: activeTab === 'engine' ? 600 : 500,
                cursor: 'pointer',
                textAlign: language === 'ar' ? 'right' : 'left',
                width: '100%',
                transition: 'all 0.15s ease',
              }}
            >
              <Video size={15} />
              <span>{t.modals.settings.tabs.engine}</span>
            </button>

            <button
              onClick={() => setActiveTab('about')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'about' ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                color: activeTab === 'about' ? '#f97316' : '#a1a1aa',
                fontSize: '12.5px',
                fontWeight: activeTab === 'about' ? 600 : 500,
                cursor: 'pointer',
                textAlign: language === 'ar' ? 'right' : 'left',
                width: '100%',
                transition: 'all 0.15s ease',
              }}
            >
              <Info size={15} />
              <span>{t.modals.settings.tabs.about}</span>
            </button>
          </div>

          {/* Main Tab Panels */}
          <div
            style={{
              flex: 1,
              padding: '24px 28px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* Tab 1: Account */}
            {activeTab === 'account' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f4f4f5', margin: 0 }}>
                    {language === 'ar' ? 'بيانات المستخدم النشط' : 'Active User Profile'}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#71717a', margin: '4px 0 0 0' }}>
                    {language === 'ar' ? 'تفاصيل جلسة العمل الحالية وحالة تسجيل الدخول' : 'Current workspace session details and authentication status'}
                  </p>
                </div>

                {/* Profile Card */}
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.025)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {user?.avatar && !avatarError ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        onError={() => setAvatarError(true)}
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid rgba(249, 115, 22, 0.4)',
                          boxShadow: '0 4px 14px rgba(234, 88, 12, 0.25)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '50%',
                          background: user?.isGuest
                            ? '#3f3f46'
                            : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                          color: '#ffffff',
                          fontSize: '19px',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px solid rgba(255, 255, 255, 0.15)',
                          boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
                          userSelect: 'none',
                        }}
                      >
                        {(user?.name?.charAt(0) || 'U').toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#f4f4f5' }}>
                          {user?.name || (language === 'ar' ? 'مستخدم ضيف' : 'Guest User')}
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            backgroundColor: user?.isGuest
                              ? 'rgba(255, 255, 255, 0.06)'
                              : user?.agentMode === 'api_key'
                              ? 'rgba(249, 115, 22, 0.12)'
                              : 'rgba(34, 197, 94, 0.12)',
                            color: user?.isGuest
                              ? '#a1a1aa'
                              : user?.agentMode === 'api_key'
                              ? '#fb923c'
                              : '#22c55e',
                            fontWeight: 600,
                          }}
                        >
                          {user?.isGuest
                            ? (language === 'ar' ? 'جلسة ضيف' : 'Guest Session')
                            : user?.agentMode === 'api_key'
                            ? `${language === 'ar' ? 'وكيل' : 'Agent'} ${user.provider ? user.provider.toUpperCase() : 'Custom'}`
                            : (language === 'ar' ? 'متصل عبر Google' : 'Connected via Google')}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#71717a', marginTop: '2px', display: 'block' }}>
                        {user?.email || 'guest@afterai.local'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22c55e', fontSize: '12px' }}>
                    <ShieldCheck size={16} />
                    <span>{language === 'ar' ? 'جلسة آمنة' : 'Secure Session'}</span>
                  </div>
                </div>

                {/* Sign Out Section (Danger Zone) */}
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.03)',
                    border: '1px solid rgba(239, 68, 68, 0.18)',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '8px',
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '13.5px', fontWeight: 600, color: '#f87171', margin: 0 }}>
                      {language === 'ar' ? 'تسجيل الخروج من المنصة' : 'Sign Out of Platform'}
                    </h4>
                    <p style={{ fontSize: '11.5px', color: '#a1a1aa', margin: '4px 0 0 0' }}>
                      {language === 'ar' ? 'إنهاء الجلسة الحالية وإغلاق صلاحيات الوصول والعودة لشاشة الدخول الرئيسية' : 'End current session, revoke credentials, and return to main login screen'}
                    </p>
                  </div>

                  {!showSignOutConfirm ? (
                    <button
                      onClick={() => setShowSignOutConfirm(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#ef4444';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                        e.currentTarget.style.color = '#ef4444';
                      }}
                    >
                      <LogOut size={14} />
                      <span>{language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={handleConfirmSignOut}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 13px',
                          borderRadius: '8px',
                          backgroundColor: '#ef4444',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Check size={14} />
                        <span>{language === 'ar' ? 'تأكيد الخروج' : 'Confirm Sign Out'}</span>
                      </button>
                      <button
                        onClick={() => setShowSignOutConfirm(false)}
                        style={{
                          padding: '7px 11px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#d4d4d8',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: AI Agent Engine */}
            {activeTab === 'agent' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f4f4f5', margin: 0 }}>
                    {language === 'ar' ? 'محرك الذكاء الاصطناعي والوكيل (AI Agent)' : 'AI Agent Engine'}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#71717a', margin: '4px 0 0 0' }}>
                    {language === 'ar' ? 'إدارة نمط عمل الوكيل والتبديل السريع بين حساب Google ومفاتيح الـ API المخصصة' : 'Manage agent mode and switch between Google account and custom API keys'}
                  </p>
                </div>

                {/* Agent Mode Selection Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* Option 1: Google Account Agent */}
                  <div
                    onClick={() => handleSwitchAgentMode('google')}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      backgroundColor:
                        agentMode === 'google'
                          ? 'rgba(59, 130, 246, 0.08)'
                          : 'rgba(255, 255, 255, 0.02)',
                      border:
                        agentMode === 'google'
                          ? '1px solid rgba(59, 130, 246, 0.4)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '7px',
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Bot size={16} color="#60a5fa" />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#f4f4f5' }}>
                          {language === 'ar' ? 'حساب Google (agy)' : 'Google Account (agy)'}
                        </span>
                      </div>
                      {agentMode === 'google' && (
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: '#3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={12} color="#ffffff" />
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize: '11px', color: '#a1a1aa', margin: 0, lineHeight: 1.5 }}>
                      {language === 'ar'
                        ? 'تكامل رسمي مع Google agy، تسجيل دخول بنقرة واحدة، مجاني وبدون الحاجة لأي مفتاح API.'
                        : 'Official Google agy integration, one-click sign in, free with no API key required.'}
                    </p>
                  </div>

                  {/* Option 2: Custom API Key Agent */}
                  <div
                    onClick={() => handleSwitchAgentMode('api_key')}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      backgroundColor:
                        agentMode === 'api_key'
                          ? 'rgba(249, 115, 22, 0.08)'
                          : 'rgba(255, 255, 255, 0.02)',
                      border:
                        agentMode === 'api_key'
                          ? '1px solid rgba(249, 115, 22, 0.4)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '7px',
                            backgroundColor: 'rgba(249, 115, 22, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Key size={16} color="#f97316" />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#f4f4f5' }}>
                          {language === 'ar' ? 'مفتاح API الخاص (Custom)' : 'Custom API Key'}
                        </span>
                      </div>
                      {agentMode === 'api_key' && (
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: '#f97316',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={12} color="#ffffff" />
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize: '11px', color: '#a1a1aa', margin: 0, lineHeight: 1.5 }}>
                      {language === 'ar'
                        ? 'محرك afterAi المستقل عبر OpenRouter و DeepSeek و Claude و GPT-4o.'
                        : 'Autonomous afterAi engine via OpenRouter, DeepSeek, Claude, and GPT-4o.'}
                    </p>
                  </div>
                </div>

                {/* Configuration form for Custom Agent */}
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.025)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
                      {language === 'ar' ? 'إعدادات مزود ومفتاح الـ API المخصص' : 'Custom Provider & API Key Settings'}
                    </span>
                    {agentHasExistingKey && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#34d399',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '5px',
                          fontWeight: 500,
                        }}
                      >
                        {language === 'ar' ? 'مفتاح API مُحفظ في النظام' : 'API key saved in system'}
                      </span>
                    )}
                  </div>

                  {/* Provider selection */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa' }}>
                      {language === 'ar' ? 'مزود الخدمة (Provider):' : 'Service Provider:'}
                    </label>
                    <select
                      value={agentProvider}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAgentProvider(val);
                        setAgentTestResult(null);
                        setAgentError(null);
                        if (val === 'google_ai_studio' || val === 'google') setAgentModelId('gemini-3.8-flash-high');
                        else if (val === 'openrouter') setAgentModelId('liquid/lfm-2.5-2.6b:free');
                        else if (val === 'deepseek') setAgentModelId('deepseek-chat');
                        else if (val === 'anthropic') setAgentModelId('claude-3-5-sonnet-20241022');
                        else if (val === 'openai') setAgentModelId('gpt-4o');
                      }}
                      style={{
                        backgroundColor: '#141418',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        padding: '9px 12px',
                        color: '#ffffff',
                        fontSize: '12.5px',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="google_ai_studio">{language === 'ar' ? 'Google AI Studio (Gemini 3.6 Flash المستقر / 3.8 Flash)' : 'Google AI Studio (Gemini 3.6 Flash / 3.8 Flash)'}</option>
                      <option value="openrouter">{language === 'ar' ? 'OpenRouter (كافة النماذج العالمية)' : 'OpenRouter (Global AI Models)'}</option>
                      <option value="deepseek">DeepSeek (V3 / R1)</option>
                      <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                      <option value="openai">OpenAI (GPT-4o)</option>
                      <option value="custom">{language === 'ar' ? 'خادم مخصص (OpenAI-compatible URL)' : 'Custom Server (OpenAI-compatible URL)'}</option>
                    </select>
                  </div>

                  {/* Custom Base URL (if custom) */}
                  {agentProvider === 'custom' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa' }}>
                        {language === 'ar' ? 'رابط الـ API الأساسي (Base URL):' : 'API Base URL:'}
                      </label>
                      <input
                        type="text"
                        value={agentCustomBaseUrl}
                        onChange={(e) => setAgentCustomBaseUrl(e.target.value)}
                        placeholder="https://your-api.com/v1"
                        dir="ltr"
                        style={{
                          backgroundColor: '#09090b',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          outline: 'none',
                        }}
                      />
                    </div>
                  )}

                  {/* API Key */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa' }}>
                      {language === 'ar' ? 'مفتاح الـ API:' : 'API Key:'}
                    </label>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <input
                        type={showAgentApiKey ? 'text' : 'password'}
                        value={agentApiKey}
                        onChange={(e) => {
                          setAgentApiKey(e.target.value);
                          setAgentTestResult(null);
                          setAgentError(null);
                        }}
                        placeholder={
                          agentHasExistingKey
                            ? (language === 'ar' ? '•••••••••••••••••••••••••••••••• (مفتاح محفوظ)' : '•••••••••••••••••••••••••••••••• (Saved key)')
                            : agentProvider === 'openrouter'
                            ? 'sk-or-v1-...'
                            : 'sk-...'
                        }
                        dir="ltr"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          backgroundColor: '#09090b',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          padding: '8px 36px 8px 10px',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAgentApiKey(!showAgentApiKey)}
                        style={{
                          position: 'absolute',
                          left: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#71717a',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {showAgentApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Model ID */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#a1a1aa' }}>
                      {language === 'ar' ? 'معرّف النموذج (Model ID):' : 'Model ID:'}
                    </label>
                    <input
                      type="text"
                      value={agentModelId}
                      onChange={(e) => {
                        setAgentModelId(e.target.value);
                        setAgentTestResult(null);
                      }}
                      placeholder="e.g. liquid/lfm-2.5-2.6b:free"
                      dir="ltr"
                      style={{
                        backgroundColor: '#09090b',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        outline: 'none',
                      }}
                    />

                    {/* Quick chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '3px' }}>
                      {(agentProvider === 'google_ai_studio' || agentProvider === 'google') && (
                        <>
                          <button
                            type="button"
                            onClick={() => setAgentModelId('gemini-3.8-flash-high')}
                            style={{
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              backgroundColor: agentModelId === 'gemini-3.8-flash-high' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: agentModelId === 'gemini-3.8-flash-high' ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: agentModelId === 'gemini-3.8-flash-high' ? '#fb923c' : '#a1a1aa',
                              cursor: 'pointer',
                            }}
                          >
                            Gemini 3.8 Flash (High) {language === 'ar' ? '(الافتراضي)' : '(Default)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAgentModelId('gemini-3.8-flash-medium')}
                            style={{
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              backgroundColor: agentModelId === 'gemini-3.8-flash-medium' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: agentModelId === 'gemini-3.8-flash-medium' ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: agentModelId === 'gemini-3.8-flash-medium' ? '#fb923c' : '#a1a1aa',
                              cursor: 'pointer',
                            }}
                          >
                            Gemini 3.8 Flash (Med)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAgentModelId('gemini-3.8-flash-low')}
                            style={{
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              backgroundColor: agentModelId === 'gemini-3.8-flash-low' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: agentModelId === 'gemini-3.8-flash-low' ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: agentModelId === 'gemini-3.8-flash-low' ? '#fb923c' : '#a1a1aa',
                              cursor: 'pointer',
                            }}
                          >
                            Gemini 3.8 Flash (Low)
                          </button>
                        </>
                      )}
                      {agentProvider === 'openrouter' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setAgentModelId('liquid/lfm-2.5-2.6b:free')}
                            style={{
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              backgroundColor: agentModelId === 'liquid/lfm-2.5-2.6b:free' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: agentModelId === 'liquid/lfm-2.5-2.6b:free' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: agentModelId === 'liquid/lfm-2.5-2.6b:free' ? '#34d399' : '#a1a1aa',
                              cursor: 'pointer',
                            }}
                          >
                            LFM Free {language === 'ar' ? '(مجاني)' : '(Free)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAgentModelId('meta-llama/llama-3.3-70b-instruct:free')}
                            style={{
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              backgroundColor: agentModelId === 'meta-llama/llama-3.3-70b-instruct:free' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: agentModelId === 'meta-llama/llama-3.3-70b-instruct:free' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: agentModelId === 'meta-llama/llama-3.3-70b-instruct:free' ? '#34d399' : '#a1a1aa',
                              cursor: 'pointer',
                            }}
                          >
                            Llama 3.3 70B {language === 'ar' ? '(مجاني)' : '(Free)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAgentModelId('google/gemini-2.0-flash-exp:free')}
                            style={{
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              backgroundColor: agentModelId === 'google/gemini-2.0-flash-exp:free' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: agentModelId === 'google/gemini-2.0-flash-exp:free' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: agentModelId === 'google/gemini-2.0-flash-exp:free' ? '#34d399' : '#a1a1aa',
                              cursor: 'pointer',
                            }}
                          >
                            Gemini 2.0 Flash {language === 'ar' ? '(مجاني)' : '(Free)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAgentModelId('deepseek/deepseek-r1:free')}
                            style={{
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              backgroundColor: agentModelId === 'deepseek/deepseek-r1:free' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: agentModelId === 'deepseek/deepseek-r1:free' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: agentModelId === 'deepseek/deepseek-r1:free' ? '#34d399' : '#a1a1aa',
                              cursor: 'pointer',
                            }}
                          >
                            DeepSeek R1 {language === 'ar' ? '(مجاني)' : '(Free)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAgentModelId('anthropic/claude-3.5-sonnet')}
                            style={{
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              backgroundColor: agentModelId === 'anthropic/claude-3.5-sonnet' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: agentModelId === 'anthropic/claude-3.5-sonnet' ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: agentModelId === 'anthropic/claude-3.5-sonnet' ? '#fb923c' : '#a1a1aa',
                              cursor: 'pointer',
                            }}
                          >
                            Claude 3.5 Sonnet
                          </button>
                          <button
                            type="button"
                            onClick={() => setAgentModelId('deepseek/deepseek-chat')}
                            style={{
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              backgroundColor: agentModelId === 'deepseek/deepseek-chat' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: agentModelId === 'deepseek/deepseek-chat' ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: agentModelId === 'deepseek/deepseek-chat' ? '#fb923c' : '#a1a1aa',
                              cursor: 'pointer',
                            }}
                          >
                            DeepSeek V3
                          </button>
                        </>
                      )}
                      {agentProvider === 'deepseek' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setAgentModelId('deepseek-chat')}
                            style={{
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              backgroundColor: agentModelId === 'deepseek-chat' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: agentModelId === 'deepseek-chat' ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: agentModelId === 'deepseek-chat' ? '#fb923c' : '#a1a1aa',
                              cursor: 'pointer',
                            }}
                          >
                            deepseek-chat (V3)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAgentModelId('deepseek-reasoner')}
                            style={{
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              backgroundColor: agentModelId === 'deepseek-reasoner' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: agentModelId === 'deepseek-reasoner' ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: agentModelId === 'deepseek-reasoner' ? '#fb923c' : '#a1a1aa',
                              cursor: 'pointer',
                            }}
                          >
                            deepseek-reasoner (R1)
                          </button>
                        </>
                      )}
                      {agentProvider === 'anthropic' && (
                        <button
                          type="button"
                          onClick={() => setAgentModelId('claude-3-5-sonnet-20241022')}
                          style={{
                            fontSize: '10.5px',
                            padding: '3px 7px',
                            borderRadius: '5px',
                            backgroundColor: agentModelId === 'claude-3-5-sonnet-20241022' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            border: agentModelId === 'claude-3-5-sonnet-20241022' ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                            color: agentModelId === 'claude-3-5-sonnet-20241022' ? '#fb923c' : '#a1a1aa',
                            cursor: 'pointer',
                          }}
                        >
                          claude-3-5-sonnet
                        </button>
                      )}
                      {agentProvider === 'openai' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setAgentModelId('gpt-4o')}
                            style={{
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              backgroundColor: agentModelId === 'gpt-4o' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: agentModelId === 'gpt-4o' ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: agentModelId === 'gpt-4o' ? '#fb923c' : '#a1a1aa',
                              cursor: 'pointer',
                            }}
                          >
                            gpt-4o
                          </button>
                          <button
                            type="button"
                            onClick={() => setAgentModelId('gpt-4o-mini')}
                            style={{
                              fontSize: '10.5px',
                              padding: '3px 7px',
                              borderRadius: '5px',
                              backgroundColor: agentModelId === 'gpt-4o-mini' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: agentModelId === 'gpt-4o-mini' ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: agentModelId === 'gpt-4o-mini' ? '#fb923c' : '#a1a1aa',
                              cursor: 'pointer',
                            }}
                          >
                            gpt-4o-mini
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions: Test Connection & Save */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleTestAgent}
                        disabled={isTestingAgent}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#d4d4d8',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: isTestingAgent ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isTestingAgent ? <Loader2 size={13} className="animate-spin" color="#f97316" /> : <Sparkles size={13} color="#f97316" />}
                        <span>{isTestingAgent ? (language === 'ar' ? 'جاري الفحص...' : 'Testing...') : (language === 'ar' ? 'فحص الاتصال' : 'Test Connection')}</span>
                      </button>

                      {agentTestResult && (
                        <span style={{ fontSize: '11.5px', color: agentTestResult.ok ? '#34d399' : '#f87171', fontWeight: 500 }}>
                          {agentTestResult.message}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveAgentConfig}
                      disabled={isSavingAgent}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        backgroundColor: saveAgentSuccess ? '#16a34a' : '#f97316',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: isSavingAgent ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isSavingAgent ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>{language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}</span>
                        </>
                      ) : saveAgentSuccess ? (
                        <>
                          <Check size={14} />
                          <span>{language === 'ar' ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully'}</span>
                        </>
                      ) : (
                        <span>{language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}</span>
                      )}
                    </button>
                  </div>

                  {agentError && (
                    <div style={{ color: '#f87171', fontSize: '11.5px', marginTop: '2px' }}>
                      {agentError}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: General & Workspace */}
            {activeTab === 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f4f4f5', margin: 0 }}>
                    {t.modals.settings.tabs.general}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#71717a', margin: '4px 0 0 0' }}>
                    {language === 'ar' ? 'تخصيص سلوك محرر المشاهد والتخزين التلقائي ولغة الواجهة' : 'Customize scene editor behavior, storage, and interface language'}
                  </p>
                </div>

                {/* Interface Language Switcher */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        border: '1px solid rgba(249, 115, 22, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Globe size={16} color="#f97316" />
                    </div>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
                        {t.modals.settings.languageSection.title}
                      </span>
                      <p style={{ fontSize: '11.5px', color: '#71717a', margin: '2px 0 0 0' }}>
                        {t.modals.settings.languageSection.desc}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setLanguage('ar')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: language === 'ar' ? '1px solid #f97316' : '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: language === 'ar' ? 'rgba(249, 115, 22, 0.18)' : '#18181b',
                        color: language === 'ar' ? '#fb923c' : '#a1a1aa',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {t.modals.settings.languageSection.arabicOption}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: language === 'en' ? '1px solid #f97316' : '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: language === 'en' ? 'rgba(249, 115, 22, 0.18)' : '#18181b',
                        color: language === 'en' ? '#fb923c' : '#a1a1aa',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {t.modals.settings.languageSection.englishOption}
                    </button>
                  </div>
                </div>

                {/* Auto-save Switch */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
                      {t.modals.settings.autoSaveSection.title}
                    </span>
                    <p style={{ fontSize: '11.5px', color: '#71717a', margin: '2px 0 0 0' }}>
                      {t.modals.settings.autoSaveSection.desc}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleAutoSave}
                    style={{
                      width: '44px',
                      height: '24px',
                      borderRadius: '12px',
                      backgroundColor: autoSaveEnabled ? '#ea580c' : '#27272a',
                      border: 'none',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        position: 'absolute',
                        top: '3px',
                        left: autoSaveEnabled ? '23px' : '3px',
                        transition: 'left 0.2s ease',
                      }}
                    />
                  </button>
                </div>

                {/* Smart Snapping Switch */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
                      {t.modals.settings.snappingSection.title}
                    </span>
                    <p style={{ fontSize: '11.5px', color: '#71717a', margin: '2px 0 0 0' }}>
                      {t.modals.settings.snappingSection.desc}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleSnapping}
                    style={{
                      width: '44px',
                      height: '24px',
                      borderRadius: '12px',
                      backgroundColor: smartSnapping ? '#ea580c' : '#27272a',
                      border: 'none',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        position: 'absolute',
                        top: '3px',
                        left: smartSnapping ? '23px' : '3px',
                        transition: 'left 0.2s ease',
                      }}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: Engine & Video */}
            {activeTab === 'engine' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f4f4f5', margin: 0 }}>
                    {language === 'ar' ? 'محرك الفيديو والمونتاج البرمجي' : 'Video Render Engine'}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#71717a', margin: '4px 0 0 0' }}>
                    {language === 'ar' ? 'تهيئة أبعاد الفيديو ومعدل الإطارات الافتراضي للمشاريع الجديدة' : 'Configure default video dimensions and frame rate for new projects'}
                  </p>
                </div>

                {/* Aspect Ratio / Resolution */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#d4d4d8' }}>
                    {language === 'ar' ? 'الأبعاد الافتراضية للفيديو:' : 'Default Video Dimensions:'}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      onClick={() => handleChangeResolution('1080x1920')}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        backgroundColor: defaultResolution === '1080x1920' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                        border: defaultResolution === '1080x1920' ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: defaultResolution === '1080x1920' ? '#fb923c' : '#a1a1aa',
                        cursor: 'pointer',
                        textAlign: language === 'ar' ? 'right' : 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      <div>{language === 'ar' ? 'عمودي (9:16) • Reels / Shorts' : 'Vertical (9:16) • Reels / Shorts'}</div>
                      <div style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>{language === 'ar' ? '1080 × 1920 بكسل' : '1080 × 1920 px'}</div>
                    </button>

                    <button
                      onClick={() => handleChangeResolution('1920x1080')}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        backgroundColor: defaultResolution === '1920x1080' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                        border: defaultResolution === '1920x1080' ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: defaultResolution === '1920x1080' ? '#fb923c' : '#a1a1aa',
                        cursor: 'pointer',
                        textAlign: language === 'ar' ? 'right' : 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      <div>{language === 'ar' ? 'أفقي (16:9) • YouTube / Screen' : 'Horizontal (16:9) • YouTube / Screen'}</div>
                      <div style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>{language === 'ar' ? '1920 × 1080 بكسل' : '1920 × 1080 px'}</div>
                    </button>
                  </div>
                </div>

                {/* Framerate Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#d4d4d8' }}>
                    {language === 'ar' ? 'معدل الإطارات (FPS):' : 'Frame Rate (FPS):'}
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {[30, 60].map((fps) => (
                      <button
                        key={fps}
                        onClick={() => handleChangeFps(fps)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          backgroundColor: defaultFps === fps ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                          border: defaultFps === fps ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                          color: defaultFps === fps ? '#fb923c' : '#a1a1aa',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {fps} {language === 'ar' ? 'إطار / ثانية' : 'fps'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: About */}
            {activeTab === 'about' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f4f4f5', margin: 0 }}>
                    {language === 'ar' ? 'حول منصة after ai' : 'About after ai'}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#71717a', margin: '4px 0 0 0' }}>
                    {language === 'ar' ? 'منظومة المونتاج التوليدي والرسوم المتحركة بالذكاء الاصطناعي' : 'Generative Video Editing and AI Motion Graphics System'}
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                    <span style={{ color: '#71717a' }}>{language === 'ar' ? 'إصدار المنصة:' : 'Platform Version:'}</span>
                    <span style={{ color: '#f4f4f5', fontWeight: 600 }}>v1.2.0 (Desktop & Studio)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                    <span style={{ color: '#71717a' }}>{language === 'ar' ? 'محرك المونتاج:' : 'Render Engine:'}</span>
                    <span style={{ color: '#f4f4f5', fontWeight: 500 }}>Remotion Engine v4.0.532</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                    <span style={{ color: '#71717a' }}>{language === 'ar' ? 'البيئة البرمجية:' : 'Runtime Environment:'}</span>
                    <span style={{ color: '#f4f4f5', fontWeight: 500 }}>Electron + React 18 + Vite</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                    <span style={{ color: '#71717a' }}>{language === 'ar' ? 'محركات الذكاء الاصطناعي:' : 'AI Engines:'}</span>
                    <span style={{ color: '#f4f4f5', fontWeight: 500 }}>Google Gemini & OpenRouter</span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    color: '#22c55e',
                    fontSize: '11.5px',
                    fontWeight: 500,
                  }}
                >
                  <Sparkles size={14} />
                  <span>{language === 'ar' ? 'جميع خوادم التطبيق وخدمات الـ API متصلة وتعمل بكفاءة' : 'All application servers and API services are connected and operational'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
