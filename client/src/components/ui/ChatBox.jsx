import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';

import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../api/http';

// Socket.io connects to the server's own origin, not the "/api" path — so
// this strips the trailing /api the same way resolveAssetUrl does for
// avatars. In dev this resolves to '', which falls through to `undefined`
// so socket.io-client defaults to the current page's origin (proxied to
// the backend by vite.config.js's "/socket.io" entry).
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '') || undefined;
const DEFAULT_ROOM = 'global';
const MAX_MESSAGE_LENGTH = 500;

function ChatBox() {
  const { token, user, isAuthenticated } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [connected, setConnected] = useState(false);
  const [chatError, setChatError] = useState('');

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
      socket.emit('join_room', DEFAULT_ROOM);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

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

    socket.on('chat_error', (message) => {
      setChatError(message || 'Something went wrong with the chat.');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('room_history');
      socket.off('receive_message');
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

    socketRef.current.emit('send_message', { room: DEFAULT_ROOM, text });
    setDraft('');
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

                  return (
                    <div
                      key={message._id}
                      className={`chat-message ${isMine ? 'chat-message-mine' : 'chat-message-other'}`}
                    >
                      {!isMine && <span className="chat-message-sender">{message.senderName}</span>}
                      <span className="chat-message-text">{message.text}</span>
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