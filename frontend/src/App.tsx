import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import MobileBottomNav from './components/MobileBottomNav';
import AIAssistant from './components/AIAssistant';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Packs from './pages/Packs';
import Learn from './pages/Learn';
import Review from './pages/Review';
import Practice from './pages/Practice';
import WrongBook from './pages/WrongBook';
import Leaderboard from './pages/Leaderboard';
import PK from './pages/PK';
import KidHome from './pages/KidHome';
import Story from './pages/Story';
import Battle from './pages/Battle';
import Profile from './pages/Profile';
import PetRestaurant from './pages/PetRestaurant';
import GameStats from './pages/GameStats';
import Reading from './pages/Reading';
import Garden from './pages/Garden';
import VocabTest from './pages/VocabTest';
import MemoryScan from './pages/MemoryScan';
import FiveStepFlow from './pages/FiveStepFlow';
import BatchLearn from './pages/BatchLearn';
import AutoReview from './pages/AutoReview';
import ProgressiveLearn from './pages/ProgressiveLearn';
import EmployeeLogin from './pages/EmployeeLogin';
import AIChat from './pages/ai/AIChat';
import { initSpeech } from './utils/speech';

// Preload speech voices early
initSpeech();

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminGroups from './pages/admin/Groups';
import AdminCampuses from './pages/admin/Campuses';
import AdminStories from './pages/admin/Stories';

// Teacher pages
import TeacherClassroom from './pages/teacher/Classroom';
import TeacherStudentDetail from './pages/teacher/StudentDetail';

// Parent pages
import ParentChildren from './pages/parent/Children';
import ParentChildReport from './pages/parent/ChildReport';
import ParentReport from './pages/ParentReport';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl">⏳</div>
          <p className="text-gray-500 mt-2">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAdmin, isCoach, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl">⏳</div>
          <p className="text-gray-500 mt-2">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin && !isCoach) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const ParentRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isParent, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl">⏳</div>
          <p className="text-gray-500 mt-2">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isParent) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl">⏳</div>
          <p className="text-gray-500 mt-2">加载中...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

	const AppContent: React.FC = () => {
	  const { isAuthenticated } = useAuth();
	
	  return (
	    <BrowserRouter>
	      <div className="min-h-screen bg-gray-50">
	        <Navbar />
	        <main className={`page-enter ${isAuthenticated ? 'pb-16 md:pb-8' : 'pb-8'}`}>
	          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
            <Route path="/packs" element={<ProtectedRoute><Packs /></ProtectedRoute>} />
            <Route path="/learn" element={<ProtectedRoute><Learn /></ProtectedRoute>} />
            <Route path="/review" element={<ProtectedRoute><Review /></ProtectedRoute>} />
            <Route path="/practice" element={<ProtectedRoute><Practice /></ProtectedRoute>} />
            <Route path="/wrong-book" element={<ProtectedRoute><WrongBook /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/pk" element={<ProtectedRoute><PK /></ProtectedRoute>} />
            <Route path="/kid-home" element={<ProtectedRoute><KidHome /></ProtectedRoute>} />
            <Route path="/restaurant" element={<ProtectedRoute><PetRestaurant /></ProtectedRoute>} />
            <Route path="/game-stats" element={<ProtectedRoute><GameStats /></ProtectedRoute>} />
            <Route path="/story" element={<ProtectedRoute><Story /></ProtectedRoute>} />
            <Route path="/reading" element={<ProtectedRoute><Reading /></ProtectedRoute>} />
            <Route path="/battle" element={<ProtectedRoute><Battle /></ProtectedRoute>} />
            <Route path="/garden" element={<ProtectedRoute><ErrorBoundary><Garden /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/vocab-test" element={<ProtectedRoute><VocabTest /></ProtectedRoute>} />
            <Route path="/memory-scan" element={<ProtectedRoute><MemoryScan /></ProtectedRoute>} />
            <Route path="/memory-scan/:packId" element={<ProtectedRoute><MemoryScan /></ProtectedRoute>} />
            <Route path="/five-step/:packId" element={<ProtectedRoute><FiveStepFlow /></ProtectedRoute>} />
            <Route path="/batch-learn" element={<ProtectedRoute><BatchLearn /></ProtectedRoute>} />
            <Route path="/auto-review" element={<ProtectedRoute><AutoReview /></ProtectedRoute>} />
            <Route path="/progressive-learn/:packId" element={<ProtectedRoute><ProgressiveLearn /></ProtectedRoute>} />
            <Route path="/ai-chat" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ErrorBoundary><Profile /></ErrorBoundary></ProtectedRoute>} />

            {/* ── 员工一键直达（无需手动登录） ── */}
            <Route path="/employee" element={<EmployeeLogin />} />

            {/* Admin routes */}
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
            <Route path="/admin/groups" element={<AdminRoute><AdminGroups /></AdminRoute>} />
            <Route path="/admin/campuses" element={<AdminRoute><AdminCampuses /></AdminRoute>} />
            <Route path="/admin/stories" element={<AdminRoute><AdminStories /></AdminRoute>} />

            {/* Teacher routes (coach+) */}
            <Route path="/teacher" element={<AdminRoute><TeacherClassroom /></AdminRoute>} />
            <Route path="/teacher/students/:studentId" element={<AdminRoute><TeacherStudentDetail /></AdminRoute>} />

            {/* Parent routes */}
            <Route path="/parent" element={<ParentRoute><ParentChildren /></ParentRoute>} />
            <Route path="/parent/children/:studentId" element={<ParentRoute><ParentChildReport /></ParentRoute>} />
            <Route path="/parent/report" element={<ParentRoute><ParentReport /></ParentRoute>} />

            <Route path="*" element={
              <div className="page-container text-center py-16">
                <span className="text-6xl mb-4 block">404</span>
                <h2 className="text-xl font-bold text-gray-700">页面未找到</h2>
                <p className="text-gray-500 mt-2">你访问的页面不存在</p>
              </div>
            } />
          </Routes>
        </main>
        <MobileBottomNav />
        {isAuthenticated && <AIAssistant />}
      </div>
    </BrowserRouter>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
