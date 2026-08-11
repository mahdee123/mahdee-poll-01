import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Waves, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { apiRequest } from '../api';
import Button from './Button';

export default function LoginForm() {
  useDocumentTitle('Sign In');
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    if (!formData.password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    try {
      const { token, user, company } = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: formData.email, password: formData.password },
      });

      // Update auth context
      setAuth(token, user, company);

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Something went wrong signing in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-6">
          <span className="w-11 h-11 rounded-control bg-primary flex items-center justify-center">
            <Waves size={22} className="text-white" />
          </span>
          <span className="text-sm font-medium text-ink-faint">Raya Pool</span>
        </div>

        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-ink mb-1">Welcome back</h1>
          <p className="text-sm text-ink-soft mb-6">Sign in to your pool management account</p>

          {error && (
            <div className="flex items-start gap-2 bg-danger-soft border border-danger/20 text-danger-ink px-3.5 py-3 rounded-control mb-4 text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="admin@example.com"
                className="input"
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <label className="label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="input"
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-ink-soft mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary hover:text-primary-700 font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
