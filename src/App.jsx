import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Layout from './components/layout/Layout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import OnboardingParent  from './pages/OnboardingParent';
import OnboardingTeacher     from './pages/OnboardingTeacher';
import OnboardingTeacherHead from './pages/OnboardingTeacherHead';
import OnboardingCounselor   from './pages/OnboardingCounselor';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Profile from './pages/Profile';
import Grades from './pages/Grades';
import Bulletin from './pages/Bulletin';
import Schedule from './pages/Schedule';
import Reports from './pages/Reports';
import Parent from './pages/Parent';
import TeacherProfile from './pages/TeacherProfile';

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Onboarding : protégé mais sans sidebar */}
          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding"         element={<Onboarding />} />
            <Route path="/onboarding-parent"  element={<OnboardingParent />} />
            <Route path="/onboarding-teacher"      element={<OnboardingTeacher />} />
            <Route path="/onboarding-teacher-head" element={<OnboardingTeacherHead />} />
            <Route path="/onboarding-counselor"    element={<OnboardingCounselor />} />
          </Route>

          {/* Routes privées: Si Non connecté -> redirige Login */}
          <Route element={<ProtectedRoute />}>
            {/* Le Layout s'applique avec la Sidebar & Header */}
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/students" element={<Students />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/grades" element={<Grades />} />
              <Route path="/bulletin" element={<Bulletin />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/parent" element={<Parent />} />
              <Route path="/teacher-profile" element={<TeacherProfile />} />
              
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
