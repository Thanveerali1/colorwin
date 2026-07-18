import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';
import GamePage from './pages/GamePage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import CookieConsent from './components/CookieConsent';
import { trackPageView } from './lib/analytics';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/auth" replace />;
}

// Must live inside <HashRouter> to access route location.
function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <HashRouter>
      <PageTracker />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route
          path="/wallet"
          element={
            <RequireAuth>
              <WalletPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/game"
          element={
            <RequireAuth>
              <GamePage />
            </RequireAuth>
          }
        />
      </Routes>
      <CookieConsent />
    </HashRouter>
  );
}

export default App;