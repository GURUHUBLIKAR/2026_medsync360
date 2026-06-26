import React, { useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { LoginForm } from './components/features/auth/LoginForm';
import { SessionTimeoutModal } from './components/features/auth/SessionTimeoutModal';
import { GlobalLoader } from './components/ui/GlobalLoader';
import { OnboardingForm } from './components/features/onboarding';
import { Messages } from './components/features/Messages';
import { useAuthStore } from './store/authStore';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { usePreferences } from './store/preferencesStore';
import { supabase } from './lib/supabase';
import { setupGlobalErrorLogging } from './lib/logger';

// Lazy load main route components
const Dashboard = lazy(() => import('./components/features/dashboard/Dashboard').then(module => ({ default: module.Dashboard })));
const ReferralManagement = lazy(() => import('./components/features/referrals/ReferralManagement').then(module => ({ default: module.ReferralManagement })));
const ResearchInsight = lazy(() => import('./components/features/research-insight/ResearchInsight').then(module => ({ default: module.ResearchInsight })));
const HospitalManagement = lazy(() => import('./components/features/hospitals/HospitalManagement').then(module => ({ default: module.HospitalManagement })));
const ApprovalsPage = lazy(() => import('./components/features/admin/ApprovalsPage').then(module => ({ default: module.ApprovalsPage })));
const MedSyncVideo = lazy(() => import('./components/features/video/MedSyncVideo').then(module => ({ default: module.MedSyncVideo })));
const Analytics = lazy(() => import('./components/features/analytics/AnalyticsPage').then(module => ({ default: module.AnalyticsPage })));

const AIAssistant = lazy(() => Promise.resolve({ default: () => (
  <div className="text-center py-12">
    <h2 className="text-2xl font-bold text-neutral-900 mb-4">AI Medical Assistant</h2>
    <p className="text-neutral-600">AI-powered medical insights coming soon...</p>
  </div>
)}));

// main's richer charts/leaderboard analytics, kept alongside the role-scoped AnalyticsPage.
const AnalyticsOverview = lazy(() => import('./components/features/analytics/Analytics').then(module => ({ default: module.Analytics })));

const Settings = lazy(() => import('./components/features/settings/Settings').then(module => ({ default: module.Settings })));

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
  const sessionTimeoutEnabled = usePreferences((s) => s.sessionTimeoutEnabled);

  const handleTimeout = useCallback(async () => {
    await signOut();
    toast.error('You have been logged out due to inactivity');
  }, [signOut]);

  const { showWarning, secondsRemaining, stayLoggedIn } = useSessionTimeout({
    // Toggleable from Settings; defaults to the VITE_SESSION_TIMEOUT_ENABLED flag.
    enabled: sessionTimeoutEnabled && !!user,
    onTimeout: handleTimeout,
  });

  if (!sessionTimeoutEnabled || !user) return null;

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

// Shown to a doctor whose registration is awaiting their hospital superuser.
function AccountStatusScreen({ status }: { status: 'pending' | 'rejected' }) {
  const { signOut } = useAuthStore();
  const pending = status === 'pending';
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md w-full text-center bg-white border border-neutral-200 rounded-xl p-8">
        <div className={`w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center ${pending ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
          <span className="text-2xl">{pending ? '⏳' : '⛔'}</span>
        </div>
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">
          {pending ? 'Waiting for approval' : 'Registration not approved'}
        </h2>
        <p className="text-neutral-600 mb-6">
          {pending
            ? 'Your account is pending approval by your hospital’s administrator. You’ll get access as soon as it’s approved.'
            : 'Your registration was not approved. Please contact your hospital administrator if you believe this is a mistake.'}
        </p>
        <button
          onClick={() => signOut()}
          className="px-4 py-2 text-sm font-medium text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
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

  // Approval gate. Only explicit pending/rejected are blocked — anything else
  // (approved, or an older row without the column) passes, so existing accounts
  // are never locked out.
  const status = (profile as any)?.approval_status;
  if (status === 'pending') return <AccountStatusScreen status="pending" />;
  if (status === 'rejected') return <AccountStatusScreen status="rejected" />;

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
  const theme = usePreferences((s) => s.theme);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Apply the selected theme by toggling the `dark` class on <html>.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

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
          <GlobalLoader />
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
              {/* Role-scoped analytics (gurutomain) */}
              <Route path="/analytics" element={<Analytics />} />
              {/* Charts/leaderboard analytics (main) */}
              <Route path="/analytics-overview" element={<AnalyticsOverview />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/research-insight" element={<ResearchInsight />} />
              {/* gurutomain admin/platform features */}
              <Route path="/hospitals" element={<HospitalManagement />} />
              <Route path="/approvals" element={<ApprovalsPage />} />
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
