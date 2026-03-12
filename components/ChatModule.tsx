import React, { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Paperclip, Send, MessageSquare, Upload, RefreshCw } from "lucide-react";

// WhatsApp SVG icon (inline, no extra dependency)
const WhatsAppIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);
import { toast } from "sonner";
import { API_BASE_URL, createChatConversation, getChatConversations, getChatMessages, getChatParticipants, markChatConversationRead, sendChatAttachment, sendChatMessage } from "../services/api";
import { ChatConversation, ChatMessage, User } from "../types";
import { Badge, Button, Card } from "./UIComponents";

type ChatParticipant = {
  student_id: number | string;
  student_name?: string;
  grade?: string;
  section?: string;
  teacher_id?: number | string;
  teacher_name?: string;
  teacher_user_id?: number | string;
  parent_user_id?: number | string;
  parent_name?: string;
};

type TypingEvent = {
  conversation_id: number;
  user_id: number;
  role: string;
  is_typing: boolean;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
};

const formatFileSize = (bytes?: number | null) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const normalizeId = (value: unknown) => String(value ?? "");

const getParticipantKey = (entry: ChatParticipant, userRole: string) => {
  if (userRole === "teacher") return normalizeId(entry.student_id);
  return `${normalizeId(entry.student_id)}:${normalizeId(entry.teacher_id)}`;
};

/** Strips non-digits and builds a wa.me link. Returns null if no valid phone. */
const buildWhatsAppUrl = (phone?: string | null): string | null => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}`;
};

const upsertConversation = (list: ChatConversation[], conversation: ChatConversation) => {
  const id = normalizeId(conversation.id);
  const map = new Map(list.map((entry) => [normalizeId(entry.id), entry]));
  map.set(id, { ...(map.get(id) || {}), ...conversation });

  return [...map.values()].sort((a, b) => {
    const aDate = new Date(String(a.last_message_created_at || a.updated_at || a.created_at || 0)).getTime();
    const bDate = new Date(String(b.last_message_created_at || b.updated_at || b.created_at || 0)).getTime();
    return bDate - aDate;
  });
};

const ChatModule: React.FC<{ user: User }> = ({ user }) => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [selectedParticipantKey, setSelectedParticipantKey] = useState("");
  const [typingEvent, setTypingEvent] = useState<TypingEvent | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const selectedConversationRef = useRef<string>("");
  const typingTimeoutRef = useRef<number | null>(null);
  const outgoingTypingOffTimerRef = useRef<number | null>(null);
  const activeConversationJoinRef = useRef<string>("");
  const refreshConversationsTimerRef = useRef<number | null>(null);

  const userRole = String(user.role || "").toLowerCase();
  const userId = Number(user.id);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => normalizeId(conversation.id) === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const typingLabel = useMemo(() => {
    if (!typingEvent) return "";
    if (!typingEvent.is_typing) return "";
    if (normalizeId(typingEvent.conversation_id) !== selectedConversationId) return "";
    if (typingEvent.user_id === userId) return "";
    if (userRole === "teacher") return "Parent is typing...";
    return "Teacher is typing...";
  }, [typingEvent, selectedConversationId, userId, userRole]);

  const getConversationTitle = (conversation: ChatConversation) => {
    if (userRole === "teacher") return conversation.parent_name || "Parent";
    return conversation.teacher_name || "Teacher";
  };

  const getConversationSubtitle = (conversation: ChatConversation) => {
    const classText = [conversation.grade, conversation.section].filter(Boolean).join("-");
    const student = conversation.student_name || "Student";
    return classText ? `${student} (${classText})` : student;
  };

  const addMessage = (incoming: ChatMessage) => {
    const id = normalizeId(incoming.id);
    if (!id) return;
    if (messageIdsRef.current.has(id)) return;
    messageIdsRef.current.add(id);
    setMessages((prev) => [...prev, incoming].sort((a, b) => Number(a.id) - Number(b.id)));
  };

  const loadParticipants = async () => {
    setIsLoadingParticipants(true);
    setParticipantError(null);
    try {
      const data = await getChatParticipants();
      setParticipants(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to load chat participants";
      setParticipantError(msg);
      toast.error(msg);
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const loadConversations = async (keepSelection = true) => {
    setIsLoadingConversations(true);
    try {
      const data = await getChatConversations({ limit: 100 });
      const list = Array.isArray(data) ? data : [];
      setConversations(list);

      if (!list.length) {
        setSelectedConversationId("");
        return;
      }

      if (!keepSelection || !selectedConversationRef.current) {
        setSelectedConversationId(normalizeId(list[0].id));
        return;
      }

      const exists = list.some((entry) => normalizeId(entry.id) === selectedConversationRef.current);
      if (!exists) {
        setSelectedConversationId(normalizeId(list[0].id));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load conversations");
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    if (!conversationId) return;
    setIsLoadingMessages(true);
    try {
      const data = await getChatMessages(conversationId, { limit: 100 });
      const list = Array.isArray(data) ? data : [];
      messageIdsRef.current = new Set(list.map((entry) => normalizeId(entry.id)));
      setMessages(list);
      await markChatConversationRead(conversationId);
      setConversations((prev) =>
        prev.map((entry) =>
          normalizeId(entry.id) === conversationId
            ? { ...entry, unread_count: 0 }
            : entry
        )
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load messages");
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    selectedConversationRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    loadParticipants();
    loadConversations(false);
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    loadMessages(selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io(API_BASE_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => setIsSocketConnected(true));
    socket.on("disconnect", () => setIsSocketConnected(false));

    socket.on("chat:message", (message: ChatMessage) => {
      const conversationId = normalizeId(message.conversation_id);
      if (conversationId === selectedConversationRef.current) {
        addMessage(message);
        markChatConversationRead(conversationId).catch(() => { });
      }

      setConversations((prev) => {
        const existing = prev.find((entry) => normalizeId(entry.id) === conversationId);
        const unreadCount = conversationId === selectedConversationRef.current
          ? 0
          : Number(existing?.unread_count || 0) + (Number(message.sender_user_id) !== userId ? 1 : 0);

        const next: ChatConversation = {
          ...(existing || { id: message.conversation_id }),
          last_message_id: message.id,
          last_message_type: message.message_type,
          last_message_text: message.message_text || null,
          last_message_file_url: message.file_url || null,
          last_message_file_name: message.file_name || null,
          last_message_sender_role: message.sender_role,
          last_message_created_at: message.created_at,
          updated_at: message.created_at,
          unread_count: unreadCount,
        } as ChatConversation;
        return upsertConversation(prev, next);
      });
    });

    socket.on("chat:conversation:update", () => {
      if (refreshConversationsTimerRef.current) {
        window.clearTimeout(refreshConversationsTimerRef.current);
      }
      refreshConversationsTimerRef.current = window.setTimeout(() => {
        loadConversations(true);
      }, 250);
    });

    socket.on("chat:typing", (payload: TypingEvent) => {
      setTypingEvent(payload);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => setTypingEvent(null), 2200);
    });

    return () => {
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      if (refreshConversationsTimerRef.current) window.clearTimeout(refreshConversationsTimerRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selectedConversationId) return;

    if (activeConversationJoinRef.current && activeConversationJoinRef.current !== selectedConversationId) {
      socket.emit("chat:leave", { conversation_id: Number(activeConversationJoinRef.current) });
    }

    socket.emit("chat:join", { conversation_id: Number(selectedConversationId) });
    activeConversationJoinRef.current = selectedConversationId;

    return () => {
      if (socket.connected) {
        socket.emit("chat:leave", { conversation_id: Number(selectedConversationId) });
      }
      if (activeConversationJoinRef.current === selectedConversationId) {
        activeConversationJoinRef.current = "";
      }
    };
  }, [selectedConversationId]);

  const emitTyping = (isTyping: boolean) => {
    const socket = socketRef.current;
    if (!socket || !selectedConversationId) return;
    socket.emit("chat:typing", {
      conversation_id: Number(selectedConversationId),
      is_typing: isTyping,
    });
  };

  const handleInputChange = (value: string) => {
    setMessageInput(value);
    emitTyping(Boolean(value.trim()));
    if (outgoingTypingOffTimerRef.current) window.clearTimeout(outgoingTypingOffTimerRef.current);
    outgoingTypingOffTimerRef.current = window.setTimeout(() => emitTyping(false), 1200);
  };

  const handleSendMessage = async () => {
    if (!selectedConversationId) {
      toast.error("Select a conversation first");
      return;
    }
    const trimmed = messageInput.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      const sent = await sendChatMessage(selectedConversationId, { message: trimmed });
      addMessage(sent);
      setMessageInput("");
      emitTyping(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachmentClick = () => {
    if (!selectedConversationId) {
      toast.error("Select a conversation first");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleAttachmentSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedConversationId) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (messageInput.trim()) {
        formData.append("caption", messageInput.trim());
      }

      const sent = await sendChatAttachment(selectedConversationId, formData);
      addMessage(sent);
      setMessageInput("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to upload attachment");
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartConversation = async () => {
    if (!selectedParticipantKey) {
      toast.error(userRole === "teacher" ? "Select a student first" : "Select a teacher/student pair first");
      return;
    }
    const participant = participants.find((entry) => {
      const key = getParticipantKey(entry, userRole);
      return key === selectedParticipantKey;
    });
    if (!participant) return;

    try {
      const payload = userRole === "teacher"
        ? (
          participant.parent_user_id
            ? { student_id: participant.student_id, parent_user_id: participant.parent_user_id }
            : { student_id: participant.student_id }
        )
        : { student_id: participant.student_id, teacher_id: participant.teacher_id };
      const result = await createChatConversation(payload);
      const conversation = result?.conversation;
      if (!conversation?.id) {
        await loadConversations(true);
        toast.success("Conversation ready");
        return;
      }

      setConversations((prev) => upsertConversation(prev, conversation));
      setSelectedConversationId(normalizeId(conversation.id));
      toast.success(result?.created ? "Conversation started" : "Conversation opened");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to start conversation");
    }
  };

  const participantOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>();
    for (const participant of participants) {
      const key = getParticipantKey(participant, userRole);
      if (!key) continue;
      const counterpartyName = userRole === "teacher"
        ? (participant.parent_name || "Parent")
        : (participant.teacher_name || "Teacher");
      const classText = [participant.grade, participant.section].filter(Boolean).join("-");
      const studentText = classText
        ? `${participant.student_name || "Student"} (${classText})`
        : (participant.student_name || "Student");
      map.set(key, { key, label: `${counterpartyName} - ${studentText}` });
    }
    return [...map.values()];
  }, [participants, userRole]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare size={22} />
            Parent-Teacher Chat
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time messaging with attachments and read sync.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={isSocketConnected ? "success" : "warning"}>
            {isSocketConnected ? "Live" : "Reconnecting"}
          </Badge>
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => loadConversations(true)}>
            Refresh
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid md:grid-cols-[1fr_auto] gap-3">
          <select
            disabled={isLoadingParticipants}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm disabled:opacity-60"
            value={selectedParticipantKey}
            onChange={(event) => setSelectedParticipantKey(event.target.value)}
          >
            {isLoadingParticipants
              ? <option value="">Loading participants...</option>
              : (
                <>
                  <option value="">Select participant</option>
                  {participantOptions.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </>
              )
            }
          </select>
          <Button onClick={handleStartConversation} disabled={isLoadingParticipants}>Start / Open Conversation</Button>
        </div>

        {/* Diagnostic messages */}
        {!isLoadingParticipants && participantError && (
          <p className="text-xs text-red-500 mt-3">Warning: {participantError}</p>
        )}
        {!isLoadingParticipants && !participantError && !participantOptions.length && (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            {userRole === "teacher" ? (
              <>
                <p className="font-medium">No parents found for your students (Count: {participants.length}).</p>
                <p>For participants to appear here, the following must all be true:</p>
                <ul className="list-disc ml-4 space-y-0.5">
                  <li>You are assigned as a class teacher OR teach subjects in a class</li>
                  <li>That class has students</li>
                  <li>Those students have a guardian phone in the student profile</li>
                </ul>
                <p className="mt-1">Ask your school admin to update guardian phone numbers in student records.</p>
              </>
            ) : (
              <>
                <p className="font-medium">No teachers found for your linked students.</p>
                <p>Your students must be assigned to a class with at least one teacher. Contact your school admin.</p>
              </>
            )}
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-4">
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold">Conversations</h3>
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            {isLoadingConversations && (
              <p className="p-4 text-sm text-slate-500">Loading conversations...</p>
            )}
            {!isLoadingConversations && !conversations.length && (
              <p className="p-4 text-sm text-slate-500">No conversations yet.</p>
            )}
            {!isLoadingConversations && conversations.map((conversation) => {
              const conversationId = normalizeId(conversation.id);
              const isActive = conversationId === selectedConversationId;
              return (
                <button
                  key={conversationId}
                  onClick={() => setSelectedConversationId(conversationId)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-800 transition-colors ${isActive
                    ? "bg-indigo-50 dark:bg-indigo-900/20"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate flex items-center gap-1.5">
                        {getConversationTitle(conversation)}
                        {userRole === "teacher" && buildWhatsAppUrl(conversation.parent_phone) && (
                          <a
                            href={buildWhatsAppUrl(conversation.parent_phone)!}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={`WhatsApp ${conversation.parent_name || "Parent"}`}
                            className="text-green-500 hover:text-green-600 shrink-0"
                          >
                            <WhatsAppIcon size={13} />
                          </a>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{getConversationSubtitle(conversation)}</p>
                    </div>
                    {!!Number(conversation.unread_count || 0) && (
                      <Badge variant="warning">{conversation.unread_count}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 truncate">
                    {conversation.last_message_type === "file"
                      ? `File: ${conversation.last_message_file_name || "Attachment"}`
                      : (conversation.last_message_text || "No messages yet")}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">{formatDateTime(conversation.last_message_created_at || conversation.updated_at)}</p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          {!selectedConversationId ? (
            <div className="h-[65vh] flex items-center justify-center text-sm text-slate-500">
              Select a conversation to start chatting.
            </div>
          ) : (
            <div className="flex flex-col h-[65vh]">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{selectedConversation ? getConversationTitle(selectedConversation) : "Conversation"}</p>
                  <p className="text-xs text-slate-500">{selectedConversation ? getConversationSubtitle(selectedConversation) : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  {userRole === "teacher" &&
                    selectedConversation &&
                    buildWhatsAppUrl(selectedConversation.parent_phone) && (
                      <a
                        href={buildWhatsAppUrl(selectedConversation.parent_phone)!}
                        target="_blank"
                        rel="noreferrer"
                        title={`WhatsApp ${selectedConversation.parent_name || "Parent"}: ${selectedConversation.parent_phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors"
                      >
                        <WhatsAppIcon size={14} />
                        WhatsApp
                      </a>
                    )}
                  <Badge variant="outline">ID #{selectedConversationId}</Badge>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/40 dark:bg-slate-900/40">
                {isLoadingMessages && (
                  <p className="text-sm text-slate-500">Loading messages...</p>
                )}
                {!isLoadingMessages && !messages.length && (
                  <p className="text-sm text-slate-500">No messages yet.</p>
                )}
                {!isLoadingMessages && messages.map((message) => {
                  const mine = Number(message.sender_user_id) === userId;
                  return (
                    <div
                      key={normalizeId(message.id)}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 border ${mine
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        }`}>
                        <p className={`text-[11px] mb-1 ${mine ? "text-indigo-100" : "text-slate-500"}`}>
                          {message.sender_name || message.sender_role}
                        </p>
                        {message.message_text && (
                          <p className={`text-sm whitespace-pre-wrap break-words ${mine ? "text-white" : "text-slate-800 dark:text-slate-100"}`}>
                            {message.message_text}
                          </p>
                        )}
                        {message.message_type === "file" && message.file_url && (
                          <a
                            href={`${API_BASE_URL}${message.file_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`mt-2 inline-flex items-center gap-2 text-sm underline ${mine ? "text-indigo-100" : "text-indigo-600 dark:text-indigo-300"}`}
                          >
                            <Upload size={14} />
                            {message.file_name || "Attachment"} ({formatFileSize(message.file_size_bytes)})
                          </a>
                        )}
                        <p className={`text-[10px] mt-2 ${mine ? "text-indigo-200" : "text-slate-400"}`}>
                          {formatDateTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {typingLabel && (
                  <p className="text-xs text-slate-500 italic">{typingLabel}</p>
                )}
              </div>

              <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleAttachmentSelected}
                />
                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm resize-none"
                    placeholder="Type message..."
                    value={messageInput}
                    onChange={(event) => handleInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button variant="outline" onClick={handleAttachmentClick} disabled={isUploading}>
                    <Paperclip size={16} />
                  </Button>
                  <Button onClick={handleSendMessage} disabled={isSending || !messageInput.trim()}>
                    <Send size={16} />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ChatModule;
