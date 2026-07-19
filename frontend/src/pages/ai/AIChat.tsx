/**
 * AIChat — Full-page AI chat interface.
 *
 * Rich chat experience with SSE streaming, context-aware responses,
 * and student learning context integration.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { aiApi } from '../../services/aiApi';

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
};

const QUICK_TOPICS = [
  { icon: '📖', label: '今日学习计划', message: '帮我制定今天的学习计划' },
  { icon: '❌', label: '错题分析', message: '帮我分析最近的错题' },
  { icon: '🎯', label: '记忆技巧', message: '有什么好的单词记忆技巧？' },
  { icon: '📊', label: '学习报告', message: '我的学习情况怎么样？' },
  { icon: '🗣️', label: '口语练习', message: '我想练习英语口语' },
  { icon: '📝', label: '语法问题', message: '帮我讲解英语语法' },
];

const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '你好！我是你的AI学习助手，我可以帮你制定学习计划、分析错题、讲解单词和语法、做口语练习等。有什么需要帮助的吗？😊',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    if (!text) setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: Date.now() }]);
    setLoading(true);
    setStreamingContent('');

    // Build conversation history
    const history: Array<{ role: string; content: string }> = messages
      .filter(m => m.role !== 'system')
      .slice(-20) // last 20 messages for context
      .map(m => ({ role: m.role, content: m.content }));

    try {
      // Use SSE streaming via fetch with history
      const url = aiApi.getStreamUrl(msg, history);

      const response = await fetch(url);

      if (!response.ok) throw new Error('Stream request failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.content || parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                setStreamingContent(prev => prev + content);
              }
            } catch {
              // raw text
              if (data) {
                setStreamingContent(prev => prev + data);
              }
            }
          }
        }
      }

      // Add final message
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: streamingContent, timestamp: Date.now() },
      ]);
      setStreamingContent('');
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '抱歉，我暂时无法回复，请稍后再试。',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      // Ensure we capture any remaining streamed content
      if (streamingContent) {
        setMessages(prev => {
          // Avoid duplicate if already added
          if (prev[prev.length - 1]?.role === 'assistant' && prev[prev.length - 1]?.content === streamingContent) {
            return prev;
          }
          return [
            ...prev,
            { role: 'assistant', content: streamingContent, timestamp: Date.now() },
          ];
        });
        setStreamingContent('');
      }
      setLoading(false);
    }
  }, [input, loading, messages, streamingContent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickTopic = (topic: string) => {
    setInput(topic);
    setTimeout(() => handleSend(topic), 50);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-base">
            🤖
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-sm">AI 学习助手</h1>
            <p className="text-[11px] text-gray-400">乐说邦英语 · DeepSeek 驱动 · 随时为你解答</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Quick topics (show only at start) */}
          {messages.length === 1 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2">💡 快速开始</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {QUICK_TOPICS.map((topic) => (
                  <button
                    key={topic.label}
                    onClick={() => handleQuickTopic(topic.message)}
                    className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50/50 text-sm text-gray-600 hover:text-primary-700 transition-all"
                  >
                    <span>{topic.icon}</span>
                    <span className="text-xs">{topic.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] ${
                  msg.role === 'user'
                    ? 'bg-primary-500 text-white rounded-2xl rounded-br-md px-4 py-2.5'
                    : 'bg-white text-gray-700 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm border border-gray-100'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs">🤖</span>
                    <span className="text-[11px] font-medium text-primary-500">AI 学习助手</span>
                    <span className="text-[10px] text-gray-300">
                      {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {loading && streamingContent && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-700 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm border border-gray-100 max-w-[85%] sm:max-w-[75%]">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs">🤖</span>
                  <span className="text-[11px] font-medium text-primary-500">AI 学习助手</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{streamingContent}</p>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {loading && !streamingContent && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-500 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
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
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-100 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入英语学习问题，按 Enter 发送..."
              rows={1}
              className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 resize-none transition-all max-h-[120px]"
              disabled={loading}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-200 text-white rounded-xl transition-all disabled:cursor-not-allowed flex items-center justify-center h-[42px] min-w-[42px]"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-[10px] text-gray-300 mt-1.5 text-center">
            AI 回复仅供参考，学习内容请以教材为准
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
