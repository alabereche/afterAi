import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Sparkles,
  CheckCircle2,
  Loader2,
  User,
  Bot,
  Layers,
  Cpu,
  ChevronUp,
  ChevronDown,
  Check,
  Plus,
  Square,
  BookmarkCheck,
  X,
  Paperclip,
  Image as ImageIcon,
  Mic,
  Music,
  Play,
  Pause,
  Volume2,
  Video,
  AlertTriangle,
  Eye,
  FileCode,
  Terminal,
  Code2,
} from 'lucide-react';
import { MarkdownView } from './MarkdownView';
import { AttachedImage, AttachedAudio, AttachedVideo, ChatMessage, AgentStep } from '../types/chat';
import { AVAILABLE_MODELS, ModelOption } from '../types/models';
import {
  validateVideoFile,
  loadVideoElement,
  extractVideoKeyframes,
  fileToBase64,
} from '../utils/videoKeyframes';
import { useLanguage } from '../i18n/LanguageContext';

export type { AttachedImage, AttachedAudio, AttachedVideo, ChatMessage, AgentStep };

interface ChatPanelProps {
  messages: ChatMessage[];
  isBusy: boolean;
  onSendMessage: (
    text: string,
    images?: AttachedImage[],
    audio?: AttachedAudio | null,
    video?: AttachedVideo | null
  ) => void;
  onStop?: () => void;
  currentToolAction?: string | null;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  agentMode?: 'google' | 'api_key';
  agentProvider?: string;
  onNewSession?: () => void;
  activeSessionTitle?: string;
  pinnedFrame?: { frame: number; timeSeconds: string } | null;
  onUnpinFrame?: () => void;
  attachedImages?: AttachedImage[];
  onAddAttachedImage?: (image: AttachedImage) => void;
  onRemoveAttachedImage?: (id: string) => void;
  onClearAttachedImages?: () => void;
  attachedAudio?: AttachedAudio | null;
  onSetAttachedAudio?: (audio: AttachedAudio) => void;
  onClearAttachedAudio?: () => void;
  attachedVideo?: AttachedVideo | null;
  onSetAttachedVideo?: (video: AttachedVideo) => void;
  onClearAttachedVideo?: () => void;
}

// Modular Media Components for Professional Chat Display
const MessageAudioPlayer: React.FC<{ audio: AttachedAudio }> = ({ audio }) => {
  const { t } = useLanguage();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderRadius: '8px',
        backgroundColor: audio.mode === 'voiceover' ? 'rgba(249, 115, 22, 0.08)' : 'rgba(16, 185, 129, 0.08)',
        border: `1px solid ${audio.mode === 'voiceover' ? 'rgba(249, 115, 22, 0.22)' : 'rgba(16, 185, 129, 0.22)'}`,
        direction: 'rtl',
        width: '100%',
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: audio.mode === 'voiceover' ? '#f97316' : '#10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {audio.mode === 'voiceover' ? (
          <Volume2 size={14} color="#ffffff" />
        ) : (
          <Mic size={14} color="#ffffff" />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              color: '#f4f4f5',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {audio.name}
          </span>
          <span
            style={{
              fontSize: '9.5px',
              color: audio.mode === 'voiceover' ? '#fb923c' : '#34d399',
              backgroundColor: audio.mode === 'voiceover' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${audio.mode === 'voiceover' ? 'rgba(249, 115, 22, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              padding: '1px 5px',
              borderRadius: '4px',
            }}
          >
            {audio.mode === 'voiceover' ? t.chat.voiceoverBadge : t.chat.commandBadge}
          </span>
          <span
            style={{
              fontSize: '9.5px',
              color: '#a1a1aa',
              fontFamily: 'monospace',
            }}
          >
            {audio.durationSeconds}{t.common.seconds}
          </span>
        </div>
        <audio
          controls
          src={audio.serverUrl || audio.dataUrl}
          style={{
            width: '100%',
            height: '28px',
            marginTop: '6px',
            filter: 'invert(0.9) hue-rotate(180deg)',
            borderRadius: '4px',
          }}
        />
        {audio.transcript && (
          <span
            style={{
              fontSize: '10.5px',
              color: '#a1a1aa',
              marginTop: '4px',
              lineHeight: 1.4,
            }}
          >
            {t.chat.transcriptLabel} {audio.transcript}
          </span>
        )}
      </div>
    </div>
  );
};

const MessageVideoPlayer: React.FC<{
  video: AttachedVideo;
  onLightboxImage: (url: string) => void;
}> = ({ video, onLightboxImage }) => {
  const { t, format } = useLanguage();
  return (
    <div
      style={{
        padding: '10px 12px',
        backgroundColor: '#121216',
        borderRadius: '10px',
        border: '1px solid rgba(249, 115, 22, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        direction: 'rtl',
        maxWidth: '380px',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
          <Video size={14} color="#f97316" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              color: '#f4f4f5',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {video.name}
          </span>
        </div>
        <span
          style={{
            fontSize: '9.5px',
            color: '#fb923c',
            backgroundColor: 'rgba(249, 115, 22, 0.15)',
            border: '1px solid rgba(249, 115, 22, 0.3)',
            padding: '1px 6px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            flexShrink: 0,
          }}
        >
          {video.durationSeconds}{t.common.seconds} • {video.durationFrames} {t.common.frames}
        </span>
      </div>

      {(video.serverUrl || video.dataUrl) && (
        <div style={{ borderRadius: '8px', overflow: 'hidden', backgroundColor: '#000', maxHeight: '200px' }}>
          <video
            controls
            preload="metadata"
            src={video.serverUrl || video.dataUrl}
            style={{ width: '100%', maxHeight: '200px', display: 'block', outline: 'none' }}
          />
        </div>
      )}

      {video.keyframes && video.keyframes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
          <span style={{ fontSize: '10px', color: '#a1a1aa' }}>
            {format(t.chat.keyframesExtracted, { count: video.keyframes.length })}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '3px' }}>
            {video.keyframes.map((kf, kfIdx) => (
              <div
                key={kfIdx}
                onClick={() => onLightboxImage(kf.serverUrl || kf.dataUrl)}
                title={format(t.chat.keyframeTooltip, { idx: kfIdx + 1, sec: kf.timeSeconds, frame: kf.frameIndex })}
                style={{
                  position: 'relative',
                  width: '56px',
                  height: '34px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  backgroundColor: '#000',
                }}
              >
                <img
                  src={kf.serverUrl || kf.dataUrl}
                  alt={`Keyframe ${kfIdx}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    color: '#fb923c',
                    fontSize: '8px',
                    padding: '0 3px',
                    fontFamily: 'monospace',
                  }}
                >
                  {kf.timeSeconds}s
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const MessageImagesGrid: React.FC<{
  images: AttachedImage[];
  onLightboxImage: (url: string) => void;
}> = ({ images, onLightboxImage }) => {
  const { t } = useLanguage();
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
      }}
    >
      {images.map((img, idx) => (
        <div
          key={img.id || idx}
          onClick={() => onLightboxImage(img.serverUrl || img.dataUrl)}
          title={`${img.name} (${t.chat.clickToEnlarge})`}
          style={{
            position: 'relative',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            cursor: 'pointer',
            backgroundColor: '#0a0a0d',
            maxWidth: images.length === 1 ? '240px' : '120px',
            transition: 'transform 0.15s ease, border-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
          }}
        >
          <img
            src={img.serverUrl || img.dataUrl}
            alt={img.name}
            style={{
              width: '100%',
              height: images.length === 1 ? '160px' : '90px',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      ))}
    </div>
  );
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isBusy,
  onSendMessage,
  onStop,
  currentToolAction,
  selectedModel,
  onSelectModel,
  agentMode = 'google',
  agentProvider = 'openrouter',
  onNewSession,
  activeSessionTitle,
  pinnedFrame,
  onUnpinFrame,
  attachedImages = [],
  onAddAttachedImage,
  onRemoveAttachedImage,
  onClearAttachedImages,
  attachedAudio = null,
  onSetAttachedAudio,
  onClearAttachedAudio,
  attachedVideo = null,
  onSetAttachedVideo,
  onClearAttachedVideo,
}) => {
  const { t, format, language } = useLanguage();
  const [inputText, setInputText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>(AVAILABLE_MODELS);
  const [isLiveModels, setIsLiveModels] = useState<boolean>(false);
  const [customModelInput, setCustomModelInput] = useState<string>('');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Reference Video Attachment State
  const [isVideoExtracting, setIsVideoExtracting] = useState(false);
  const [videoExtractProgress, setVideoExtractProgress] = useState(0);
  const [extractingVideoName, setExtractingVideoName] = useState('');
  const [videoValidationError, setVideoValidationError] = useState<string | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  // Audio Recording & Audio Attachment State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isPlayingAudioPreview, setIsPlayingAudioPreview] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState<'command' | 'voiceover'>('command');
  const recordingTargetRef = useRef<'command' | 'voiceover'>('command');

  // Voice Dictation (Speech-to-Text for typing commands without audio attachment)
  const [isDictating, setIsDictating] = useState(false);
  const dictationRecognitionRef = useRef<any>(null);

  // Expanded Diff Cards State
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});

  const toggleDiff = (diffKey: string) => {
    setExpandedDiffs((prev) => ({
      ...prev,
      [diffKey]: prev[diffKey] !== undefined ? !prev[diffKey] : false,
    }));
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const speechRecognitionRef = useRef<any>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const previewAudioElementRef = useRef<HTMLAudioElement | null>(null);

  const formatSecondsToTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (previewAudioElementRef.current) {
        previewAudioElementRef.current.pause();
        previewAudioElementRef.current = null;
      }
      if (dictationRecognitionRef.current) {
        try {
          dictationRecognitionRef.current.stop();
        } catch (_) {}
        dictationRecognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!attachedAudio && previewAudioElementRef.current) {
      previewAudioElementRef.current.pause();
      setIsPlayingAudioPreview(false);
    }
  }, [attachedAudio]);

  // Start Microphone Voice Recording (target: 'command' for chat/order, 'voiceover' for video scene)
  const startRecording = async (target: 'command' | 'voiceover' = 'command') => {
    if (isBusy || isRecording) return;
    setRecordingTarget(target);
    recordingTargetRef.current = target;

    if (isDictating && dictationRecognitionRef.current) {
      try {
        dictationRecognitionRef.current.stop();
      } catch (_) {}
      dictationRecognitionRef.current = null;
      setIsDictating(false);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(200);
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingSeconds(0);
      setLiveTranscript('');

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      // Web Speech API for Arabic speech recognition fallback
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.lang = 'ar-DZ';
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (evt: any) => {
            let fullText = '';
            for (let i = 0; i < evt.results.length; i++) {
              fullText += evt.results[i][0].transcript + ' ';
            }
            setLiveTranscript(fullText.trim());
          };
          rec.onerror = () => {};
          rec.start();
          speechRecognitionRef.current = rec;
        } catch (_) {}
      }
    } catch (err) {
      console.error('[ChatPanel] Microphone error:', err);
      alert(t.chat.micError);
    }
  };

  // Stop & Save or Discard Recording
  const stopRecording = (discard = false) => {
    if (!isRecording) return;
    const target = recordingTargetRef.current;

    const elapsedSeconds = recordingStartTimeRef.current > 0
      ? Math.max(1, Math.round(((Date.now() - recordingStartTimeRef.current) / 1000) * 10) / 10)
      : Math.max(1, recordingSeconds);

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (_) {}
      speechRecognitionRef.current = null;
    }

    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.onstop = () => {
        if (!discard && audioChunksRef.current.length > 0) {
          const mimeType = mr.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const finalSec = elapsedSeconds;
            const finalFrames = Math.max(30, Math.round(finalSec * 30));

            onSetAttachedAudio?.({
              id: `voice_${Date.now()}`,
              dataUrl,
              name: target === 'voiceover'
                ? `${t.chat.voiceoverBadge} (${new Date().toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })})`
                : `${t.chat.commandBadge} (${new Date().toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })})`,
              durationSeconds: finalSec,
              durationFrames: finalFrames,
              transcript: liveTranscript.trim() || undefined,
              source: 'recorded',
              mode: target,
            });

            if (!inputText.trim() && liveTranscript.trim()) {
              setInputText(liveTranscript.trim());
            }
          };
          reader.readAsDataURL(audioBlob);
        }

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };

      mr.stop();
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    }

    setIsRecording(false);
  };

  // Upload Audio File (Defaults to voiceover for video scene)
  const handleAudioFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const tempAudio = new Audio(dataUrl);
      tempAudio.onloadedmetadata = () => {
        const sec = Math.max(1, Math.round((tempAudio.duration || 10) * 10) / 10);
        const frames = Math.max(30, Math.round(sec * 30));

        onSetAttachedAudio?.({
          id: `audio_file_${Date.now()}`,
          dataUrl,
          name: file.name,
          durationSeconds: sec,
          durationFrames: frames,
          source: 'upload',
          size: file.size,
          mode: 'voiceover',
        });
      };
      tempAudio.onerror = () => {
        onSetAttachedAudio?.({
          id: `audio_file_${Date.now()}`,
          dataUrl,
          name: file.name,
          durationSeconds: 10,
          durationFrames: 300,
          source: 'upload',
          size: file.size,
          mode: 'voiceover',
        });
      };
    };
    reader.readAsDataURL(file);
    if (audioFileInputRef.current) audioFileInputRef.current.value = '';
  };

  // Toggle Audio Preview Playback
  const togglePlayAudioPreview = () => {
    if (!attachedAudio) return;

    if (isPlayingAudioPreview) {
      if (previewAudioElementRef.current) {
        previewAudioElementRef.current.pause();
      }
      setIsPlayingAudioPreview(false);
    } else {
      if (!previewAudioElementRef.current) {
        previewAudioElementRef.current = new Audio(attachedAudio.dataUrl);
        previewAudioElementRef.current.onended = () => {
          setIsPlayingAudioPreview(false);
        };
      } else {
        previewAudioElementRef.current.src = attachedAudio.dataUrl;
      }
      previewAudioElementRef.current
        .play()
        .then(() => setIsPlayingAudioPreview(true))
        .catch(() => setIsPlayingAudioPreview(false));
    }
  };

  // Toggle Voice Dictation for typing commands
  const toggleDictation = () => {
    if (isBusy) return;

    if (isDictating) {
      if (dictationRecognitionRef.current) {
        try {
          dictationRecognitionRef.current.stop();
        } catch (_) {}
        dictationRecognitionRef.current = null;
      }
      setIsDictating(false);
      return;
    }

    // Stop voiceover recording if in progress
    if (isRecording) {
      stopRecording(true);
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert(t.chat.dictateUnsupported);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = language === 'ar' ? 'ar-DZ' : 'en-US';
      rec.continuous = true;
      rec.interimResults = true;

      const baseText = inputText.trim() ? inputText.trim() + ' ' : '';

      rec.onresult = (evt: any) => {
        let recognized = '';
        for (let i = 0; i < evt.results.length; i++) {
          recognized += evt.results[i][0].transcript + ' ';
        }
        setInputText(baseText + recognized.trim());
      };

      rec.onend = () => {
        setIsDictating(false);
        dictationRecognitionRef.current = null;
      };

      rec.onerror = (err: any) => {
        console.warn('[ChatPanel] Dictation error:', err);
        setIsDictating(false);
        dictationRecognitionRef.current = null;
      };

      rec.start();
      dictationRecognitionRef.current = rec;
      setIsDictating(true);
    } catch (err) {
      console.error('[ChatPanel] Dictation start failed:', err);
      setIsDictating(false);
    }
  };

  useEffect(() => {
    if (!isBusy) {
      setElapsedTime(0);
      return;
    }
    setElapsedTime(1);
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isBusy]);

  const cleanSelectedModel = (agentMode !== 'api_key' && !selectedModel.startsWith('gemini-3.8-flash-'))
    ? 'gemini-3.8-flash-high'
    : selectedModel;

  const currentModel =
    models.find((m) => m.id === cleanSelectedModel || m.name === cleanSelectedModel) ||
    (cleanSelectedModel
      ? {
          id: cleanSelectedModel,
          name: cleanSelectedModel,
          badge: cleanSelectedModel.includes(':free') ? 'FREE' : 'Active',
          description: cleanSelectedModel,
          provider: (agentProvider || 'AI').toUpperCase(),
        }
      : models[0] || AVAILABLE_MODELS[0]);

  useEffect(() => {
    let isMounted = true;
    const fetchModels = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (agentMode) queryParams.set('mode', agentMode);
        if (agentProvider) queryParams.set('provider', agentProvider);
        if (selectedModel) queryParams.set('modelId', selectedModel);

        const res = await fetch(`/api/models?${queryParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.models && Array.isArray(data.models) && data.models.length > 0 && isMounted) {
            if (agentMode !== 'api_key') {
              const googleTiers = data.models.filter((m: ModelOption) => m.id.startsWith('gemini-3.8-flash-'));
              setModels(googleTiers.length > 0 ? googleTiers : AVAILABLE_MODELS);
            } else {
              setModels(data.models);
            }
            setIsLiveModels(true);
          }
        }
      } catch (err) {
        console.warn('[ChatPanel] Failed to fetch dynamic models, using defaults:', err);
      }
    };
    fetchModels();
    return () => {
      isMounted = false;
    };
  }, [agentMode, agentProvider, selectedModel]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(target) &&
        modelButtonRef.current &&
        !modelButtonRef.current.contains(target)
      ) {
        setIsModelMenuOpen(false);
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(target)) {
        setIsAttachMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isBusy, currentToolAction]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isDictating && dictationRecognitionRef.current) {
      try {
        dictationRecognitionRef.current.stop();
      } catch (_) {}
      dictationRecognitionRef.current = null;
      setIsDictating(false);
    }

    const trimmed = inputText.trim();
    const hasImages = attachedImages && attachedImages.length > 0;
    const hasAudio = Boolean(attachedAudio);
    const hasVideo = Boolean(attachedVideo);
    if ((!trimmed && !hasImages && !hasAudio && !hasVideo) || isBusy) return;

    let userPromptText = trimmed;
    if (!userPromptText) {
      if (hasVideo) {
        userPromptText = t.chat.defaultUserVideoPrompt;
      } else if (hasAudio) {
        userPromptText = attachedAudio?.mode === 'voiceover'
          ? t.chat.defaultUserAudioPromptVoiceover
          : t.chat.defaultUserAudioPromptCommand;
      } else if (hasImages) {
        userPromptText = t.chat.defaultUserImagePrompt;
      }
    }

    onSendMessage(
      userPromptText,
      hasImages ? attachedImages : undefined,
      hasAudio ? attachedAudio : undefined,
      hasVideo ? attachedVideo : undefined
    );
    setInputText('');
    onClearAttachedImages?.();
    onClearAttachedAudio?.();
    onClearAttachedVideo?.();
  };

  // Video processing & keyframe extraction handler
  const handleProcessVideoFile = async (file: File) => {
    setVideoValidationError(null);
    const validation = validateVideoFile(file);
    if (!validation.valid) {
      setVideoValidationError(validation.error || (language === 'ar' ? 'الملف غير صالح.' : 'File is invalid.'));
      return;
    }

    setIsVideoExtracting(true);
    setVideoExtractProgress(10);
    setExtractingVideoName(file.name);

    let objectUrlToRevoke: string | null = null;
    try {
      const { video, objectUrl, durationSeconds, durationFrames } = await loadVideoElement(file);
      objectUrlToRevoke = objectUrl;
      setVideoExtractProgress(25);

      const keyframes = await extractVideoKeyframes(video, 6, (pct) => {
        setVideoExtractProgress(25 + Math.round(pct * 0.45));
      });

      setVideoExtractProgress(75);
      const videoBase64 = await fileToBase64(file);
      setVideoExtractProgress(85);

      // Upload to server to persist video and keyframe files
      let serverVideoData: any = null;
      try {
        const uploadRes = await fetch('/api/upload-reference-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            durationSeconds,
            durationFrames,
            videoBase64,
            keyframes,
          }),
        });

        if (uploadRes.ok) {
          const resData = await uploadRes.json();
          if (resData.success && resData.video) {
            serverVideoData = resData.video;
          }
        } else {
          const errData = await uploadRes.json().catch(() => ({}));
          if (errData.error) {
            setVideoValidationError(errData.error);
            setIsVideoExtracting(false);
            if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
            return;
          }
        }
      } catch (uploadErr) {
        console.warn('[ChatPanel] Upload to server failed, using local blob:', uploadErr);
      }

      setVideoExtractProgress(100);

      const videoAttachment: AttachedVideo = {
        id: serverVideoData?.id || `vid_${Date.now()}`,
        name: file.name,
        size: file.size,
        durationSeconds: Math.round(durationSeconds * 10) / 10,
        durationFrames,
        source: 'upload',
        dataUrl: objectUrl,
        serverUrl: serverVideoData?.serverUrl,
        relativePath: serverVideoData?.relativePath,
        fullPath: serverVideoData?.fullPath,
        thumbnailUrl: serverVideoData?.thumbnailUrl || keyframes[0]?.dataUrl,
        keyframes: serverVideoData?.keyframes || keyframes,
      };

      onSetAttachedVideo?.(videoAttachment);
    } catch (err: any) {
      console.error('[ChatPanel] Video processing error:', err);
      setVideoValidationError(err.message || (language === 'ar' ? 'فشلت معالجة ملف الفيديو.' : 'Failed to process video file.'));
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    } finally {
      setIsVideoExtracting(false);
      setVideoExtractProgress(0);
      setExtractingVideoName('');
      if (videoFileInputRef.current) videoFileInputRef.current.value = '';
    }
  };

  // Video file picker change
  const handleVideoFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessVideoFile(file);
    }
  };

  // Paste image or video directly from clipboard
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('video/')) {
        const file = item.getAsFile();
        if (file) {
          handleProcessVideoFile(file);
        }
      } else if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            onAddAttachedImage?.({
              id: `paste_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              dataUrl,
              name: `${language === 'ar' ? 'صورة ملصقة' : 'Pasted Image'} (${new Date().toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })})`,
              size: file.size,
              source: 'paste',
            });
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // Drag and drop images and videos
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.types?.includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('video/')) {
        handleProcessVideoFile(file);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          onAddAttachedImage?.({
            id: `drop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            dataUrl,
            name: file.name,
            size: file.size,
            source: 'upload',
          });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Select file from file picker
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          onAddAttachedImage?.({
            id: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            dataUrl,
            name: file.name,
            size: file.size,
            source: 'upload',
          });
        };
        reader.readAsDataURL(file);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && isBusy && onStop) {
      e.preventDefault();
      onStop();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <aside
      style={{
        width: 'clamp(320px, 28vw, 450px)',
        minWidth: '280px',
        maxWidth: '480px',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#101013',
        borderLeft: '1px solid rgba(255, 255, 255, 0.07)',
        flexShrink: 0,
      }}
    >
      {/* Panel Top Title */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#121215',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={15} color="#f97316" />
          <h2 style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5', letterSpacing: '-0.01em', margin: 0 }}>
            {t.chat.assistantTitle}
          </h2>
        </div>

        {onNewSession && (
          <button
            onClick={onNewSession}
            disabled={isBusy}
            title={t.chat.newSessionTooltip}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11.5px',
              fontWeight: 500,
              color: '#d4d4d8',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '5px 11px',
              borderRadius: '7px',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isBusy) {
                e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.3)';
                e.currentTarget.style.color = '#fb923c';
              }
            }}
            onMouseLeave={(e) => {
              if (!isBusy) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#d4d4d8';
              }
            }}
          >
            <Plus size={13} color="#f97316" />
            <span>{t.chat.newSession}</span>
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {messages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          const hasText = Boolean(msg.text && msg.text.trim().length > 0);
          const hasSteps = Boolean(msg.steps && msg.steps.length > 0);
          const isStreaming = Boolean(msg.isStreaming);
          const isLastMessage = index === messages.length - 1;
          const isAgentThinking = !isUser && isStreaming && !hasText;

          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-start' : 'stretch',
                gap: '8px',
                width: '100%',
              }}
            >
              {/* Sender Meta */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isUser ? 'flex-start' : 'space-between',
                  gap: '8px',
                  fontSize: '11px',
                  color: '#71717a',
                  padding: '0 4px',
                  userSelect: 'none',
                }}
              >
                {isUser ? (
                  <>
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <User size={12} color="#e4e4e7" />
                    </div>
                    <span style={{ fontWeight: 600, color: '#e4e4e7', fontSize: '11.5px', letterSpacing: '-0.01em' }}>
                      {t.chat.userSender}
                    </span>
                    <span
                      dir="ltr"
                      style={{
                        fontSize: '10px',
                        fontFamily: 'Consolas, monospace',
                        color: '#71717a',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        lineHeight: '14px',
                      }}
                    >
                      {msg.timestamp}
                    </span>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '6px',
                          background: isStreaming
                            ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.35), rgba(234, 88, 12, 0.2))'
                            : 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(255, 255, 255, 0.04))',
                          border: isStreaming
                            ? '1px solid rgba(249, 115, 22, 0.45)'
                            : '1px solid rgba(249, 115, 22, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: isStreaming ? '0 0 10px rgba(249, 115, 22, 0.25)' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <Bot size={12} color={isStreaming ? '#fb923c' : '#f97316'} />
                      </div>
                      <span style={{ fontWeight: 600, color: isStreaming ? '#fb923c' : '#f4f4f5', fontSize: '11.5px', letterSpacing: '-0.01em' }}>
                        {t.chat.agentSender}
                      </span>
                      {isStreaming ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10px',
                            color: '#fb923c',
                            backgroundColor: 'rgba(249, 115, 22, 0.12)',
                            padding: '1px 7px',
                            borderRadius: '9999px',
                            border: '1px solid rgba(249, 115, 22, 0.3)',
                            fontWeight: 500,
                          }}
                        >
                          <Loader2 size={10} className="animate-spin" />
                          <span>{t.chat.processing}</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '10px',
                            color: '#a1a1aa',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.07)',
                            padding: '1px 6px',
                            borderRadius: '9999px',
                            fontFamily: 'monospace',
                          }}
                        >
                          Remotion AI
                        </span>
                      )}
                    </div>
                    <span
                      dir="ltr"
                      style={{
                        fontSize: '10px',
                        fontFamily: 'Consolas, monospace',
                        color: '#71717a',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        lineHeight: '14px',
                      }}
                    >
                      {msg.timestamp}
                    </span>
                  </>
                )}
              </div>

              {/* Message Body */}
              {isUser ? (
                /* User Prompt Bubble (Sleek Right-Aligned Studio Capsule) */
                <div
                  style={{
                    width: 'fit-content',
                    maxWidth: '88%',
                    padding: '12px 16px',
                    borderRadius: '14px 14px 4px 14px',
                    backgroundColor: '#1c1c22',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#f4f4f5',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: '0 3px 12px rgba(0, 0, 0, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {msg.audio && <MessageAudioPlayer audio={msg.audio} />}
                  {msg.video && (
                    <MessageVideoPlayer
                      video={msg.video}
                      onLightboxImage={(url) => setLightboxImage(url)}
                    />
                  )}
                  {msg.images && msg.images.length > 0 && (
                    <MessageImagesGrid
                      images={msg.images}
                      onLightboxImage={(url) => setLightboxImage(url)}
                    />
                  )}
                  {hasText && (
                    <div style={{ fontSize: '13px', color: '#f4f4f5', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {msg.text}
                    </div>
                  )}
                </div>
              ) : isAgentThinking ? (
                /* Luxury Satin Dark Observability Card (Pill Aesthetics) */
                <div
                  style={{
                    width: '100%',
                    padding: '16px 18px',
                    borderRadius: '20px',
                    backgroundColor: '#121215',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Top Header Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    {/* Status & Tool Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '9999px',
                          backgroundColor: '#1b1b20',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Loader2 size={13} color="#d4d4d8" className="animate-spin" />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#f4f4f5',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {msg.activeTool?.actionTitle || currentToolAction || t.chat.defaultActionTitle}
                          </span>
                          {msg.activeTool?.target && (
                            <span
                              dir="ltr"
                              style={{
                                fontSize: '10px',
                                fontFamily: 'monospace',
                                color: '#a1a1aa',
                                backgroundColor: '#1c1c22',
                                border: '1px solid rgba(255, 255, 255, 0.07)',
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                maxWidth: '160px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                            >
                              {msg.activeTool.target}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: '#71717a' }}>
                          {t.chat.remotionProcessingSubtext}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Badges: Step & Thinking & Timer (Satin Pills) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#f4f4f5',
                          backgroundColor: '#222228',
                          border: '1px solid rgba(255, 255, 255, 0.09)',
                          padding: '4px 12px',
                          borderRadius: '9999px',
                          fontWeight: 600,
                          letterSpacing: '0.01em',
                          display: 'inline-flex',
                          alignItems: 'center',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
                        }}
                      >
                        {format(t.chat.stepLabel, { step: msg.stepNumber !== undefined ? msg.stepNumber : 1 })}
                      </span>
                      {msg.thinkingTokens && (
                        <span
                          style={{
                            fontSize: '10px',
                            color: '#a1a1aa',
                            backgroundColor: '#19191e',
                            border: '1px solid rgba(255, 255, 255, 0.07)',
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontWeight: 500,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>{language === 'ar' ? 'تفكير:' : 'Thinking:'}</span>
                          <span dir="ltr" style={{ fontFamily: 'monospace', color: '#e4e4e7' }}>{msg.thinkingTokens}</span>
                        </span>
                      )}
                      <span
                        dir="ltr"
                        style={{
                          fontSize: '10.5px',
                          color: '#a1a1aa',
                          fontFamily: 'monospace',
                          backgroundColor: '#19191e',
                          border: '1px solid rgba(255, 255, 255, 0.07)',
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          fontWeight: 500,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        {elapsedTime > 0 ? `${elapsedTime}s` : '0s'}
                      </span>
                    </div>
                  </div>

                  {/* Subtle Monochrome Progress Line */}
                  <div
                    style={{
                      margin: '12px 0 4px 0',
                      height: '2px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '9999px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.18) 50%, transparent 100%)',
                      }}
                      className="animate-shimmer-beam"
                    />
                  </div>

                  {/* Active Tool Sub-pill (Smooth Luxury Pill Bar) */}
                  {msg.activeTool && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '6px 12px 6px 10px',
                        borderRadius: '9999px',
                        backgroundColor: '#18181d',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            backgroundColor: '#222228',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {msg.activeTool.toolName === 'view_file' ? (
                            <Eye size={11} color="#a1a1aa" />
                          ) : msg.activeTool.toolName === 'run_command' ? (
                            <Terminal size={11} color="#a1a1aa" />
                          ) : (
                            <FileCode size={11} color="#a1a1aa" />
                          )}
                        </div>
                        <span
                          dir="ltr"
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11.5px',
                            color: '#e4e4e7',
                            fontWeight: 500,
                          }}
                        >
                          {msg.activeTool.toolName}
                        </span>
                      </div>

                      {/* Status Badge Pill */}
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          color: msg.activeTool.state === 'ACTIVE' ? '#f59e0b' : '#a1a1aa',
                          backgroundColor: msg.activeTool.state === 'ACTIVE' ? 'rgba(245, 158, 11, 0.12)' : '#222228',
                          border: msg.activeTool.state === 'ACTIVE' ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(255, 255, 255, 0.07)',
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {msg.activeTool.state === 'ACTIVE' && (
                          <span
                            style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              backgroundColor: '#f59e0b',
                              display: 'inline-block',
                            }}
                          />
                        )}
                        {msg.activeTool.state === 'ACTIVE' ? t.chat.statusActive : t.chat.statusCompleted}
                      </span>
                    </div>
                  )}

                  {/* Live Steps Pipeline */}
                  {hasSteps && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px 14px',
                        backgroundColor: '#16161b',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '7px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#a1a1aa',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          paddingBottom: '5px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        }}
                      >
                        <Layers size={11} color="#a1a1aa" />
                        <span>{t.chat.productionStagesTitle}</span>
                      </div>

                      {msg.steps!.map((st) => (
                        <div
                          key={st.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '11px',
                            color:
                              st.status === 'completed'
                                ? '#a1a1aa'
                                : st.status === 'running'
                                ? '#f4f4f5'
                                : '#52525b',
                          }}
                        >
                          {st.status === 'completed' && <CheckCircle2 size={12} color="#10b981" />}
                          {st.status === 'running' && <Loader2 size={12} color="#f4f4f5" className="animate-spin" />}
                          {st.status === 'pending' && (
                            <div
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                border: '1px solid #3f3f46',
                              }}
                            />
                          )}
                          <span style={{ fontWeight: st.status === 'running' ? 500 : 400 }}>
                            {st.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Agent Studio Card (Full Width Studio Canvas) */
                <div
                  style={{
                    width: '100%',
                    padding: '16px 18px',
                    borderRadius: '14px',
                    backgroundColor: '#121216',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    color: '#e4e4e7',
                    fontSize: '13px',
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Attached Audio in Agent Card */}
                  {msg.audio && <MessageAudioPlayer audio={msg.audio} />}

                  {/* Attached Video in Agent Card */}
                  {msg.video && (
                    <MessageVideoPlayer
                      video={msg.video}
                      onLightboxImage={(url) => setLightboxImage(url)}
                    />
                  )}

                  {/* Attached Images in Agent Card */}
                  {msg.images && msg.images.length > 0 && (
                    <MessageImagesGrid
                      images={msg.images}
                      onLightboxImage={(url) => setLightboxImage(url)}
                    />
                  )}

                  {/* Live Steps Pipeline for completed or text-containing messages */}
                  {hasSteps && (
                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#a1a1aa',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          paddingBottom: '5px',
                        }}
                      >
                        <Layers size={12} color="#f97316" />
                        <span>{t.chat.productionStagesTitle}</span>
                      </div>

                      {msg.steps!.map((st) => (
                        <div
                          key={st.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '11.5px',
                            color:
                              st.status === 'completed'
                                ? '#34d399'
                                : st.status === 'running'
                                ? '#f97316'
                                : '#64748b',
                          }}
                        >
                          {st.status === 'completed' && <CheckCircle2 size={13} color="#10b981" />}
                          {st.status === 'running' && <Loader2 size={13} color="#f97316" className="animate-spin" />}
                          {st.status === 'pending' && (
                            <div
                              style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                border: '1px solid #475569',
                              }}
                            />
                          )}
                          <span style={{ fontWeight: st.status === 'running' ? 600 : 400 }}>
                            {st.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message Content */}
                  {hasText && <MarkdownView content={msg.text} />}

                  {/* Orange Cursor while typing text */}
                  {isStreaming && hasText && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: '3px',
                        height: '14px',
                        backgroundColor: '#f97316',
                        marginRight: '4px',
                        verticalAlign: 'middle',
                        borderRadius: '1px',
                        animation: 'pulseGlow 0.9s infinite',
                      }}
                    />
                  )}

                  {/* Tool Action In-Bubble Badge when text is streaming but tool is still active */}
                  {isBusy && currentToolAction && isLastMessage && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        fontSize: '11px',
                        color: '#a1a1aa',
                      }}
                    >
                      <Loader2 size={12} className="animate-spin" color="#a1a1aa" />
                      <span>{currentToolAction}</span>
                    </div>
                  )}

                  {/* File Diff Inspection Cards */}
                  {msg.diffSummary && msg.diffSummary.length > 0 && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          color: '#71717a',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <FileCode size={12} color="#a1a1aa" />
                        <span>{format(t.chat.diffSummaryTitle, { count: msg.diffSummary.length })}</span>
                      </div>

                      {msg.diffSummary.map((diff, diffIdx) => {
                        const diffKey = `${msg.id}_diff_${diffIdx}`;
                        const isExpanded = expandedDiffs[diffKey] !== undefined ? expandedDiffs[diffKey] : true;

                        return (
                          <div
                            key={diffKey}
                            style={{
                              backgroundColor: '#101014',
                              border: '1px solid rgba(255, 255, 255, 0.07)',
                              borderRadius: '7px',
                              overflow: 'hidden',
                            }}
                          >
                            {/* Diff Header */}
                            <div
                              onClick={() => toggleDiff(diffKey)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '7px 11px',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                cursor: 'pointer',
                                userSelect: 'none',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                                <FileCode size={13} color="#a1a1aa" />
                                <span
                                  style={{
                                    fontFamily: 'monospace',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    color: '#f4f4f5',
                                  }}
                                >
                                  {diff.file}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontFamily: 'monospace',
                                    color: '#4ade80',
                                    backgroundColor: 'rgba(34, 197, 94, 0.08)',
                                    border: '1px solid rgba(34, 197, 94, 0.2)',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                  }}
                                >
                                  +{diff.additions}
                                </span>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontFamily: 'monospace',
                                    color: '#f87171',
                                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                  }}
                                >
                                  -{diff.deletions}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp size={13} color="#71717a" />
                                ) : (
                                  <ChevronDown size={13} color="#71717a" />
                                )}
                              </div>
                            </div>

                            {/* Diff Body */}
                            {isExpanded && (
                              <div
                                style={{
                                  maxHeight: '260px',
                                  overflowY: 'auto',
                                  backgroundColor: '#0c0c0e',
                                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                  fontFamily: 'Consolas, "Fira Code", monospace',
                                  fontSize: '11px',
                                  lineHeight: 1.6,
                                }}
                              >
                                {diff.hunks.map((hunk, hIdx) => {
                                  if (hunk.type === 'separator') {
                                    return (
                                      <div
                                        key={hIdx}
                                        style={{
                                          padding: '2px 8px',
                                          color: '#52525b',
                                          textAlign: 'center',
                                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                          borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                                        }}
                                      >
                                        ...
                                      </div>
                                    );
                                  }

                                  const isAdd = hunk.type === 'add';
                                  const isDel = hunk.type === 'delete';

                                  return (
                                    <div
                                      key={hIdx}
                                      style={{
                                        display: 'flex',
                                        direction: 'ltr',
                                        padding: '1px 8px',
                                        backgroundColor: isAdd
                                          ? 'rgba(34, 197, 94, 0.07)'
                                          : isDel
                                          ? 'rgba(239, 68, 68, 0.07)'
                                          : 'transparent',
                                        borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                                      }}
                                    >
                                      <span
                                        style={{
                                          width: '32px',
                                          color: '#52525b',
                                          textAlign: 'right',
                                          paddingRight: '8px',
                                          userSelect: 'none',
                                          flexShrink: 0,
                                        }}
                                      >
                                        {hunk.newLineNumber || hunk.oldLineNumber || ''}
                                      </span>
                                      <span
                                        style={{
                                          width: '14px',
                                          color: isAdd ? '#4ade80' : isDel ? '#f87171' : '#52525b',
                                          userSelect: 'none',
                                          fontWeight: 600,
                                          flexShrink: 0,
                                        }}
                                      >
                                        {isAdd ? '+' : isDel ? '-' : ' '}
                                      </span>
                                      <span
                                        style={{
                                          color: isAdd ? '#4ade80' : isDel ? '#f87171' : '#71717a',
                                          whiteSpace: 'pre',
                                          overflowX: 'auto',
                                        }}
                                      >
                                        {hunk.content}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Automated Verification Badge */}
                  {msg.verificationResult && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '7px 11px',
                        borderRadius: '6px',
                        backgroundColor: msg.verificationResult.passed
                          ? 'rgba(34, 197, 94, 0.05)'
                          : 'rgba(239, 68, 68, 0.05)',
                        border: msg.verificationResult.passed
                          ? '1px solid rgba(34, 197, 94, 0.2)'
                          : '1px solid rgba(239, 68, 68, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        fontSize: '11px',
                      }}
                    >
                      {msg.verificationResult.passed ? (
                        <CheckCircle2 size={13} color="#22c55e" />
                      ) : (
                        <AlertTriangle size={13} color="#ef4444" />
                      )}
                      <span
                        style={{
                          fontWeight: 500,
                          color: msg.verificationResult.passed ? '#f4f4f5' : '#f87171',
                        }}
                      >
                        {msg.verificationResult.message}
                      </span>
                    </div>
                  )}

                  {/* Duration & Tokens Badge upon completion */}
                  {msg.duration && (
                    <div
                      style={{
                        marginTop: '10px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        fontSize: '11px',
                        color: '#a1a1aa',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <CheckCircle2 size={12} color="#22c55e" />
                        <span>{format(t.chat.executionSuccessDuration, { sec: msg.duration })}</span>
                      </div>
                      {msg.thinkingTokens && (
                        <span style={{ fontSize: '10px', color: '#71717a', fontFamily: 'monospace' }}>
                          {format(t.chat.thinkingTokens, { tokens: msg.thinkingTokens })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Fallback Floating Action Pill (Only when busy and no streaming message is in progress) */}
        {isBusy && !messages.some((m) => m.sender === 'agent' && m.isStreaming) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(22, 22, 27, 0.95)',
              border: '1px solid rgba(249, 115, 22, 0.3)',
              color: '#fb923c',
              fontSize: '12px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              alignSelf: 'stretch',
            }}
          >
            <Loader2 size={15} className="animate-spin" color="#f97316" />
            <span>{currentToolAction || t.chat.analyzingAndChecking}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Prompt Card (Linear/Antigravity Style - Multimodal Enabled) */}
      <div style={{ padding: '14px 16px 16px 16px', position: 'relative' }}>
        {/* Active Audio Recording Deck (Emerges from behind the prompt card when recording) */}
        {isRecording && (
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              marginBottom: '-18px',
              padding: '14px 18px 28px 18px',
              borderRadius: '24px 24px 12px 12px',
              backgroundColor: recordingTarget === 'voiceover' ? '#1c1612' : '#141c18',
              border: `1px solid ${recordingTarget === 'voiceover' ? 'rgba(249, 115, 22, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
              direction: 'rtl',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Status & Live Timer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: recordingTarget === 'voiceover' ? '#f97316' : '#10b981',
                  boxShadow: `0 0 12px ${recordingTarget === 'voiceover' ? '#f97316' : '#10b981'}`,
                  flexShrink: 0,
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: recordingTarget === 'voiceover' ? '#fb923c' : '#34d399',
                    }}
                  >
                    {recordingTarget === 'voiceover' ? t.chat.recordingVoiceoverNotice : t.chat.recordingCommandNotice}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#f4f4f5',
                      backgroundColor: 'rgba(0, 0, 0, 0.55)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      padding: '1px 8px',
                      borderRadius: '9999px',
                      fontWeight: 600,
                    }}
                  >
                    {formatSecondsToTimer(recordingSeconds)}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10.5px',
                    color: '#a1a1aa',
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {recordingTarget === 'voiceover' ? t.chat.recordVoiceoverDesc : t.chat.recordCommandDesc}
                </span>
              </div>
            </div>

            {/* Quick Action Buttons (Save / Cancel) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => stopRecording(false)}
                title={t.chat.finishAndSaveRecording}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '5px 13px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
              >
                <Check size={13} strokeWidth={2.5} />
                <span>{t.common.save}</span>
              </button>

              <button
                type="button"
                onClick={() => stopRecording(true)}
                title={t.chat.cancelRecording}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#d4d4d8',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '9999px',
                  padding: '5px 11px',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = '#d4d4d8';
                }}
              >
                <X size={13} />
                <span>{t.common.cancel}</span>
              </button>
            </div>
          </div>
        )}

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            borderRadius: '26px',
            backgroundColor: isDragOver ? 'rgba(249, 115, 22, 0.04)' : '#161619',
            border: isDragOver
              ? '2px dashed #f97316'
              : `1px solid ${isFocused ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.08)'}`,
            boxShadow: isFocused
              ? '0 12px 36px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              : '0 8px 30px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'visible',
            position: 'relative',
            zIndex: 2,
            transition: 'all 0.18s ease',
          }}
        >
          {/* Floating Model Selection Popover - Anchored right above the model button */}
          {isModelMenuOpen && (
            <div
              ref={modelMenuRef}
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                left: language === 'ar' ? 'auto' : '16px',
                right: language === 'ar' ? '16px' : 'auto',
                width: '300px',
                maxWidth: 'calc(100% - 32px)',
                maxHeight: '380px',
                backgroundColor: '#18181b',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.04)',
                padding: '4px',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255, 255, 255, 0.15) transparent',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '6px 8px 4px 8px',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#71717a',
                  letterSpacing: '0.02em',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Model</span>
                {agentMode === 'api_key' && (
                  <span style={{ fontSize: '10px', color: '#a1a1aa' }}>
                    {(agentProvider || 'OpenRouter').toUpperCase()}
                  </span>
                )}
              </div>

              {/* Models List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {(agentMode !== 'api_key'
                  ? models.filter((m) => m.id.startsWith('gemini-3.8-flash-'))
                  : models
                ).map((m) => {
                  const isSelected = m.id === selectedModel || m.name === selectedModel;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onSelectModel(m.id);
                        setIsModelMenuOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background-color 0.1s ease',
                        width: '100%',
                        gap: '8px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isSelected
                          ? 'rgba(255, 255, 255, 0.04)'
                          : 'transparent';
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          minWidth: 0,
                          overflow: 'hidden',
                        }}
                      >
                        <span
                          dir="ltr"
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 500,
                            color: '#f4f4f5',
                            letterSpacing: '-0.01em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {m.name}
                        </span>
                        {m.badge && (
                          <span
                            dir="ltr"
                            style={{
                              fontSize: '11px',
                              color: '#a1a1aa',
                              fontWeight: 400,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.badge}
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <Check size={14} color="#f4f4f5" strokeWidth={2.2} style={{ flexShrink: 0 }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom Model Input for API Key Mode */}
              {agentMode === 'api_key' && (
                <div
                  style={{
                    padding: '8px 6px 4px 6px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    marginTop: '4px',
                  }}
                >
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const val = customModelInput.trim();
                      if (val) {
                        onSelectModel(val);
                        fetch('/api/models/custom', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ modelId: val }),
                        }).catch(() => {});
                        setModels((prev) => {
                          if (prev.some((m) => m.id === val)) return prev;
                          return [
                            {
                              id: val,
                              name: val,
                              badge: val.includes(':free') ? 'FREE' : 'Custom',
                              description: '',
                              provider: (agentProvider || 'Custom').toUpperCase(),
                              isCustom: true,
                              isFree: val.includes(':free'),
                            },
                            ...prev,
                          ];
                        });
                        setCustomModelInput('');
                        setIsModelMenuOpen(false);
                      }
                    }}
                    style={{ display: 'flex', gap: '6px' }}
                  >
                    <input
                      type="text"
                      value={customModelInput}
                      onChange={(e) => setCustomModelInput(e.target.value)}
                      placeholder="Custom model..."
                      dir="ltr"
                      style={{
                        flex: 1,
                        backgroundColor: '#1b1b20',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        color: '#f4f4f5',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!customModelInput.trim()}
                      style={{
                        backgroundColor: '#27272a',
                        color: customModelInput.trim() ? '#ffffff' : '#71717a',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0 8px',
                        fontSize: '11px',
                        cursor: customModelInput.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Add
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Pinned Frame Context Chip */}
          {pinnedFrame && (
            <div
              style={{
                margin: '10px 12px 0 12px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(249, 115, 22, 0.12)',
                border: '1px solid rgba(249, 115, 22, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '11px',
                color: '#fb923c',
                alignSelf: 'flex-start',
              }}
            >
              <BookmarkCheck size={13} color="#f97316" />
              <span style={{ fontWeight: 600 }}>{format(t.chat.pinnedInTimeline, { frame: pinnedFrame.frame, sec: pinnedFrame.timeSeconds })}</span>
              {onUnpinFrame && (
                <button
                  type="button"
                  onClick={onUnpinFrame}
                  title={t.chat.unpinThisFrame}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 2px',
                    marginLeft: '4px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Attached Images Preview Row */}
          {attachedImages && attachedImages.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                overflowX: 'auto',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
              }}
            >
              {attachedImages.map((img) => (
                <div
                  key={img.id}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 8px 4px 4px',
                    backgroundColor: '#18181c',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#e4e4e7',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    onClick={() => setLightboxImage(img.dataUrl)}
                    title={t.chat.clickToEnlarge}
                    style={{
                      width: '36px',
                      height: '36px',
                      objectFit: 'cover',
                      borderRadius: '5px',
                      cursor: 'zoom-in',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '130px' }}>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                        direction: 'rtl',
                      }}
                    >
                      {img.name}
                    </span>
                    <span
                      style={{
                        fontSize: '9.5px',
                        color: img.source === 'snapshot' ? '#fb923c' : '#a1a1aa',
                      }}
                    >
                      {img.source === 'snapshot' ? t.chat.sceneSnapshot : t.chat.imageAttached}
                    </span>
                  </div>
                  {onRemoveAttachedImage && (
                    <button
                      type="button"
                      onClick={() => onRemoveAttachedImage(img.id)}
                      title={t.chat.removeImage}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#71717a',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2px',
                        borderRadius: '4px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#71717a')}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}


          {/* Attached Audio Preview Card */}
          {attachedAudio && !isRecording && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 14px',
                backgroundColor: attachedAudio.mode === 'voiceover' ? 'rgba(249, 115, 22, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                borderBottom: `1px solid ${attachedAudio.mode === 'voiceover' ? 'rgba(249, 115, 22, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                direction: 'rtl',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                <button
                  type="button"
                  onClick={togglePlayAudioPreview}
                  title={isPlayingAudioPreview ? t.chat.stopAudioPreview : t.chat.playAudioPreview}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: isPlayingAudioPreview
                      ? (attachedAudio.mode === 'voiceover' ? '#ea580c' : '#059669')
                      : (attachedAudio.mode === 'voiceover' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(16, 185, 129, 0.2)'),
                    border: `1px solid ${attachedAudio.mode === 'voiceover' ? 'rgba(249, 115, 22, 0.45)' : 'rgba(16, 185, 129, 0.45)'}`,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isPlayingAudioPreview ? (
                    <Pause size={13} fill="#ffffff" />
                  ) : (
                    <Play size={13} fill="#ffffff" style={{ marginLeft: '-1px' }} />
                  )}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#f4f4f5',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {attachedAudio.name}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: attachedAudio.mode === 'voiceover' ? '#fb923c' : '#34d399',
                        backgroundColor: attachedAudio.mode === 'voiceover' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        border: `1px solid ${attachedAudio.mode === 'voiceover' ? 'rgba(249, 115, 22, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        flexShrink: 0,
                        fontFamily: 'monospace',
                      }}
                    >
                      {attachedAudio.durationSeconds}{t.common.seconds} ({attachedAudio.durationFrames} {t.common.frames})
                    </span>
                  </div>

                  <span style={{ fontSize: '10px', color: '#a1a1aa', marginTop: '2px' }}>
                    {attachedAudio.mode === 'voiceover' ? t.chat.voiceoverModeDesc : t.chat.commandModeDesc}
                  </span>
                </div>
              </div>

              {/* Mode Toggle & Clear Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() =>
                    onSetAttachedAudio?.({
                      ...attachedAudio,
                      mode: attachedAudio.mode === 'voiceover' ? 'command' : 'voiceover',
                    })
                  }
                  title={t.chat.switchRecordingModeTooltip}
                  style={{
                    fontSize: '10.5px',
                    padding: '4px 9px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    color: '#e4e4e7',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)')}
                >
                  {attachedAudio.mode === 'voiceover' ? t.chat.switchModeToCommand : t.chat.switchModeToVoiceover}
                </button>

                {onClearAttachedAudio && (
                  <button
                    type="button"
                    onClick={onClearAttachedAudio}
                    title={t.chat.removeRecording}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#71717a',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      borderRadius: '4px',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#71717a')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Video Validation Error Banner */}
          {videoValidationError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                fontSize: '11px',
                direction: 'rtl',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>{videoValidationError}</span>
              </div>
              <button
                type="button"
                onClick={() => setVideoValidationError(null)}
                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Video Extraction Progress Bar */}
          {isVideoExtracting && (
            <div
              style={{
                padding: '9px 14px',
                backgroundColor: 'rgba(249, 115, 22, 0.08)',
                borderBottom: '1px solid rgba(249, 115, 22, 0.22)',
                direction: 'rtl',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#fb923c' }}>
                  <Loader2 size={13} className="animate-spin" color="#f97316" />
                  <span>
                    {t.chat.extractingKeyframesNotice} <strong>{extractingVideoName}</strong>
                  </span>
                </div>
                <span style={{ color: '#a1a1aa', fontFamily: 'monospace', fontSize: '10.5px' }}>
                  {videoExtractProgress}%
                </span>
              </div>
              <div
                style={{
                  height: '3px',
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${videoExtractProgress}%`,
                    backgroundColor: '#f97316',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Attached Video Preview Card */}
          {attachedVideo && !isVideoExtracting && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '10px 14px',
                backgroundColor: 'rgba(249, 115, 22, 0.06)',
                borderBottom: '1px solid rgba(249, 115, 22, 0.2)',
                direction: 'rtl',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div
                    onClick={() => {
                      setVideoPreviewUrl(attachedVideo.serverUrl || attachedVideo.dataUrl || null);
                      setIsVideoModalOpen(true);
                    }}
                    title={t.chat.previewReferenceVideo}
                    style={{
                      position: 'relative',
                      width: '60px',
                      height: '38px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: '1px solid rgba(249, 115, 22, 0.4)',
                      backgroundColor: '#000',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={attachedVideo.thumbnailUrl || attachedVideo.keyframes[0]?.dataUrl}
                      alt={attachedVideo.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Play size={13} fill="#ffffff" color="#ffffff" />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#f4f4f5',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {attachedVideo.name}
                      </span>
                      <span
                        style={{
                          fontSize: '9.5px',
                          color: '#fb923c',
                          backgroundColor: 'rgba(249, 115, 22, 0.15)',
                          border: '1px solid rgba(249, 115, 22, 0.3)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          flexShrink: 0,
                        }}
                      >
                        {attachedVideo.durationSeconds}{t.common.seconds} ({attachedVideo.durationFrames} {t.common.frames})
                      </span>
                      {attachedVideo.size && (
                        <span style={{ fontSize: '9.5px', color: '#71717a', fontFamily: 'monospace' }}>
                          {(attachedVideo.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: '10px', color: '#a1a1aa', marginTop: '2px' }}>
                      {format(t.chat.referenceVideoDescription, { count: attachedVideo.keyframes.length })}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoPreviewUrl(attachedVideo.serverUrl || attachedVideo.dataUrl || null);
                      setIsVideoModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '10.5px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#e4e4e7',
                      cursor: 'pointer',
                    }}
                  >
                    <Eye size={12} color="#fb923c" />
                    <span>{t.chat.previewButton}</span>
                  </button>

                  {onClearAttachedVideo && (
                    <button
                      type="button"
                      onClick={onClearAttachedVideo}
                      title={t.chat.removeVideo}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#71717a',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#71717a')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {attachedVideo.keyframes && attachedVideo.keyframes.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingTop: '2px' }}>
                  {attachedVideo.keyframes.map((kf, kfIdx) => (
                    <div
                      key={kfIdx}
                      onClick={() => setLightboxImage(kf.serverUrl || kf.dataUrl)}
                      title={format(t.chat.keyframeTooltip, { idx: kfIdx + 1, sec: kf.timeSeconds, frame: kf.frameIndex })}
                      style={{
                        position: 'relative',
                        width: '46px',
                        height: '28px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        cursor: 'pointer',
                        flexShrink: 0,
                        backgroundColor: '#000',
                      }}
                    >
                      <img src={kf.serverUrl || kf.dataUrl} alt={`Keyframe ${kfIdx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.75)',
                          color: '#fb923c',
                          fontSize: '7.5px',
                          padding: '0 2px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {kf.timeSeconds}s
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Main Textarea */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={
              attachedVideo
                ? t.chat.inputPromptVideoPlaceholder
                : attachedAudio
                ? t.chat.inputPromptAudioPlaceholder
                : attachedImages && attachedImages.length > 0
                ? t.chat.inputPromptImagePlaceholder
                : t.chat.inputPlaceholder
            }
            rows={2}
            disabled={isBusy}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              padding: '16px 20px 8px 20px',
              color: '#f4f4f5',
              fontSize: '13.5px',
              lineHeight: 1.6,
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />

          {/* Hidden File Input for Image Upload */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />

          {/* Hidden File Input for Audio Upload */}
          <input
            type="file"
            ref={audioFileInputRef}
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={handleAudioFileInputChange}
          />

          {/* Hidden File Input for Video Upload */}
          <input
            type="file"
            ref={videoFileInputRef}
            accept="video/mp4,video/webm,video/quicktime,video/*"
            style={{ display: 'none' }}
            onChange={handleVideoFileInputChange}
          />

          {/* Bottom Action Row (Seamless Satin Dark Flow) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 16px 14px 16px',
              backgroundColor: 'transparent',
              gap: '12px',
            }}
          >
            {/* Start Side (RTL Right): Add/Attachment (+) and Model Selector Pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              {/* Circular Attachment Button (+) with Dropdown Popover */}
              <div style={{ position: 'relative' }} ref={attachMenuRef}>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setIsAttachMenuOpen((prev) => !prev);
                    setIsModelMenuOpen(false);
                  }}
                  title={t.chat.attachMenuTooltip}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: isAttachMenuOpen ? '#2e2e34' : '#25252a',
                    border: `1px solid ${isAttachMenuOpen ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: isAttachMenuOpen ? '#ffffff' : '#d4d4d8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isBusy && !isAttachMenuOpen) {
                      e.currentTarget.style.backgroundColor = '#2e2e34';
                      e.currentTarget.style.color = '#ffffff';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isBusy && !isAttachMenuOpen) {
                      e.currentTarget.style.backgroundColor = '#25252a';
                      e.currentTarget.style.color = '#d4d4d8';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    }
                  }}
                >
                  <Plus size={15} strokeWidth={2.2} />
                </button>

                {/* Popover Dropdown for Attachment Options */}
                {isAttachMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 8px)',
                      left: language === 'ar' ? 'auto' : 0,
                      right: language === 'ar' ? 0 : 'auto',
                      width: '220px',
                      backgroundColor: '#18181d',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '16px',
                      padding: '6px',
                      boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      zIndex: 60,
                      backdropFilter: 'blur(20px)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#e4e4e7',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        textAlign: language === 'ar' ? 'right' : 'left',
                        width: '100%',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                        e.currentTarget.style.color = '#fb923c';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#e4e4e7';
                      }}
                    >
                      <ImageIcon size={14} color="#f97316" />
                      <span>{t.chat.attachImage}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachMenuOpen(false);
                        videoFileInputRef.current?.click();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#e4e4e7',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        textAlign: language === 'ar' ? 'right' : 'left',
                        width: '100%',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                        e.currentTarget.style.color = '#fb923c';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#e4e4e7';
                      }}
                    >
                      <Video size={14} color="#f97316" />
                      <span>{t.chat.attachVideo}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachMenuOpen(false);
                        startRecording('voiceover');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#e4e4e7',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        textAlign: language === 'ar' ? 'right' : 'left',
                        width: '100%',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.1)';
                        e.currentTarget.style.color = '#fb923c';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#e4e4e7';
                      }}
                    >
                      <Volume2 size={14} color="#f97316" />
                      <span>{t.chat.recordVoiceover}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachMenuOpen(false);
                        audioFileInputRef.current?.click();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#e4e4e7',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        textAlign: language === 'ar' ? 'right' : 'left',
                        width: '100%',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                        e.currentTarget.style.color = '#fb923c';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#e4e4e7';
                      }}
                    >
                      <Music size={14} color="#fb923c" />
                      <span>{t.chat.uploadAudio}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Model Switcher Button (Clean Satin Pill matching reference) */}
              <div>
                <button
                  ref={modelButtonRef}
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setIsModelMenuOpen((prev) => !prev);
                    setIsAttachMenuOpen(false);
                  }}
                  title={t.chat.modelTooltip}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    height: '28px',
                    padding: '0 10px',
                    borderRadius: '9999px',
                    backgroundColor: isModelMenuOpen ? '#2e2e34' : '#25252a',
                    border: `1px solid ${isModelMenuOpen ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: '#f4f4f5',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isBusy && !isModelMenuOpen) {
                      e.currentTarget.style.backgroundColor = '#2e2e34';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isBusy && !isModelMenuOpen) {
                      e.currentTarget.style.backgroundColor = '#25252a';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    }
                  }}
                >
                  <span
                    dir="ltr"
                    style={{
                      fontWeight: 500,
                      maxWidth: '120px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#f4f4f5',
                    }}
                  >
                    {currentModel.name}
                  </span>
                  {currentModel.badge && (
                    <span
                      dir="ltr"
                      style={{
                        fontSize: '10px',
                        color: '#a1a1aa',
                        fontWeight: 400,
                      }}
                    >
                      {currentModel.badge}
                    </span>
                  )}
                  {isModelMenuOpen ? (
                    <ChevronUp size={11} color="#a1a1aa" />
                  ) : (
                    <ChevronDown size={11} color="#a1a1aa" />
                  )}
                </button>
              </div>
            </div>

            {/* End Side (RTL Left): Direct Voice Recording and Submit / Stop */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {/* Circular Microphone Button */}
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  if (isRecording) {
                    stopRecording(false);
                  } else {
                    startRecording('command');
                  }
                }}
                title={isRecording ? t.chat.stopRecordingTooltip : t.chat.speakWithAssistantTooltip}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: isRecording ? 'rgba(239, 68, 68, 0.22)' : '#25252a',
                  border: `1px solid ${isRecording ? 'rgba(239, 68, 68, 0.7)' : 'rgba(255, 255, 255, 0.08)'}`,
                  color: isRecording ? '#ef4444' : '#d4d4d8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isBusy ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                  boxShadow: isRecording ? '0 0 10px rgba(239, 68, 68, 0.5)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isBusy && !isRecording) {
                    e.currentTarget.style.backgroundColor = '#2e2e34';
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isBusy && !isRecording) {
                    e.currentTarget.style.backgroundColor = '#25252a';
                    e.currentTarget.style.color = '#d4d4d8';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }
                }}
              >
                <Mic size={14} color={isRecording ? '#ef4444' : undefined} />
              </button>

              {/* Circular Submit or Stop Button (Signature Violet Satin Pill) */}
              {isBusy ? (
                <button
                  type="button"
                  onClick={onStop}
                  title={t.chat.stopTooltip}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 0 12px rgba(239, 68, 68, 0.5)',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dc2626';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ef4444';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <Square size={10} fill="#ffffff" strokeWidth={0} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={!inputText.trim() && (!attachedImages || attachedImages.length === 0) && !attachedAudio && !attachedVideo}
                  title={t.chat.sendTooltip}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor:
                      !inputText.trim() && (!attachedImages || attachedImages.length === 0) && !attachedAudio && !attachedVideo
                        ? '#25252a'
                        : '#ea580c',
                    color:
                      !inputText.trim() && (!attachedImages || attachedImages.length === 0) && !attachedAudio && !attachedVideo
                        ? 'rgba(255, 255, 255, 0.28)'
                        : '#ffffff',
                    border:
                      !inputText.trim() && (!attachedImages || attachedImages.length === 0) && !attachedAudio && !attachedVideo
                        ? '1px solid rgba(255, 255, 255, 0.06)'
                        : '1px solid rgba(249, 115, 22, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor:
                      !inputText.trim() && (!attachedImages || attachedImages.length === 0) && !attachedAudio && !attachedVideo
                        ? 'not-allowed'
                        : 'pointer',
                    boxShadow:
                      !inputText.trim() && (!attachedImages || attachedImages.length === 0) && !attachedAudio && !attachedVideo
                        ? 'none'
                        : '0 2px 10px rgba(234, 88, 12, 0.35)',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (inputText.trim() || (attachedImages && attachedImages.length > 0) || attachedAudio || attachedVideo) {
                      e.currentTarget.style.backgroundColor = '#f97316';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (inputText.trim() || (attachedImages && attachedImages.length > 0) || attachedAudio || attachedVideo) {
                      e.currentTarget.style.backgroundColor = '#ea580c';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
                  }}
                >
                  <ArrowUp size={14} strokeWidth={2.4} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footnote / Disclaimer (Centered below card) */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '4px',
            fontSize: '10px',
            color: '#52525b',
            userSelect: 'none',
          }}
        >
          {t.chat.modelGeneratedBy}
        </div>
      </div>

      {/* Video Preview Modal */}
      {isVideoModalOpen && videoPreviewUrl && (
        <div
          onClick={() => {
            setIsVideoModalOpen(false);
            setVideoPreviewUrl(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            direction: 'rtl',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '680px',
              width: '100%',
              backgroundColor: '#121216',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Video size={16} color="#f97316" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
                  {t.chat.previewReferenceVideo}
                </span>
              </div>
              <button
                onClick={() => {
                  setIsVideoModalOpen(false);
                  setVideoPreviewUrl(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a1a1aa',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ borderRadius: '8px', overflow: 'hidden', backgroundColor: '#000', maxHeight: '420px' }}>
              <video
                controls
                autoPlay
                src={videoPreviewUrl}
                style={{ width: '100%', maxHeight: '420px', display: 'block', outline: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'zoom-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: '#121215',
              borderRadius: '12px',
              padding: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
              cursor: 'default',
            }}
          >
            <button
              onClick={() => setLightboxImage(null)}
              title={t.chat.closePreview}
              style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#27272a',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#f4f4f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
              }}
            >
              <X size={14} />
            </button>
            <img
              src={lightboxImage}
              alt={t.chat.enlargedPreview}
              style={{
                maxWidth: '100%',
                maxHeight: '82vh',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
          </div>
        </div>
      )}
    </aside>
  );
};
