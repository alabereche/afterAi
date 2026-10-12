import React, { useState } from 'react';
import {
  FolderKanban,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Clock,
  MessageSquare,
  Cpu,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react';
import { SessionMetadata } from '../types/session';
import { useLanguage } from '../i18n/LanguageContext';

interface SessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionMetadata[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
}

export const SessionsModal: React.FC<SessionsModalProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
}) => {
  const { language, t } = useLanguage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartRename = (session: SessionMetadata) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return language === 'ar' ? 'غير محدد' : 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        direction: 'rtl',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '680px',
          maxWidth: '92vw',
          maxHeight: '85vh',
          backgroundColor: '#141417',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
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
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FolderKanban size={16} color="#f97316" />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f4f4f5', margin: 0 }}>
                {t.modals.sessions.title}
              </h2>
              <p style={{ fontSize: '11.5px', color: '#71717a', margin: '2px 0 0 0' }}>
                {t.modals.sessions.subtitle}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                onNewSession();
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                backgroundColor: '#f97316',
                border: 'none',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ea580c')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f97316')}
            >
              <Plus size={14} />
              <span>{t.modals.sessions.newSession}</span>
            </button>

            <button
              onClick={onClose}
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
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {sessions.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#71717a',
                fontSize: '13px',
              }}
            >
              {t.modals.sessions.emptyState}
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isEditing = editingId === session.id;
              const isConfirmingDelete = deletingId === session.id;

              return (
                <div
                  key={session.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: isActive ? 'rgba(249, 115, 22, 0.06)' : '#18181c',
                    border: `1px solid ${
                      isActive ? 'rgba(249, 115, 22, 0.35)' : 'rgba(255, 255, 255, 0.06)'
                    }`,
                    transition: 'all 0.15s ease',
                    gap: '12px',
                  }}
                >
                  {/* Left (RTL Start) Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(session.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          style={{
                            flex: 1,
                            backgroundColor: '#202025',
                            border: '1px solid rgba(249, 115, 22, 0.5)',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            color: '#ffffff',
                            fontSize: '13px',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => handleSaveRename(session.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#f97316',
                            border: 'none',
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            border: 'none',
                            color: '#a1a1aa',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '13.5px',
                              fontWeight: 600,
                              color: isActive ? '#fb923c' : '#f4f4f5',
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              onSelectSession(session.id);
                              onClose();
                            }}
                          >
                            {session.title}
                          </span>
                          {isActive && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                                color: '#fb923c',
                                border: '1px solid rgba(249, 115, 22, 0.3)',
                                fontWeight: 600,
                              }}
                            >
                              {t.modals.sessions.currentBadge}
                            </span>
                          )}
                        </div>

                        {/* Metadata Row */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '11px',
                            color: '#71717a',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} />
                            <span>{formatTimestamp(session.updatedAt)}</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MessageSquare size={11} />
                            <span>{session.messageCount} {language === 'ar' ? 'رسائل' : 'messages'}</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Cpu size={11} />
                            <span>{session.model.split(' ')[0]}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {!isActive && !isEditing && (
                      <button
                        onClick={() => {
                          onSelectSession(session.id);
                          onClose();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 12px',
                          borderRadius: '7px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          color: '#e4e4e7',
                          fontSize: '11.5px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.09)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')
                        }
                      >
                        <span>{language === 'ar' ? 'فتح' : 'Open'}</span>
                        <ChevronLeft size={13} />
                      </button>
                    )}

                    {!isEditing && (
                      <button
                        onClick={() => handleStartRename(session)}
                        title={t.modals.sessions.rename}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          color: '#a1a1aa',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)')
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <Edit2 size={12} />
                      </button>
                    )}

                    {!isEditing && (
                      <>
                        {isConfirmingDelete ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={() => {
                                onDeleteSession(session.id);
                                setDeletingId(null);
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                backgroundColor: '#ef4444',
                                border: 'none',
                                color: '#ffffff',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {language === 'ar' ? 'تأكيد' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                border: 'none',
                                color: '#a1a1aa',
                                fontSize: '11px',
                                cursor: 'pointer',
                              }}
                            >
                              {t.common.cancel}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(session.id)}
                            title={t.modals.sessions.deleteConfirm}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              backgroundColor: 'transparent',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              color: '#71717a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                              e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#71717a';
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer Info */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#121215',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11.5px',
            color: '#71717a',
          }}
        >
          <span>{language === 'ar' ? `إجمالي الجلسات: ${sessions.length}` : `Total Sessions: ${sessions.length}`}</span>
          <span>{language === 'ar' ? 'يتم حفظ وتحديث كود المشاهد وسجلات الدردشة تلقائياً لكل جلسة' : 'Scene code and chat history are saved automatically per session'}</span>
        </div>
      </div>
    </div>
  );
};
