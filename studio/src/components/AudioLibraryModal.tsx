import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Play,
  Pause,
  Upload,
  Plus,
  X,
  Music,
  Sparkles,
  Check,
  Disc,
} from 'lucide-react';
import { AudioPreset, AudioClip } from '../types/audio';
import { useLanguage } from '../i18n/LanguageContext';

interface AudioLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFrame: number;
  onInsertAudioClip: (clip: AudioClip) => void;
}

export const AudioLibraryModal: React.FC<AudioLibraryModalProps> = ({
  isOpen,
  onClose,
  currentFrame,
  onInsertAudioClip,
}) => {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'presets' | 'upload'>('presets');
  const [presets, setPresets] = useState<AudioPreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch presets on modal open
  useEffect(() => {
    if (!isOpen) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setPlayingId(null);
      return;
    }

    const fetchPresets = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/audio/presets');
        if (res.ok) {
          const data = await res.json();
          setPresets(data.presets || []);
        }
      } catch (err) {
        console.error('[AudioLibraryModal] Failed to fetch presets:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPresets();
  }, [isOpen]);

  // Audio preview playback
  const handleTogglePreview = (preset: AudioPreset) => {
    if (playingId === preset.id) {
      previewAudioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }

    const audio = new Audio(preset.url);
    previewAudioRef.current = audio;
    setPlayingId(preset.id);

    audio.play().catch((err) => {
      console.warn('[AudioPreview] Failed to play:', err);
      setPlayingId(null);
    });

    audio.onended = () => {
      setPlayingId(null);
    };
  };

  // Handle inserting preset
  const handleInsertPreset = (preset: AudioPreset) => {
    const newClip: AudioClip = {
      id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: preset.name.split(' (')[0],
      src: preset.url,
      startFrame: currentFrame,
      durationInFrames: preset.durationFrames || 30,
      volume: 1.0,
      color: preset.color || '#f97316',
    };

    onInsertAudioClip(newClip);
    onClose();
  };

  // Handle custom audio upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;

          // Estimate duration via temporary audio element
          const tempAudio = new Audio(dataUrl);
          await new Promise((resolve) => {
            tempAudio.onloadedmetadata = resolve;
            tempAudio.onerror = resolve;
          });

          const dur = tempAudio.duration && !isNaN(tempAudio.duration) ? tempAudio.duration : 2.0;
          const durFrames = Math.max(15, Math.round(dur * 30));

          const res = await fetch('/api/audio/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              dataUrl,
              duration: dur,
              durationFrames: durFrames,
            }),
          });

          if (!res.ok) {
            throw new Error(language === 'ar' ? 'فشل رفع الملف الصوتي إلى الخادم' : 'Failed to upload audio file to server');
          }

          const data = await res.json();
          if (data.preset) {
            handleInsertPreset(data.preset);
          }
        } catch (err: any) {
          setUploadError(err.message || (language === 'ar' ? 'حدث خطأ أثناء معالجة الملف الصوتي' : 'An error occurred while processing audio file'));
          setIsUploading(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || (language === 'ar' ? 'حدث خطأ أثناء قراءة الملف' : 'An error occurred while reading file'));
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '640px',
          maxWidth: '100%',
          maxHeight: '85vh',
          backgroundColor: '#121216',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 1px 1px rgba(249, 115, 22, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#16161b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Volume2 size={16} color="#f97316" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#f4f4f5' }}>
                {t.modals.audioLibrary.title}
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#71717a' }}>
                {language === 'ar'
                  ? `إدراج أصوات متزامنة بدقة الفريم عند الإطار الحالي (${currentFrame})`
                  : `Insert frame-synchronized audio at current frame (${currentFrame})`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            title={t.common.close}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#a1a1aa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs Bar */}
        <div
          style={{
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            backgroundColor: '#0f0f13',
          }}
        >
          <button
            onClick={() => setActiveTab('presets')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'presets' ? '#27272a' : 'transparent',
              color: activeTab === 'presets' ? '#ffffff' : '#71717a',
              transition: 'all 0.15s ease',
            }}
          >
            <Sparkles size={13} color={activeTab === 'presets' ? '#f97316' : '#71717a'} />
            <span>{language === 'ar' ? 'مؤثرات سينمائية جاهزة' : 'Cinematic SFX Presets'}</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'upload' ? '#27272a' : 'transparent',
              color: activeTab === 'upload' ? '#ffffff' : '#71717a',
              transition: 'all 0.15s ease',
            }}
          >
            <Upload size={13} color={activeTab === 'upload' ? '#f97316' : '#71717a'} />
            <span>{language === 'ar' ? 'رفع ملف صوتي من جهازك' : 'Upload Local Audio'}</span>
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {activeTab === 'presets' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {isLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#71717a', fontSize: '13px' }}>
                  {language === 'ar' ? 'جارٍ تحميل المؤثرات الصوتية...' : 'Loading audio library presets...'}
                </div>
              ) : (
                presets.map((p) => {
                  const isPlaying = playingId === p.id;

                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        backgroundColor: '#16161b',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.3)';
                        e.currentTarget.style.backgroundColor = '#1a1a21';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                        e.currentTarget.style.backgroundColor = '#16161b';
                      }}
                    >
                      {/* Left: Info and Preview */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        {/* Play / Pause button */}
                        <button
                          onClick={() => handleTogglePreview(p)}
                          title={isPlaying ? (language === 'ar' ? 'إيقاف المعاينة' : 'Stop Preview') : (language === 'ar' ? 'تشغيل المعاينة' : 'Play Preview')}
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            backgroundColor: isPlaying ? '#f97316' : 'rgba(255, 255, 255, 0.06)',
                            border: `1px solid ${isPlaying ? '#f97316' : 'rgba(255, 255, 255, 0.1)'}`,
                            color: isPlaying ? '#09090b' : '#f4f4f5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: '1px' }} />}
                        </button>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
                              {p.name}
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                color: '#a1a1aa',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                              }}
                            >
                              {p.category}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#71717a' }}>
                            {p.description} • {p.duration} {language === 'ar' ? `ثانية (${p.durationFrames} إطار)` : `s (${p.durationFrames} frames)`}
                          </span>
                        </div>
                      </div>

                      {/* Right: Insert Button */}
                      <button
                        onClick={() => handleInsertPreset(p)}
                        title={language === 'ar' ? 'إدراج هذا الصوت في التايم لاين عند موضع القراءة الحالي' : 'Insert this sound into timeline at current playhead'}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '7px',
                          backgroundColor: 'rgba(249, 115, 22, 0.12)',
                          border: '1px solid rgba(249, 115, 22, 0.3)',
                          color: '#fb923c',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f97316';
                          e.currentTarget.style.color = '#09090b';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.12)';
                          e.currentTarget.style.color = '#fb923c';
                        }}
                      >
                        <Plus size={13} />
                        <span>{t.modals.audioLibrary.addToTimeline}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  border: '2px dashed rgba(249, 115, 22, 0.3)',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(249, 115, 22, 0.03)',
                  padding: '40px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  cursor: isUploading ? 'wait' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#f97316';
                  e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.3)';
                  e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.03)';
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(249, 115, 22, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Upload size={22} color="#f97316" />
                </div>

                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#f4f4f5' }}>
                    {isUploading
                      ? (language === 'ar' ? 'جارٍ رفع ومعالجة الملف الصوتي...' : 'Uploading and processing audio file...')
                      : (language === 'ar' ? 'انقر لاختيار ملف صوتي من جهازك أو اسحبه هنا' : 'Click to select audio file from your device or drop here')}
                  </h4>
                  <p style={{ margin: 0, fontSize: '11px', color: '#71717a' }}>
                    {language === 'ar' ? 'يدعم ملفات MP3, WAV, OGG, M4A حتى 25 ميجابايت' : 'Supports MP3, WAV, OGG, M4A up to 25MB'}
                  </p>
                </div>
              </div>

              {uploadError && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '12px',
                  }}
                >
                  {uploadError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
