import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/http';
import { getUserList } from '../api/userApi';
import { getConversations, getDirectHistory } from '../api/messageApi';
import { getInitials, resolveAssetUrl } from '../utils/dashboard';

import '../styles/codeforces.css';

const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '') || undefined;
const MAX_MESSAGE_LENGTH = 500;
const EMOJI_PALETTE = ['😀', '😂', '😍', '👍', '🙏', '🎉', '🔥', '😢', '😮', '❤️', '😎', '🤔'];

const formatClock = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function MessageBubble({
  message,
  isMine,
  isMenuOpen,
  isEditing,
  editDraft,
  onToggleMenu,
  onStartEdit,
  onChangeEditDraft,
  onSaveEdit,
  onCancelEdit,
  onDeleteForMe,
  onDeleteForEveryone
}) {
  const isDeleted = message.isDeletedForEveryone;

  if (isEditing) {
    return (
      <div className={`dm-message ${isMine ? 'dm-message-mine' : 'dm-message-other'}`}>
        <div className="dm-edit-row">
          <input
            type="text"
            value={editDraft}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={(e) => onChangeEditDraft(e.target.value)}
            autoFocus
          />
          <button type="button" className="cf-btn primary" onClick={onSaveEdit}>Save</button>
          <button type="button" className="cf-btn" onClick={onCancelEdit}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`dm-message ${isMine ? 'dm-message-mine' : 'dm-message-other'}`}>
      <div className="dm-message-body">
        <span className={`dm-message-text ${isDeleted ? 'dm-message-deleted' : ''}`}>
          {isDeleted ? '🚫 This message was deleted' : message.text}
        </span>

        <div className="dm-message-meta">
          {!isDeleted && message.isEdited && <span className="dm-message-edited-tag">(edited)</span>}
          <span className="dm-message-time">{formatClock(message.createdAt)}</span>
        </div>

        <div className="dm-message-menu-wrap">
          <button
            type="button"
            className="dm-message-menu-btn"
            onClick={() => onToggleMenu(message._id)}
            aria-label="Message options"
          >
            ⋮
          </button>

          {isMenuOpen && (
            <div className="dm-message-menu">
              {isMine && !isDeleted && (
                <button type="button" onClick={() => onStartEdit(message)}>
                  Edit message
                </button>
              )}
              <button type="button" onClick={() => onDeleteForMe(message._id)}>
                Delete for me
              </button>
              {isMine && !isDeleted && (
                <button type="button" onClick={() => onDeleteForEveryone(message._id)}>
                  Delete for everyone
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DirectMessagesPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const { userId: activeUserId } = useParams();

  const [conversations, setConversations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [search, setSearch] = useState('');

  const [activeUser, setActiveUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);

  const [draft, setDraft] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editDraft, setEditDraft] = useState('');

  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const [connected, setConnected] = useState(false);
  const [chatError, setChatError] = useState('');
  const [loadingConversation, setLoadingConversation] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const refreshConversations = useCallback(() => {
    getConversations()
      .then((response) => setConversations(response.data.conversations || []))
      .catch(() => {});
  }, []);

  /* initial sidebar data */
  useEffect(() => {
    refreshConversations();

    getUserList()
      .then((response) => setAllUsers(response.data.users || []))
      .catch(() => {});
  }, [refreshConversations]);

  /* persistent socket connection for the whole time this page is open */
  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => {
      setConnected(false);
      setChatError('Could not connect to chat. Please try again later.');
    });

    socket.on('online_users', (ids) => setOnlineUserIds(new Set(ids)));
    socket.on('user_online', (id) => setOnlineUserIds((prev) => new Set(prev).add(id)));
    socket.on('user_offline', (id) =>
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      })
    );

    socket.on('dm_room_history', ({ room: historyRoom, messages: historyMessages }) => {
      setRoom((currentRoom) => {
        if (currentRoom === historyRoom) setMessages(historyMessages || []);
        return currentRoom;
      });
    });

    socket.on('dm_message_received', (message) => {
      setRoom((currentRoom) => {
        if (currentRoom === message.room) {
          setMessages((prev) => [...prev, message]);
        }
        return currentRoom;
      });
      refreshConversations();
    });

    socket.on('dm_message_edited', ({ messageId, text, room: editedRoom }) => {
      setRoom((currentRoom) => {
        if (currentRoom === editedRoom) {
          setMessages((prev) =>
            prev.map((m) => (m._id === messageId ? { ...m, text, isEdited: true } : m))
          );
        }
        return currentRoom;
      });
      refreshConversations();
    });

    socket.on('dm_message_deleted', ({ messageId, room: deletedRoom }) => {
      setRoom((currentRoom) => {
        if (currentRoom === deletedRoom) {
          setMessages((prev) =>
            prev.map((m) => (m._id === messageId ? { ...m, isDeletedForEveryone: true } : m))
          );
        }
        return currentRoom;
      });
      refreshConversations();
    });

    socket.on('dm_message_deleted_for_me', ({ messageId, room: deletedRoom }) => {
      setRoom((currentRoom) => {
        if (currentRoom === deletedRoom) {
          setMessages((prev) => prev.filter((m) => m._id !== messageId));
        }
        return currentRoom;
      });
      refreshConversations();
    });

    socket.on('chat_error', (message) => setChatError(message || 'Something went wrong.'));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('online_users');
      socket.off('user_online');
      socket.off('user_offline');
      socket.off('dm_room_history');
      socket.off('dm_message_received');
      socket.off('dm_message_edited');
      socket.off('dm_message_deleted');
      socket.off('dm_message_deleted_for_me');
      socket.off('chat_error');
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, refreshConversations]);

  /* load the active conversation whenever the URL's :userId changes */
  useEffect(() => {
    if (!activeUserId) {
      setActiveUser(null);
      setRoom(null);
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoadingConversation(true);
    setChatError('');

    getDirectHistory(activeUserId)
      .then((response) => {
        if (cancelled) return;
        setActiveUser(response.data.otherUser);
        setRoom(response.data.room);
        setMessages(response.data.messages || []);
      })
      .catch(() => {
        if (!cancelled) setChatError('Could not load this conversation.');
      })
      .finally(() => {
        if (!cancelled) setLoadingConversation(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeUserId]);

  /* join the socket room for the active conversation once both the room id
     and the connection are ready, regardless of which resolves first */
  useEffect(() => {
    if (!connected || !room || !socketRef.current) return;
    socketRef.current.emit('join_dm_room', room);
  }, [connected, room]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredSearchResults = useMemo(() => {
    if (!search.trim()) return [];
    const term = search.trim().toLowerCase();
    return allUsers.filter((candidate) => candidate.username.toLowerCase().includes(term));
  }, [search, allUsers]);

  const handleSend = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !room || !socketRef.current || !connected) return;

    socketRef.current.emit('send_dm_message', { roomId: room, text });
    setDraft('');
    setShowEmoji(false);
  };

  const handlePickEmoji = (emoji) => setDraft((prev) => prev + emoji);

  const handleToggleMenu = useCallback((messageId) => {
    setOpenMenuId((prev) => (prev === messageId ? null : messageId));
  }, []);

  const handleStartEdit = (message) => {
    setEditingMessageId(message._id);
    setEditDraft(message.text);
    setOpenMenuId(null);
  };

  const handleSaveEdit = () => {
    const text = editDraft.trim();
    if (!text) return;
    socketRef.current?.emit('edit_dm_message', { messageId: editingMessageId, text });
    setEditingMessageId(null);
    setEditDraft('');
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditDraft('');
  };

  const handleDeleteForMe = (messageId) => {
    socketRef.current?.emit('delete_dm_for_me', { messageId });
    setOpenMenuId(null);
  };

  const handleDeleteForEveryone = (messageId) => {
    socketRef.current?.emit('delete_dm_for_everyone', { messageId });
    setOpenMenuId(null);
  };

  const isOtherOnline = activeUser ? onlineUserIds.has(String(activeUser._id)) : false;

  return (
    <main className="content dm-page">
      <aside className="dm-sidebar">
        <div className="dm-sidebar-header">Direct Messages</div>

        <input
          type="text"
          className="dm-search"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="dm-conversation-list">
          {search.trim() ? (
            filteredSearchResults.length === 0 ? (
              <p className="dm-empty-hint">No users found.</p>
            ) : (
              filteredSearchResults.map((candidate) => (
                <button
                  type="button"
                  key={candidate._id}
                  className={`dm-conversation-row ${activeUserId === candidate._id ? 'active' : ''}`}
                  onClick={() => navigate(`/chat/${candidate._id}`)}
                >
                  <div className="dm-conversation-avatar">
                    {candidate.avatarUrl ? (
                      <img src={resolveAssetUrl(candidate.avatarUrl)} alt="" />
                    ) : (
                      getInitials(candidate.username)
                    )}
                    {onlineUserIds.has(String(candidate._id)) && <span className="dm-online-dot" />}
                  </div>
                  <div className="dm-conversation-info">
                    <span className="dm-conversation-name">{candidate.username}</span>
                    <span className="dm-conversation-preview">Rating {candidate.rating}</span>
                  </div>
                </button>
              ))
            )
          ) : conversations.length === 0 ? (
            <p className="dm-empty-hint">
              No conversations yet — search for a user above to start one.
            </p>
          ) : (
            conversations.map((entry) => (
              <button
                type="button"
                key={entry.room}
                className={`dm-conversation-row ${activeUserId === entry.otherUser._id ? 'active' : ''}`}
                onClick={() => navigate(`/chat/${entry.otherUser._id}`)}
              >
                <div className="dm-conversation-avatar">
                  {entry.otherUser.avatarUrl ? (
                    <img src={resolveAssetUrl(entry.otherUser.avatarUrl)} alt="" />
                  ) : (
                    getInitials(entry.otherUser.username)
                  )}
                  {onlineUserIds.has(String(entry.otherUser._id)) && <span className="dm-online-dot" />}
                </div>
                <div className="dm-conversation-info">
                  <span className="dm-conversation-name">{entry.otherUser.username}</span>
                  <span className="dm-conversation-preview">
                    {entry.lastMessage.wasMine ? 'You: ' : ''}
                    {entry.lastMessage.text}
                  </span>
                </div>
                <span className="dm-conversation-time">{formatClock(entry.lastMessage.createdAt)}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="dm-main">
        {!activeUserId && (
          <div className="dm-empty-state">Select a conversation to start chatting.</div>
        )}

        {activeUserId && loadingConversation && (
          <div className="dm-empty-state">Loading conversation...</div>
        )}

        {activeUserId && !loadingConversation && activeUser && (
          <>
            <div className="dm-thread-header">
              <div className="dm-conversation-avatar">
                {activeUser.avatarUrl ? (
                  <img src={resolveAssetUrl(activeUser.avatarUrl)} alt="" />
                ) : (
                  getInitials(activeUser.username)
                )}
                {isOtherOnline && <span className="dm-online-dot" />}
              </div>
              <div>
                <div className="dm-thread-username">{activeUser.username}</div>
                <div className="dm-thread-status">{isOtherOnline ? 'Online' : 'Offline'}</div>
              </div>
            </div>

            <div className="dm-messages">
              {messages.length === 0 && (
                <p className="dm-empty-hint">No messages yet — say hello!</p>
              )}

              {messages.map((message) => (
                <MessageBubble
                  key={message._id}
                  message={message}
                  isMine={String(message.sender) === String(user?._id)}
                  isMenuOpen={openMenuId === message._id}
                  isEditing={editingMessageId === message._id}
                  editDraft={editDraft}
                  onToggleMenu={handleToggleMenu}
                  onStartEdit={handleStartEdit}
                  onChangeEditDraft={setEditDraft}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onDeleteForMe={handleDeleteForMe}
                  onDeleteForEveryone={handleDeleteForEveryone}
                />
              ))}

              <div ref={messagesEndRef} />
            </div>

            {chatError && <div className="dm-error">{chatError}</div>}

            <form className="dm-input-row" onSubmit={handleSend}>
              <div className="dm-emoji-wrap">
                <button
                  type="button"
                  className="dm-emoji-btn"
                  onClick={() => setShowEmoji((prev) => !prev)}
                  aria-label="Emoji"
                >
                  🙂
                </button>

                {showEmoji && (
                  <div className="dm-emoji-palette">
                    {EMOJI_PALETTE.map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => handlePickEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input
                type="text"
                value={draft}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder={connected ? 'Type a message...' : 'Connecting...'}
                disabled={!connected}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="cf-btn primary" disabled={!connected || !draft.trim()}>
                Send
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

export default DirectMessagesPage;