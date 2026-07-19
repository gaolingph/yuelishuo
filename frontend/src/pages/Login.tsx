import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LeshuobangLogo: React.FC = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Book base */}
    <path d="M16 20C16 17.7909 17.7909 16 20 16H52C54.2091 16 56 17.7909 56 20V56C56 58.2091 54.2091 60 52 60H20C17.7909 60 16 58.2091 16 56V20Z" fill="#DCF1D5" stroke="#1FA576" strokeWidth="2"/>
    {/* Book spine */}
    <path d="M36 16V60" stroke="#1FA576" strokeWidth="2" strokeLinecap="round"/>
    {/* Left page lines */}
    <line x1="22" y1="26" x2="32" y2="26" stroke="#1FA576" strokeWidth="2" strokeLinecap="round"/>
    <line x1="22" y1="34" x2="32" y2="34" stroke="#1FA576" strokeWidth="2" strokeLinecap="round"/>
    <line x1="22" y1="42" x2="32" y2="42" stroke="#1FA576" strokeWidth="2" strokeLinecap="round"/>
    {/* Right page lines */}
    <line x1="40" y1="26" x2="50" y2="26" stroke="#1FA576" strokeWidth="2" strokeLinecap="round"/>
    <line x1="40" y1="34" x2="50" y2="34" stroke="#1FA576" strokeWidth="2" strokeLinecap="round"/>
    {/* Star on top */}
    <path d="M36 8L38.5 14.5H45.5L40 18.5L42 25L36 21L30 25L32 18.5L26.5 14.5H33.5L36 8Z" fill="#FC9530" stroke="#FC9530" strokeWidth="1" strokeLinejoin="round"/>
    {/* Speech bubble accent */}
    <circle cx="52" cy="50" r="6" fill="#46D1B2" opacity="0.3"/>
    <text x="50" y="53" fontSize="8" fill="white" fontWeight="bold" textAnchor="middle">♪</text>
  </svg>
);

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('请填写用户名和密码');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.role === 'student') {
          navigate('/kid-home');
        } else {
          navigate('/');
        }
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-b from-[#DCF1D5] via-[#EEF8EA] to-white">
      {/* Decorative background blobs */}
      <div className="absolute top-[-80px] right-[-60px] w-72 h-72 rounded-full bg-[#46D1B2]/20 blur-3xl" />
      <div className="absolute bottom-[-100px] left-[-80px] w-96 h-96 rounded-full bg-[#1FA576]/10 blur-3xl" />
      <div className="absolute top-[30%] left-[5%] w-32 h-32 rounded-full bg-[#FC9530]/10 blur-2xl" />
      <div className="absolute bottom-[20%] right-[10%] w-48 h-48 rounded-full bg-[#DCF1D5] blur-3xl" />

      <div className="relative z-10 w-full max-w-md px-6 py-8">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-white/80 backdrop-blur rounded-2xl shadow-lg shadow-[#1FA576]/10">
              <LeshuobangLogo />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-[#1D4431] tracking-tight">
            乐说邦英语
          </h1>
          <p className="text-[#1FA576] font-medium mt-1 text-sm">
            快乐学英语，自信说英语
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl shadow-[#1FA576]/10 p-7 border border-[#DCF1D5]/50">
          <h2 className="text-xl font-bold text-[#1D4431] mb-1">欢迎回来</h2>
          <p className="text-gray-500 text-sm mb-6">登录你的学习账号，继续学习之旅</p>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-5 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">用户名</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">👤</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1FA576] focus:border-[#1FA576] outline-none transition-all duration-200 bg-gray-50/50"
                  placeholder="请输入用户名"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔒</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1FA576] focus:border-[#1FA576] outline-none transition-all duration-200 bg-gray-50/50"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#1FA576] hover:bg-[#16845e] text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#1FA576]/25 hover:shadow-xl hover:shadow-[#1FA576]/30 active:scale-[0.98] text-base"
            >
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              还没有账号？
              <Link to="/register" className="text-[#1FA576] hover:text-[#16845e] font-semibold hover:underline ml-1">
                立即注册
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

export default Login;
