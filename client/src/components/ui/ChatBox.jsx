import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';

import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../api/http';
import { getUserList } from '../../api/userApi';

// Socket.io connects to the server's own origin, not the "/api" path — so
// this strips the trailing /api the same way resolveAssetUrl does for
// avatars. In dev this resolves to '', which falls through to `undefined`
// so socket.io-client defaults to the current page's origin (proxied to
// the backend by vite.config.js's "/socket.io" entry).
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '') || undefined;
const MAX_MESSAGE_LENGTH = 500;

// Mirrors the server's directRoomFor() exactly — purely a local bookkeeping
// key for grouping messages by conversation client-side. Never used for
// authorization; the server always recomputes and validates the real room.
const getDirectRoomKey = (idA, idB) => [String(idA), String(idB)].sort().join('_');

function MessageBubble({ message, isMine, onDeleteForMe, onDeleteForEveryone, isMenuOpen, onToggleMenu }) {
  const isDeleted = message.isDeletedForEveryone;

  return (
    <div className={`chat-message ${isMine ? 'chat-message-mine' : 'chat-message-other'}`}>
      {!isMine && <span className="chat-message-sender">{message.senderName}</span>}

      <div className="chat-message-body">
        <span className={`chat-message-text ${isDeleted ? 'chat-message-deleted' : ''}`}>
          {isDeleted ? '🚫 This message was deleted' : message.text}
        </span>

        <div className="chat-message-menu-wrap">
          <button
            type="button"
            className="chat-message-menu-btn"
            onClick={() => onToggleMenu(message._id)}
            aria-label="Message options"
          >
            ⋮
          </button>

          {isMenuOpen && (
            <div className="chat-message-menu">
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

function ChatBox() {
  const { token, user, isAuthenticated } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('global');
  const [directTarget, setDirectTarget] = useState(null);
  const [userList, setUserList] = useState([]);
  const [userListLoading, setUserListLoading] = useState(false);
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [draft, setDraft] = useState('');
  const [connected, setConnected] = useState(false);
  const [chatError, setChatError] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const activeRoomKey =
    activeTab === 'global'
      ? 'global'
      : directTarget
      ? getDirectRoomKey(user?._id, directTarget._id)
      : null;

  const activeMessages = useMemo(
    () => (activeRoomKey ? messagesByRoom[activeRoomKey] || [] : []),
    [messagesByRoom, activeRoomKey]
  );

  /* connect / disconnect the socket while the widget is open */
  useEffect(() => {
    if (!isOpen || !isAuthenticated || !token) return;

    setChatError('');

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

    socket.on('room_history', ({ room, messages }) => {
      setMessagesByRoom((prev) => ({ ...prev, [room]: messages || [] }));
    });

    socket.on('receive_message', (message) => {
      setMessagesByRoom((prev) => ({
        ...prev,
        [message.room]: [...(prev[message.room] || []), message]
      }));
    });

    socket.on('message_deleted', ({ messageId, room }) => {
      setMessagesByRoom((prev) => ({
        ...prev,
        [room]: (prev[room] || []).map((m) =>
          m._id === messageId ? { ...m, isDeletedForEveryone: true } : m
        )
      }));
    });

    socket.on('message_deleted_for_me', ({ messageId, room }) => {
      setMessagesByRoom((prev) => ({
        ...prev,
        [room]: (prev[room] || []).filter((m) => m._id !== messageId)
      }));
    });

    socket.on('chat_error', (message) => {
      setChatError(message || 'Something went wrong with the chat.');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('room_history');
      socket.off('receive_message');
      socket.off('message_deleted');
      socket.off('message_deleted_for_me');
      socket.off('chat_error');
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [isOpen, isAuthenticated, token]);

  /* join whichever room the current tab/target points to */
  useEffect(() => {
    if (!connected || !socketRef.current) return;

    if (activeTab === 'global') {
      socketRef.current.emit('join_room', { chatType: 'global' });
    } else if (activeTab === 'direct' && directTarget) {
      socketRef.current.emit('join_room', {
        chatType: 'direct',
        otherUserId: directTarget._id
      });
    }
  }, [connected, activeTab, directTarget]);

  /* fetch the user list the first time the Direct tab is opened */
  useEffect(() => {
    if (activeTab !== 'direct' || userList.length > 0 || userListLoading) return;

    let cancelled = false;
    setUserListLoading(true);

    getUserList()
      .then((response) => {
        if (!cancelled) setUserList(response.data.users || []);
      })
      .catch(() => {
        if (!cancelled) setChatError('Could not load the user list.');
      })
      .finally(() => {
        if (!cancelled) setUserListLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, userList.length, userListLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  const handleSend = (event) => {
    event.preventDefault();

    const text = draft.trim();
    if (!text || !socketRef.current || !connected) return;
    if (activeTab === 'direct' && !directTarget) return;

    socketRef.current.emit('send_message', {
      chatType: activeTab,
      otherUserId: directTarget?._id,
      text
    });

    setDraft('');
  };

  const handleToggleMenu = useCallback((messageId) => {
    setOpenMenuId((prev) => (prev === messageId ? null : messageId));
  }, []);

  const handleDeleteForMe = (messageId) => {
    socketRef.current?.emit('delete_for_me', { messageId });
    setOpenMenuId(null);
  };

  const handleDeleteForEveryone = (messageId) => {
    socketRef.current?.emit('delete_for_everyone', { messageId });
    setOpenMenuId(null);
  };

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    setOpenMenuId(null);
  };

  const handleSelectUser = (targetUser) => {
    setDirectTarget(targetUser);
    setOpenMenuId(null);
  };

  return (
    <div className="chat-widget">
      {isOpen && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <span>▶ Chat</span>
            <button
              type="button"
              className="chat-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {!isAuthenticated && (
            <div className="chat-guest-notice">
              <Link to="/login">Login</Link> to use chat.
            </div>
          )}

          {isAuthenticated && (
            <>
              <div className="chat-tabs">
                <button
                  type="button"
                  className={activeTab === 'global' ? 'active' : ''}
                  onClick={() => handleSelectTab('global')}
                >
                  Global Chat
                </button>
                <button
                  type="button"
                  className={activeTab === 'direct' ? 'active' : ''}
                  onClick={() => handleSelectTab('direct')}
                >
                  Direct Messages
                </button>
              </div>

              {activeTab === 'direct' && (
                <div className="chat-dm-bar">
                  {directTarget ? (
                    <>
                      <button
                        type="button"
                        className="chat-dm-back"
                        onClick={() => setDirectTarget(null)}
                      >
                        ← All users
                      </button>
                      <span className="chat-dm-target">{directTarget.username}</span>
                    </>
                  ) : (
                    <span className="chat-dm-hint">Pick someone to message:</span>
                  )}
                </div>
              )}

              {activeTab === 'direct' && !directTarget && (
                <div className="chat-user-list">
                  {userListLoading && <p className="chat-empty-hint">Loading users...</p>}

                  {!userListLoading && userList.length === 0 && (
                    <p className="chat-empty-hint">No other users yet.</p>
                  )}

                  {userList.map((candidate) => (
                    <button
                      type="button"
                      key={candidate._id}
                      className="chat-user-row"
                      onClick={() => handleSelectUser(candidate)}
                    >
                      {candidate.username}
                      <span className="chat-user-rating">{candidate.rating}</span>
                    </button>
                  ))}
                </div>
              )}

              {(activeTab === 'global' || (activeTab === 'direct' && directTarget)) && (
                <>
                  <div className="chat-messages">
                    {activeMessages.length === 0 && (
                      <p className="chat-empty-hint">
                        {connected ? 'No messages yet — say hello!' : 'Connecting...'}
                      </p>
                    )}

                    {activeMessages.map((message) => (
                      <MessageBubble
                        key={message._id}
                        message={message}
                        isMine={String(message.sender) === String(user?._id)}
                        isMenuOpen={openMenuId === message._id}
                        onToggleMenu={handleToggleMenu}
                        onDeleteForMe={handleDeleteForMe}
                        onDeleteForEveryone={handleDeleteForEveryone}
                      />
                    ))}

                    <div ref={messagesEndRef} />
                  </div>

                  {chatError && <div className="chat-error">{chatError}</div>}

                  <form className="chat-input-row" onSubmit={handleSend}>
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
            </>
          )}
        </div>
      )}

      <button
        type="button"
        className="chat-toggle-btn"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? '✕' : '💬'}
      </button>
    </div>
  );
}

export default ChatBox;