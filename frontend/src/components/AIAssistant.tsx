/**
 * Floating AI Assistant — a chat bubble widget that follows users across pages.
 *
 * - Collapsible floating button (bottom-right)
 * - Slides up an expandable chat panel
 * - Uses SSE streaming for real-time AI responses
 */

import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { aiApi } from '../services/aiApi';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '你好！我是你的AI学习助手，有什么可以帮助你的吗？😊' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await aiApi.quickChat({ message: text });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '抱歉，我暂时无法回复，请稍后再试。' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
        aria-label="AI 助手"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-36 right-4 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-3 flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <div className="flex-1">
              <p className="font-semibold text-sm">AI 学习助手</p>
              <p className="text-[11px] text-white/80">乐说邦英语 · DeepSeek 驱动</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto max-h-80 space-y-3 bg-gray-50/50">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary-500 text-white rounded-br-md'
                      : 'bg-white text-gray-700 shadow-sm border border-gray-100 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <span className="text-xs text-primary-500 font-medium block mb-0.5">🤖 AI</span>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-500 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100 text-sm">
                  <span className="inline-flex gap-1">
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-100 bg-white">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入英语学习问题..."
                className="flex-1 px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 transition-all"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="px-4 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-200 text-white rounded-xl transition-all disabled:cursor-not-allowed flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              </button>
            </div>
            {/* Quick suggestions */}
            <div className="flex gap-1.5 mt-2 overflow-x-auto">
              {['讲解单词', '学习建议', '语法问题'].map((hint) => (
                <button
                  key={hint}
                  onClick={() => {
                    setInput(hint);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className="text-[11px] px-2 py-1 rounded-full bg-gray-50 text-gray-500 hover:bg-primary-50 hover:text-primary-600 border border-gray-100 whitespace-nowrap transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
