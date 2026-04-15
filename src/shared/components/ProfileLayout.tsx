import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import UserAvatar from '@/shared/components/UserAvatar';
import { useProfileLeaveGuard, type ProfileLeaveGuardState } from '@/shared/components/profileLeaveGuard';
import { accountNavItems, getAccountPageTitle } from '@/features/account/accountNav';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

type LeavePromptProps = {
  onSave: () => Promise<boolean>;
  onDiscard: () => void;
  onClose: () => void;
  isMobile: boolean;
};

function LeavePromptCard({
  onSave,
  onDiscard,
  onClose,
  isMobile,
}: LeavePromptProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const ok = await onSave();
      if (!ok) {
        setIsSaving(false);
      }
    } catch {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    if (isSaving) return;
    onDiscard();
  };

  if (isMobile) {
    return (
      <div className="s-profilelayou-leave-toast s-profilelayou-leave-toast--mobile">
        <button
          type="button"
          className="s-profilelayou-leave-toast-close"
          onClick={onClose}
          aria-label="Close"
        >
          <i className="bi bi-x-lg" />
        </button>
        <div className="s-profilelayou-leave-toast-title">
          Save changes before leaving
        </div>
        <div className="s-profilelayou-leave-toast-copy">
          Close this message, save your changes, then continue.
        </div>
      </div>
    );
  }

  return (
    <div className="s-profilelayou-leave-toast">
      <div className="s-profilelayou-leave-toast-title">Do you want to keep your changes?</div>
      <div className="s-profilelayou-leave-toast-copy">
        Save them now or discard them and continue.
      </div>
      <div className="s-profilelayou-leave-toast-actions">
        <button type="button" className="s-profilelayou-leave-toast-save" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" className="s-profilelayou-leave-toast-discard" onClick={handleDiscard} disabled={isSaving}>
          Don't Save
        </button>
      </div>
    </div>
  );
}

export default function ProfileLayout() {
  const { getUserName, logout, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const name = getUserName();
  const profileImageUrl = (user as any)?.profileImageUrl || '';
  const mobilePageTitle = getAccountPageTitle(location.pathname);
  const greeting = 'Hey Beautiful';
  const [typedGreeting, setTypedGreeting] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (!isDeleting && typedGreeting.length < greeting.length) {
      timer = setTimeout(() => {
        setTypedGreeting(greeting.slice(0, typedGreeting.length + 1));
      }, 110);
    } else if (!isDeleting && typedGreeting.length === greeting.length) {
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, 5000);
    } else if (isDeleting && typedGreeting.length > 0) {
      timer = setTimeout(() => {
        setTypedGreeting(greeting.slice(0, typedGreeting.length - 1));
      }, 60);
    } else if (isDeleting && typedGreeting.length === 0) {
      timer = setTimeout(() => {
        setIsDeleting(false);
      }, 200);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [greeting, isDeleting, typedGreeting]);

  const { guard } = useProfileLeaveGuard();
  const guardRef = useRef<ProfileLeaveGuardState | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const leaveToastRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isMobile) return;
    window.scrollTo(0, 0);
  }, [isMobile, location.pathname]);

  useEffect(() => {
    guardRef.current = guard ?? null;
  }, [guard]);

  const dismissLeavePrompt = useCallback(() => {
    if (leaveToastRef.current !== undefined) {
      toast.dismiss(leaveToastRef.current);
      leaveToastRef.current = undefined;
    }
  }, []);

  const runPendingAction = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    dismissLeavePrompt();
    action?.();
  }, [dismissLeavePrompt]);

  const openLeavePrompt = useCallback((nextAction: () => void) => {
    pendingActionRef.current = nextAction;
    if (leaveToastRef.current !== undefined) return;

    const toastId = toast.custom(
      <LeavePromptCard
        onSave={async () => {
          const currentGuard = guardRef.current;
          if (!currentGuard) return false;
          const saved = await currentGuard.saveChanges();
          if (saved) {
            runPendingAction();
          }
          return saved;
        }}
        onDiscard={() => {
          guardRef.current?.discardChanges();
          runPendingAction();
        }}
        onClose={() => {
          pendingActionRef.current = null;
          dismissLeavePrompt();
        }}
        isMobile={isMobile}
      />,
      {
        duration: Infinity,
        style: {
          background: 'transparent',
          boxShadow: 'none',
          padding: 0,
          border: 'none',
        },
      },
    );

    leaveToastRef.current = toastId;
  }, [dismissLeavePrompt, isMobile, runPendingAction]);

  const handleGuardedAction = useCallback((nextAction: () => void) => {
    if (!guardRef.current?.isDirty) {
      nextAction();
      return;
    }

    openLeavePrompt(nextAction);
  }, [openLeavePrompt]);

  const handleNavClick = useCallback((event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (location.pathname === path) return;
    if (guardRef.current?.isDirty) {
      event.preventDefault();
      openLeavePrompt(() => navigate(path));
    }
  }, [location.pathname, navigate, openLeavePrompt]);

  const handleSignOut = useCallback(() => {
    handleGuardedAction(() => {
      logout();
      navigate('/');
    });
  }, [handleGuardedAction, logout, navigate]);

  const handleSupportClick = useCallback(() => {
    handleGuardedAction(() => navigate('/contact-us'));
  }, [handleGuardedAction, navigate]);

  const handleMobileBack = useCallback(() => {
    handleGuardedAction(() => {
      if (window.history.length > 2) {
        navigate(-1);
        return;
      }
      navigate('/');
    });
  }, [handleGuardedAction, navigate]);

  useEffect(() => () => {
    dismissLeavePrompt();
  }, [dismissLeavePrompt]);

  if (isMobile) {
    return (
      <div className="pl-mobile-shell">
        <div className="pl-mobile-topbar">
          <button
            type="button"
            onClick={handleMobileBack}
            className="pl-mobile-back"
            aria-label="Go back"
          >
            <i className="bi bi-chevron-left" />
            <span>Back</span>
          </button>
          <h1 className="pl-mobile-title twam-font-heading">
            {mobilePageTitle}
          </h1>
        </div>

        <main className="pl-mobile-content">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="container pl-wrap s-profilelayou-8cf73f">

        {/* ── Sidebar ── */}
        <aside className="pl-sidebar s-profilelayou-a63021">
          <div className="s-profilelayou-7033d5">

            {/* Header */}
            <div className="s-profilelayou-84a313">
              <div className="s-profilelayou-e33b62" />
              <div className="s-profilelayou-92f3ba">
                <UserAvatar
                  name={name}
                  imageUrl={profileImageUrl}
                  size={48}
                  fallbackMode="initial"
                  className="s-profilelayou-8aef68"
                />
                <div className="s-profilelayou-typing" aria-hidden="true">
                  <span className="s-profilelayou-typing-text">{typedGreeting}</span>
                  <span className="s-profilelayou-typing-cursor" />
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="pl-nav s-profilelayou-4eec79">
              {accountNavItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={(event) => handleNavClick(event, item.path)}
                  style={({ isActive }) => ({ display:'flex', alignItems:'center', gap:10, padding:'11px 18px', textDecoration:'none', fontSize:'13.5px', color: isActive ? 'var(--brand)' : 'var(--heirloom)', background: isActive ? 'var(--ivory)' : 'transparent', borderLeft: isActive ? `3px solid var(--brand)` : '3px solid transparent', fontWeight: isActive ? 700 : 400, fontFamily: 'var(--font-body)', transition:'background .15s,color .15s' })}
                >
                  <i className={`bi ${item.icon} s-profilelayou-40fc0e`} />
                  {item.label}
                </NavLink>
              ))}
              <div className="s-profilelayou-a78377" />
              <button onClick={handleSignOut}
                className="s-profilelayou-d3b202">
                <i className="bi bi-box-arrow-right s-profilelayou-40fc0e" /> Sign Out
              </button>
            </nav>
          </div>

          {/* Help card */}
          <div className="s-profilelayou-e6f435">
            <p className="s-profilelayou-9e4e02 s-profilelayou-ff6baedf">Need help?</p>
            <p className="s-profilelayou-331eb0">Our support team is ready to help.</p>
            <button onClick={handleSupportClick}
              className="s-profilelayou-a17955">
              Contact Support
            </button>
          </div>
        </aside>

        {/* ── Content ── */}
        <main className="s-userdashboar-7aa8c4">
          <Outlet />
        </main>
      </div>
    </>
  );
}
