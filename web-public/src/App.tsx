import { Routes, Route, useLocation } from 'react-router-dom';
import Nav from './components/Nav';
import Footer from './components/Footer';
import ChatbotWidget from './components/ChatbotWidget';
import OfflineBanner from './components/OfflineBanner';
import Home from './pages/Home';
import AgentChat from './pages/AgentChat';
import Work from './pages/Work';
import WorkDetail from './pages/WorkDetail';
import Team from './pages/Team';
import TeamDetail from './pages/TeamDetail';
import Contact from './pages/Contact';

function ScrollToTop() {
  // Scroll restoration — React Router v6 doesn't do this by default with BrowserRouter
  return null;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const embedAgentOnHome = location.pathname === '/';

  return (
    <>
      <OfflineBanner />
      <div className="wrap">
        <Nav />
      </div>
      <main>{children}</main>
      <div className="wrap">
        <Footer />
      </div>
      {/* The homepage owns its own agent entry point (hero panel / bottom sheet). */}
      {!embedAgentOnHome && <ChatbotWidget />}
    </>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route
          path="/agent"
          element={
            <AppLayout>
              <AgentChat />
            </AppLayout>
          }
        />
        <Route
          path="/"
          element={
            <AppLayout>
              <Home />
            </AppLayout>
          }
        />
        <Route
          path="/work"
          element={
            <AppLayout>
              <Work />
            </AppLayout>
          }
        />
        <Route
          path="/work/:slug"
          element={
            <AppLayout>
              <WorkDetail />
            </AppLayout>
          }
        />
        <Route
          path="/team"
          element={
            <AppLayout>
              <Team />
            </AppLayout>
          }
        />
        <Route
          path="/team/:slug"
          element={
            <AppLayout>
              <TeamDetail />
            </AppLayout>
          }
        />
        <Route
          path="/contact"
          element={
            <AppLayout>
              <Contact />
            </AppLayout>
          }
        />
      </Routes>
    </>
  );
}
