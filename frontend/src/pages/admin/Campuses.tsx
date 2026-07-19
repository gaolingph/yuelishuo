import React, { useEffect, useState } from 'react';
import { adminApi, CampusData, GroupData } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface FormData {
  name: string;
  group_id: number;
  address: string;
  contact_info: string;
}

const emptyForm: FormData = { name: '', group_id: 0, address: '', contact_info: '' };

const Campuses: React.FC = () => {
  const { user } = useAuth();
  const [campuses, setCampuses] = useState<CampusData[]>([]);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCampus, setEditingCampus] = useState<CampusData | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isCampusAdmin = user?.role === 'campus_admin';

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [campusRes, groupsRes] = await Promise.all([
        adminApi.listCampuses(),
        adminApi.listGroups(),
      ]);
      setCampuses(campusRes.data);
      setGroups(groupsRes.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingCampus(null);
    setFormData({
      ...emptyForm,
      group_id: isCampusAdmin && user?.group_id ? user.group_id : 0,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (campus: CampusData) => {
    setEditingCampus(campus);
    setFormData({
      name: campus.name,
      group_id: campus.group_id,
      address: campus.address || '',
      contact_info: campus.contact_info || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCampus(null);
    setFormData(emptyForm);
    setFormError(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'group_id' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('请输入校区名称');
      return;
    }
    if (!formData.group_id) {
      setFormError('请选择所属集团');
      return;
    }

    try {
      setSaving(true);
      if (editingCampus) {
        await adminApi.updateCampus(editingCampus.id, {
          name: formData.name,
          address: formData.address,
          contact_info: formData.contact_info,
        });
      } else {
        await adminApi.createCampus({
          group_id: formData.group_id,
          name: formData.name,
          address: formData.address,
          contact_info: formData.contact_info,
        });
      }
      closeModal();
      fetchData();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || err?.message || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  // Filter groups for campus_admin
  const availableGroups = isCampusAdmin
    ? groups.filter((g) => g.id === user?.group_id)
    : groups;

  // Build a lookup map for group names
  const groupMap = new Map<number, string>();
  groups.forEach((g) => groupMap.set(g.id, g.name));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">校区管理</h1>
          <p className="mt-1 text-gray-500">管理所有校区信息</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          + 添加校区
        </button>
      </div>

      {/* Campuses Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  校区名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  所属集团
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  地址
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  联系方式
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  学生人数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  创建时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campuses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    暂无校区数据
                  </td>
                </tr>
              ) : (
                campuses.map((campus) => (
                  <tr key={campus.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {campus.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {groupMap.get(campus.group_id) || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {campus.address || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {campus.contact_info || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {campus.student_count ?? '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {campus.created_at
                        ? new Date(campus.created_at).toLocaleDateString('zh-CN')
                        : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => openEditModal(campus)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={closeModal}
            />

            {/* Modal Panel */}
            <div className="relative inline-block bg-white rounded-xl shadow-2xl text-left overflow-hidden transform transition-all sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingCampus ? '编辑校区' : '添加校区'}
                  </h3>
                </div>

                {/* Body */}
                <div className="px-6 py-4 space-y-4">
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {formError}
                    </div>
                  )}

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      校区名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="请输入校区名称"
                    />
                  </div>

                  {/* Group (only show dropdown for non-campus_admin, or if availableGroups has entries) */}
                  {!isCampusAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属集团 <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="group_id"
                        value={formData.group_id}
                        onChange={handleChange}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      >
                        <option value={0}>请选择集团</option>
                        {availableGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* For campus_admin, show the group as read-only text */}
                  {isCampusAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属集团
                      </label>
                      <input
                        type="text"
                        value={groupMap.get(user?.group_id ?? 0) || '—'}
                        disabled
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
                      />
                    </div>
                  )}

                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      地址
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="请输入地址"
                    />
                  </div>

                  {/* Contact Info */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      联系方式
                    </label>
                    <input
                      type="text"
                      name="contact_info"
                      value={formData.contact_info}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="请输入联系方式"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? '保存中...' : editingCampus ? '保存修改' : '添加'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Campuses;
