import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Waves, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { apiRequest } from '../api';
import Button from './Button';

export default function SignupForm() {
  useDocumentTitle('Create Account');
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    companyName: '',
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: ''
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
    if (!formData.companyName.trim()) {
      setError('Company name is required');
      return;
    }
    if (!formData.ownerName.trim()) {
      setError('Owner name is required');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { token, user, company } = await apiRequest('/auth/register-company', {
        method: 'POST',
        body: {
          companyName: formData.companyName,
          ownerName: formData.ownerName,
          email: formData.email,
          password: formData.password,
        },
      });

      // Update auth context
      setAuth(token, user, company);

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Something went wrong creating your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-6">
          <span className="w-11 h-11 rounded-control bg-primary flex items-center justify-center">
            <Waves size={22} className="text-white" />
          </span>
          <span className="text-sm font-medium text-ink-faint">Raya Pool</span>
        </div>

        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-ink mb-1">Create your pool business</h1>
          <p className="text-sm text-ink-soft mb-6">Start managing your pool membership service today</p>

          {error && (
            <div className="flex items-start gap-2 bg-danger-soft border border-danger/20 text-danger-ink px-3.5 py-3 rounded-control mb-4 text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="signup-company">Company name</label>
              <input
                id="signup-company"
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder="e.g., Sunset Pool Club"
                className="input"
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <label className="label" htmlFor="signup-owner">Owner name</label>
              <input
                id="signup-owner"
                type="text"
                name="ownerName"
                value={formData.ownerName}
                onChange={handleChange}
                placeholder="Your full name"
                className="input"
                disabled={loading}
              />
            </div>

            <div>
              <label className="label" htmlFor="signup-email">Email address</label>
              <input
                id="signup-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="admin@example.com"
                className="input"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="signup-password">Password</label>
                <input
                  id="signup-password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="6+ characters"
                  className="input"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="label" htmlFor="signup-confirm">Confirm password</label>
                <input
                  id="signup-confirm"
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input"
                  disabled={loading}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-ink-soft mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:text-primary-700 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
