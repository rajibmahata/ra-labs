import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';
import Layout from './pages/Layout';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Portfolio from './pages/Portfolio';
import Team from './pages/Team';
import MyProfile from './pages/MyProfile';
import Content from './pages/Content';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Customers from './pages/Customers';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Drafts from './pages/Drafts';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/admin/login" element={<Login />} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="customers" element={<Customers />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="drafts" element={<Drafts />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="team" element={<Team />} />
            <Route path="my-profile" element={<MyProfile />} />
            <Route path="content" element={<Content />} />
            <Route path="chat" element={<Chat />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
