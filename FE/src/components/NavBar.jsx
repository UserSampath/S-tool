import Logo from "./Logo";
import { SignOutIcon } from "./icons";

function NavBar({ user, onSignOut }) {
  const initial = (user?.username ?? "?").charAt(0).toUpperCase();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <a className="nav-brand" href="/" aria-label="S tools home">
          <Logo size={36} variant="nav" />
          <span>S tools</span>
        </a>

        <div className="nav-user">
          <div className="nav-identity">
            <span className="nav-avatar" aria-hidden="true">
              {initial}
            </span>
            <span className="nav-name">{user?.username}</span>
          </div>

          <button
            type="button"
            className="nav-signout"
            onClick={onSignOut}
            title="Sign out"
          >
            <SignOutIcon />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default NavBar;
