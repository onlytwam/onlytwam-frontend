import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type ProfileLeaveGuardState = {
  isDirty: boolean;
  saveChanges: () => Promise<boolean>;
  discardChanges: () => void;
};

type ProfileLeaveGuardContextValue = {
  guard: ProfileLeaveGuardState | null;
  setGuard: (guard: ProfileLeaveGuardState | null) => void;
};

const ProfileLeaveGuardContext = createContext<ProfileLeaveGuardContextValue | null>(null);

export function ProfileLeaveGuardProvider({ children }: { children: ReactNode }) {
  const [guard, setGuard] = useState<ProfileLeaveGuardState | null>(null);

  const value = useMemo(
    () => ({ guard, setGuard }),
    [guard],
  );

  return (
    <ProfileLeaveGuardContext.Provider value={value}>
      {children}
    </ProfileLeaveGuardContext.Provider>
  );
}

export function useProfileLeaveGuard() {
  const context = useContext(ProfileLeaveGuardContext);
  if (!context) {
    throw new Error('useProfileLeaveGuard must be used within ProfileLeaveGuardProvider');
  }
  return context;
}
