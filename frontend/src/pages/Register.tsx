import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('请填写用户名和密码');
      return;
    }
    if (username.trim().length < 3) {
      setError('用户名至少3个字符');
      return;
    }
    if (password.length < 6) {
      setError('密码至少6个字符');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }

    setLoading(true);
    try {
      await register(username.trim(), password, nickname.trim() || undefined);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || '注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-b from-[#DCF1D5] via-[#EEF8EA] to-white">
      {/* Decorative background blobs */}
      <div className="absolute top-[-60px] left-[-60px] w-80 h-80 rounded-full bg-[#46D1B2]/20 blur-3xl" />
      <div className="absolute bottom-[-80px] right-[-80px] w-96 h-96 rounded-full bg-[#1FA576]/10 blur-3xl" />
      <div className="absolute top-[40%] right-[8%] w-40 h-40 rounded-full bg-[#FC9530]/10 blur-2xl" />

      <div className="relative z-10 w-full max-w-md px-6 py-8">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 bg-[#1FA576]/10 rounded-2xl flex items-center justify-center text-3xl shadow-sm">
              📝
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-[#1D4431] tracking-tight">
            乐说邦英语
          </h1>
          <p className="text-[#1FA576] font-medium mt-1 text-sm">
            加入我们，开启快乐英语学习之旅
          </p>
        </div>

        {/* Register card */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl shadow-[#1FA576]/10 p-7 border border-[#DCF1D5]/50">
          <h2 className="text-xl font-bold text-[#1D4431] mb-1">创建账号</h2>
          <p className="text-gray-500 text-sm mb-6">填写信息，开始你的学习之旅</p>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-5 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">用户名 *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">👤</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1FA576] focus:border-[#1FA576] outline-none transition-all duration-200 bg-gray-50/50"
                  placeholder="至少3个字符"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">昵称（可选）</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🏷️</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1FA576] focus:border-[#1FA576] outline-none transition-all duration-200 bg-gray-50/50"
                  placeholder="你的显示名称"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">密码 *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔒</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1FA576] focus:border-[#1FA576] outline-none transition-all duration-200 bg-gray-50/50"
                  placeholder="至少6个字符"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">确认密码 *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">✓</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1FA576] focus:border-[#1FA576] outline-none transition-all duration-200 bg-gray-50/50"
                  placeholder="再次输入密码"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#1FA576] hover:bg-[#16845e] text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#1FA576]/25 hover:shadow-xl hover:shadow-[#1FA576]/30 active:scale-[0.98] text-base"
            >
              {loading ? '注册中...' : '注 册'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              已有账号？
              <Link to="/login" className="text-[#1FA576] hover:text-[#16845e] font-semibold hover:underline ml-1">
                立即登录
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          乐说邦英语 · 让每个孩子快乐学英语
        </p>
      </div>
    </div>
  );
};

export default Register;
