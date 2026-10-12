import React, { useState, useEffect, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { Header, UpdateInfo } from './components/Header';
import { ChatPanel } from './components/ChatPanel';
import { PlayerView } from './components/PlayerView';
import { CodeModal } from './components/CodeModal';
import { ExportModal } from './components/ExportModal';
import { SessionsModal } from './components/SessionsModal';
import { SettingsModal } from './components/SettingsModal';
import { TextInspectorModal } from './components/TextInspectorModal';
import { AuthScreen, UserProfile } from './components/AuthScreen';
import { SessionMetadata, SessionData } from './types/session';
import { AudioClip } from './types/audio';
import { AttachedImage, AttachedAudio, AttachedVideo, ChatMessage } from './types/chat';
import { SceneData, ElementTransform, TextElementData } from './types/sceneData';
import { useLanguage } from './i18n/LanguageContext';

export const App: React.FC = () => {
  const { language, t } = useLanguage();
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('remotion_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return localStorage.getItem('remotion_active_session') || 'session_default';
  });
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    fetch('/api/check-update')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.hasUpdate) {
          setUpdateInfo(data);
        }
      })
      .catch(() => {});
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'agent',
      text: t.chat.welcomeMessage,
      timestamp: t.common.now,
    },
  ]);

  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [currentToolAction, setCurrentToolAction] = useState<string | null>(null);
  const sanitizeModelForMode = (model: string | undefined, mode?: string): string => {
    if (mode === 'api_key') return model || 'liquid/lfm-2.5-2.6b:free';
    if (!model || !model.startsWith('gemini-3.8-flash-')) return 'gemini-3.8-flash-high';
    return model;
  };

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('remotion_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.agentMode === 'api_key' && parsed.modelId) {
          return parsed.modelId;
        }
        if (parsed.agentMode === 'google') {
          return 'gemini-3.8-flash-high';
        }
      }
    } catch (_) {}
    return 'gemini-3.8-flash-high';
  });
  const [playerKey, setPlayerKey] = useState<number>(1);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [pinnedFrame, setPinnedFrame] = useState<{ frame: number; timeSeconds: string } | null>(null);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [attachedAudio, setAttachedAudio] = useState<AttachedAudio | null>(null);
  const [attachedVideo, setAttachedVideo] = useState<AttachedVideo | null>(null);
  const [sceneData, setSceneData] = useState<SceneData | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editingTextElement, setEditingTextElement] = useState<TextElementData | null>(null);

  const messagesRef = useRef<ChatMessage[]>(messages);
  const currentSessionIdRef = useRef<string>(currentSessionId);
  const audioClipsRef = useRef<AudioClip[]>(audioClips);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    audioClipsRef.current = audioClips;
  }, [audioClips]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Keep single initial welcome message synchronized when switching interface language
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && (prev[0].id === 'welcome' || prev[0].id.startsWith('welcome-'))) {
        return [
          {
            ...prev[0],
            text: t.chat.welcomeMessage,
            timestamp: t.common.now,
          },
        ];
      }
      return prev;
    });
  }, [t]);

  // Stop active generation cleanly on demand
  const handleStopGeneration = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const activeId = currentSessionIdRef.current;
    try {
      await fetch('/api/chat/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeId }),
      });
    } catch (e) {}

    setIsBusy(false);
    setCurrentToolAction(null);

    setMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming
          ? {
              ...msg,
              isStreaming: false,
              text: msg.text
                ? `${msg.text}\n\n(${language === 'ar' ? 'تم إيقاف التوليد بواسطة المستخدم' : 'Generation stopped by user'})`
                : (language === 'ar' ? 'تم إيقاف التوليد بواسطة المستخدم.' : 'Generation stopped by user.'),
              steps: msg.steps?.map((s) => (s.status === 'running' ? { ...s, status: 'completed' as const } : s)),
            }
          : msg
      )
    );
    setPlayerKey((k) => k + 1);

    setTimeout(() => {
      saveCurrentSessionState(activeId, undefined, undefined, true);
    }, 300);
  };

  // Load Sessions List on Mount
  const loadSessionsList = async (preferredId?: string) => {
    try {
      const res = await fetch('/api/sessions');
      if (!res.ok) return;
      const data = await res.json();
      const list: SessionMetadata[] = data.sessions || [];
      setSessions(list);

      const savedSessionId = localStorage.getItem('remotion_active_session');
      const targetId = preferredId || (savedSessionId && list.some((s) => s.id === savedSessionId) ? savedSessionId : list[0]?.id);
      if (targetId) {
        await loadSessionDetails(targetId);
      }
    } catch (err) {
      console.error('[App] Failed to fetch sessions list:', err);
    }
  };

  const loadSessionDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}?sync=true`);
      if (!res.ok) return;
      const data: { session: SessionData } = await res.json();
      if (data?.session) {
        setCurrentSessionId(data.session.id);
        currentSessionIdRef.current = data.session.id;
        localStorage.setItem('remotion_active_session', data.session.id);
        if (data.session.messages && data.session.messages.length > 0) {
          setMessages(data.session.messages);
        }
        if (data.session.model) {
          setSelectedModel(sanitizeModelForMode(data.session.model, user?.agentMode));
        }
        if (data.session.audioClips && Array.isArray(data.session.audioClips) && data.session.audioClips.length > 0) {
          setAudioClips(data.session.audioClips);
        } else {
          try {
            const parseRes = await fetch('/api/scene/parse-audio');
            if (parseRes.ok) {
              const parseData = await parseRes.json();
              if (parseData.clips && Array.isArray(parseData.clips)) {
                setAudioClips(parseData.clips);
              } else {
                setAudioClips([]);
              }
            } else {
              setAudioClips([]);
            }
          } catch (_) {
            setAudioClips([]);
          }
        }
        if (data.session.sceneData) {
          setSceneData(data.session.sceneData);
        } else {
          fetchSceneData();
        }
        // Force player remount to reflect restored scene code immediately
        setPlayerKey((k) => k + 1);
      }
    } catch (err) {
      console.error('[App] Failed to load session details:', err);
    }
  };

  const fetchSceneData = async () => {
    try {
      const res = await fetch('/api/scene-data');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSceneData(json.data);
        }
      }
    } catch (err) {
      console.error('[App] Failed to fetch scene data:', err);
    }
  };

  const handleUpdateTextElement = async (updated: {
    id: string;
    text: string;
    fontSize: number;
    color?: string;
    isDeleted?: boolean;
  }) => {
    try {
      const res = await fetch('/api/scene-data/text', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSceneData(json.data);
          setPlayerKey((k) => k + 1);
        }
      }
    } catch (err) {
      console.error('[App] Failed to update text element:', err);
    }
  };

  const handleUpdateElementTiming = async (payload: {
    kind: 'text' | 'card';
    id: string;
    startFrame?: number;
    durationInFrames?: number;
    track?: number;
    holdToEnd?: boolean;
    isDeleted?: boolean;
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/scene-data/element', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSceneData(json.data);
          setPlayerKey((k) => k + 1);
          return true;
        }
      } else if (res.status === 409) {
        console.warn('[App] Element timing update rejected due to collision');
        return false;
      }
    } catch (err) {
      console.error('[App] Failed to update element timing:', err);
    }
    return false;
  };

  const handleUpdateElementTransform = async (payload: {
    kind: 'text' | 'card';
    id: string;
    transform: ElementTransform;
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/scene-data/transform', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, sessionId: currentSessionIdRef.current }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSceneData(json.data);
          // Seamless update: do NOT increment playerKey so playback continues uninterrupted!
          return true;
        }
      }
    } catch (err) {
      console.error('[App] Failed to update element transform:', err);
    }
    return false;
  };

  const handleDeleteElement = async (kind: 'text' | 'card', id: string): Promise<boolean> => {
    return handleUpdateElementTiming({
      kind,
      id,
      isDeleted: true,
    });
  };

  const handleSplitElement = async (
    kind: 'text' | 'card',
    id: string,
    splitFrame: number
  ): Promise<{ success: boolean; rightPieceId?: string; error?: string }> => {
    try {
      const res = await fetch('/api/scene-data/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, splitFrame, sessionId: currentSessionId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSceneData(data.data);
        return { success: true, rightPieceId: data.rightPiece?.id };
      }
      return { success: false, error: data.error || (language === 'ar' ? 'فشل في تقسيم العنصر' : 'Failed to split element') };
    } catch (err: any) {
      console.error('[App] Failed to split element:', err);
      return { success: false, error: err.message || (language === 'ar' ? 'خطأ في الاتصال بالخادم' : 'Server connection error') };
    }
  };

  const handleUndoSceneData = async () => {
    try {
      const res = await fetch('/api/scene-data/undo', {
        method: 'POST',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSceneData(json.data);
          setPlayerKey((k) => k + 1);
        }
      }
    } catch (err) {
      console.error('[App] Failed to undo scene data:', err);
    }
  };

  useEffect(() => {
    loadSessionsList();
    fetchSceneData();

    // Verify and sync encrypted server auth session
    const syncAuthSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
            localStorage.setItem('remotion_user', JSON.stringify(data.user));
            if (data.user.agentMode === 'api_key' && data.user.modelId) {
              setSelectedModel(data.user.modelId);
            }
            return;
          }
        }
        // If server had no session file yet, sync existing user from client storage
        const savedUser = localStorage.getItem('remotion_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.email) {
            if (parsed.agentMode === 'api_key' && parsed.modelId) {
              setSelectedModel(parsed.modelId);
            }
            await fetch('/api/auth/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user: parsed }),
            });
          }
        }

        try {
          const agentRes = await fetch('/api/agent/config');
          if (agentRes.ok) {
            const agentCfg = await agentRes.json();
            if (agentCfg && agentCfg.mode === 'api_key' && agentCfg.modelId) {
              setSelectedModel(agentCfg.modelId);
            }
          }
        } catch (_) {}
      } catch (e) {
        console.warn('[App] Could not verify encrypted auth session:', e);
      }
    };
    syncAuthSession();
  }, []);

  // Mirror messages continuously into localStorage per session
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      try {
        localStorage.setItem(`session_msgs_${currentSessionId}`, JSON.stringify(messages));
      } catch (_) {}
    }
  }, [messages, currentSessionId]);

  // Save session messages and state to server
  const saveCurrentSessionState = async (
    targetSessionId?: string,
    customMessages?: ChatMessage[],
    customTitle?: string,
    captureCode = false
  ) => {
    const activeId = targetSessionId || currentSessionIdRef.current;
    if (!activeId) return;
    try {
      await fetch(`/api/sessions/${activeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: customMessages || messagesRef.current,
          title: customTitle,
          model: selectedModel,
          captureCurrentCode: captureCode,
          audioClips: audioClipsRef.current,
        }),
      });
      // Refresh metadata in sessions list
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('[App] Failed to auto-save session state:', err);
    }
  };

  // Audio Clips Timeline Handlers
  const handleAddAudioClip = (clip: AudioClip) => {
    setAudioClips((prev) => {
      const updated = [...prev, clip];
      fetch(`/api/sessions/${currentSessionIdRef.current}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioClips: updated }),
      }).catch((e) => console.error('[App] Failed to save added audio clip:', e));
      return updated;
    });
  };

  const handleUpdateAudioClip = (clipId: string, updates: Partial<AudioClip>) => {
    setAudioClips((prev) => {
      const updated = prev.map((c) => (c.id === clipId ? { ...c, ...updates } : c));
      fetch(`/api/sessions/${currentSessionIdRef.current}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioClips: updated }),
      }).catch((e) => console.error('[App] Failed to save updated audio clip:', e));
      return updated;
    });
  };

  const handleDeleteAudioClip = async (clipId: string) => {
    const clipToDelete = audioClipsRef.current.find((c) => c.id === clipId);
    const updated = audioClipsRef.current.filter((c) => c.id !== clipId);
    setAudioClips(updated);

    try {
      await fetch('/api/scene/sync-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionIdRef.current,
          deletedClip: clipToDelete,
          remainingClips: updated,
        }),
      });
      // Force Remotion Player reload to reflect silenced audio immediately
      setPlayerKey((k) => k + 1);
    } catch (err) {
      console.error('[App] Failed to sync audio removal:', err);
    }
  };

  const handleClearAllAudio = async () => {
    setAudioClips([]);
    try {
      await fetch('/api/scene/sync-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionIdRef.current,
          clearAll: true,
          remainingClips: [],
        }),
      });
      setPlayerKey((k) => k + 1);
    } catch (err) {
      console.error('[App] Failed to clear all audio:', err);
    }
  };

  // Start a New Session
  const handleNewSession = async () => {
    if (isBusy) return;
    try {
      setIsBusy(true);
      setCurrentToolAction(t.chat.newSessionAction);

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          previousSessionId: currentSessionIdRef.current,
          title: language === 'ar'
            ? `مشروع جديد ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
            : `New Project ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
        }),
      });

      if (!res.ok) throw new Error(language === 'ar' ? 'فشل إنشاء الجلسة في الخادم' : 'Failed to create session on server');
      const data: { session: SessionData; sceneData?: any } = await res.json();

      setCurrentSessionId(data.session.id);
      currentSessionIdRef.current = data.session.id;
      localStorage.setItem('remotion_active_session', data.session.id);
      setMessages(data.session.messages || []);
      setSelectedModel(sanitizeModelForMode(data.session.model, user?.agentMode));
      setAudioClips([]);
      if (data.sceneData) {
        setSceneData(data.sceneData);
      } else {
        await fetchSceneData();
      }

      // Force refresh player to show clean starter scene
      setPlayerKey((k) => k + 1);

      // Refresh sessions list
      const listRes = await fetch('/api/sessions');
      if (listRes.ok) {
        const listData = await listRes.json();
        setSessions(listData.sessions || []);
      }
    } catch (err: any) {
      console.error('[App] handleNewSession error:', err);
    } finally {
      setIsBusy(false);
      setCurrentToolAction(null);
    }
  };

  // Switch between sessions
  const handleSwitchSession = async (targetSessionId: string) => {
    if (isBusy || targetSessionId === currentSessionIdRef.current) return;
    try {
      setIsBusy(true);
      setCurrentToolAction(t.chat.switchSessionAction);

      const res = await fetch(`/api/sessions/${targetSessionId}/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentSessionId: currentSessionIdRef.current }),
      });

      if (!res.ok) throw new Error(language === 'ar' ? 'فشل التبديل للجلسة' : 'Failed to switch session');
      const data: { session: SessionData; sceneData?: any } = await res.json();

      setCurrentSessionId(data.session.id);
      currentSessionIdRef.current = data.session.id;
      localStorage.setItem('remotion_active_session', data.session.id);
      const serverMsgs = data.session.messages || [];
      const localCachedRaw = localStorage.getItem(`session_msgs_${data.session.id}`);
      let resolvedMsgs = serverMsgs;
      if (localCachedRaw) {
        try {
          const cached = JSON.parse(localCachedRaw);
          if (Array.isArray(cached) && cached.length > serverMsgs.length) {
            resolvedMsgs = cached;
          }
        } catch (_) {}
      }
      setMessages(resolvedMsgs);
      if (data.session.model) {
        setSelectedModel(sanitizeModelForMode(data.session.model, user?.agentMode));
      }
      setAudioClips(data.session.audioClips || []);
      if (data.sceneData) {
        setSceneData(data.sceneData);
      } else {
        await fetchSceneData();
      }

      // Force player refresh so it mounts restored scene
      setPlayerKey((k) => k + 1);

      // Update sessions list metadata
      const listRes = await fetch('/api/sessions');
      if (listRes.ok) {
        const listData = await listRes.json();
        setSessions(listData.sessions || []);
      }
    } catch (err: any) {
      console.error('[App] handleSwitchSession error:', err);
    } finally {
      setIsBusy(false);
      setCurrentToolAction(null);
    }
  };

  // Rename Session
  const handleRenameSession = async (id: string, newTitle: string) => {
    try {
      await fetch(`/api/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: newTitle, updatedAt: Date.now() } : s))
      );
    } catch (err) {
      console.error('[App] handleRenameSession error:', err);
    }
  };

  // Delete Session
  const handleDeleteSession = async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      const updated = sessions.filter((s) => s.id !== id);
      setSessions(updated);

      // If deleted current session, switch to first remaining or create new
      if (id === currentSessionIdRef.current) {
        if (updated.length > 0) {
          handleSwitchSession(updated[0].id);
        } else {
          handleNewSession();
        }
      }
    } catch (err) {
      console.error('[App] handleDeleteSession error:', err);
    }
  };

  const handleSendMessage = async (
    text: string,
    imagesToSend?: AttachedImage[],
    audioToSend?: AttachedAudio | null,
    videoToSend?: AttachedVideo | null
  ) => {
    if (isBusy) return;

    const userMessageId = `user-${Date.now()}`;
    const agentMessageId = `agent-${Date.now()}`;

    const activePin = pinnedFrame;
    if (activePin) {
      setPinnedFrame(null);
    }

    const activeImages = imagesToSend !== undefined ? imagesToSend : attachedImages;
    setAttachedImages([]);

    const activeAudio = audioToSend !== undefined ? audioToSend : attachedAudio;
    setAttachedAudio(null);

    const activeVideo = videoToSend !== undefined ? videoToSend : attachedVideo;
    setAttachedVideo(null);

    const isVoiceover = Boolean(activeAudio && activeAudio.mode === 'voiceover');

    const voiceoverDirective = language === 'ar'
      ? 'قم بتوليد ومطابقة المشهد وتنسيق الحركات البصرية بدقة متزامنة مع هذا التعليق الصوتي المرفق. استمع إلى ملف الصوت المرفق عبر أداة view_file وحلّل محتواه الكلامي واستخرج النصوص والجمل المنطوقة والتوقيتات الزمنية لكل جملة، ثم صمم وابرمج مشهداً سينمائياً احترافياً كاملاً في Scene.tsx يعرض تلك النصوص والعناوين والبطاقات الحركية بتزامن دقيق مع الصوت. هذا أمر تصميم فيديو وليس محادثة عادية، يجب تعديل كود Scene.tsx و scene-data.json فوراً.'
      : 'Generate and match the scene animations synchronously with this attached voiceover audio. Analyze spoken text and timings, then design and program a full cinematic motion scene in Scene.tsx and scene-data.json displaying text titles and animated elements in tight sync with speech.';
    const userText = text.trim();
    let basePrompt: string;
    if (isVoiceover) {
      // Voiceover directive ALWAYS takes priority, user text is supplementary context
      basePrompt = userText
        ? (language === 'ar' ? `${voiceoverDirective}\n\n[ملاحظة إضافية من المستخدم]: ${userText}` : `${voiceoverDirective}\n\n[Additional User Note]: ${userText}`)
        : voiceoverDirective;
    } else {
      basePrompt = userText
        || (activeVideo ? (language === 'ar' ? `قم بتحليل هذا الفيديو المرجعي المرفق واللقطات المفتاحية المستخرجة منه (${activeVideo.name})، واستلهم منه الحركات والانتقالات وتناسق الألوان والهوية البصرية لإعادة تصميم وبرمجة المشهد في Scene.tsx باستخدام Remotion.` : `Analyze this attached reference video and its keyframes (${activeVideo.name}), drawing inspiration for motion design, transitions, and visual theme in Scene.tsx using Remotion.`) : '')
        || (activeImages && activeImages.length > 0 ? (language === 'ar' ? 'قم بتحليل هذه الصورة المرفقة واستخدامها أو تطبيق التعديل المطلوب بناءً عليها.' : 'Analyze this attached image and use it or apply the requested modification accordingly.') : '')
        || (activeAudio ? (language === 'ar' ? 'استمع إلى هذا التسجيل الصوتي المرفق من المستخدم. إذا كان مجرد تحية أو سؤال أو محادثة فأجب بلباقة في الشات دون لمس كود المشهد، وإذا كان أمراً بتعديل المشهد فنفذه برمجياً دون وضع الصوت في الفيديو.' : 'Listen to this attached audio recording from the user. If it is a greeting or question, respond courteously in chat without modifying scene code; if it is a command to modify the scene, implement it programmatically.') : '');
    }
    if (!basePrompt && (!activeImages || activeImages.length === 0) && !activeAudio && !activeVideo) return;

    const promptToSend = activePin
      ? (language === 'ar' ? `[التوقيت المستهدف والمحدد في التايم لاين: الإطار ${activePin.frame} (الثانية ${activePin.timeSeconds})]\n${basePrompt}` : `[Target Timeline Frame: ${activePin.frame} (${activePin.timeSeconds}s)]\n${basePrompt}`)
      : basePrompt;

    const userMsgText = activePin
      ? (language === 'ar' ? `[الإطار ${activePin.frame} • ${activePin.timeSeconds}ث]\n${text}` : `[Frame ${activePin.frame} • ${activePin.timeSeconds}s]\n${text}`)
      : text;

    const userMsg: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      text: userMsgText,
      images: activeImages && activeImages.length > 0 ? [...activeImages] : undefined,
      audio: activeAudio ? { ...activeAudio } : undefined,
      video: activeVideo ? { ...activeVideo } : undefined,
      timestamp: new Date().toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    // STRICT: Only add to timeline if mode is explicitly 'voiceover'!
    if (activeAudio && isVoiceover) {
      const voiceoverClip: AudioClip = {
        id: `voice_${Date.now()}`,
        name: language === 'ar' ? `تعليق صوتي (${activeAudio.name})` : `Voiceover (${activeAudio.name})`,
        src: activeAudio.serverUrl || activeAudio.dataUrl,
        startFrame: 0,
        durationInFrames: activeAudio.durationFrames,
        volume: 1,
        color: '#10b981',
      };
      handleAddAudioClip(voiceoverClip);
    }

    let didExecuteTools = false;
    let receivedStreamError: string | null = null;
    let currentStageIndex = 0; // 0 = initial, 1 = analyzing, 2 = building, 3 = validating, 4 = previewing, 5 = all done

    const PRODUCTION_STAGES = [
      { id: '1', label: t.chat.stage1 },
      { id: '2', label: t.chat.stage2 },
      { id: '3', label: t.chat.stage3 },
      { id: '4', label: t.chat.stage4 },
    ];

    const updateStageProgress = (targetStage: number, textDelta?: string, isFinal = false) => {
      if (targetStage > currentStageIndex) {
        currentStageIndex = targetStage;
      }

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== agentMessageId) return msg;

          let updatedSteps = msg.steps;
          // Display steps strictly when video editing tools are executing
          if (didExecuteTools || currentStageIndex >= 2) {
            updatedSteps = PRODUCTION_STAGES.map((stage, idx) => {
              const stepNumber = idx + 1;
              if (isFinal || currentStageIndex >= 5) {
                return { ...stage, status: 'completed' as const };
              }
              if (stepNumber < currentStageIndex) {
                return { ...stage, status: 'completed' as const };
              } else if (stepNumber === currentStageIndex) {
                return { ...stage, status: 'running' as const };
              } else {
                return { ...stage, status: 'pending' as const };
              }
            });
          }

          return {
            ...msg,
            text: textDelta !== undefined ? msg.text + textDelta : msg.text,
            steps: updatedSteps,
          };
        })
      );
    };

    const agentMsg: ChatMessage = {
      id: agentMessageId,
      sender: 'agent',
      text: '',
      isStreaming: true,
      timestamp: new Date().toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    const initialTurnMessages = [...messagesRef.current, userMsg, agentMsg];
    setMessages(initialTurnMessages);
    setIsBusy(true);
    setCurrentToolAction(`${t.chat.stage1}...`);
    const startTime = Date.now();

    // Fasten targetSessionId immutably for this entire turn
    const targetSessionId = currentSessionIdRef.current;

    // Auto-update session title if it is a fresh session
    const currentSession = sessions.find((s) => s.id === targetSessionId);
    let updatedTitle: string | undefined;
    if (currentSession && (
      currentSession.title.startsWith('مشروع جديد') ||
      currentSession.title.startsWith('New Project') ||
      currentSession.title === 'مشروع الفيديو الافتراضي' ||
      currentSession.title === 'مشروع الفيديو' ||
      currentSession.title === 'Video Project'
    )) {
      const trimmed = text.length > 28 ? text.slice(0, 28) + '...' : text;
      updatedTitle = trimmed;
      handleRenameSession(targetSessionId, trimmed);
    }

    // Immediately persist user prompt to localStorage and server to survive reloads
    if (targetSessionId) {
      try {
        localStorage.setItem(`session_msgs_${targetSessionId}`, JSON.stringify(initialTurnMessages));
        saveCurrentSessionState(targetSessionId, initialTurnMessages, updatedTitle, false);
      } catch (_) {}
    }

    const hasPriorUserMessages = messages.some((m) => m.sender === 'user');
    const continueConv = hasPriorUserMessages;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          prompt: promptToSend,
          model: selectedModel,
          agentMode: user?.agentMode,
          language: language,
          continueConversation: continueConv,
          sessionId: targetSessionId,
          images: activeImages && activeImages.length > 0 ? activeImages.map((img) => ({
            id: img.id,
            name: img.name,
            dataUrl: img.dataUrl,
            source: img.source,
            frame: img.frame,
            timeSeconds: img.timeSeconds,
          })) : undefined,
          audio: activeAudio ? {
            id: activeAudio.id,
            name: activeAudio.name,
            dataUrl: activeAudio.dataUrl,
            durationSeconds: activeAudio.durationSeconds,
            durationFrames: activeAudio.durationFrames,
            transcript: activeAudio.transcript,
            source: activeAudio.source,
            mode: activeAudio.mode,
          } : undefined,
          video: activeVideo ? {
            id: activeVideo.id,
            name: activeVideo.name,
            durationSeconds: activeVideo.durationSeconds,
            durationFrames: activeVideo.durationFrames,
            size: activeVideo.size,
            serverUrl: activeVideo.serverUrl,
            relativePath: activeVideo.relativePath,
            fullPath: activeVideo.fullPath,
            thumbnailUrl: activeVideo.thumbnailUrl,
            keyframes: activeVideo.keyframes,
          } : undefined,
        }),
      });

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('data:')) {
            const dataStr = line.replace(/^data:\s*/, '');
            try {
              const data = JSON.parse(dataStr);

              if (data.event === 'saved_images' && Array.isArray(data.images)) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === userMessageId
                      ? {
                          ...msg,
                          images: data.images,
                        }
                      : msg
                  )
                );
              } else if (data.event === 'saved_audio' && data.audio) {
                // Update audio clips with permanent server URL
                if (data.audio.serverUrl) {
                  setAudioClips((prev) =>
                    prev.map((clip) =>
                      clip.id.startsWith('voice_') || clip.src.startsWith('data:audio')
                        ? { ...clip, src: data.audio.serverUrl }
                        : clip
                    )
                  );
                }
              } else if (data.event === 'tool_event') {
                didExecuteTools = true;
                const toolTitle = data.actionTitle || data.toolName;
                const targetText = data.target ? `: ${data.target}` : '';
                setCurrentToolAction(`${toolTitle}${targetText}`);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === agentMessageId
                      ? {
                          ...msg,
                          activeTool: {
                            toolName: data.toolName,
                            actionTitle: data.actionTitle,
                            target: data.target,
                            state: data.state,
                            durationSeconds: data.durationSeconds,
                          },
                          stepNumber: data.stepIndex !== undefined ? data.stepIndex : msg.stepNumber,
                        }
                      : msg
                  )
                );
              } else if (data.event === 'token_usage') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === agentMessageId
                      ? {
                          ...msg,
                          thinkingTokens: data.thinkingTokens || msg.thinkingTokens,
                          outputTokens: data.outputTokens || msg.outputTokens,
                          stepNumber: data.stepIndex !== undefined ? data.stepIndex : msg.stepNumber,
                        }
                      : msg
                  )
                );
              } else if (data.event === 'diff_summary') {
                if (Array.isArray(data.diffs)) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === agentMessageId
                        ? {
                            ...msg,
                            diffSummary: data.diffs,
                          }
                        : msg
                    )
                  );
                }
              } else if (data.event === 'verification_result') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === agentMessageId
                      ? {
                          ...msg,
                          verificationResult: {
                            passed: Boolean(data.passed),
                            message: data.message,
                            errors: data.errors,
                          },
                        }
                      : msg
                  )
                );
              } else if (data.event === 'step_update') {
                const step = data.step_update;
                if (step?.step_index !== undefined) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === agentMessageId
                        ? {
                            ...msg,
                            stepNumber: step.step_index,
                          }
                        : msg
                    )
                  );
                }
                if (step?.step_type === 'checkpoint') {
                  updateStageProgress(1);
                  setCurrentToolAction(`${t.chat.stage1}...`);
                } else if (step?.step_type === 'tool') {
                  didExecuteTools = true;
                  if (step.state === 'ACTIVE') {
                    updateStageProgress(2);
                    setCurrentToolAction(`${t.chat.stage2}...`);
                  } else {
                    updateStageProgress(3);
                    setCurrentToolAction(`${t.chat.stage3}...`);
                  }
                } else if (step?.text_delta) {
                  if (didExecuteTools) {
                    updateStageProgress(4, step.text_delta);
                    setCurrentToolAction(`${t.chat.stage4}...`);
                  } else {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === agentMessageId ? { ...msg, text: msg.text + step.text_delta } : msg
                      )
                    );
                  }
                }
              } else if (data.event === 'error') {
                const errMessage = data.message || data.error || t.chat.agentError;
                receivedStreamError = errMessage;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === agentMessageId
                      ? {
                          ...msg,
                          text: errMessage,
                          isStreaming: false,
                        }
                      : msg
                  )
                );
                setCurrentToolAction(null);
              } else if (data.event === 'stderr') {
                if (data.text) {
                  setCurrentToolAction(data.text);
                }
              } else if (data.event === 'result' || data.event === 'done' || data.exitCode !== undefined) {
                const rawExitError = Boolean(data.exitCode && data.exitCode !== 0);
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== agentMessageId) return msg;
                    const hasAppliedChanges = Boolean(
                      (msg.diffSummary && msg.diffSummary.length > 0) ||
                      (msg.verificationResult && msg.verificationResult.passed)
                    );
                    const isError = Boolean(receivedStreamError || (rawExitError && !hasAppliedChanges && !didExecuteTools));
                    const errorText = receivedStreamError || data.error || t.chat.agentError;
                    const successText = (didExecuteTools || hasAppliedChanges)
                      ? t.chat.videoSceneSuccess
                      : (msg.text ? msg.text : t.chat.noSceneChanges);

                    if ((didExecuteTools || hasAppliedChanges) && !isError) {
                      updateStageProgress(5, undefined, true);
                      setPlayerKey((k) => k + 1);
                      fetch('/api/scene/parse-audio')
                        .then((r) => r.json())
                        .then((parsed) => {
                          if (parsed.clips && Array.isArray(parsed.clips) && parsed.clips.length > 0) {
                            setAudioClips(parsed.clips);
                          }
                        })
                        .catch(() => {});
                    }

                    return {
                      ...msg,
                      text: msg.text || data.result?.response || (isError ? errorText : successText),
                      isStreaming: false,
                      duration: (didExecuteTools || hasAppliedChanges)
                        ? Math.round(data.result?.duration_seconds || (Date.now() - startTime) / 1000)
                        : undefined,
                      steps: (didExecuteTools || hasAppliedChanges)
                        ? PRODUCTION_STAGES.map((s) => ({ ...s, status: isError ? ('pending' as const) : ('completed' as const) }))
                        : undefined,
                    };
                  })
                );
                setCurrentToolAction(null);
              }
            } catch (e) {
              // Non-JSON payload
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User aborted generation, state already handled cleanly
        return;
      }
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === agentMessageId
            ? {
                ...msg,
                isStreaming: false,
                text: `${language === 'ar' ? 'حدث خطأ أثناء تشغيل الوكيل:' : 'Error running agent:'} ${err.message}`,
              }
            : msg
        )
      );
    } finally {
      abortControllerRef.current = null;

      // Guarantee completion state in case stream closed before explicit result event
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== agentMessageId || !msg.isStreaming) return msg;
          const fallbackText = receivedStreamError
            ? receivedStreamError
            : (didExecuteTools
              ? t.chat.videoSceneSuccess
              : (msg.text || t.chat.noSceneChanges));
          return {
            ...msg,
            isStreaming: false,
            text: msg.text || fallbackText,
            duration: Math.round((Date.now() - startTime) / 1000),
            steps: didExecuteTools && !receivedStreamError
              ? PRODUCTION_STAGES.map((s) => ({ ...s, status: 'completed' as const }))
              : undefined,
          };
        })
      );

      setIsBusy(false);
      setCurrentToolAction(null);
      setPlayerKey((k) => k + 1);
      fetchSceneData();

      // Auto-persist finalized messages to current session
      setTimeout(() => {
        saveCurrentSessionState(targetSessionId, undefined, updatedTitle, didExecuteTools);
      }, 500);
    }
  };

  const activeSession = sessions.find((s) => s.id === currentSessionId);

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    localStorage.removeItem('remotion_user');
    setUser(null);
  };

  const handleSelectModel = async (modelId: string) => {
    setSelectedModel(sanitizeModelForMode(modelId, user?.agentMode));
    if (user && user.agentMode === 'api_key') {
      const updatedUser = { ...user, modelId };
      setUser(updatedUser);
      try {
        localStorage.setItem('remotion_user', JSON.stringify(updatedUser));
        await fetch('/api/models/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId }),
        });
      } catch (_) {}
    }
  };

  const handleLoginSuccess = async (loggedInUser: UserProfile) => {
    localStorage.setItem('remotion_user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    if (loggedInUser.agentMode === 'api_key' && loggedInUser.modelId) {
      setSelectedModel(loggedInUser.modelId);
    }
    try {
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: loggedInUser }),
      });
    } catch (e) {}
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
        <TitleBar />
        <div style={{ flex: 1, minHeight: 0 }}>
          <AuthScreen onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <TitleBar activeSessionTitle={activeSession?.title} />
      <Header
        onOpenCode={() => setIsCodeModalOpen(true)}
        onOpenExport={() => setIsExportModalOpen(true)}
        isAgentBusy={isBusy}
        onStop={handleStopGeneration}
        activeSessionTitle={activeSession?.title || t.chat.defaultSessionTitle}
        onOpenSessions={() => setIsSessionsModalOpen(true)}
        onNewSession={handleNewSession}
        user={user}
        onSignOut={handleSignOut}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        updateInfo={updateInfo}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <ChatPanel
          messages={messages}
          isBusy={isBusy}
          onSendMessage={handleSendMessage}
          onStop={handleStopGeneration}
          currentToolAction={currentToolAction}
          selectedModel={selectedModel}
          onSelectModel={handleSelectModel}
          agentMode={user?.agentMode || 'google'}
          agentProvider={user?.provider || 'openrouter'}
          onNewSession={handleNewSession}
          activeSessionTitle={activeSession?.title}
          pinnedFrame={pinnedFrame}
          onUnpinFrame={() => setPinnedFrame(null)}
          attachedImages={attachedImages}
          onAddAttachedImage={(img) => setAttachedImages((prev) => [...prev, img])}
          onRemoveAttachedImage={(id) => setAttachedImages((prev) => prev.filter((i) => i.id !== id))}
          onClearAttachedImages={() => setAttachedImages([])}
          attachedAudio={attachedAudio}
          onSetAttachedAudio={setAttachedAudio}
          onClearAttachedAudio={() => setAttachedAudio(null)}
          attachedVideo={attachedVideo}
          onSetAttachedVideo={setAttachedVideo}
          onClearAttachedVideo={() => setAttachedVideo(null)}
        />

        <PlayerView
          playerKey={playerKey}
          onRefresh={() => {
            fetchSceneData();
            setPlayerKey((k) => k + 1);
          }}
          pinnedFrame={pinnedFrame}
          onPinFrame={(frame, timeSeconds) => setPinnedFrame({ frame, timeSeconds })}
          onUnpinFrame={() => setPinnedFrame(null)}
          audioClips={audioClips}
          onAddAudioClip={handleAddAudioClip}
          onUpdateAudioClip={handleUpdateAudioClip}
          onDeleteAudioClip={handleDeleteAudioClip}
          onClearAllAudio={handleClearAllAudio}
          onCaptureSnapshot={(img) => setAttachedImages((prev) => [...prev, img])}
          sceneData={sceneData}
          onUpdateTextElement={handleUpdateTextElement}
          onUpdateElementTiming={handleUpdateElementTiming}
          onUndoSceneData={handleUndoSceneData}
          isBusy={isBusy}
          selectedElementId={selectedElementId}
          onSelectElement={setSelectedElementId}
          onUpdateElementTransform={handleUpdateElementTransform}
          onDeleteElement={handleDeleteElement}
          onSplitElement={handleSplitElement}
          onOpenTextInspector={(element) => setEditingTextElement(element)}
          isTextInspectorActive={Boolean(editingTextElement)}
        />
      </div>

      {/* Global Text Inspector Modal accessible from canvas and timeline */}
      <TextInspectorModal
        element={editingTextElement}
        isOpen={Boolean(editingTextElement)}
        onClose={() => setEditingTextElement(null)}
        onSave={async (updated) => {
          await handleUpdateTextElement(updated);
        }}
        isBusy={isBusy}
      />

      <SessionsModal
        isOpen={isSessionsModalOpen}
        onClose={() => setIsSessionsModalOpen(false)}
        sessions={sessions}
        activeSessionId={currentSessionId}
        onSelectSession={handleSwitchSession}
        onNewSession={handleNewSession}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
      />

      <CodeModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        defaultFileName={activeSession?.title}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        user={user}
        onSignOut={handleSignOut}
      />
    </div>
  );
};

export default App;
