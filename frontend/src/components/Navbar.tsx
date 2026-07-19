import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar: React.FC = () => {
  const { user, isAuthenticated, isAdmin, isCoach, isParent, isStudent, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Student nav links
  const studentLinks = [
    { path: '/kid-home', label: '乐园', icon: '🎮' },
    { path: '/story', label: '故事', icon: '📖' },
    { path: '/reading', label: '阅读', icon: '📝' },
    { path: '/battle', label: '大乱斗', icon: '⚔️' },
    { path: '/packs', label: '词库', icon: '📚' },
    { path: '/learn', label: '学习', icon: '📖' },
    { path: '/review', label: '复习', icon: '🔄' },
    { path: '/restaurant', label: '餐厅', icon: '🍽️' },
    { path: '/game-stats', label: '成就', icon: '📊' },
    { path: '/pk', label: 'PK', icon: '⚔️' },
  ];

  // Admin nav links
  const adminLinks = [
    { path: '/admin', label: '管理首页', icon: '📊' },
    { path: '/teacher', label: '课堂管理', icon: '👨‍🏫' },
    { path: '/admin/users', label: '用户管理', icon: '👥' },
    { path: '/admin/groups', label: '集团管理', icon: '🏢' },
    { path: '/admin/campuses', label: '校区管理', icon: '🏫' },
    { path: '/admin/stories', label: '故事管理', icon: '📖' },
  ];

  // Parent nav links
  const parentLinks = [
    { path: '/parent', label: '我的孩子', icon: '👶' },
    { path: '/parent/report', label: '成长日报', icon: '📋' },
  ];

  // Choose links based on role
  let navLinks = studentLinks;
  if (isAdmin || isCoach) {
    navLinks = adminLinks;
  } else if (isParent) {
    navLinks = parentLinks;
  }

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabel = isAdmin ? '管理员' : isCoach ? '教练' : isParent ? '家长' : '';

  return (
    <nav className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-primary-600">
            <span className="text-2xl">📝</span>
            <span className="hidden sm:inline">英语单词速记</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {link.icon} {link.label}
              </Link>
            ))}
            {/* Switch to student view if admin/parent */}
            {isAuthenticated && !isStudent && (
              <Link
                to="/packs"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >
                🎒 学生端
              </Link>
            )}
          </div>

          {/* User section */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {roleLabel && (
                  <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-600">
                    {roleLabel}
                  </span>
                )}
                <Link to="/profile" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
                  <span className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xs font-bold">
                    {(user?.nickname || user?.username || '?')[0]}
                  </span>
                  <span className="hidden sm:inline">{user?.nickname || user?.username}</span>
                </Link>
                <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-500 transition-colors">
                  退出
                </button>
              </>
            ) : (
              <Link to="/login" className="btn-primary text-sm !py-1.5 !px-4">
                登录
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
