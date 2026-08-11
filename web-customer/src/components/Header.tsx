import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="customer-header">
      <div className="wrap">
        <Link to="/dashboard" className="wordmark" aria-label="R&A Labs Customer Portal home">
          R<em>&amp;</em>A Labs
        </Link>
        <nav aria-label="Main navigation">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/agent"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            AI Agent
          </NavLink>
          <NavLink
            to="/account"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Account
          </NavLink>
          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
            aria-label={`Logout ${user?.name ?? ''}`}
          >
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
