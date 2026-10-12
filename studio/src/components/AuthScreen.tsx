import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  Loader2,
  Minus,
  Square,
  X,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Download,
  Terminal,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Key,
  Eye,
  EyeOff,
  Sparkles,
  Bot,
  Zap,
  Globe,
  ExternalLink,
} from 'lucide-react';

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  isGuest?: boolean;
  agentMode?: 'google' | 'api_key';
  provider?: string;
  modelId?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  badge: string;
  tagline: string;
  defaultModel: string;
  placeholder: string;
  hintText?: string;
  hintUrl?: string;
  presets: { id: string; label: string; badge?: string }[];
}

export const getProviderConfigs = (isAr: boolean): Record<string, ProviderConfig> => ({
  google_ai_studio: {
    id: 'google_ai_studio',
    name: 'Google AI Studio',
    badge: 'Gemini 3.8',
    tagline: isAr ? 'مفتاح رسمي ومباشر من Google AI Studio (Gemini 3.8 Flash)' : 'Official direct key from Google AI Studio (Gemini 3.8 Flash)',
    defaultModel: 'gemini-3.8-flash-high',
    placeholder: isAr ? 'AQ... أو AIzaSy... (من aistudio.google.com)' : 'AQ... or AIzaSy... (from aistudio.google.com)',
    hintText: isAr ? 'احصل على مفتاحك مجاناً عبر:' : 'Get your key for free via:',
    hintUrl: 'https://aistudio.google.com/app/apikey',
    presets: [
      { id: 'gemini-3.8-flash-high', label: 'Gemini 3.8 Flash (High)', badge: isAr ? 'افتراضي' : 'Default' },
      { id: 'gemini-3.8-flash-medium', label: 'Gemini 3.8 Flash (Med)', badge: isAr ? 'متزن' : 'Medium' },
      { id: 'gemini-3.8-flash-low', label: 'Gemini 3.8 Flash (Low)', badge: isAr ? 'سريع' : 'Fast' },
    ],
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    badge: isAr ? 'كافة النماذج' : 'All Models',
    tagline: isAr ? 'بوابة شاملة لأكثر من 200 نموذج ذكاء اصطناعي عالمي' : 'Universal gateway for 200+ global AI models',
    defaultModel: 'liquid/lfm-2.5-2.6b:free',
    placeholder: 'sk-or-v1-...',
    hintText: isAr ? 'احصل على المفتاح من:' : 'Get your key from:',
    hintUrl: 'https://openrouter.ai/keys',
    presets: [
      { id: 'liquid/lfm-2.5-2.6b:free', label: 'LFM 2.5', badge: isAr ? 'مجاني' : 'Free' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
    ],
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek Direct',
    badge: 'V3 / R1',
    tagline: isAr ? 'اتصال سحابي مباشر بمخدمات DeepSeek الرسمية' : 'Direct cloud connection to DeepSeek servers',
    defaultModel: 'deepseek-chat',
    placeholder: 'sk-...',
    hintText: isAr ? 'احصل على المفتاح من منصة:' : 'Get your key from:',
    hintUrl: 'https://platform.deepseek.com/api_keys',
    presets: [
      { id: 'deepseek-chat', label: 'DeepSeek V3', badge: isAr ? 'محادثة' : 'Chat' },
      { id: 'deepseek-reasoner', label: 'DeepSeek R1', badge: isAr ? 'تفكير' : 'Reasoning' },
    ],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    badge: 'Sonnet',
    tagline: isAr ? 'مفتاح رسمي لمستخدمي منصة Anthropic Console' : 'Official API key for Anthropic Console',
    defaultModel: 'claude-3-5-sonnet-20241022',
    placeholder: 'sk-ant-...',
    hintText: isAr ? 'احصل على المفتاح من:' : 'Get your key from:',
    hintUrl: 'https://console.anthropic.com/settings/keys',
    presets: [
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI Direct',
    badge: 'GPT-4o',
    tagline: isAr ? 'اتصال رسمي بمخدمات OpenAI API' : 'Official connection to OpenAI API',
    defaultModel: 'gpt-4o',
    placeholder: 'sk-...',
    hintText: isAr ? 'احصل على المفتاح من منصة:' : 'Get your key from:',
    hintUrl: 'https://platform.openai.com/api-keys',
    presets: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', badge: isAr ? 'خفيف' : 'Lite' },
    ],
  },
  custom: {
    id: 'custom',
    name: isAr ? 'خادم مخصص' : 'Custom Server',
    badge: 'Local / Custom',
    tagline: isAr ? 'ربط بمخدم محلي (Ollama / vLLM) أو أي خادم متوافق مع OpenAI' : 'Connect to local server (Ollama / vLLM) or OpenAI-compatible URL',
    defaultModel: '',
    placeholder: isAr ? 'مفتاح اختياري أو Bearer Token' : 'Optional key or Bearer Token',
    presets: [],
  },
});

export const PROVIDER_CONFIGS = getProviderConfigs(true);;

interface AuthScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

type CustomStyle = React.CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag';
};

declare global {
  interface Window {
    electronAPI?: {
      isElectron?: boolean;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      restart?: () => void;
      isMaximized: () => Promise<boolean>;
      onWindowStateChange?: (callback: (state: { isMaximized: boolean }) => void) => () => void;
    };
  }
}

interface PrerequisitesStatus {
  loading: boolean;
  nodeInstalled: boolean;
  nodeVersion: string | null;
  agyInstalled: boolean;
  agyVersion: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const { language, setLanguage } = useLanguage();
  const isAr = language === 'ar';
  const providerConfigs = React.useMemo(() => getProviderConfigs(isAr), [isAr]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStepMessage, setAuthStepMessage] = useState('');
  const [activeAuthId, setActiveAuthId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Prerequisites State
  const [prereqs, setPrereqs] = useState<PrerequisitesStatus>({
    loading: true,
    nodeInstalled: true,
    nodeVersion: null,
    agyInstalled: true,
    agyVersion: null,
  });

  const [isInstallingAgy, setIsInstallingAgy] = useState(false);
  const [activeInstallId, setActiveInstallId] = useState<string | null>(null);
  const [agyInstallLog, setAgyInstallLog] = useState('');
  const [installLogsHistory, setInstallLogsHistory] = useState<string[]>([]);
  const [showInstallDetails, setShowInstallDetails] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [agyInstallError, setAgyInstallError] = useState<string | null>(null);
  const [hasDownloadedNode, setHasDownloadedNode] = useState(false);

  // Dual-Agent Onboarding State (Google vs Custom API Key)
  const [authMode, setAuthMode] = useState<'google' | 'api_key'>('google');
  const [customProvider, setCustomProvider] = useState<string>('google_ai_studio');
  const [customApiKey, setCustomApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [customModelId, setCustomModelId] = useState<string>('gemini-3.8-flash-high');
  const [customBaseUrl, setCustomBaseUrl] = useState<string>('');
  const [hasExistingKey, setHasExistingKey] = useState<boolean>(false);
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
  const [keyTestStatus, setKeyTestStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [isSubmittingCustom, setIsSubmittingCustom] = useState<boolean>(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState<boolean>(false);
  const providerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(e.target as Node)) {
        setIsProviderDropdownOpen(false);
      }
    };
    if (isProviderDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProviderDropdownOpen]);

  const pollIntervalRef = useRef<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const checkPrerequisites = useCallback(async () => {
    try {
      const res = await fetch('/api/system/prerequisites');
      if (res.ok) {
        const data = await res.json();
        setPrereqs({
          loading: false,
          nodeInstalled: Boolean(data.nodeInstalled),
          nodeVersion: data.nodeVersion || null,
          agyInstalled: Boolean(data.agyInstalled),
          agyVersion: data.agyVersion || null,
        });
      } else {
        setPrereqs((prev) => ({ ...prev, loading: false }));
      }
    } catch (_) {
      setPrereqs((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    checkPrerequisites();
    fetch('/api/agent/config')
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          // Default auth mode is always Google CLI (AGY) on launch
          if (data.provider) {
            const mappedProv = data.provider === 'google' ? 'google_ai_studio' : data.provider;
            setCustomProvider(mappedProv);
          }
          if (data.modelId) setCustomModelId(data.modelId);
          if (data.hasKey) setHasExistingKey(true);
          if (data.customBaseUrl) setCustomBaseUrl(data.customBaseUrl);
        }
      })
      .catch(() => {});
  }, [checkPrerequisites]);

  const handleProviderChange = (prov: string) => {
    setCustomProvider(prov);
    setIsProviderDropdownOpen(false);
    setKeyTestStatus(null);
    setCustomError(null);
    const cfg = PROVIDER_CONFIGS[prov] || (prov === 'google' ? providerConfigs.google_ai_studio : null);
    if (cfg && cfg.defaultModel) {
      setCustomModelId(cfg.defaultModel);
    }
  };

  const handleTestConnection = async () => {
    if (!customApiKey.trim() && !hasExistingKey) {
      setCustomError(isAr ? 'يرجى إدخال مفتاح API أولاً' : 'Please enter an API key first');
      return;
    }
    setIsTestingKey(true);
    setKeyTestStatus(null);
    setCustomError(null);
    try {
      const res = await fetch('/api/agent/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: customProvider,
          apiKey: customApiKey.trim() || undefined,
          modelId: customModelId.trim(),
          customBaseUrl: customBaseUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setKeyTestStatus({ ok: true, message: isAr ? 'الاتصال ناجح بالنموذج' : 'Connection successful' });
      } else {
        setKeyTestStatus({ ok: false, message: data.error || (isAr ? 'فشل الاتصال بالمزود' : 'Connection to provider failed') });
      }
    } catch (err: any) {
      setKeyTestStatus({ ok: false, message: err.message || (isAr ? 'خطأ في الاتصال بالشبكة' : 'Network error') });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleCustomAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customApiKey.trim() && !hasExistingKey) {
      setCustomError(isAr ? 'يرجى إدخال مفتاح API للمتابعة' : 'Please enter an API key to continue');
      return;
    }
    if (!customModelId.trim()) {
      setCustomError(isAr ? 'يرجى تحديد معرّف النموذج (Model ID)' : 'Please specify a Model ID');
      return;
    }

    setIsSubmittingCustom(true);
    setCustomError(null);

    try {
      const res = await fetch('/api/agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'api_key',
          provider: customProvider,
          apiKey: customApiKey.trim() || undefined,
          modelId: customModelId.trim(),
          customBaseUrl: customBaseUrl.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || (isAr ? 'فشل حفظ إعدادات الوكيل' : 'Failed to save agent settings'));
      }

      const providerLabel =
        customProvider === 'google_ai_studio' || customProvider === 'google'
          ? 'Google Gemini'
          : customProvider === 'openrouter'
          ? 'OpenRouter'
          : customProvider === 'deepseek'
          ? 'DeepSeek'
          : customProvider === 'anthropic'
          ? 'Claude'
          : customProvider === 'openai'
          ? 'OpenAI'
          : 'Custom';

      const profile: UserProfile = {
        name: `${providerLabel} Agent`,
        email: `${customProvider}@afterai.ai`,
        isGuest: false,
        agentMode: 'api_key',
        provider: customProvider,
        modelId: customModelId.trim(),
      };

      onLoginSuccess(profile);
    } catch (err: any) {
      setCustomError(err.message || (isAr ? 'حدث خطأ أثناء تفعيل الوكيل' : 'Error activating agent'));
      setIsSubmittingCustom(false);
    }
  };

  const handleRestartApp = () => {
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.restart === 'function') {
      window.electronAPI.restart();
    } else {
      window.location.reload();
    }
  };

  const handleCopyInstallCommand = () => {
    const cmd = 'irm https://antigravity.google/cli/install.ps1 | iex';
    navigator.clipboard.writeText(cmd).then(() => {
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    });
  };

  const handleInstallAgy = async () => {
    setIsInstallingAgy(true);
    setAgyInstallError(null);
    setAgyInstallLog(isAr ? 'جاري بدء عملية التثبيت...' : 'Starting installation...');
    setInstallLogsHistory([isAr ? 'جاري إرسال طلب التثبيت إلى النظام...' : 'Sending installation request to system...']);
    setShowInstallDetails(false);

    try {
      // 1. Start installation via POST with required custom header
      const startRes = await fetch('/api/system/install-agy/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AfterAi-Action': 'install-agy',
        },
      });

      if (!startRes.ok) {
        const errJson = await startRes.json().catch(() => ({}));
        throw new Error(errJson.error || (isAr ? 'تعذر بدء عملية التثبيت من الخادم' : 'Failed to start installation from server'));
      }

      const startData = await startRes.json();
      const installId = startData.installId;
      setActiveInstallId(installId);

      // 2. Connect to pure read-only SSE stream with installId parameter
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(`/api/system/install-agy/stream?installId=${encodeURIComponent(installId)}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'log' && payload.line) {
            setAgyInstallLog(payload.line);
            setInstallLogsHistory((prev) => [...prev, payload.line]);
          } else if (payload.type === 'done') {
            eventSource.close();
            eventSourceRef.current = null;
            setIsInstallingAgy(false);
            setPrereqs((prev) => ({
              ...prev,
              agyInstalled: true,
              agyVersion: payload.version || 'Ready',
            }));
          } else if (payload.type === 'error') {
            eventSource.close();
            eventSourceRef.current = null;
            setIsInstallingAgy(false);
            setAgyInstallError(payload.line || (isAr ? 'تعذر استكمال التثبيت.' : 'Installation could not be completed.'));
          } else if (payload.type === 'cancelled') {
            eventSource.close();
            eventSourceRef.current = null;
            setIsInstallingAgy(false);
            setAgyInstallError(isAr ? 'تم إلغاء عملية التثبيت بنجاح.' : 'Installation cancelled successfully.');
          }
        } catch (_) {}
      };

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;
        setIsInstallingAgy(false);
        checkPrerequisites();
      };
    } catch (err: any) {
      setIsInstallingAgy(false);
      setAgyInstallError(err.message || (isAr ? 'حدث خطأ أثناء بدء عملية التثبيت' : 'Error starting installation'));
    }
  };

  const handleCancelAgyInstall = async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (activeInstallId) {
      try {
        await fetch('/api/system/install-agy/cancel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-AfterAi-Action': 'install-agy',
          },
          body: JSON.stringify({ installId: activeInstallId }),
        });
      } catch (_) {}
    }

    setIsInstallingAgy(false);
    setAgyInstallError(isAr ? 'تم إلغاء عملية التثبيت.' : 'Installation cancelled.');
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const handleCancelAuth = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsAuthenticating(false);
    setActiveAuthId(null);
    setAuthStepMessage('');
    setAuthError(null);
  };

  const handleGoogleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    setAuthStepMessage(isAr ? 'جاري انتظار التوثيق في المتصفح...' : 'Awaiting authentication in browser...');

    try {
      const res = await fetch('/api/auth/google/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || (isAr ? 'تعذر بدء جلسة التوثيق من الخادم' : 'Failed to start auth session'));
      }

      const data = await res.json();
      const authId = data.authId;
      setActiveAuthId(authId);
      setAuthStepMessage(isAr ? 'تم فتح صفحة Google في المتصفح...' : 'Google page opened in browser...');

      // Open the Google OAuth URL directly in default system browser
      if (data.authUrl) {
        window.open(data.authUrl, '_blank');
      }

      // Poll for authentication status every second
      pollIntervalRef.current = setInterval(async () => {
        try {
          const checkRes = await fetch(`/api/auth/google/check?authId=${authId}`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.authenticated && checkData.user) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
              setAuthStepMessage(isAr ? 'تم التوثيق بنجاح! جاري الدخول...' : 'Authentication successful! Entering...');

              setTimeout(() => {
                setIsAuthenticating(false);
                fetch('/api/agent/switch-mode', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mode: 'google' }),
                }).catch(() => {});
                onLoginSuccess({
                  ...checkData.user,
                  agentMode: 'google',
                });
              }, 600);
            }
          }
        } catch (pollErr) {
          console.error('[Auth Poll] Error polling auth status:', pollErr);
        }
      }, 1000);
    } catch (err: any) {
      console.error('[Google Sign-In Error]:', err);
      setIsAuthenticating(false);
      setAuthError(err.message || (isAr ? 'تعذر بدء جلسة التوثيق' : 'Authentication error'));
      setActiveAuthId(null);
      setAuthStepMessage('');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#050507',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        fontFamily: '"Cairo", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        direction: 'rtl',
        overflowY: 'auto',
        overflowX: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* ========================================================= */}
      {/* Dynamic Keyframes for Traveling Light Sweep Across Logo   */}
      {/* ========================================================= */}
      <style>{`
        @keyframes walkingBeam {
          0% {
            transform: translateX(-160%) rotate(25deg);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translateX(160%) rotate(25deg);
            opacity: 0;
          }
        }
        @keyframes indeterminateBar {
          0% {
            left: -35%;
            width: 35%;
          }
          50% {
            left: 25%;
            width: 55%;
          }
          100% {
            left: 100%;
            width: 35%;
          }
        }
      `}</style>

      {/* ========================================================= */}
      {/* 1. HIGH-CONTRAST PROCEDURAL NOISE (SVG feTurbulence)       */}
      {/* ========================================================= */}
      <svg
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
          opacity: 0.16,
          mixBlendMode: 'screen',
        }}
      >
        <filter id="proceduralNoiseFilter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.7"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.6 -0.15"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#proceduralNoiseFilter)" fill="#ffffff" />
      </svg>

      {/* ========================================================= */}
      {/* 3. ELECTRON WINDOW TITLEBAR & LANGUAGE SWITCHER           */}
      {/* ========================================================= */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          zIndex: 50,
          WebkitAppRegion: 'drag',
        } as CustomStyle}
      >
        {typeof window !== 'undefined' && window.electronAPI ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', WebkitAppRegion: 'no-drag' } as CustomStyle}>
            <button
              type="button"
              onClick={() => window.electronAPI?.close()}
              title={isAr ? "إغلاق" : "Close"}
              style={{
                width: '32px',
                height: '28px',
                background: 'none',
                border: 'none',
                color: '#71717a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderRadius: '4px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ef4444';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#71717a';
              }}
            >
              <X size={14} />
            </button>
            <button
              type="button"
              onClick={() => window.electronAPI?.maximize()}
              title={isAr ? "تكبير / استعادة" : "Maximize / Restore"}
              style={{
                width: '32px',
                height: '28px',
                background: 'none',
                border: 'none',
                color: '#71717a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderRadius: '4px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#71717a';
              }}
            >
              <Square size={12} />
            </button>
            <button
              type="button"
              onClick={() => window.electronAPI?.minimize()}
              title={isAr ? "تصغير" : "Minimize"}
              style={{
                width: '32px',
                height: '28px',
                background: 'none',
                border: 'none',
                color: '#71717a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderRadius: '4px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#71717a';
              }}
            >
              <Minus size={14} />
            </button>
          </div>
        ) : (
          <div />
        )}

        {/* Global Language Toggle Pill */}
        <div style={{ WebkitAppRegion: 'no-drag' } as CustomStyle}>
          <button
            type="button"
            onClick={() => setLanguage(isAr ? 'en' : 'ar')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#d4d4d8',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
          >
            <Globe size={13} color="#f97316" />
            <span>{isAr ? 'English' : 'العربية'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. MAIN HERO & AUTHENTICATION CENTER                      */}
      {/* ========================================================= */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: '430px',
          width: '100%',
          padding: '24px 16px',
          margin: 'auto 0',
        }}
      >
        {/* Studio Official 3D Play/Arrow Logo with Liquid Light Sweep Across Surface (No Background Glow) */}
        <div
          style={{
            marginBottom: '10px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '96px',
            height: '96px',
          }}
        >
          {/* Base Logo Image with clean, crisp realistic shadow */}
          <img
            src="/logo.png"
            alt="afterAi"
            style={{
              width: '92px',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 8px 18px rgba(0, 0, 0, 0.7))',
              position: 'relative',
              zIndex: 1,
              userSelect: 'none',
            }}
          />

          {/* Liquid Light Sweep Walking Across the Logo Surface */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 2,
              maskImage: 'url(/logo.png)',
              WebkitMaskImage: 'url(/logo.png)',
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
              overflow: 'hidden',
            }}
          >
            {/* Primary Traveling Light Beam */}
            <div
              style={{
                position: 'absolute',
                top: '-50%',
                left: '-150%',
                width: '300%',
                height: '200%',
                background: 'linear-gradient(115deg, transparent 20%, rgba(249, 115, 22, 0.25) 36%, rgba(255, 255, 255, 0.98) 50%, rgba(251, 191, 36, 0.85) 58%, rgba(249, 115, 22, 0.35) 68%, transparent 80%)',
                animation: 'walkingBeam 3s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                mixBlendMode: 'screen',
              }}
            />
            {/* Secondary Color-Dodge Specular Shimmer */}
            <div
              style={{
                position: 'absolute',
                top: '-50%',
                left: '-150%',
                width: '300%',
                height: '200%',
                background: 'linear-gradient(115deg, transparent 38%, rgba(255, 255, 255, 0.95) 50%, transparent 62%)',
                animation: 'walkingBeam 3s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                mixBlendMode: 'color-dodge',
              }}
            />
          </div>
        </div>

        {/* Header Title */}
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#ffffff',
            margin: '0 0 3px 0',
            letterSpacing: '-0.02em',
          }}
        >
          Welcome to afterAi
        </h1>
        <p
          style={{
            fontSize: '12px',
            color: '#71717a',
            margin: '0 0 16px 0',
            fontWeight: 400,
          }}
        >
          {isAr ? 'استوديو الموشن جرافيك الذكي' : 'Intelligent AI Motion Graphics Studio'}
        </p>

        {/* Minimalist Dark Sign-in Card */}
        <div
          style={{
            width: '100%',
            maxWidth: '430px',
            backgroundColor: '#111114',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '18px 20px',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Dual-Agent Mode Switcher Tabs */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '10px',
              padding: '3px',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              marginBottom: '14px',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setAuthMode('google');
                setAuthError(null);
                setCustomError(null);
                setIsProviderDropdownOpen(false);
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: authMode === 'google' ? '1px solid rgba(249, 115, 22, 0.35)' : '1px solid transparent',
                backgroundColor: authMode === 'google' ? 'rgba(249, 115, 22, 0.14)' : 'transparent',
                color: authMode === 'google' ? '#fb923c' : '#71717a',
                fontSize: '12px',
                fontWeight: authMode === 'google' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Bot size={15} />
              <span>{isAr ? 'أداة Google CLI المجانية' : 'Free Google CLI Agent'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('api_key');
                setAuthError(null);
                setCustomError(null);
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: authMode === 'api_key' ? '1px solid rgba(249, 115, 22, 0.35)' : '1px solid transparent',
                backgroundColor: authMode === 'api_key' ? 'rgba(249, 115, 22, 0.14)' : 'transparent',
                color: authMode === 'api_key' ? '#fb923c' : '#71717a',
                fontSize: '12px',
                fontWeight: authMode === 'api_key' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Key size={15} />
              <span>{isAr ? 'مفتاح API الخاص' : 'Custom API Key'}</span>
            </button>
          </div>

          {authMode === 'api_key' ? (
            /* Custom API Key Agent Form */
            <form
              onSubmit={handleCustomAgentSubmit}
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '15px',
                textAlign: isAr ? 'right' : 'left',
                direction: isAr ? 'rtl' : 'ltr',
              }}
            >
              {/* Feature Banner */}
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '7px',
                    backgroundColor: 'rgba(249, 115, 22, 0.12)',
                    border: '1px solid rgba(249, 115, 22, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Zap size={13} style={{ color: '#f97316' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <span style={{ fontWeight: 700, color: '#f4f4f5', fontSize: '11.5px' }}>
                    {isAr ? 'ربط سحابي مباشر بالذكاء الاصطناعي' : 'Direct Cloud AI Connection'}
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#71717a', lineHeight: 1.3 }}>
                    {isAr ? 'يعمل فورياً دون الحاجة لتثبيت أي برامج أو طرفيات إضافية.' : 'Works instantly with no local dependencies needed.'}
                  </span>
                </div>
              </div>

              {/* Provider Selector Section */}
              {(() => {
                const activeCfg =
                  providerConfigs[customProvider] ||
                  (customProvider === 'google' ? providerConfigs.google_ai_studio : providerConfigs.google_ai_studio);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#e4e4e7' }}>
                        {isAr ? 'مزود الذكاء الاصطناعي (AI Provider)' : 'AI Service Provider'}
                      </label>
                      <span style={{ fontSize: '10.5px', color: '#71717a' }}>
                        {isAr ? 'اختر المنصة' : 'Select platform'}
                      </span>
                    </div>

                    {/* Custom Interactive Dropdown */}
                    <div ref={providerDropdownRef} style={{ position: 'relative', width: '100%' }}>
                      <button
                        type="button"
                        onClick={() => setIsProviderDropdownOpen(!isProviderDropdownOpen)}
                        style={{
                          width: '100%',
                          height: '40px',
                          boxSizing: 'border-box',
                          backgroundColor: 'rgba(24, 24, 27, 0.85)',
                          border: isProviderDropdownOpen ? '1px solid #f97316' : '1px solid rgba(255, 255, 255, 0.09)',
                          borderRadius: '9px',
                          padding: '0 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          boxShadow: isProviderDropdownOpen ? '0 0 0 3px rgba(249, 115, 22, 0.15)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '5px',
                              backgroundColor: 'rgba(249, 115, 22, 0.14)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Sparkles size={12} color="#f97316" />
                          </div>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff' }}>
                            {activeCfg.name}
                          </span>
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              color: '#fdba74',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                          >
                            {activeCfg.badge}
                          </span>
                        </div>
                        <ChevronDown
                          size={15}
                          color="#a1a1aa"
                          style={{
                            transform: isProviderDropdownOpen ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s ease',
                          }}
                        />
                      </button>

                      {/* Floating Dropdown Menu */}
                      {isProviderDropdownOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            right: 0,
                            zIndex: 60,
                            backgroundColor: '#141418',
                            border: '1px solid rgba(255, 255, 255, 0.14)',
                            borderRadius: '12px',
                            padding: '6px',
                            boxShadow: '0 18px 40px -4px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                            maxHeight: '300px',
                            overflowY: 'auto',
                          }}
                        >
                          {Object.values(PROVIDER_CONFIGS).map((opt) => {
                            const isSelected =
                              customProvider === opt.id || (customProvider === 'google' && opt.id === 'google_ai_studio');
                            return (
                              <div
                                key={opt.id}
                                onClick={() => handleProviderChange(opt.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '9px 12px',
                                  borderRadius: '8px',
                                  backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                                  cursor: 'pointer',
                                  transition: 'all 0.12s ease',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#fb923c' : '#ffffff' }}>
                                      {opt.name}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '9.5px',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                                        color: isSelected ? '#fed7aa' : '#a1a1aa',
                                      }}
                                    >
                                      {opt.badge}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '11px', color: '#71717a' }}>
                                    {opt.tagline}
                                  </span>
                                </div>
                                {isSelected && <Check size={14} color="#f97316" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Custom Base URL (if custom) */}
              {customProvider === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#e4e4e7' }}>
                    {isAr ? 'رابط الـ API الأساسي (Base URL)' : 'API Base URL'}
                  </label>
                  <input
                    type="text"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    placeholder={isAr ? "https://your-api.com/v1 أو http://localhost:11434/v1" : "https://your-api.com/v1 or http://localhost:11434/v1"}
                    dir="ltr"
                    style={{
                      width: '100%',
                      height: '40px',
                      boxSizing: 'border-box',
                      backgroundColor: 'rgba(24, 24, 27, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.09)',
                      borderRadius: '9px',
                      padding: '0 12px',
                      color: '#ffffff',
                      fontSize: '12.5px',
                      fontFamily: 'monospace',
                      outline: 'none',
                      transition: 'all 0.15s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#f97316';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.15)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.09)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              )}

              {/* API Key Input Section */}
              {(() => {
                const activeCfg =
                  providerConfigs[customProvider] ||
                  (customProvider === 'google' ? providerConfigs.google_ai_studio : providerConfigs.google_ai_studio);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#e4e4e7' }}>
                        {isAr ? 'مفتاح API الخاص بك (Secret Key)' : 'Your API Secret Key'}
                      </label>
                      {hasExistingKey && !customApiKey && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 7px',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            color: '#34d399',
                            fontSize: '10px',
                            fontWeight: 600,
                          }}
                        >
                          <span
                            style={{
                              width: '4px',
                              height: '4px',
                              borderRadius: '50%',
                              backgroundColor: '#10b981',
                              boxShadow: '0 0 5px #10b981',
                            }}
                          />
                          <span>{isAr ? 'المفتاح محفوظ في النظام' : 'Saved in system'}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ position: 'relative', width: '100%' }}>
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={customApiKey}
                        onChange={(e) => {
                          setCustomApiKey(e.target.value);
                          setKeyTestStatus(null);
                          setCustomError(null);
                        }}
                        placeholder={hasExistingKey ? '••••••••••••••••••••••••••••••••' : activeCfg.placeholder}
                        dir="ltr"
                        style={{
                          width: '100%',
                          height: '40px',
                          boxSizing: 'border-box',
                          backgroundColor: 'rgba(24, 24, 27, 0.85)',
                          border: '1px solid rgba(255, 255, 255, 0.09)',
                          borderRadius: '9px',
                          padding: '0 38px 0 12px',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          fontFamily: customApiKey ? 'monospace' : 'inherit',
                          outline: 'none',
                          transition: 'all 0.15s ease',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#f97316';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.15)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.09)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        style={{
                          position: 'absolute',
                          left: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#a1a1aa',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '5px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
                      >
                        {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>

                    {activeCfg.hintUrl && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '10.5px',
                          marginTop: '1px',
                        }}
                      >
                        <span style={{ color: '#71717a' }}>{activeCfg.hintText}</span>
                        <a
                          href={activeCfg.hintUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#fb923c',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontWeight: 500,
                          }}
                        >
                          <span>{isAr ? 'الحصول على المفتاح' : 'Get API Key'}</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Model ID Input Section with Clean 2x2 Preset Grid */}
              {(() => {
                const activeCfg =
                  providerConfigs[customProvider] ||
                  (customProvider === 'google' ? providerConfigs.google_ai_studio : providerConfigs.google_ai_studio);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#e4e4e7' }}>
                        {isAr ? 'معرّف النموذج (Model ID)' : 'Model ID'}
                      </label>
                      <span style={{ fontSize: '10.5px', color: '#71717a' }}>
                        {isAr ? 'اختر نموذجاً أو اكتب اسماً' : 'Choose preset or type name'}
                      </span>
                    </div>

                    <input
                      type="text"
                      value={customModelId}
                      onChange={(e) => {
                        setCustomModelId(e.target.value);
                        setKeyTestStatus(null);
                      }}
                      placeholder={isAr ? "اسم النموذج (مثل: gemini-3.8-flash-high)" : "Model ID (e.g. gemini-3.8-flash-high)"}
                      dir="ltr"
                      style={{
                        width: '100%',
                        height: '40px',
                        boxSizing: 'border-box',
                        backgroundColor: 'rgba(24, 24, 27, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.09)',
                        borderRadius: '9px',
                        padding: '0 12px',
                        color: '#ffffff',
                        fontSize: '12.5px',
                        fontFamily: 'monospace',
                        outline: 'none',
                        transition: 'all 0.15s ease',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#f97316';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(249, 115, 22, 0.15)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.09)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />

                    {/* Presets Grid */}
                    {activeCfg.presets.length > 0 && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: activeCfg.presets.length <= 2 ? '1fr 1fr' : 'repeat(2, minmax(0, 1fr))',
                          gap: '5px',
                          marginTop: '3px',
                        }}
                      >
                        {activeCfg.presets.map((preset) => {
                          const isSelected = customModelId === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                setCustomModelId(preset.id);
                                setKeyTestStatus(null);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px',
                                padding: '5px 8px',
                                borderRadius: '7px',
                                backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                border: isSelected
                                  ? '1px solid rgba(249, 115, 22, 0.45)'
                                  : '1px solid rgba(255, 255, 255, 0.07)',
                                color: isSelected ? '#fb923c' : '#a1a1aa',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                textAlign: 'right',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                                  e.currentTarget.style.color = '#ffffff';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                                  e.currentTarget.style.color = '#a1a1aa';
                                }
                              }}
                            >
                              <span style={{ fontSize: '11px', fontWeight: isSelected ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {preset.label}
                              </span>
                              {preset.badge && (
                                <span
                                  style={{
                                    fontSize: '9px',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    backgroundColor: isSelected
                                      ? 'rgba(249, 115, 22, 0.28)'
                                      : 'rgba(255, 255, 255, 0.06)',
                                    color: isSelected ? '#fed7aa' : '#71717a',
                                    fontWeight: 500,
                                    flexShrink: 0,
                                  }}
                                >
                                  {preset.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Test Connection Button & Status */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginTop: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingKey}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '7px 12px',
                    borderRadius: '7px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#e4e4e7',
                    fontSize: '11.5px',
                    fontWeight: 500,
                    cursor: isTestingKey ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => !isTestingKey && (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
                  onMouseLeave={(e) => !isTestingKey && (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)')}
                >
                  {isTestingKey ? (
                    <Loader2 size={12} className="animate-spin" color="#f97316" />
                  ) : (
                    <Sparkles size={12} color="#f97316" />
                  )}
                  <span>{isTestingKey ? (isAr ? 'جاري الفحص...' : 'Testing...') : (isAr ? 'فحص الاتصال' : 'Test Connection')}</span>
                </button>

                {keyTestStatus && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      borderRadius: '7px',
                      backgroundColor: keyTestStatus.ok ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      border: `1px solid ${keyTestStatus.ok ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                      color: keyTestStatus.ok ? '#34d399' : '#f87171',
                      fontSize: '11px',
                      fontWeight: 500,
                      maxWidth: '220px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: keyTestStatus.ok ? '#10b981' : '#ef4444',
                        boxShadow: keyTestStatus.ok ? '0 0 5px #10b981' : 'none',
                        flexShrink: 0,
                      }}
                    />
                    <span>{keyTestStatus.message}</span>
                  </div>
                )}
              </div>

              {/* Error Banner */}
              {customError && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#f87171',
                    fontSize: '11.5px',
                    lineHeight: 1.5,
                  }}
                >
                  {customError}
                </div>
              )}

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={isSubmittingCustom}
                style={{
                  width: '100%',
                  height: '42px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: isSubmittingCustom ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
                  transition: 'all 0.15s ease',
                  marginTop: '2px',
                }}
                onMouseEnter={(e) => !isSubmittingCustom && (e.currentTarget.style.filter = 'brightness(1.08)')}
                onMouseLeave={(e) => !isSubmittingCustom && (e.currentTarget.style.filter = 'none')}
              >
                {isSubmittingCustom ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>{isAr ? 'جاري تفعيل الوكيل والدخول...' : 'Activating agent & entering...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>{isAr ? 'الدخول إلى الاستوديو وتفعيل الوكيل' : 'Launch Studio & Activate Agent'}</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <>
              {/* Card Title based on active step */}
              <div
                style={{
                  fontSize: '14.5px',
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: '18px',
                }}
              >
                {prereqs.loading
                  ? (isAr ? 'فحص جاهزية النظام...' : 'Checking prerequisites...')
                  : !prereqs.nodeInstalled
                  ? (isAr ? 'إعداد النظام (1 / 2) • بيئة Node.js' : 'System Setup (1 / 2) • Node.js')
                  : !prereqs.agyInstalled
                  ? (isAr ? 'إعداد النظام (2 / 2) • محرك الذكاء الاصطناعي' : 'System Setup (2 / 2) • AI Engine')
                  : 'Sign in'}
              </div>

          {/* Loading Prerequisites State */}
          {prereqs.loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '16px 0' }}>
              <Loader2 size={20} className="animate-spin" color="#f97316" />
              <span style={{ fontSize: '13px', color: '#a1a1aa' }}>{isAr ? 'جاري التحقق من متطلبات التشغيل...' : 'Checking runtime requirements...'}</span>
            </div>
          ) : !prereqs.nodeInstalled ? (
            /* STEP 1: Node.js is MISSING */
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  color: '#fca5a5',
                  fontSize: '12.5px',
                  lineHeight: 1.6,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  direction: 'rtl',
                  textAlign: 'right',
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#f87171' }} />
                <span>{isAr ? 'بيئة Node.js غير مثبتة على جهازك. يتطلب التطبيق وجود Node.js (الإصدار 18 فما فوق) لتشغيل محرك الموشن وتوليد المشاهد.' : 'Node.js is not installed. afterAi requires Node.js (v18+) to run the motion engine and render scenes.'}</span>
              </div>

              {/* Primary Download Button */}
              <button
                type="button"
                onClick={() => {
                  window.open('https://nodejs.org/en/download', '_blank');
                  setHasDownloadedNode(true);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  backgroundColor: '#f97316',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(249, 115, 22, 0.35)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ea580c')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f97316')}
              >
                <Download size={16} />
                <span>{isAr ? 'تحميل Node.js (الموقع الرسمي)' : 'Download Node.js (Official Site)'}</span>
              </button>

              {/* Guidance & Restart Button */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '11.5px', color: '#a1a1aa', lineHeight: 1.5 }}>
                  {isAr ? 'بعد إتمام تثبيت Node.js، اضغط الزر أدناه لإعادة تشغيل التطبيق للتعرف عليه:' : 'After installing Node.js, click below to restart the application:'}
                </span>
                <button
                  type="button"
                  onClick={handleRestartApp}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
                >
                  <RotateCcw size={14} />
                  <span>{isAr ? 'إعادة تشغيل التطبيق' : 'Restart Application'}</span>
                </button>
              </div>
            </div>
          ) : !prereqs.agyInstalled ? (
            /* STEP 2: Node is present, but agy CLI is MISSING */
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
              {/* Node.js Ready Badge */}
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '8px',
                  padding: '7px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#34d399',
                  direction: 'rtl',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} color="#10b981" />
                  <span style={{ fontWeight: 600 }}>{isAr ? 'Node.js متوفر' : 'Node.js Available'}</span>
                </div>
                <span style={{ fontFamily: 'monospace', color: '#a1a1aa', direction: 'ltr' }}>
                  {prereqs.nodeVersion || 'v20+'}
                </span>
              </div>

              {!isInstallingAgy ? (
                /* Ready to Install agy */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '12.5px', color: '#a1a1aa', lineHeight: 1.6, textAlign: 'right', direction: 'rtl' }}>
                    {isAr ? <>تتطلب معالجة ومونتاج الفيديو بالذكاء الاصطناعي تثبيت أداة <strong style={{ color: '#ffffff' }}>Google Antigravity (agy)</strong>.</> : <>AI video processing requires the <strong style={{ color: '#ffffff' }}>Google Antigravity (agy)</strong> tool.</>}
                  </div>

                  {/* Primary Install AI Tool Button */}
                  <button
                    type="button"
                    onClick={handleInstallAgy}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 18px',
                      borderRadius: '10px',
                      backgroundColor: '#f97316',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(249, 115, 22, 0.35)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ea580c')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f97316')}
                  >
                    <Download size={16} />
                    <span>{isAr ? 'تثبيت أداة الذكاء الاصطناعي الآن' : 'Install AI Engine Now'}</span>
                  </button>

                  {/* Failure Box: Retry and View Details */}
                  {agyInstallError && (
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        textAlign: 'right',
                        direction: 'rtl',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontSize: '12px' }}>
                        <AlertCircle size={15} style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{agyInstallError}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={handleInstallAgy}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)')}
                        >
                          <RotateCcw size={13} />
                          <span>{isAr ? 'إعادة المحاولة' : 'Retry'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowInstallDetails(!showInstallDetails)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#d4d4d8',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.09)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
                        >
                          {showInstallDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          <span>{showInstallDetails ? (isAr ? 'إخفاء التفاصيل' : 'Hide Details') : (isAr ? 'عرض التفاصيل' : 'Show Details')}</span>
                        </button>
                      </div>

                      {/* Expanded Details Terminal Log */}
                      {showInstallDetails && (
                        <div
                          style={{
                            maxHeight: '130px',
                            overflowY: 'auto',
                            backgroundColor: '#09090b',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            fontSize: '10.5px',
                            fontFamily: 'monospace',
                            color: '#a1a1aa',
                            lineHeight: 1.4,
                            direction: 'ltr',
                            textAlign: 'left',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            marginTop: '4px',
                          }}
                        >
                          {installLogsHistory.length > 0
                            ? installLogsHistory.join('\n')
                            : (isAr ? 'لا توجد سجلات مخرجات مسجلة.' : 'No output logs recorded.')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manual PowerShell Command Card with Copy Button */}
                  <div
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', direction: 'rtl' }}>
                      <span style={{ fontSize: '11px', color: '#71717a' }}>{isAr ? 'أو التثبيت اليدوي عبر PowerShell:' : 'Or manual install via PowerShell:'}</span>
                      <button
                        type="button"
                        onClick={handleCopyInstallCommand}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'none',
                          border: 'none',
                          color: copiedCommand ? '#34d399' : '#f97316',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {copiedCommand ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedCommand ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ الأمر' : 'Copy Command')}</span>
                      </button>
                    </div>

                    <div
                      style={{
                        fontSize: '10.5px',
                        color: '#d4d4d8',
                        direction: 'ltr',
                        textAlign: 'left',
                        fontFamily: 'monospace',
                        backgroundColor: '#09090b',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        overflowX: 'auto',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      irm https://antigravity.google/cli/install.ps1 | iex
                    </div>
                  </div>
                </div>
              ) : (
                /* Installing: Animated Indeterminate Bar + Live Output + Cancel Button */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', padding: '6px 0', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f4f4f5', fontWeight: 600 }}>
                    <Loader2 size={16} className="animate-spin" color="#f97316" />
                    <span>{isAr ? 'جاري تثبيت أداة الذكاء الاصطناعي في الخلفية...' : 'Installing AI engine in the background...'}</span>
                  </div>

                  {/* Indeterminate Animated Progress Bar */}
                  <div
                    style={{
                      width: '100%',
                      height: '6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        borderRadius: '3px',
                        background: 'linear-gradient(90deg, #f97316, #fbbf24)',
                        animation: 'indeterminateBar 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                      }}
                    />
                  </div>

                  {/* Last Log Line Console Pill */}
                  <div
                    style={{
                      width: '100%',
                      backgroundColor: '#09090b',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: '#e4e4e7',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      direction: 'ltr',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <Terminal size={12} color="#f97316" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {agyInstallLog || (isAr ? 'جاري معالجة أمر التثبيت...' : 'Processing install command...')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', fontSize: '11px', color: '#71717a' }}>
                    <span>{isAr ? 'المهلة المحددة: 5 دقائق' : 'Timeout: 5 minutes'}</span>
                    <button
                      type="button"
                      onClick={handleCancelAgyInstall}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#f87171',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 500,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.16)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)')}
                    >
                      <X size={12} />
                      <span>{isAr ? 'إلغاء العملية' : 'Cancel'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* STEP 3: Both Node and agy are Ready -> Standard Sign In Card */
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Ready Indicator */}
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '11.5px',
                  color: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  marginBottom: '18px',
                  direction: 'rtl',
                }}
              >
                <CheckCircle2 size={13} color="#10b981" />
                <span>{isAr ? 'متطلبات النظام جاهزة (Node.js & agy)' : 'System requirements ready (Node.js & agy)'}</span>
              </div>

              {isAuthenticating ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      color: '#a1a1aa',
                      fontSize: '13.5px',
                      fontWeight: 500,
                    }}
                  >
                    <Loader2 size={16} className="animate-spin" color="#f97316" />
                    <span>{authStepMessage || 'Awaiting Authentication...'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelAuth}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#52525b',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      marginTop: '14px',
                      padding: '4px',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#52525b')}
                  >
                    {isAr ? 'إلغاء والمحاولة لاحقاً' : 'Cancel and try later'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '12px 18px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Official Colorful Google G Icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{isAr ? 'تسجيل الدخول بحساب Google' : 'Sign in with Google'}</span>
                </button>
              )}

              {/* Error Banner */}
              {authError && (
                <div
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#f87171',
                    fontSize: '12px',
                    marginTop: '14px',
                    lineHeight: 1.5,
                    textAlign: 'center',
                  }}
                >
                  {authError}
                </div>
              )}
            </div>
          )}
          </>
          )}
        </div>

        {/* Having trouble? Let us know */}
        <div
          dir="ltr"
          style={{
            marginTop: '22px',
            fontSize: '11.5px',
            color: '#52525b',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            direction: 'ltr',
          }}
        >
          <span>Having trouble?</span>
          <span
            style={{
              color: '#71717a',
              textDecoration: 'underline',
              cursor: 'pointer',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#d4d4d8')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#71717a')}
            onClick={() => {
              window.open('https://accounts.google.com', '_blank');
            }}
          >
            Let us know
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
