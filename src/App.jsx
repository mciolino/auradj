import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { PlayerProvider } from '@/context/PlayerContext';
import { SpotifyProvider } from '@/context/SpotifyContext';
import { MixerProvider } from '@/context/MixerContext';
import AppLayout from '@/components/layout/AppLayout';

// Auth Pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// Pages
import Home from '@/pages/Home';
import Discover from '@/pages/Discover';
import DJSession from '@/pages/DJSession';
import MixDetail from '@/pages/MixDetail';
import Profile from '@/pages/Profile';
import ConnectedServices from '@/pages/ConnectedServices';
import Analytics from '@/pages/Analytics';
import MixStats from '@/pages/MixStats';
import DevProfile from '@/pages/DevProfile';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/session" element={<DJSession />} />
        <Route path="/session/:id" element={<DJSession />} />
        <Route path="/mix/:id" element={<MixDetail />} />
        <Route path="/profile/:userId" element={<Profile />} />
        <Route path="/services" element={<ConnectedServices />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/mix-stats" element={<MixStats />} />
        <Route path="/dev" element={<DevProfile />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <PlayerProvider>
          <SpotifyProvider>
            <MixerProvider>
              <Router>
                <AuthenticatedApp />
              </Router>
              <Toaster />
              <Sonner position="bottom-center" />
            </MixerProvider>
          </SpotifyProvider>
        </PlayerProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
