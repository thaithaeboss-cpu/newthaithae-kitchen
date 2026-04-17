'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface BranchContextValue {
  branchId: string;
  setBranchId: (id: string) => void;
}

const BranchContext = createContext<BranchContextValue>({
  branchId: '',
  setBranchId: () => {},
});

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branchId, setBranchIdState] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('selectedBranchId');
    if (saved) setBranchIdState(saved);
  }, []);

  function setBranchId(id: string) {
    setBranchIdState(id);
    localStorage.setItem('selectedBranchId', id);
  }

  return (
    <BranchContext.Provider value={{ branchId, setBranchId }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranchContext() {
  return useContext(BranchContext);
}
