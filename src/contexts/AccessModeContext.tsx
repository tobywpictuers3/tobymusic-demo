import React, { createContext, useContext, useState, ReactNode, FC } from 'react';

type AccessMode = 'private' | 'public';

interface AccessModeContextType {
  accessMode: AccessMode;
  setAccessMode: (mode: AccessMode) => void;
  isPublicMode: boolean;
  checkWriteAccess: () => boolean;
}

const AccessModeContext = createContext<AccessModeContextType | undefined>(undefined);

export const AccessModeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [accessMode, setAccessMode] = useState<AccessMode>('private');

  const isPublicMode = accessMode === 'public';

  const checkWriteAccess = (): boolean => {
    if (accessMode === 'public') {
      return false;
    }
    return true;
  };

  return (
    <AccessModeContext.Provider value={{ accessMode, setAccessMode, isPublicMode, checkWriteAccess }}>
      {children}
    </AccessModeContext.Provider>
  );
};

export const useAccessMode = () => {
  const context = useContext(AccessModeContext);
  if (context === undefined) {
    throw new Error('useAccessMode must be used within an AccessModeProvider');
  }
  return context;
};
