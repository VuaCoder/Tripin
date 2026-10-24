'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  Shield,
  Star,
  User,
  Building2,
  HelpCircle,
  ImagePlus,
  Paperclip,
  Smile,
  X,
} from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { EmojiPicker } from './EmojiPicker';
import {
  uploadImageToCloudinary,
  validateImageFile,
} from '@/features/traveler-account/api/avatarUpload';
import { getCategoryLabel, getSubCategoryLabel, PRIORITY_LABELS, STATUS_LABELS } from '../labels';
import type { ComplaintTicketDetail } from '../types';
import {
  useAcceptResolutionMutation,
  useAdjudicateComplaintTicketMutation,
  useCreateComplaintImageSignatureMutation,
  useEscalateComplaintMutation,
  useGetComplaintDetailQuery,
  useResolveComplaintTicketMutation,
  useSendComplaintMessageMutation,
} from '../api/complaintsApi';
import { ComplaintCsatDialog } from './ComplaintCsatDialog';

interface ComplaintConversationViewProps {
  ticketId: string;
  userRole: 'TRAVELER' | 'AGENCY' | 'MODERATOR' | 'SUPER_ADMIN';
  userId: string;
  onBack?: () => void;
}

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export function ComplaintConversationView({
  ticketId,
  userRole,
  userId,
  onBack,
}: ComplaintConversationViewProps) {
  const { data: ticket, isLoading, isError, refetch } = useGetComplaintDetailQuery(ticketId);
  const [createSignature] = useCreateComplaintImageSignatureMutation();
  const [sendMessage, { isLoading: isSending }] = useSendComplaintMessageMutation();
  const [resolveTicket, { isLoading: isResolving }] = useResolveComplaintTicketMutation();
  const [acceptResolution, { isLoading: isAccepting }] = useAcceptResolutionMutation();
  const [escalateTicket, { isLoading: isEscalating }] = useEscalateComplaintMutation();
  const [adjudicateTicket, { isLoading: isAdjudicating }] = useAdjudicateComplaintTicketMutation();

  const [messageText, setMessageText] = useState('');
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [chatUploadProgress, setChatUploadProgress] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);

  const [showCsatModal, setShowCsatModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showAdjudicateModal, setShowAdjudicateModal] = useState(false);

  const [solutionInput, setSolutionInput] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [adjudicateDecision, setAdjudicateDecision] = useState('');
  const [adjudicateNote, setAdjudicateNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const insertEmoji = (emoji: string) => {
    const input = textInputRef.current;
    if (input) {
      const start = input.selectionStart ?? messageText.length;
      const end = input.selectionEnd ?? messageText.length;
      const next = messageText.slice(0, start) + emoji + messageText.slice(end);
      setMessageText(next);
      setTimeout(() => {
        input.focus();
        const nextPos = start + emoji.length;
        input.setSelectionRange(nextPos, nextPos);
      }, 0);
    } else {
      setMessageText((prev) => prev + emoji);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages.length]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-brand-teal border-t-transparent" />
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-bold text-red-700">Không thể tải thông tin phiếu khiếu nại</p>
        <p className="mt-1 text-sm text-red-600">Vui lòng thử lại sau.</p>
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="mt-4">
            Quay lại
          </Button>
        )}
      </div>
    );
  }

  const isClosed = ticket.status === 'CLOSED';
  const isResolved = ticket.status === 'RESOLVED';
  const isEscalated = ticket.status === 'ESCALATED';
  const isTraveler = userRole === 'TRAVELER';
  const isAgency = userRole === 'AGENCY';
  const isStaff = userRole === 'MODERATOR' || userRole === 'SUPER_ADMIN';

  const handleAddChatFiles = (selected: File[]) => {
    setFileError(null);
    const next = [...chatFiles];
    const errors: string[] = [];

    for (const f of selected) {
      const issue = validateImageFile(f, 'Ảnh đính kèm');
      if (issue) {
        errors.push(issue);
        continue;
      }
      if (
        next.some(
          (item) =>
            item.name === f.name &&
            item.size === f.size &&
            item.lastModified === f.lastModified,
        )
      ) {
        continue;
      }
      if (next.length >= 5) {
        errors.push('Tối đa 5 ảnh trong một tin nhắn.');
        break;
      }
      next.push(f);
    }

    setChatFiles(next);
    if (errors.length > 0) setFileError(errors[0]!);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = messageText.trim();
    if ((!trimmed && chatFiles.length === 0) || isSending || isUploadingImages) return;
    setActionError(null);
    setFileError(null);

    try {
      let imagePublicIds: string[] | undefined;

      if (chatFiles.length > 0) {
        setIsUploadingImages(true);
        const ids: string[] = [];
        const role = isTraveler ? 'TRAVELER' : isAgency ? 'AGENCY' : 'MODERATOR';

        for (let i = 0; i < chatFiles.length; i++) {
          const file = chatFiles[i]!;
          setChatUploadProgress(`Đang tải ảnh ${i + 1}/${chatFiles.length}...`);
          const sig = await createSignature({ role }).unwrap();
          const uploadRes = await uploadImageToCloudinary(file, sig);
          ids.push(uploadRes.publicId);
        }
        imagePublicIds = ids;
      }

      await sendMessage({
        ticketId: ticket.id,
        text: trimmed || '(Đính kèm hình ảnh bằng chứng)',
        imagePublicIds,
      }).unwrap();

      setMessageText('');
      setChatFiles([]);
    } catch (err: any) {
      setActionError(
        err?.message ||
          err?.data?.error?.message ||
          'Không thể gửi tin nhắn hoặc tải ảnh lên Cloudinary.',
      );
    } finally {
      setIsUploadingImages(false);
      setChatUploadProgress('');
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solutionInput.trim()) return;
    setActionError(null);
    try {
      await resolveTicket({ ticketId: ticket.id, solutionSummary: solutionInput.trim() }).unwrap();
      setShowResolveModal(false);
      setSolutionInput('');
    } catch (err: any) {
      setActionError(err?.data?.error?.message || 'Không thể gửi đề xuất giải quyết.');
    }
  };

  const handleAcceptResolution = async () => {
    setActionError(null);
    try {
      await acceptResolution(ticket.id).unwrap();
      setShowCsatModal(true);
    } catch (err: any) {
      setActionError(err?.data?.error?.message || 'Không thể xác nhận đóng phiếu.');
    }
  };

  const handleEscalateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateReason.trim()) return;
    setActionError(null);
    try {
      await escalateTicket({ ticketId: ticket.id, reason: escalateReason.trim() }).unwrap();
      setShowEscalateModal(false);
      setEscalateReason('');
    } catch (err: any) {
      setActionError(err?.data?.error?.message || 'Không thể yêu cầu sàn phân xử.');
    }
  };

  const handleAdjudicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjudicateDecision.trim() || !adjudicateNote.trim()) return;
    setActionError(null);
    try {
      await adjudicateTicket({
        ticketId: ticket.id,
        decision: adjudicateDecision.trim(),
        note: adjudicateNote.trim(),
      }).unwrap();
      setShowAdjudicateModal(false);
    } catch (err: any) {
      setActionError(err?.data?.error?.message || 'Không thể hoàn tất phán quyết.');
    }
  };

  const statusInfo = STATUS_LABELS[ticket.status] || { label: ticket.status, className: '' };
  const priorityInfo = PRIORITY_LABELS[ticket.priority] || { label: ticket.priority, className: '' };

  const isBusy = isSending || isUploadingImages;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* Header phiếu khiếu nại */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-extrabold text-brand-teal">{ticket.ticketCode}</span>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusInfo.className}`}>
                {statusInfo.label}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityInfo.className}`}>
                {priorityInfo.label}
              </span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900 line-clamp-1">{ticket.subject}</h2>
            <p className="text-xs text-slate-500">
              Tour: <span className="font-semibold text-slate-700">{ticket.tourTitle}</span>
              {ticket.bookingCode && ` · Đặt chỗ: ${ticket.bookingCode}`}
              {' · '}
              {getCategoryLabel(ticket.category)} ➔ {getSubCategoryLabel(ticket.category, ticket.subCategory)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isTraveler && isClosed && !ticket.hasFeedback && (
              <Button size="sm" onClick={() => setShowCsatModal(true)} className="gap-1.5 shadow-sm">
                <Star className="size-4 fill-amber-300 text-amber-300" />
                <span>Đánh giá CSAT</span>
              </Button>
            )}
            {isAgency && (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') && (
              <Button size="sm" onClick={() => setShowResolveModal(true)} className="gap-1.5 shadow-sm">
                <CheckCircle2 className="size-4" />
                <span>Đề xuất giải pháp & Đóng phiếu</span>
              </Button>
            )}
            {isStaff && isEscalated && (
              <Button size="sm" variant="danger" onClick={() => setShowAdjudicateModal(true)} className="gap-1.5 shadow-sm">
                <Shield className="size-4" />
                <span>Phán quyết sàn</span>
              </Button>
            )}
            {onBack && (
              <Button size="sm" variant="ghost" onClick={onBack}>
                Quay lại
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Banner nếu có giải pháp chờ xác nhận hoặc leo thang */}
      {isResolved && (
        <div className="shrink-0 border-b border-indigo-100 bg-indigo-50/90 p-4 text-sm text-indigo-950">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-bold text-indigo-900 flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-indigo-600" />
                Đối tác đã đề xuất phương án giải quyết:
              </p>
              <p className="text-xs text-indigo-800 bg-white/70 rounded-xl p-2.5 font-medium border border-indigo-200">
                &ldquo;{ticket.solutionSummary}&rdquo;
              </p>
            </div>
            {isTraveler && (
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" onClick={handleAcceptResolution} loading={isAccepting}>
                  Đồng ý giải pháp & Đóng phiếu
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowEscalateModal(true)}>
                  Yêu cầu sàn can thiệp
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {isEscalated && (
        <div className="shrink-0 border-b border-rose-100 bg-rose-50/90 p-3.5 text-xs text-rose-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-rose-600 shrink-0" />
            <p>
              <strong>Vụ việc đang được Kiểm duyệt viên sàn phân xử.</strong> Toàn bộ bằng chứng và hội thoại đang được thẩm định.
            </p>
          </div>
        </div>
      )}

      {ticket.moderatorDecision && (
        <div className="shrink-0 border-b border-purple-100 bg-purple-50/90 p-4 text-xs text-purple-950">
          <p className="font-bold flex items-center gap-1.5 text-purple-900">
            <Shield className="size-4 text-purple-700" />
            Phán quyết chính thức từ Sàn:
          </p>
          <p className="mt-1 font-semibold text-purple-900">{ticket.moderatorDecision}</p>
        </div>
      )}

      {/* Danh sách tin nhắn */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40">
        {/* Tin nhắn mở đầu */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <User className="size-3.5 text-slate-500" />
              {ticket.travelerName || 'Du khách'} (Nội dung khởi tạo khiếu nại)
            </span>
            <span>{dateTime.format(new Date(ticket.createdAt))}</span>
          </div>
          <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{ticket.description}</p>

          {/* Ảnh bằng chứng khởi tạo */}
          {ticket.messages[0]?.attachments && ticket.messages[0].attachments.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">Ảnh bằng chứng đính kèm:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ticket.messages[0].attachments.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-2xs transition hover:opacity-90"
                    title="Bấm để xem ảnh phóng to"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Bằng chứng #${i + 1}`}
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Các tin nhắn trao đổi tiếp theo */}
        {ticket.messages.slice(1).map((msg) => {
          const isMe = msg.senderId === userId;
          const isSystem = msg.senderRole === 'SYSTEM';

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <div className="max-w-md rounded-full bg-slate-200/80 px-4 py-1 text-center text-xs font-medium text-slate-700 shadow-2xs">
                  {msg.text}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 px-1">
                {msg.senderRole === 'AGENCY' ? (
                  <Building2 className="size-3 text-indigo-500" />
                ) : msg.senderRole === 'MODERATOR' ? (
                  <Shield className="size-3 text-purple-600" />
                ) : (
                  <User className="size-3 text-slate-500" />
                )}
                <span className="font-semibold text-slate-600">
                  {msg.senderName ||
                    (msg.senderRole === 'MODERATOR'
                      ? 'Ban Kiểm Duyệt Sàn'
                      : msg.senderRole === 'AGENCY'
                        ? 'Đối tác lữ hành'
                        : msg.senderRole === 'TRAVELER'
                          ? 'Du khách'
                          : msg.senderRole)}
                </span>
                <span>·</span>
                <span>{dateTime.format(new Date(msg.createdAt))}</span>
              </div>

              <div
                className={`max-w-[78%] rounded-2xl p-3.5 text-sm shadow-2xs whitespace-pre-wrap ${
                  msg.senderRole === 'MODERATOR'
                    ? 'bg-purple-50 text-purple-950 border border-purple-200 rounded-bl-xs'
                    : isMe
                      ? 'bg-brand-teal text-white rounded-br-xs'
                      : 'bg-white text-slate-900 border border-slate-200 rounded-bl-xs'
                }`}
              >
                <p>{msg.text}</p>
                {msg.attachments.length > 0 && (
                  <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-white/20">
                    {msg.attachments.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative block aspect-video overflow-hidden rounded-xl border border-slate-200/60 bg-slate-900/10 shadow-2xs transition hover:opacity-90"
                        title="Bấm để xem ảnh phóng to"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Đính kèm #${i + 1}`}
                          className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input Chat */}
      {actionError && (
        <div className="shrink-0 bg-red-50 px-6 py-2 text-xs font-semibold text-red-600 border-t border-red-200">
          {actionError}
        </div>
      )}
      {fileError && (
        <div className="shrink-0 bg-amber-50 px-6 py-2 text-xs font-semibold text-amber-700 border-t border-amber-200">
          {fileError}
        </div>
      )}

      {/* Preview ảnh đính kèm trước khi gửi */}
      {chatFiles.length > 0 && (
        <div className="shrink-0 border-t border-slate-200 bg-slate-50/90 px-4 py-2.5 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold text-slate-600 shrink-0">
            {chatFiles.length}/5 ảnh:
          </span>
          <div className="flex items-center gap-2">
            {chatFiles.map((file, idx) => (
              <div key={idx} className="relative size-12 shrink-0 rounded-lg overflow-hidden border border-slate-300 bg-white shadow-2xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setChatFiles(chatFiles.filter((_, i) => i !== idx))}
                  disabled={isBusy}
                  className="absolute right-0.5 top-0.5 size-4 rounded-full bg-slate-950/80 text-white flex items-center justify-center hover:bg-red-600"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4 sticky bottom-0 z-10">
        {isClosed ? (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Phiếu khiếu nại này đã đóng. Không thể gửi thêm tin nhắn.
            </span>
            {isTraveler && !ticket.hasFeedback && (
              <Button size="sm" onClick={() => setShowCsatModal(true)}>
                Đánh giá chất lượng hỗ trợ ⭐
              </Button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSend} className="relative flex items-center gap-2">
            <input
              ref={fileInputRef}
              hidden
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={isBusy}
              onChange={(e) => {
                handleAddChatFiles(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={isBusy || chatFiles.length >= 5}
              onClick={() => fileInputRef.current?.click()}
              title="Đính kèm ảnh bằng chứng (Cloudinary)"
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:opacity-40"
            >
              <Paperclip className="size-4" />
            </button>

            {/* Bộ Icon / Emoji Picker */}
            <div className="relative">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                title="Chèn biểu tượng cảm xúc (Emoji)"
                aria-label="Chọn biểu tượng cảm xúc"
                className={`flex size-10 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:opacity-40 ${
                  showEmojiPicker
                    ? 'border-brand-teal bg-teal-50 text-brand-teal'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-brand-teal'
                }`}
              >
                <Smile className="size-4" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 z-30 mb-1">
                  <EmojiPicker
                    onSelect={insertEmoji}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                </div>
              )}
            </div>

            <input
              ref={textInputRef}
              type="text"
              maxLength={4000}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={isBusy}
              placeholder={chatFiles.length > 0 ? 'Thêm ghi chú cho ảnh đính kèm (hoặc nhấn Gửi)...' : 'Nhập nội dung phản hồi, trao đổi phương án xử lý...'}
              className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:bg-white focus:ring-2 focus:ring-brand-teal/20 disabled:bg-slate-100"
            />
            <Button
              type="submit"
              size="sm"
              loading={isBusy}
              loadingLabel={chatUploadProgress || 'Đang gửi...'}
              disabled={!messageText.trim() && chatFiles.length === 0}
              className="rounded-full px-4"
            >
              <Send className="size-4" />
              <span className="sr-only sm:not-sr-only">Gửi</span>
            </Button>
          </form>
        )}
      </div>

      {/* Dialog Đánh giá CSAT */}
      <ComplaintCsatDialog
        open={showCsatModal}
        ticketId={ticket.id}
        ticketCode={ticket.ticketCode}
        agencyName={ticket.agencyName}
        onClose={() => setShowCsatModal(false)}
        onSuccess={() => void refetch()}
      />

      {/* Modal đề xuất giải pháp (Agency) */}
      <Modal
        open={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        closeOnBackdrop={!isResolving}
        title="Đề xuất giải pháp & Đóng khiếu nại"
      >
        <form onSubmit={handleResolveSubmit} className="space-y-4 text-sm">
          <p className="text-xs text-slate-500">
            Hãy mô tả phương án thỏa thuận bạn đã thống nhất hoặc muốn đề xuất cho khách hàng (ví dụ: hoàn tiền 30%, tặng voucher 500k, xin lỗi và giải trình...).
          </p>
          <textarea
            autoFocus
            rows={4}
            maxLength={2000}
            required
            value={solutionInput}
            onChange={(e) => setSolutionInput(e.target.value)}
            disabled={isResolving}
            placeholder="Nội dung giải pháp xử lý..."
            className="w-full resize-y rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowResolveModal(false)} disabled={isResolving}>
              Hủy
            </Button>
            <Button type="submit" loading={isResolving} loadingLabel="Đang gửi...">
              Gửi phương án
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Leo thang lên Sàn (Traveler/Agency) */}
      <Modal
        open={showEscalateModal}
        onClose={() => setShowEscalateModal(false)}
        closeOnBackdrop={!isEscalating}
        title="Yêu cầu Ban quản trị sàn can thiệp"
      >
        <form onSubmit={handleEscalateSubmit} className="space-y-4 text-sm">
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            Khiếu nại sẽ được chuyển sang trạng thái <strong>LEO THANG (ESCALATED)</strong>. Đội ngũ Kiểm duyệt viên sàn sẽ vào cuộc xác minh và đưa ra phán quyết ràng buộc.
          </div>
          <textarea
            autoFocus
            rows={3}
            maxLength={2000}
            required
            value={escalateReason}
            onChange={(e) => setEscalateReason(e.target.value)}
            disabled={isEscalating}
            placeholder="Lý do không đạt được thỏa thuận hoặc cần sàn can thiệp..."
            className="w-full resize-y rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowEscalateModal(false)} disabled={isEscalating}>
              Hủy
            </Button>
            <Button type="submit" variant="danger" loading={isEscalating} loadingLabel="Đang gửi...">
              Xác nhận chuyển sàn
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Phán quyết của Sàn (Moderator) */}
      <Modal
        open={showAdjudicateModal}
        onClose={() => setShowAdjudicateModal(false)}
        closeOnBackdrop={!isAdjudicating}
        title="Phán quyết giải quyết khiếu nại"
      >
        <form onSubmit={handleAdjudicateSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Quyết định chính thức</label>
            <input
              autoFocus
              type="text"
              required
              maxLength={200}
              value={adjudicateDecision}
              onChange={(e) => setAdjudicateDecision(e.target.value)}
              disabled={isAdjudicating}
              placeholder="Ví dụ: Chấp thuận khiếu nại - Buộc hoàn 50% tiền tour"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Căn cứ &amp; Hướng dẫn thực thi</label>
            <textarea
              rows={4}
              required
              maxLength={2000}
              value={adjudicateNote}
              onChange={(e) => setAdjudicateNote(e.target.value)}
              disabled={isAdjudicating}
              placeholder="Giải trình căn cứ dựa trên lịch trình, chứng từ và quy định của sàn..."
              className="w-full resize-y rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowAdjudicateModal(false)} disabled={isAdjudicating}>
              Hủy
            </Button>
            <Button type="submit" variant="danger" loading={isAdjudicating} loadingLabel="Đang lưu phán quyết...">
              Đóng vụ việc với phán quyết này
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
