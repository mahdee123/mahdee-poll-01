import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SignupForm from './components/SignupForm';
import LoginForm from './components/LoginForm';
import CompanySettings from './components/CompanySettings';
import LoadingSpinner from './components/LoadingSpinner';
import App from './App';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

function AuthGate() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-canvas">
      <LoadingSpinner message="Loading your workspace…" />
    </div>
  );
}

// Protected route wrapper - requires authentication
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <AuthGate />;

  return isAuthenticated ? children : <Navigate to="/login" />;
}

// Public route wrapper - only accessible when not authenticated
function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <AuthGate />;

  return isAuthenticated ? <Navigate to="/dashboard" /> : children;
}

export default function MainApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public Routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginForm />
                </PublicRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicRoute>
                  <SignupForm />
                </PublicRoute>
              }
            />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <App />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/company"
              element={
                <ProtectedRoute>
                  <CompanySettings />
                </ProtectedRoute>
              }
            />

            {/* Redirect to login by default */}
            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
