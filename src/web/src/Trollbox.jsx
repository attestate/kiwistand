import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAccount } from "wagmi";
import { Wallet } from "@ethersproject/wallet";
import { getLocalAccount } from "./session.mjs";

// EIP-712 domain for trollbox auth (must match server)
const TROLLBOX_DOMAIN = {
  name: "kiwinews-trollbox",
  version: "1.0.0",
};

const TROLLBOX_TYPES = {
  Auth: [
    { name: "purpose", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
};

const POLL_INTERVAL = 3000;
const HEARTBEAT_INTERVAL = 15000;

// Deterministic color from address
function addressColor(address) {
  if (!address) return "#888";
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 40%)`;
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function signAuth(signer) {
  const timestamp = String(Date.now());
  const value = { purpose: "trollbox-auth", timestamp };
  const signature = await signer._signTypedData(
    TROLLBOX_DOMAIN,
    TROLLBOX_TYPES,
    value,
  );
  return { signature, timestamp };
}

export default function Trollbox() {
  const [messages, setMessages] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [inputText, setInputText] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const shouldAutoScroll = useRef(true);
  const lastTimestamp = useRef(0);
  const signerRef = useRef(null);

  const account = useAccount();
  const localAccount = getLocalAccount(account.address);

  let signer = null;
  if (localAccount && localAccount.privateKey) {
    signer = new Wallet(localAccount.privateKey);
    if (!authenticated) {
      setAuthenticated(true);
    }
  }
  signerRef.current = signer;

  const scrollToBottom = useCallback(() => {
    if (shouldAutoScroll.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Poll for messages
  useEffect(() => {
    let active = true;

    async function poll() {
      if (!active) return;
      try {
        const url = lastTimestamp.current
          ? `/api/v1/trollbox/messages?since=${lastTimestamp.current}`
          : `/api/v1/trollbox/messages`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();

        if (data.messages && data.messages.length > 0) {
          if (lastTimestamp.current === 0) {
            // Initial load
            setMessages(data.messages);
          } else {
            // Append new messages
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const newMsgs = data.messages.filter(
                (m) => !existingIds.has(m.id),
              );
              return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
            });
          }
          const newest = data.messages[data.messages.length - 1];
          if (newest && newest.timestamp > lastTimestamp.current) {
            lastTimestamp.current = newest.timestamp;
          }
        }

        if (typeof data.online === "number") {
          setOnlineCount(data.online);
        }
      } catch {
        // Retry on next interval
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Heartbeat to stay in online list
  useEffect(() => {
    if (!signer) return;
    let active = true;

    async function heartbeat() {
      if (!active || !signerRef.current) return;
      try {
        const auth = await signAuth(signerRef.current);
        await fetch("/api/v1/trollbox/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(auth),
        });
      } catch {
        // Ignore heartbeat errors
      }
    }

    heartbeat();
    const interval = setInterval(heartbeat, HEARTBEAT_INTERVAL);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [signer ? "has-signer" : "no-signer"]);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !signerRef.current || sending) return;

    setSending(true);
    try {
      const auth = await signAuth(signerRef.current);
      const res = await fetch("/api/v1/trollbox/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auth, text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            if (existingIds.has(data.message.id)) return prev;
            return [...prev, data.message];
          });
          if (data.message.timestamp > lastTimestamp.current) {
            lastTimestamp.current = data.message.timestamp;
          }
        }
        setInputText("");
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  }, [inputText, sending]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "var(--font-family, Inter, system-ui, sans-serif)",
        fontSize: "13px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          borderBottom: "1px solid var(--border-color, rgba(166,110,78,0.15))",
          fontWeight: 600,
          fontSize: "12px",
          color: "var(--text-secondary, #666)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        <span>trollbox</span>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 400,
            color: "#4a9",
          }}
        >
          {onlineCount} online
        </span>
      </div>

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: "#999",
              textAlign: "center",
              padding: "20px 10px",
              fontSize: "12px",
            }}
          >
            No messages yet. Say something!
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{ lineHeight: 1.4, wordBreak: "break-word" }}
          >
            <span
              style={{
                color: "#999",
                fontSize: "11px",
                marginRight: "4px",
              }}
            >
              {formatTime(msg.timestamp)}
            </span>
            <span
              style={{
                color: addressColor(msg.address),
                fontWeight: 600,
                marginRight: "4px",
                cursor: "default",
              }}
              title={msg.address}
            >
              {msg.displayName}:
            </span>
            <span style={{ color: "var(--text-primary, #333)" }}>
              {msg.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          padding: "8px",
          borderTop: "1px solid var(--border-color, rgba(166,110,78,0.15))",
        }}
      >
        {authenticated ? (
          <div style={{ display: "flex", gap: "4px" }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              maxLength={280}
              disabled={sending}
              style={{
                flex: 1,
                padding: "6px 8px",
                border: "1px solid var(--border-color, rgba(166,110,78,0.2))",
                borderRadius: "4px",
                fontSize: "13px",
                background: "var(--bg-white, #fff)",
                color: "var(--text-primary, #333)",
                outline: "none",
                opacity: sending ? 0.6 : 1,
              }}
            />
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              color: "#999",
              fontSize: "12px",
              padding: "4px",
            }}
          >
            Sign in to chat
          </div>
        )}
      </div>
    </div>
  );
}
