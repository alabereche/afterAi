import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Film,
  Folder,
  FolderOpen,
  HardDrive,
  FileVideo,
  Check,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';

interface ExportFormat {
  id: string;
  name: string;
  badge: string;
  description: string;
  format: 'mp4' | 'webm' | 'mov' | 'gif';
  codec: string;
  ext: string;
}

const getExportFormats = (lang: Language): ExportFormat[] => [
  {
    id: 'mp4-h264',
    name: 'MP4 (H.264)',
    badge: lang === 'ar' ? 'الأكثر توافقاً' : 'Most Compatible',
    description: lang === 'ar' ? 'الصيغة القياسية لليوتيوب وشبكات التواصل وكافة الشاشات' : 'Standard format for YouTube, social media, and all displays',
    format: 'mp4',
    codec: 'h264',
    ext: '.mp4',
  },
  {
    id: 'mp4-h265',
    name: 'MP4 (H.265 / HEVC)',
    badge: lang === 'ar' ? 'دقة فائقة' : 'Ultra Quality',
    description: lang === 'ar' ? 'أعلى جودة وضغط متطور للفيديوهات الثقيلة بدقة 4K' : 'Maximum quality and modern compression for 4K video',
    format: 'mp4',
    codec: 'h265',
    ext: '.mp4',
  },
  {
    id: 'webm-vp9',
    name: 'WebM (VP9)',
    badge: lang === 'ar' ? 'مثالي للويب' : 'Web Optimized',
    description: lang === 'ar' ? 'صيغة خفيفة وسريعة للمتصفحات ومواقع الويب مع دعم الشفافية' : 'Lightweight and fast for browsers and web with transparency support',
    format: 'webm',
    codec: 'vp9',
    ext: '.webm',
  },
  {
    id: 'mov-prores',
    name: 'Apple ProRes (MOV)',
    badge: lang === 'ar' ? 'استوديو خام' : 'Studio Raw',
    description: lang === 'ar' ? 'جودة استوديو احترافية لبرامج المونتاج (Premiere / Final Cut)' : 'Studio-grade editing quality for Premiere and Final Cut',
    format: 'mov',
    codec: 'prores',
    ext: '.mov',
  },
  {
    id: 'gif',
    name: lang === 'ar' ? 'GIF متحرك' : 'Animated GIF',
    badge: lang === 'ar' ? 'متحرك خفيف' : 'Lightweight',
    description: lang === 'ar' ? 'صورة متحركة بدون صوت للمشاركات السريعة والعروض' : 'Looping silent animation for quick sharing and demos',
    format: 'gif',
    codec: 'gif',
    ext: '.gif',
  },
];

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFileName?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  defaultFileName = 'motion-video',
}) => {
  const { language, t } = useLanguage();
  const exportFormats = React.useMemo(() => getExportFormats(language), [language]);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(() => exportFormats[0]);

  useEffect(() => {
    setSelectedFormat((prev) => exportFormats.find((f) => f.id === prev.id) || exportFormats[0]);
  }, [exportFormats]);
  const [fileName, setFileName] = useState<string>('motion-video-final');
  const [outputDir, setOutputDir] = useState<string>('');
  const [scale, setScale] = useState<number>(1);

  const [presets, setPresets] = useState<{ downloads?: string; desktop?: string; projectOut?: string }>({});
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderLogs, setRenderLogs] = useState<string[]>([]);
  const [completedResult, setCompletedResult] = useState<{
    outputPath: string;
    fileName: string;
    fileSize?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch system folder presets on modal open
  useEffect(() => {
    if (isOpen) {
      fetch('/api/export-presets')
        .then((r) => r.json())
        .then((data) => {
          if (data?.presets) {
            setPresets(data.presets);
            // Default to Downloads folder or Desktop
            if (!outputDir) {
              setOutputDir(data.presets.downloads || data.presets.desktop || '');
            }
          }
        })
        .catch(() => {});

      if (defaultFileName && fileName === 'motion-video-final') {
        const sanitized = defaultFileName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
        if (sanitized) setFileName(sanitized);
      }
    }
  }, [isOpen, defaultFileName]);

  if (!isOpen) return null;

  const currentExt = selectedFormat.ext;
  const fullPreviewName = fileName.endsWith(currentExt) ? fileName : `${fileName}${currentExt}`;

  const handleStartRender = async () => {
    setIsRendering(true);
    setRenderLogs([`بدء إعداد رندر ${selectedFormat.name}...`]);
    setCompletedResult(null);
    setError(null);

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: selectedFormat.format,
          codec: selectedFormat.codec,
          fileName,
          outputDir,
          scale,
        }),
      });

      if (!response.body) {
        throw new Error(language === 'ar' ? 'فشل بدء اتصال الرندر.' : 'Failed to start render connection.');
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

              if (data.message) {
                setRenderLogs((prev) => [...prev, data.message]);
              } else if (data.text) {
                setRenderLogs((prev) => [...prev.slice(-30), data.text]);
              } else if (data.success && data.outputPath) {
                setCompletedResult({
                  outputPath: data.outputPath,
                  fileName: data.fileName,
                  fileSize: data.fileSize,
                });
                setIsRendering(false);
              } else if (data.success === false) {
                setError(
                  language === 'ar'
                    ? `فشل تصدير الفيديو برمز: ${data.exitCode || data.error || 'خطأ غير معروف'}`
                    : `Failed to export video with code: ${data.exitCode || data.error || 'Unknown error'}`
                );
                setIsRendering(false);
              }
            } catch (e) {
              // Non-JSON SSE message
            }
          }
        }
      }
    } catch (err: any) {
      setError(
        language === 'ar'
          ? `خطأ أثناء الرندر: ${err.message}`
          : `Error during rendering: ${err.message}`
      );
      setIsRendering(false);
    }
  };

  const handleOpenFolder = async () => {
    if (!completedResult?.outputPath) return;
    try {
      await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: completedResult.outputPath }),
      });
    } catch (e) {
      console.error('Could not open folder', e);
    }
  };

  const handleDownloadFile = () => {
    if (!completedResult?.outputPath) return;
    window.location.href = `/api/download?file=${encodeURIComponent(completedResult.outputPath)}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${Math.round(bytes / 1024)} ${language === 'ar' ? 'كيلوبايت' : 'KB'}`;
    }
    return `${mb.toFixed(2)} ${language === 'ar' ? 'ميجابايت' : 'MB'}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        direction: 'rtl',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '680px',
          maxWidth: '94vw',
          maxHeight: '90vh',
          backgroundColor: '#141417',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#121215',
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
              <Film size={16} color="#f97316" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f4f4f5', margin: 0 }}>
                {t.modals.export.title}
              </h3>
              <p style={{ fontSize: '11.5px', color: '#71717a', margin: '2px 0 0 0' }}>
                {t.modals.export.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isRendering}
            title={t.common.close}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#a1a1aa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isRendering ? 'not-allowed' : 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {completedResult ? (
            /* ========================================================
               COMPLETED SUCCESS VIEW
               ======================================================== */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '24px 10px',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={32} color="#10b981" />
              </div>

              <div>
                <h4 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  {t.modals.export.exportSuccess}
                </h4>
                <p style={{ fontSize: '13px', color: '#a1a1aa', marginTop: '4px' }}>
                  {language === 'ar'
                    ? `الملف جاهز الآن على جهازك بدقة متكاملة وبصيغة ${selectedFormat.name}`
                    : `The video file is ready on your machine in full resolution (${selectedFormat.name})`}
                </p>
              </div>

              {/* File Info Card */}
              <div
                style={{
                  width: '100%',
                  backgroundColor: '#18181c',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  textAlign: 'right',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#71717a' }}>{t.modals.export.fileNameLabel}:</span>
                  <span style={{ color: '#f4f4f5', fontWeight: 600 }}>{completedResult.fileName}</span>
                </div>
                {completedResult.fileSize && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#71717a' }}>{language === 'ar' ? 'حجم الملف:' : 'File Size:'}</span>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>
                      {formatFileSize(completedResult.fileSize)}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#71717a' }}>{language === 'ar' ? 'مكان الحفظ:' : 'Location:'}</span>
                  <span
                    style={{
                      color: '#a1a1aa',
                      direction: 'ltr',
                      fontSize: '11px',
                      wordBreak: 'break-all',
                      maxWidth: '70%',
                    }}
                  >
                    {completedResult.outputPath}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Download + Show in Folder */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', marginTop: '6px' }}>
                <button
                  onClick={handleDownloadFile}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '11px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#f97316',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(249, 115, 22, 0.4)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ea580c')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f97316')}
                >
                  <Download size={16} />
                  <span>{language === 'ar' ? 'تحميل الفيديو للمتصفح' : 'Download Video'}</span>
                </button>

                <button
                  onClick={handleOpenFolder}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '11px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#e4e4e7',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.09)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
                >
                  <FolderOpen size={16} color="#fb923c" />
                  <span>{t.modals.export.openFolder}</span>
                </button>
              </div>

              {/* Reset to export another */}
              <button
                onClick={() => setCompletedResult(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: '#71717a',
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginTop: '4px',
                }}
              >
                <RotateCcw size={13} />
                <span>{language === 'ar' ? 'تصدير نسخة بصيغة أو مسار آخر' : 'Export another copy with different settings'}</span>
              </button>
            </div>
          ) : (
            /* ========================================================
               CONFIG FORM VIEW
               ======================================================== */
            <>
              {/* 1. File Name Field */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#f4f4f5', marginBottom: '6px' }}>
                  {t.modals.export.fileNameLabel}
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#18181c',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '0 12px',
                    direction: 'ltr',
                  }}
                >
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    disabled={isRendering}
                    placeholder="my-video"
                    style={{
                      flex: 1,
                      backgroundColor: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#ffffff',
                      fontSize: '13px',
                      padding: '10px 0',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: '#f97316',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(249, 115, 22, 0.1)',
                      border: '1px solid rgba(249, 115, 22, 0.25)',
                    }}
                  >
                    {currentExt}
                  </span>
                </div>
              </div>

              {/* 2. Format Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#f4f4f5', marginBottom: '8px' }}>
                  {t.modals.export.formatLabel}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {exportFormats.map((fmt) => {
                    const isSelected = fmt.id === selectedFormat.id;
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setSelectedFormat(fmt)}
                        disabled={isRendering}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.08)' : '#18181c',
                          border: `1px solid ${
                            isSelected ? 'rgba(249, 115, 22, 0.45)' : 'rgba(255, 255, 255, 0.06)'
                          }`,
                          cursor: isRendering ? 'not-allowed' : 'pointer',
                          textAlign: 'right',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#fb923c' : '#f4f4f5' }}>
                            {fmt.name}
                          </span>
                          <span
                            style={{
                              fontSize: '9.5px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                              color: isSelected ? '#fb923c' : '#71717a',
                              fontWeight: 600,
                            }}
                          >
                            {fmt.badge}
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#71717a', lineHeight: 1.4 }}>
                          {fmt.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Output Directory & Presets */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#f4f4f5', marginBottom: '8px' }}>
                  {language === 'ar' ? 'مكان حفظ الفيديو على جهازك' : 'Output Folder Location'}
                </label>

                {/* Preset shortcuts */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {presets.downloads && (
                    <button
                      type="button"
                      disabled={isRendering}
                      onClick={() => setOutputDir(presets.downloads || '')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        backgroundColor: outputDir === presets.downloads ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${outputDir === presets.downloads ? 'rgba(249, 115, 22, 0.35)' : 'rgba(255, 255, 255, 0.07)'}`,
                        color: outputDir === presets.downloads ? '#fb923c' : '#d4d4d8',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                      }}
                    >
                      <Download size={12} />
                      <span>{language === 'ar' ? 'مجلد التنزيلات (Downloads)' : 'Downloads Folder'}</span>
                    </button>
                  )}

                  {presets.desktop && (
                    <button
                      type="button"
                      disabled={isRendering}
                      onClick={() => setOutputDir(presets.desktop || '')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        backgroundColor: outputDir === presets.desktop ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${outputDir === presets.desktop ? 'rgba(249, 115, 22, 0.35)' : 'rgba(255, 255, 255, 0.07)'}`,
                        color: outputDir === presets.desktop ? '#fb923c' : '#d4d4d8',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                      }}
                    >
                      <HardDrive size={12} />
                      <span>{language === 'ar' ? 'سطح المكتب (Desktop)' : 'Desktop'}</span>
                    </button>
                  )}

                  {presets.projectOut && (
                    <button
                      type="button"
                      disabled={isRendering}
                      onClick={() => setOutputDir(presets.projectOut || '')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        backgroundColor: outputDir === presets.projectOut ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${outputDir === presets.projectOut ? 'rgba(249, 115, 22, 0.35)' : 'rgba(255, 255, 255, 0.07)'}`,
                        color: outputDir === presets.projectOut ? '#fb923c' : '#d4d4d8',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                      }}
                    >
                      <Folder size={12} />
                      <span>{language === 'ar' ? 'مجلد المشروع (templates/out)' : 'Project Output (templates/out)'}</span>
                    </button>
                  )}
                </div>

                {/* Directory Input */}
                <input
                  type="text"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  disabled={isRendering}
                  placeholder="C:\Users\username\Videos"
                  style={{
                    width: '100%',
                    backgroundColor: '#18181c',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '9px 12px',
                    color: '#e4e4e7',
                    fontSize: '12px',
                    outline: 'none',
                    direction: 'ltr',
                  }}
                />
              </div>

              {/* 4. Resolution Scale Options */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#f4f4f5', marginBottom: '6px' }}>
                  {t.modals.export.resolutionLabel}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { label: 'Full HD (1080p)', val: 1 },
                    { label: '4K Ultra HD (2160p)', val: 2 },
                    { label: language === 'ar' ? 'HD السريع (720p)' : 'Fast HD (720p)', val: 0.67 },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      disabled={isRendering}
                      onClick={() => setScale(opt.val)}
                      style={{
                        flex: 1,
                        padding: '7px 10px',
                        borderRadius: '7px',
                        backgroundColor: scale === opt.val ? 'rgba(249, 115, 22, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${scale === opt.val ? 'rgba(249, 115, 22, 0.35)' : 'rgba(255, 255, 255, 0.06)'}`,
                        color: scale === opt.val ? '#fb923c' : '#a1a1aa',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Render progress / logs */}
              {renderLogs.length > 0 && (
                <div
                  style={{
                    maxHeight: '110px',
                    overflowY: 'auto',
                    backgroundColor: '#0c0c0e',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    direction: 'ltr',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#d4d4d8',
                  }}
                >
                  {renderLogs.map((log, idx) => (
                    <div key={idx} style={{ lineHeight: 1.5 }}>
                      {log}
                    </div>
                  ))}
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#f87171',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                  }}
                >
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              {/* Start Render Trigger Button */}
              <button
                onClick={handleStartRender}
                disabled={isRendering || !fileName.trim()}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: isRendering ? 'rgba(255, 255, 255, 0.05)' : '#f97316',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  cursor: isRendering || !fileName.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isRendering ? 'none' : '0 2px 14px rgba(249, 115, 22, 0.4)',
                  transition: 'all 0.15s ease',
                  marginTop: '4px',
                }}
                onMouseEnter={(e) => {
                  if (!isRendering) e.currentTarget.style.backgroundColor = '#ea580c';
                }}
                onMouseLeave={(e) => {
                  if (!isRendering) e.currentTarget.style.backgroundColor = '#f97316';
                }}
              >
                {isRendering ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{t.modals.export.exporting}</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>{t.modals.export.startExport} ({selectedFormat.name})</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
