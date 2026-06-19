import React, { useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { LoginForm } from './components/features/auth/LoginForm';
import { SessionTimeoutModal } from './components/features/auth/SessionTimeoutModal';
import { OnboardingForm } from './components/features/onboarding';
import { Messages } from './components/features/Messages';
import { useAuthStore } from './store/authStore';
import { useSessionTimeout, SESSION_TIMEOUT_ENABLED } from './hooks/useSessionTimeout';
import { supabase } from './lib/supabase';
import { setupGlobalErrorLogging } from './lib/logger';

// Lazy load main route components
const Dashboard = lazy(() => import('./components/features/dashboard/Dashboard').then(module => ({ default: module.Dashboard })));
const ReferralManagement = lazy(() => import('./components/features/referrals/ReferralManagement').then(module => ({ default: module.ReferralManagement })));
const ResearchInsight = lazy(() => import('./components/features/research-insight/ResearchInsight').then(module => ({ default: module.ResearchInsight })));
const MedSyncVideo = lazy(() => import('./components/features/video/MedSyncVideo').then(module => ({ default: module.MedSyncVideo })));

const AIAssistant = lazy(() => Promise.resolve({ default: () => (
  <div className="text-center py-12">
    <h2 className="text-2xl font-bold text-neutral-900 mb-4">AI Medical Assistant</h2>
    <p className="text-neutral-600">AI-powered medical insights coming soon...</p>
  </div>
)}));

const Analytics = lazy(() => Promise.resolve({ default: () => (
  <div className="text-center py-12">
    <h2 className="text-2xl font-bold text-neutral-900 mb-4">Analytics</h2>
    <p className="text-neutral-600">Medical analytics dashboard coming soon...</p>
  </div>
)}));

const Settings = lazy(() => Promise.resolve({ default: () => (
  <div className="text-center py-12">
    <h2 className="text-2xl font-bold text-neutral-900 mb-4">Settings</h2>
    <p className="text-neutral-600">User settings and preferences coming soon...</p>
  </div>
)}));

// Loading fallback component
const LoadingFallback = React.memo(() => (
  <div className="min-h-[400px] flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
      <p className="text-neutral-600">Loading...</p>
    </div>
  </div>
));
LoadingFallback.displayName = 'LoadingFallback';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      // After sleep/wake the browser can briefly report navigator.onLine === false,
      // which would otherwise pause queries indefinitely. 'always' keeps them firing.
      networkMode: 'always',
    },
    mutations: {
      retry: 1,
      networkMode: 'always',
    },
  },
});

// Idle session timeout: warns then signs the user out after inactivity.
function SessionTimeoutManager() {
  const { user, signOut } = useAuthStore();

  const handleTimeout = useCallback(async () => {
    await signOut();
    toast.error('You have been logged out due to inactivity');
  }, [signOut]);

  const { showWarning, secondsRemaining, stayLoggedIn } = useSessionTimeout({
    // Disabled by default; toggle via VITE_SESSION_TIMEOUT_ENABLED.
    enabled: SESSION_TIMEOUT_ENABLED && !!user,
    onTimeout: handleTimeout,
  });

  if (!SESSION_TIMEOUT_ENABLED || !user) return null;

  return (
    <SessionTimeoutModal
      isOpen={showWarning}
      secondsRemaining={secondsRemaining}
      onStayLoggedIn={stayLoggedIn}
      onLogout={handleTimeout}
    />
  );
}

// Recovers a stale auth/data session when the tab becomes visible again
// (e.g. after the laptop sleeps or the tab is backgrounded).
function AuthRecoveryManager() {
  const { user, signOut } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      // getSession() refreshes the token internally if expired/near expiry,
      // without forcing a rotation on every focus like refreshSession() would.
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        await signOut();
        toast.error('Your session has expired. Please sign in again.');
        return;
      }

      queryClient.invalidateQueries(); // refetch with a valid token
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, signOut, queryClient]);

  return null;
}

// Component to handle authentication redirects
function AuthRedirect() {
  const { user, profile, initialized } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!initialized) return;

    if (user) {
      // User is authenticated
      if (!profile || !profile.profile_completed_at) {
        // Profile not complete, redirect to onboarding
        navigate('/onboarding', { replace: true });
      } else {
        // Profile complete, redirect to dashboard
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      }
    }
    // If no user, stay on login page
  }, [user, profile, initialized, navigate, location]);

  // Show loading while checking auth state
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading MedSync360...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated but we're still on login page, show loading
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Show login form
  return <LoginForm />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, initialized } = useAuthStore();
  const location = useLocation();
  
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Check if profile is complete
  if (user && (!profile || !profile.profile_completed_at)) {
    return <Navigate to="/onboarding" replace />;
  }
  
  return <>{children}</>;
}

// Separate onboarding route component
function OnboardingRoute() {
  const { user, profile, initialized } = useAuthStore();
  
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // If profile is already complete, redirect to dashboard
  if (profile && profile.profile_completed_at) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <OnboardingForm />;
}

function App() {
  const { initialize, initialized, profile } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Global crash/perf error logging to Supabase (non-invasive)
  useEffect(() => {
    setupGlobalErrorLogging(profile?.id);
  }, [profile?.id]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading MedSync360...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          <SessionTimeoutManager />
          <AuthRecoveryManager />
          <Routes>
            <Route path="/login" element={<AuthRedirect />} />
            <Route path="/onboarding" element={<OnboardingRoute />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/medsync360_final"
              element={
                <Suspense fallback={<Layout><LoadingFallback /></Layout>}>
                  <MedSyncVideo />
                </Suspense>
              }
            />
            <Route
              element={
                <ProtectedRoute>
                  <Layout>
                    <Suspense fallback={<LoadingFallback />}>
                      <Outlet />
                    </Suspense>
                  </Layout>
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/referrals" element={<ReferralManagement />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/research-insight" element={<ResearchInsight />} />
            </Route>
          </Routes>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#fff',
                color: '#333',
                border: '1px solid #e5e5e5',
              },
            }}
          />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
