'use client';

import type { CheckoutMode } from '../offer';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type CheckoutStep = 1 | 2 | 3;

const DEMO: CheckoutMode = { mode: 'demo' };

const CourseContext = createContext<{ step: CheckoutStep; setStep: (s: CheckoutStep) => void; checkout: CheckoutMode } | null>(null);

/** Estado compartilhado entre checkout, CTA fixo e links de compra (etapa atual). */
export function CourseProvider({ children, checkout = DEMO }: { children: ReactNode; checkout?: CheckoutMode }) {
  const [step, setStep] = useState<CheckoutStep>(1);
  const value = useMemo(() => ({ step, setStep, checkout }), [step, checkout]);
  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>;
}

export function useCourse() {
  const ctx = useContext(CourseContext);
  if (!ctx) throw new Error('useCourse fora de <CourseProvider>');
  return ctx;
}

export { DESKTOP_QUERY, useMediaQuery, useReducedMotion } from '../hooks';
