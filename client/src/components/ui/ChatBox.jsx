import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';

import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../api/http';

const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '') || undefined;
const MAX_MESSAGE_LENGTH = 500;

// This widget is Global Chat only — Direct Messages now live on their own
// full page (/chat/:userId), which needs a persistent connection and a lot
// more UI (presence, edit, search) than a floating widget can reasonably
// hold. See DirectMessagesPage.jsx for that.
function ChatBox() {
  const { token, user, isAuthenticated } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [connected, setConnected] = useState(false);
  const [chatError, setChatError] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !isAuthenticated || !token) return;

    setChatError('');

    const socket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_room');
    });

    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => {
      setConnected(false);
      setChatError('Could not connect to chat. Please try again later.');
    });

    socket.on('room_history', (payload) => {
      setMessages(payload?.messages || []);
    });

    socket.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('message_deleted', ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, isDeletedForEveryone: true } : m))
      );
    });

    socket.on('message_deleted_for_me', ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (event) => {
    event.preventDefault();

    const text = draft.trim();
    if (!text || !socketRef.current || !connected) return;

    socketRef.current.emit('send_message', { text });
    setDraft('');
  };

  const handleToggleMenu = (messageId) => {
    setOpenMenuId((prev) => (prev === messageId ? null : messageId));
  };

  const handleDeleteForMe = (messageId) => {
    socketRef.current?.emit('delete_for_me', { messageId });
    setOpenMenuId(null);
  };

  const handleDeleteForEveryone = (messageId) => {
    socketRef.current?.emit('delete_for_everyone', { messageId });
    setOpenMenuId(null);
  };

  return (
    <div className="chat-widget">
      {isOpen && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <span>▶ Global Chat</span>
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
              <Link to="/login">Login</Link> to join the global chat.
            </div>
          )}

          {isAuthenticated && (
            <>
              <div className="chat-messages">
                {messages.length === 0 && (
                  <p className="chat-empty-hint">
                    {connected ? 'No messages yet — say hello!' : 'Connecting...'}
                  </p>
                )}

                {messages.map((message) => {
                  const isMine = String(message.sender) === String(user?._id);
                  const isDeleted = message.isDeletedForEveryone;

                  return (
                    <div
                      key={message._id}
                      className={`chat-message ${isMine ? 'chat-message-mine' : 'chat-message-other'}`}
                    >
                      {!isMine && <span className="chat-message-sender">{message.senderName}</span>}

                      <div className="chat-message-body">
                        <span className={`chat-message-text ${isDeleted ? 'chat-message-deleted' : ''}`}>
                          {isDeleted ? '🚫 This message was deleted' : message.text}
                        </span>

                        <div className="chat-message-menu-wrap">
                          <button
                            type="button"
                            className="chat-message-menu-btn"
                            onClick={() => handleToggleMenu(message._id)}
                            aria-label="Message options"
                          >
                            ⋮
                          </button>

                          {openMenuId === message._id && (
                            <div className="chat-message-menu">
                              <button type="button" onClick={() => handleDeleteForMe(message._id)}>
                                Delete for me
                              </button>
                              {isMine && !isDeleted && (
                                <button type="button" onClick={() => handleDeleteForEveryone(message._id)}>
                                  Delete for everyone
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

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