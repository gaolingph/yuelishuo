/**
 * AI Agent API service — DeepSeek-powered intelligent features.
 */

import api from './api';

// ── Types ───────────────────────────────────────────────────────────

export interface AIChatRequest {
  message: string;
  conversation_history?: Array<{ role: string; content: string }>;
}

export interface AIChatResponse {
  reply: string;
}

export interface EnhanceReportRequest {
  score: number;
  total?: number;
  vocab_level: string;
  estimated_vocab: number;
}

export interface EnhanceReportResponse {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  grade: string;
  appeal: string;
  next_level: string;
}

export interface ParentReportRequest {
  child_id: number;
  date?: string;
}

export interface ParentReportResponse {
  child_name: string;
  date: string;
  stats: {
    today_learned: number;
    total_learned: number;
    mastered: number;
    to_review: number;
    streak_days: number;
    accuracy: number;
  };
  greeting: string;
  progress_summary: string;
  teacher_tip: string;
  encouragement: string;
  next_milestone: string;
}

export interface SmartReviewRequest {
  wrong_words?: string[];
  due_words?: string[];
}

export interface SmartReviewResponse {
  focus_area: string;
  count: number;
  reason: string;
  tip: string;
}

export interface CoachTipRequest {
  child_id: number;
}

export interface CoachTipResponse {
  tip: string;
  focus: string;
  action: string;
}

export interface MarketingRequest {
  user_request: string;
}

export interface MarketingResponse {
  title: string;
  body: string;
  cta: string;
  style: string;
  target: string;
}

export interface SpeakingEvalRequest {
  target_text: string;
  student_response: string;
}

export interface SpeakingEvalResponse {
  score: number;
  accuracy: string;
  feedback: string;
  encouragement: string;
  correct_pronunciation: string;
}

export interface DigitalBoardRequest {
  topic: string;
  role?: 'user' | 'creative' | 'skeptic' | 'connector' | 'all';
}

export interface DigitalBoardResponse {
  topic: string;
  discussion: Record<string, string>;
}

// ── API Service ─────────────────────────────────────────────────────

export const aiApi = {
  /** Full AI assistant chat */
  chat: (data: AIChatRequest) =>
    api.post<AIChatResponse>('/ai/chat', data),

  /** Quick chat (lightweight, for floating widget) */
  quickChat: (data: AIChatRequest) =>
    api.post<AIChatResponse>('/ai/quick-chat', data),

  /** Enhance vocab test report with AI analysis */
  enhanceReport: (data: EnhanceReportRequest) =>
    api.post<EnhanceReportResponse>('/ai/enhance-report', data),

  /** Generate parent daily report */
  parentReport: (data: ParentReportRequest) =>
    api.post<ParentReportResponse>('/ai/parent-report', data),

  /** Smart review recommendations */
  smartReview: (data: SmartReviewRequest) =>
    api.post<SmartReviewResponse>('/ai/smart-review', data),

  /** Coach teaching tip */
  coachTip: (data: CoachTipRequest) =>
    api.post<CoachTipResponse>('/ai/coach-tip', data),

  /** Marketing content generation */
  marketing: (data: MarketingRequest) =>
    api.post<MarketingResponse>('/ai/marketing', data),

  /** Speaking evaluation */
  speakingEval: (data: SpeakingEvalRequest) =>
    api.post<SpeakingEvalResponse>('/ai/speaking-eval', data),

  /** Digital Board discussion */
  digitalBoard: (data: DigitalBoardRequest) =>
    api.post<DigitalBoardResponse>('/ai/digital-board', data),

  /** Get AI streaming chat URL */
  getStreamUrl: (message: string, history?: Array<{ role: string; content: string }>) => {
    const token = localStorage.getItem('token');
    let url = `/api/ai/chat/stream?message=${encodeURIComponent(message)}&token=${token}`;
    if (history && history.length > 0) {
      url += `&history=${encodeURIComponent(JSON.stringify(history))}`;
    }
    return url;
  },
};

export default aiApi;
