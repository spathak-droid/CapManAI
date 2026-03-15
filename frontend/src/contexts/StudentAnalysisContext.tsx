"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface StudentAnalysisState {
  studentContextId: number | null;
  studentName: string | null;
}

interface StudentAnalysisContextValue extends StudentAnalysisState {
  setStudentContext: (id: number, name: string) => void;
  clearStudentContext: () => void;
}

const StudentAnalysisContext = createContext<StudentAnalysisContextValue>({
  studentContextId: null,
  studentName: null,
  setStudentContext: () => {},
  clearStudentContext: () => {},
});

export function StudentAnalysisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StudentAnalysisState>({
    studentContextId: null,
    studentName: null,
  });

  const setStudentContext = useCallback((id: number, name: string) => {
    setState({ studentContextId: id, studentName: name });
  }, []);

  const clearStudentContext = useCallback(() => {
    setState({ studentContextId: null, studentName: null });
  }, []);

  return (
    <StudentAnalysisContext.Provider value={{ ...state, setStudentContext, clearStudentContext }}>
      {children}
    </StudentAnalysisContext.Provider>
  );
}

export function useStudentAnalysis() {
  return useContext(StudentAnalysisContext);
}
