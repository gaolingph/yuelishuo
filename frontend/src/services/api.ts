import axios, { AxiosError } from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== Auth ====================

export interface RegisterData {
  username: string;
  password: string;
  nickname?: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: number;
    username: string;
    nickname: string;
    phone?: string;
    role: string;
    group_id?: number | null;
    campus_id?: number | null;
  };
}

export const authApi = {
  register: (data: RegisterData) => api.post<AuthResponse>('/auth/register', data),
  login: (data: LoginData) => api.post<AuthResponse>('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// ==================== Word Packs ====================

export interface WordPack {
  id: number;
  name: string;
  level: string;
  pack_type: string;
  description: string;
  word_count: number;
  sort_order: number;
  is_free: boolean;
  is_unlocked: boolean;
  progress?: {
    total: number;
    learned: number;
    mastered: number;
    percent: number;
  };
}

export interface PackProgress {
  pack_id: number;
  total_words: number;
  learned_words: number;
  mastered_words: number;
  progress_percent: number;
  is_unlocked: boolean;
}

export const packsApi = {
  list: () => api.get<WordPack[]>('/packs/'),
  words: (packId: number) => api.get(`/packs/${packId}/words`),
  learningStatus: (packId: number) => api.get(`/packs/${packId}/learning-status`),
};

// ==================== Learning ====================

export interface TodayTask {
  checked_in: boolean;
  to_review: any[];
  new_words: any[];
  stats: {
    new_available: number;
    review_count: number;
    total_learned: number;
    total_mastered: number;
  };
}

export const learningApi = {
  today: (packId?: number) =>
    api.get<TodayTask>('/learning/today', { params: { pack_id: packId } }),
  study: (wordId: number) => api.post('/learning/study', { word_id: wordId }),
  review: (wordId: number, quality: number) =>
    api.post('/learning/review', { word_id: wordId, quality }),
  reviewList: (packId?: number) =>
    api.get('/learning/review-list', { params: { pack_id: packId } }),
  mastered: (packId?: number) =>
    api.get('/learning/mastered', { params: { pack_id: packId } }),
  wordStatus: (wordId: number) =>
    api.get(`/learning/word-status/${wordId}`),
  // Batch read-aloud learning (智牛复刻)
  batchNew: (packId: number, batchSize = 5) =>
    api.get<{ batch_size: number; pack_id: number; words: any[] }>('/learning/batch-new', { params: { pack_id: packId, batch_size: batchSize } }),
  batchStudy: (wordIds: number[]) =>
    api.post<{ message: string; studied_count: number; word_ids: number[] }>('/learning/batch-study', { word_ids: wordIds }),
};

// ==================== Practice ====================

export interface ChoiceQuestion {
  id: number;
  word_id: number;
  english: string;
  phonetic?: string;
  options: string[];
  correct_index: number;
}

export interface SpellingQuestion {
  id: number;
  word_id: number;
  chinese: string;
  hint: string;
  phonetic?: string;
  word_length: number;
}

export interface ListeningQuestion {
  id: number;
  word_id: number;
  english: string;
  phonetic?: string;
  options: string[];
  correct_index: number;
}

export interface ChineseToEnglishQuestion {
  id: number;
  word_id: number;
  chinese: string;
  phonetic?: string;
  options: string[];
  correct_index: number;
}

export interface SpeakingQuestion {
  id: number;
  word_id: number;
  english: string;
  chinese: string;
  phonetic: string;
}

export const practiceApi = {
  choice: (packId?: number, count = 10) =>
    api.get<ChoiceQuestion[]>('/practice/choice', { params: { pack_id: packId, count } }),
  spelling: (packId?: number, count = 10) =>
    api.get<SpellingQuestion[]>('/practice/spelling', { params: { pack_id: packId, count } }),
  listening: (packId?: number, count = 10) =>
    api.get<ListeningQuestion[]>('/practice/listening', { params: { pack_id: packId, count } }),
  chineseToEnglish: (packId?: number, count = 10) =>
    api.get<ChineseToEnglishQuestion[]>('/practice/chinese_to_english', { params: { pack_id: packId, count } }),
  speaking: (packId?: number, count = 10) =>
    api.get<SpeakingQuestion[]>('/practice/speaking', { params: { pack_id: packId, count } }),
  submit: (data: { word_id: number; is_correct?: boolean; user_answer?: string; practice_type: string }) =>
    api.post<{ message: string; word_id: number; is_correct: boolean; correct_answer: string }>('/practice/submit', data),
};

// ==================== Stats ====================

export interface StatsOverview {
  total_learned: number;
  total_mastered: number;
  to_review: number;
  today_learned: number;
  today_review: number;
  streak_days: number;
  total_days: number;
  pack_count: number;
  accuracy: number;
}

export interface CalendarDay {
  date: string;
  checked_in: boolean;
  count: number;
}

export interface CalendarResponse {
  year: number;
  month: number;
  days: CalendarDay[];
  total: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition_type: string;
  condition_value: number;
  earned: boolean;
  earned_at?: string;
}

/** Raw API response shape for achievements */
export interface AchievementResponse {
  key: string;
  name: string;
  description: string;
  is_earned: boolean;
  earned_at: string | null;
}

export interface LearningCurve {
  date: string;
  learned: number;
  reviewed: number;
}

export interface CapabilityData {
  key: string;
  name: string;
  score: number;
  total_attempts: number;
  correct_attempts: number;
}

export interface CapabilitiesResponse {
  dimensions: CapabilityData[];
}

export const statsApi = {
  overview: () => api.get<StatsOverview>('/stats/overview'),
  calendar: (year: number, month: number) =>
    api.get<CalendarResponse>('/stats/calendar', { params: { year, month } }),
  wrongBook: (packId?: number) =>
    api.get('/stats/wrong-book', { params: { pack_id: packId } }),
  removeWrong: (wordId: number) =>
    api.delete(`/stats/wrong-book/${wordId}`),
  achievements: () => api.get<AchievementResponse[]>('/stats/achievements'),
  learningCurve: (days = 30) =>
    api.get<LearningCurve[]>('/stats/learning-curve', { params: { days } }),
  checkin: () => api.post('/stats/checkin'),
  checkAchievements: () => api.post('/stats/check-achievements'),
  capabilities: () => api.get<CapabilitiesResponse>('/stats/capabilities'),
};

// ==================== PK ====================

export interface PKStart {
  pk_id: number;
  words: any[];
  time_limit: number;
}

export const pkApi = {
  start: (packId?: number) =>
    api.get<PKStart>('/pk/start', { params: { pack_id: packId } }),
  finish: (data: { pk_id: number; score: number; total: number; correct: number }) =>
    api.post('/pk/finish', data),
  history: () => api.get('/pk/history'),
  leaderboard: () => api.get('/pk/leaderboard'),
};

// ==================== Admin ====================

export interface AdminUserCreate {
  username: string;
  password: string;
  nickname?: string;
  phone?: string;
  role: string;
  group_id?: number | null;
  campus_id?: number | null;
}

export interface AdminUserUpdate {
  nickname?: string;
  phone?: string;
  password?: string;
  role?: string;
  group_id?: number | null;
  campus_id?: number | null;
}

export interface AdminUserResponse {
  id: number;
  username: string;
  nickname: string;
  phone?: string;
  role: string;
  group_id?: number | null;
  campus_id?: number | null;
  created_at: string;
}

export interface GroupData {
  id: number;
  name: string;
  contact_info: string;
  created_at: string;
  campus_count?: number;
}

export interface CampusData {
  id: number;
  group_id: number;
  name: string;
  address: string;
  contact_info: string;
  created_at: string;
  student_count?: number;
}

export interface ParentStudentLink {
  id: number;
  parent_id: number;
  student_id: number;
  relationship: string;
  parent_name?: string;
  student_name?: string;
  created_at: string;
}

export interface AdminStatsOverview {
  total_students: number;
  total_parents: number;
  total_learned: number;
  total_mastered: number;
  active_today: number;
}

export interface StudentStatsRow {
  user_id: number;
  username: string;
  nickname: string;
  campus_name?: string;
  total_learned: number;
  total_mastered: number;
  to_review: number;
  streak_days: number;
  accuracy: number;
}

export interface CampusStatsRow {
  campus_id: number;
  campus_name: string;
  group_name: string;
  student_count: number;
  total_learned: number;
  total_mastered: number;
  total_reviews: number;
}

// ==================== Admin Stories ====================
export interface StoryWord {
  word: string;
  chinese: string;
  phonetic: string;
}

export interface StoryAdminItem {
  id: number;
  level: string;
  title: string;
  text: string;
  vocabulary: StoryWord[];
  question: { question: string; options: string[]; correct_index: number } | null;
  sort_order: number;
  created_at: string;
}

export interface StoryAdminCreate {
  level: string;
  title: string;
  text: string;
  vocabulary?: StoryWord[];
  question?: { question: string; options: string[]; correct_index: number } | null;
  sort_order?: number;
}

export interface StoryAdminUpdate {
  level?: string;
  title?: string;
  text?: string;
  vocabulary?: StoryWord[];
  question?: { question: string; options: string[]; correct_index: number } | null;
  sort_order?: number;
}

// ==================== Game Stats ====================
export interface GameStatsData {
  pet_level: number;
  pet_name: string;
  pet_food: number;
  pet_exp: number;
  stories_completed: number;
  total_stars: number;
  battles_fought: number;
  total_learned: number;
  streak_days: number;
  today_learned: number;
}

export const adminApi = {
  // Users
  createUser: (data: AdminUserCreate) => api.post<AdminUserResponse>('/admin/users', data),
  listUsers: (params?: { role?: string; campus_id?: number }) =>
    api.get<AdminUserResponse[]>('/admin/users', { params }),
  updateUser: (id: number, data: AdminUserUpdate) =>
    api.put<AdminUserResponse>(`/admin/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),

  // Groups
  createGroup: (data: { name: string; contact_info?: string }) =>
    api.post<GroupData>('/admin/groups', data),
  listGroups: () => api.get<GroupData[]>('/admin/groups'),
  updateGroup: (id: number, data: { name?: string; contact_info?: string }) =>
    api.put<GroupData>(`/admin/groups/${id}`, data),

  // Campuses
  createCampus: (data: { group_id: number; name: string; address?: string; contact_info?: string }) =>
    api.post<CampusData>('/admin/campuses', data),
  listCampuses: () => api.get<CampusData[]>('/admin/campuses'),
  updateCampus: (id: number, data: { name?: string; address?: string; contact_info?: string }) =>
    api.put<CampusData>(`/admin/campuses/${id}`, data),

  // Parent-student links
  createParentStudent: (data: { parent_id: number; student_id: number; relationship?: string }) =>
    api.post<ParentStudentLink>('/admin/parent-student', data),
  listParentStudent: () => api.get<ParentStudentLink[]>('/admin/parent-student'),
  deleteParentStudent: (id: number) => api.delete(`/admin/parent-student/${id}`),

  // Stats
  statsOverview: () => api.get<AdminStatsOverview>('/admin/stats/overview'),
  statsStudents: () => api.get<StudentStatsRow[]>('/admin/stats/students'),
  statsCampuses: () => api.get<CampusStatsRow[]>('/admin/stats/campuses'),

  // Stories
  listStories: (level?: string) =>
    api.get<StoryAdminItem[]>('/admin/stories', { params: { level } }),
  getStory: (id: number) =>
    api.get<StoryAdminItem>(`/admin/stories/${id}`),
  createStory: (data: StoryAdminCreate) =>
    api.post<StoryAdminItem>('/admin/stories', data),
  updateStory: (id: number, data: StoryAdminUpdate) =>
    api.put<StoryAdminItem>(`/admin/stories/${id}`, data),
  deleteStory: (id: number) =>
    api.delete(`/admin/stories/${id}`),
};

// ==================== Parent ====================

export interface ChildInfo {
  user_id: number;
  username: string;
  nickname: string;
  relationship: string;
  total_learned: number;
  total_mastered: number;
  to_review: number;
  today_learned: number;
  streak_days: number;
}

export interface ChildStats {
  user_id: number;
  username: string;
  nickname: string;
  total_learned: number;
  total_mastered: number;
  to_review: number;
  today_learned: number;
  today_review: number;
  streak_days: number;
  total_days: number;
  accuracy: number;
}

export interface CalendarDayInfo {
  date: string;
  checked_in: boolean;
  count: number;
}

export interface WrongBookItem {
  id: number;
  word: { id: number; english: string; chinese: string; phonetic?: string };
  wrong_count: number;
  practice_type: string;
  last_wrong_at: string;
}

export interface ChildAchievement {
  key: string;
  name: string;
  description: string;
  earned_at?: string;
  is_earned: boolean;
}

export const parentApi = {
  children: () => api.get<ChildInfo[]>('/parent/children'),
  childStats: (studentId: number) =>
    api.get<ChildStats>(`/parent/children/${studentId}/stats`),
  childCalendar: (studentId: number, params?: { year?: number; month?: number }) =>
    api.get<{ year: number; month: number; days: CalendarDayInfo[]; total: number }>(
      `/parent/children/${studentId}/calendar`, { params }
    ),
  childCurve: (studentId: number, params?: { days?: number }) =>
    api.get<{ date: string; learned: number; reviewed: number }[]>(
      `/parent/children/${studentId}/curve`, { params }
    ),
  childWrongBook: (studentId: number, params?: { pack_id?: number }) =>
    api.get<WrongBookItem[]>(`/parent/children/${studentId}/wrong-book`, { params }),
  childAchievements: (studentId: number) =>
    api.get<ChildAchievement[]>(`/parent/children/${studentId}/achievements`),
  childCapabilities: (studentId: number) =>
    api.get<CapabilitiesResponse>(`/parent/children/${studentId}/capabilities`),
};

// ==================== Game (Gamification Features) ====================

export interface PetData {
  id: number;
  user_id: number;
  name: string;
  level: number;
  exp: number;
  food: number;
  last_fed: string | null;
  exp_to_next: number;
}

export interface FeedPetData {
  pet: PetData;
  message: string;
  leveled_up: boolean;
}

export interface EarnFoodData {
  food_earned: number;
  total_food: number;
  message: string;
}

export interface StoryWord {
  word: string;
  chinese: string;
  phonetic: string;
}

export interface StoryQuestion {
  question: string;
  options: string[];
  correct_index: number;
}

export interface StoryData {
  id: number;
  level: string;
  title: string;
  text: string;
  vocabulary: StoryWord[];
  question: StoryQuestion | null;
  completed: boolean;
  stars_earned: number;
}

export interface StoryListItem {
  id: number;
  level: string;
  title: string;
  completed: boolean;
  stars_earned: number;
}

export interface CompleteStoryData {
  story_id: number;
  correct: boolean;
  stars_earned: number;
  words_added: number;
  message: string;
}

export interface BattleWord {
  word_id: number;
  english: string;
  options: string[];
  correct_index: number;
}

export interface BattleResultSubmit {
  score: number;
  total_questions: number;
  correct_answers: number;
  max_combo: number;
}

export interface BattleResultData {
  stars_earned: number;
  food_earned: number;
  message: string;
}

export interface DailyReportData {
  date: string;
  nickname: string;
  total_learned: number;
  today_learned: number;
  today_reviewed: number;
  mastered: number;
  to_review: number;
  streak_days: number;
  accuracy: number;
  practice_count: number;
  report_text: string;
  reading_passages_completed: number;
  reading_average_score: number;
  reading_words_covered: number;
}

export const gameApi = {
  // Pet
  getPet: () => api.get<PetData>('/game/pet'),
  feedPet: () => api.post<FeedPetData>('/game/pet/feed'),
  earnFood: () => api.post<EarnFoodData>('/game/pet/earn-food'),

  // Stories
  listStories: (level?: string) =>
    api.get<StoryListItem[]>('/game/stories', { params: { level } }),
  getStory: (storyId: number) =>
    api.get<StoryData>(`/game/stories/${storyId}`),
  completeStory: (storyId: number, data: { correct: boolean; answer_index: number }) =>
    api.post<CompleteStoryData>(`/game/stories/${storyId}/complete`, data),

  // Battle
  getBattleWords: (count = 10) =>
    api.get<BattleWord[]>('/game/battle/words', { params: { count } }),
  submitBattleResult: (data: BattleResultSubmit) =>
    api.post<BattleResultData>('/game/battle/result', data),

  // Daily Report
  getDailyReport: (studentId: number) =>
    api.get<DailyReportData>(`/game/parent/daily-report/${studentId}`),

  // Game Stats
  getGameStats: () => api.get<GameStatsData>('/game/stats'),
};

// ==================== Reading Passages ====================

export interface ReadingPassageProgress {
  is_completed: boolean;
  score: number;
  questions_correct: number;
  questions_total: number;
}

export interface ReadingPassageListItem {
  id: number;
  pack_id: number;
  level: string;
  title: string;
  word_count: number;
  progress: ReadingPassageProgress | null;
}

export interface ReadingProgressResponse {
  total_passages: number;
  completed_passages: number;
  average_score: number;
  total_words_covered: number;
  passages: ReadingPassageListItem[];
}

export interface ReadingVocabWord {
  word: string;
  chinese: string;
  phonetic: string;
}

export interface ReadingQuestion {
  question: string;
  options: string[];
  correct_index: number;
}

export interface ReadingPassageData {
  id: number;
  pack_id: number;
  level: string;
  title: string;
  text: string;
  vocabulary: ReadingVocabWord[];
  questions: ReadingQuestion[];
  word_count: number;
  sort_order: number;
  created_at: string;
}

export interface ReadingCompleteResponse {
  passage_id: number;
  is_completed: boolean;
  correct_count: number;
  total_questions: number;
  score: number;
  message: string;
}

export interface LearnedVocabItem {
  word: string;
  chinese: string;
  phonetic: string;
  is_learned: boolean;
}

export const readingApi = {
  listPassages: (packId?: number) =>
    api.get<ReadingProgressResponse>('/reading/passages', { params: { pack_id: packId } }),
  getPassage: (passageId: number) =>
    api.get<ReadingPassageData>(`/reading/passages/${passageId}`),
  getPassageLearnedVocab: (passageId: number) =>
    api.get<{ vocabulary: LearnedVocabItem[] }>(`/reading/passages/${passageId}/learned-vocabulary`),
  completePassage: (passageId: number, answers: number[]) =>
    api.post<ReadingCompleteResponse>('/reading/complete', { passage_id: passageId, answers }),
  getReadingProgress: () =>
	    api.get<{ total_passages: number; completed_passages: number; average_score: number; total_words_covered: number }>('/reading/progress'),
};

// ==================== Garden ====================

export interface GardenPlant {
  word_id: number;
  english: string;
  chinese: string;
  phonetic: string;
  pack_id: number;
  pack_name: string;
  stage: number;       // 0=seed, 1=sprout, 2=growing, 3=flowering, 4=bloomed
  plant_type: string;  // flower/plant emoji
  x: number;
  y: number;
  interval: number;
  repetitions: number;
  is_mastered: boolean;
  last_reviewed: string | null;
  created_at: string | null;
}

export interface GardenSummary {
  total_plants: number;
  seed_count: number;
  sprout_count: number;
  growing_count: number;
  flowering_count: number;
  bloomed_count: number;
  mastery_rate: number;
}

export interface GardenPackInfo {
  pack_id: number;
  pack_name: string;
  count: number;
}

export interface GardenData {
  summary: GardenSummary;
  plants: GardenPlant[];
  packs: GardenPackInfo[];
}

export const gardenApi = {
  getGarden: (params?: { pack_id?: number; stage?: number }) =>
    api.get<GardenData>('/garden', { params }),
};

// ==================== Vocab Test ====================

export interface VocabTestQuestion {
  word_id: number;
  english: string;
  phonetic: string;
  options: string[];
  level: string;
  level_name: string;
}

export interface VocabTestStart {
  test_id: string;
  total: number;
  questions: VocabTestQuestion[];
}

export interface VocabTestAnswer {
  word_id: number;
  selected: string;
}

export interface VocabTestDetail {
  word_id: number;
  english: string;
  level: string;
  level_name: string;
  is_correct: boolean;
  correct_answer: string;
  user_answer: string;
}

export interface VocabTestReport {
  score: number;
  total: number;
  percentage: number;
  level_key: string;
  level_label: string;
  estimated_vocab: number;
  recommendation: string;
  level_breakdown: Record<string, { correct: number; total: number }>;
  details: VocabTestDetail[];
}

export interface VocabTestHistoryItem {
  id: number;
  score: number;
  total: number;
  percentage: number;
  level: string;
  level_label: string;
  estimated_vocab: number;
  taken_at: string;
}

// ==================== Memory Scan (智牛复刻: 单词三区分类) ====================

export interface MemoryScanWordItem {
  word_id: number;
  english: string;
  chinese: string;
  phonetic: string;
  zone: 'green' | 'yellow' | 'red';
}

export interface MemoryScanResult {
  id: number;
  pack_id: number;
  pack_name: string;
  total_words: number;
  green_count: number;
  yellow_count: number;
  red_count: number;
  green_words: MemoryScanWordItem[];
  yellow_words: MemoryScanWordItem[];
  red_words: MemoryScanWordItem[];
  scan_date: string | null;
}

export const memoryScanApi = {
  scan: (packId: number) =>
    api.get<MemoryScanResult>(`/vocab-test/memory-scan/${packId}`),
};

export const vocabTestApi = {
  start: () => api.get<VocabTestStart>('/vocab-test/start'),
  submit: (data: { test_id: string; answers: VocabTestAnswer[] }) =>
    api.post<VocabTestReport>('/vocab-test/submit', data),
  history: (limit = 10) =>
    api.get<VocabTestHistoryItem[]>('/vocab-test/history', { params: { limit } }),
};

// ==================== Teacher (教师端) ====================

export interface TeacherStudentItem {
  user_id: number;
  username: string;
  nickname: string;
  campus_id: number | null;
  created_at: string | null;
  total_learned: number;
  mastered: number;
  to_review: number;
  today_learned: number;
  today_review: number;
  wrong_count: number;
  streak_days: number;
  week_new_words: number;
  memory_scan: {
    total_words: number;
    green_count: number;
    yellow_count: number;
    red_count: number;
  } | null;
}

export interface TeacherClassOverview {
  total_students: number;
  total_learned: number;
  total_mastered: number;
  avg_accuracy: number;
  active_today: number;
  struggling_count: number;
  class_rank: number | null;
}

export interface TeacherActiveStudent {
  user_id: number;
  nickname: string;
  today_count: number;
}

export interface TeacherInactiveStudent {
  user_id: number;
  nickname: string;
  last_active: string | null;
}

export interface TeacherClassToday {
  active_count: number;
  inactive_count: number;
  total_students: number;
  active_students: TeacherActiveStudent[];
  inactive_students: TeacherInactiveStudent[];
}

export interface TeacherAlert {
  user_id: number;
  nickname: string;
  alerts: {
    type: string;
    detail: string;
    value: number;
  }[];
  priority: string;
}

export interface TeacherWeeklyCurve {
  date: string;
  count: number;
}

export interface TeacherCapabilityInfo {
  score: number;
  total_attempts: number;
  correct_attempts: number;
}

export interface TeacherStudentDetail extends TeacherStudentItem {
  weekly_curve: TeacherWeeklyCurve[];
  capabilities: Record<string, TeacherCapabilityInfo>;
}

export const teacherApi = {
  listStudents: () => api.get<TeacherStudentItem[]>('/teacher/students'),
  getStudentDetail: (studentId: number) =>
    api.get<TeacherStudentDetail>(`/teacher/students/${studentId}`),
  getClassOverview: () => api.get<TeacherClassOverview>('/teacher/class-overview'),
  getClassToday: () => api.get<TeacherClassToday>('/teacher/class-today'),
  getAlerts: (minWrongs = 10) =>
    api.get<TeacherAlert[]>('/teacher/students/alerts', { params: { min_wrongs: minWrongs } }),
};

export default api;
