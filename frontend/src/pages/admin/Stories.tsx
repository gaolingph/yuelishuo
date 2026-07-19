import React, { useEffect, useState } from 'react';
import { adminApi, StoryAdminItem, StoryAdminCreate, StoryAdminUpdate } from '../../services/api';

interface StoryForm {
  level: string;
  title: string;
  text: string;
  vocabulary: string; // JSON string for editing
  question: string; // JSON string
  sort_order: number;
}

const emptyForm: StoryForm = {
  level: 'L1',
  title: '',
  text: '',
  vocabulary: '[]',
  question: 'null',
  sort_order: 0,
};

const AdminStories: React.FC = () => {
  const [stories, setStories] = useState<StoryAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<StoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const loadStories = async () => {
    try {
      setLoading(true);
      const res = await adminApi.listStories(levelFilter || undefined);
      setStories(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || '加载故事列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStories();
  }, [levelFilter]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (story: StoryAdminItem) => {
    setForm({
      level: story.level,
      title: story.title,
      text: story.text,
      vocabulary: JSON.stringify(story.vocabulary, null, 2),
      question: JSON.stringify(story.question, null, 2),
      sort_order: story.sort_order,
    });
    setEditingId(story.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    // Validate
    if (!form.title.trim()) { setError('请输入故事标题'); return; }
    if (!form.text.trim()) { setError('请输入故事内容'); return; }

    let vocabulary: any[];
    let question: any;
    try {
      vocabulary = JSON.parse(form.vocabulary);
      if (!Array.isArray(vocabulary)) throw new Error();
    } catch {
      setError('生词格式无效，必须为 JSON 数组');
      return;
    }
    try {
      question = JSON.parse(form.question);
    } catch {
      setError('题目格式无效，必须为 JSON');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const data: StoryAdminCreate = {
        level: form.level,
        title: form.title.trim(),
        text: form.text.trim(),
        vocabulary,
        question,
        sort_order: form.sort_order,
      };

      if (editingId) {
        const updateData: StoryAdminUpdate = { ...data };
        await adminApi.updateStory(editingId, updateData);
        setSuccess('故事更新成功！');
      } else {
        await adminApi.createStory(data);
        setSuccess('故事创建成功！');
      }
      resetForm();
      loadStories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteStory(id);
      setSuccess('故事已删除');
      setDeleteConfirm(null);
      loadStories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || '删除失败');
    }
  };

  const levelBadge = (level: string) => {
    const colors: Record<string, string> = {
      L1: 'bg-green-100 text-green-700',
      L2: 'bg-yellow-100 text-yellow-700',
      L3: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${colors[level] || 'bg-gray-100 text-gray-700'}`}>
        {level}
      </span>
    );
  };

  return (
    <div className="page-container max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📖 故事管理</h1>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="btn-primary text-sm !py-2"
          >
            ✚ 新建故事
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
          <button onClick={() => setError('')} className="float-right font-bold">✕</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
          {success}
        </div>
      )}

      {/* Level filter */}
      <div className="flex gap-2 mb-4">
        {['', 'L1', 'L2', 'L3'].map((l) => (
          <button
            key={l}
            onClick={() => setLevelFilter(l)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              levelFilter === l
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {l || '全部'}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="font-bold text-gray-700 mb-4">
            {editingId ? '✏️ 编辑故事' : '✚ 新建故事'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">级别</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="L1">L1 - 初级</option>
                <option value="L2">L2 - 中级</option>
                <option value="L3">L3 - 高级</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">排序</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">标题</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="故事标题"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">正文</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm h-32"
              placeholder="故事正文（支持英文）"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                生词列表 <span className="text-gray-400">(JSON)</span>
              </label>
              <textarea
                value={form.vocabulary}
                onChange={(e) => setForm({ ...form, vocabulary: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-xs font-mono h-24"
                placeholder='[{"word": "cat", "chinese": "猫", "phonetic": "/kæt/"}]'
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                阅读理解题 <span className="text-gray-400">(JSON)</span>
              </label>
              <textarea
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-xs font-mono h-24"
                placeholder='{"question": "...", "options": [...], "correct_index": 0}'
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm !py-2">
              {saving ? '保存中...' : (editingId ? '更新故事' : '创建故事')}
            </button>
            <button onClick={resetForm} className="btn-secondary text-sm !py-2">
              取消
            </button>
          </div>
        </div>
      )}

      {/* Story list */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin text-3xl">📖</div>
          <p className="text-gray-500 mt-2 text-sm">加载中...</p>
        </div>
      ) : stories.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <span className="text-4xl">📚</span>
          <p className="mt-2">暂无故事，点击上方按钮创建</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stories.map((story) => (
            <div key={story.id} className="card !p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {levelBadge(story.level)}
                  <h3 className="font-bold text-gray-800 truncate">{story.title}</h3>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{story.text.slice(0, 120)}...</p>
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  <span>📝 {story.vocabulary?.length || 0} 个生词</span>
                  <span>🔢 排序 {story.sort_order}</span>
                  <span>🕐 {new Date(story.created_at).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleEdit(story)}
                  className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                >
                  编辑
                </button>
                {deleteConfirm === story.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleDelete(story.id)}
                      className="px-3 py-1 text-xs font-medium text-white bg-red-500 rounded-lg"
                    >
                      确认
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(story.id)}
                    className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminStories;
