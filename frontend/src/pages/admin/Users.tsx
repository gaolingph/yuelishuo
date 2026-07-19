import React, { useEffect, useState } from 'react';
import { adminApi, AdminUserResponse, AdminUserCreate, AdminUserUpdate, CampusData } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type RoleTab = 'student' | 'parent' | 'campus_admin' | 'group_admin' | 'coach';
type ModalMode = 'create' | 'edit' | null;

const ALL_ROLE_TABS: { key: RoleTab; label: string }[] = [
  { key: 'student', label: '学生' },
  { key: 'parent', label: '家长' },
  { key: 'coach', label: '教练' },
  { key: 'campus_admin', label: '校区管理员' },
  { key: 'group_admin', label: '集团管理员' },
];

const ROLE_LABELS: Record<string, string> = {
  student: '学生',
  parent: '家长',
  coach: '教练',
  campus_admin: '校区管理员',
  group_admin: '集团管理员',
};

const EMPTY_CREATE_FORM: AdminUserCreate = {
  username: '',
  password: '',
  nickname: '',
  phone: '',
  role: 'student',
};

const Users: React.FC = () => {
  const { user } = useAuth();

  // ----- state -----
  const [activeTab, setActiveTab] = useState<RoleTab>('student');
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [campuses, setCampuses] = useState<CampusData[]>([]);
  const [loading, setLoading] = useState(false);

  // modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editTarget, setEditTarget] = useState<AdminUserResponse | null>(null);
  const [saving, setSaving] = useState(false);

  // form
  const [form, setForm] = useState<AdminUserCreate>({ ...EMPTY_CREATE_FORM });
  const [editForm, setEditForm] = useState<{
    nickname: string;
    phone: string;
    role: string;
    group_id: number | null;
    campus_id: number | null;
    password: string;
  }>({
    nickname: '',
    phone: '',
    role: '',
    group_id: null,
    campus_id: null,
    password: '',
  });

  // delete
  const [deleteTarget, setDeleteTarget] = useState<AdminUserResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Compute visible tabs based on current user's role
  const roleTabs = ALL_ROLE_TABS.filter((tab) => {
    if (user?.role === 'group_admin') return true; // group admin sees all
    if (user?.role === 'campus_admin') return tab.key !== 'group_admin' && tab.key !== 'campus_admin';
    if (user?.role === 'coach') return tab.key === 'student'; // coach only sees students
    return false;
  });

  // ----- fetch users -----
  const fetchUsers = async (role: RoleTab) => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers({ role });
      setUsers(res.data ?? []);
    } catch (err) {
      console.error('Failed to fetch users', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampuses = async () => {
    try {
      const res = await adminApi.listCampuses();
      setCampuses(res.data ?? []);
    } catch (err) {
      console.error('Failed to fetch campuses', err);
      setCampuses([]);
    }
  };

  useEffect(() => {
    fetchUsers(activeTab);
  }, [activeTab]);

  useEffect(() => {
    fetchCampuses();
  }, []);

  // ----- helpers -----
  const getCampusName = (campusId?: number | null): string => {
    if (!campusId) return '-';
    const c = campuses.find((c) => c.id === campusId);
    return c ? c.name : String(campusId);
  };

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // ----- create -----
  const handleCreate = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      // Only strip campus_id for student/parent roles — coach and admin need it
      if (payload.role === 'student' || payload.role === 'parent') {
        delete (payload as any).campus_id;
      }
      await adminApi.createUser(payload);
      setModalMode(null);
      setForm({ ...EMPTY_CREATE_FORM });
      fetchUsers(activeTab);
    } catch (err) {
      console.error('Failed to create user', err);
    } finally {
      setSaving(false);
    }
  };

  // ----- update -----
  const handleUpdate = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const payload: AdminUserUpdate = {
        nickname: editForm.nickname,
        phone: editForm.phone,
        role: editForm.role || undefined,
        group_id: editForm.group_id ?? null,
        campus_id: editForm.campus_id ?? null,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password;
      }
      await adminApi.updateUser(editTarget.id, payload);
      setModalMode(null);
      setEditTarget(null);
      fetchUsers(activeTab);
    } catch (err) {
      console.error('Failed to update user', err);
    } finally {
      setSaving(false);
    }
  };

  // ----- delete -----
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      fetchUsers(activeTab);
    } catch (err) {
      console.error('Failed to delete user', err);
    } finally {
      setDeleting(false);
    }
  };

  // ----- open edit modal -----
  const openEditModal = (u: AdminUserResponse) => {
    setEditTarget(u);
    setEditForm({
      nickname: u.nickname ?? '',
      phone: u.phone ?? '',
      role: u.role ?? '',
      group_id: u.group_id ?? null,
      campus_id: u.campus_id ?? null,
      password: '',
    });
    setModalMode('edit');
  };

  // ----- render -----
  return (
    <div className="p-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <button
          onClick={() => {
            setForm({ ...EMPTY_CREATE_FORM });
            setModalMode('create');
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 添加用户
        </button>
      </div>

      {/* ---- Tabs ---- */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {roleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- User Table ---- */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">用户名</th>
              <th className="px-4 py-3 text-left font-medium">昵称</th>
              <th className="px-4 py-3 text-left font-medium">手机号</th>
              <th className="px-4 py-3 text-left font-medium">角色</th>
              <th className="px-4 py-3 text-left font-medium">校区</th>
              <th className="px-4 py-3 text-left font-medium">创建时间</th>
              <th className="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  加载中...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  暂无数据
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openEditModal(u)}
                >
                  <td className="px-4 py-3">{u.username}</td>
                  <td className="px-4 py-3">{u.nickname ?? '-'}</td>
                  <td className="px-4 py-3">{u.phone ?? '-'}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[u.role] ?? u.role}</td>
                  <td className="px-4 py-3">{getCampusName(u.campus_id)}</td>
                  <td className="px-4 py-3">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(u);
                      }}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ======== Create Modal ======== */}
      {modalMode === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">添加用户</h2>

            <div className="space-y-4">
              {/* username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名 *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码 *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* nickname */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                <input
                  type="text"
                  value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色 *</label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as AdminUserCreate['role'] })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="student">学生</option>
                  <option value="parent">家长</option>
                  <option value="coach">教练</option>
                  <option value="campus_admin">校区管理员</option>
                  <option value="group_admin">集团管理员</option>
                </select>
              </div>

              {/* campus (only for campus_admin and coach) */}
              {(form.role === 'campus_admin' || form.role === 'coach') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">校区 *</label>
                  <select
                    value={(form as any).campus_id ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, campus_id: Number(e.target.value) || undefined } as any)
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">请选择校区</option>
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setModalMode(null);
                  setForm({ ...EMPTY_CREATE_FORM });
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.username || !form.password}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======== Edit Modal ======== */}
      {modalMode === 'edit' && editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              编辑用户
              <span className="text-gray-500 text-sm ml-2 font-normal">({editTarget.username})</span>
            </h2>

            {/* read-only info */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 space-y-1">
              <p>
                <span className="font-medium">用户名：</span>
                {editTarget.username}
              </p>
              <p>
                <span className="font-medium">当前角色：</span>
                {ROLE_LABELS[editTarget.role] ?? editTarget.role}
              </p>
              <p>
                <span className="font-medium">校区：</span>
                {getCampusName(editTarget.campus_id)}
              </p>
            </div>

            <div className="space-y-4">
              {/* nickname */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                <input
                  type="text"
                  value={editForm.nickname}
                  onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* role (only group_admin can change role) */}
              {user?.role === 'group_admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="student">学生</option>
                    <option value="parent">家长</option>
                    <option value="coach">教练</option>
                    <option value="campus_admin">校区管理员</option>
                    <option value="group_admin">集团管理员</option>
                  </select>
                </div>
              )}

              {/* campus (for campus_admin and coach) */}
              {(editForm.role === 'campus_admin' || editForm.role === 'coach') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">校区</label>
                  <select
                    value={editForm.campus_id ?? ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, campus_id: Number(e.target.value) || null })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">请选择校区</option>
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* password (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  新密码 <span className="text-gray-400 font-normal">(留空则不修改)</span>
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="不修改请留空"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setModalMode(null);
                  setEditTarget(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======== Delete Confirmation ======== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold mb-2">确认删除</h2>
            <p className="text-sm text-gray-600 mb-6">
              确定要删除用户 <strong>{deleteTarget.username}</strong> 吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
