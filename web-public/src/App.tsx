import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useI18n } from './i18n';
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
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return null;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isAgentPage = location.pathname === '/agent';

  return (
    <>
      <a href="#main-content" className="skip-link">
        {t('a11y.skipToContent', 'Skip to main content')}
      </a>
      <OfflineBanner />
      <div className="wrap">
        <Nav />
      </div>
      <main id="main-content">{children}</main>
      <div className="wrap">
        <Footer />
      </div>
      {/* The homepage and /agent page own their own agent entry points. */}
      {!isHome && !isAgentPage && <ChatbotWidget />}
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
