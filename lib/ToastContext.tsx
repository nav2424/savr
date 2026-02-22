import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { ToastHost, ToastKind } from '../components/ToastHost'

type ToastOptions = {
  kind?: ToastKind
  durationMs?: number
}

type ToastContextValue = {
  showToast: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const [kind, setKind] = useState<ToastKind>('info')
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((nextMessage: string, options?: ToastOptions) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }

    setKind(options?.kind ?? 'info')
    setMessage(nextMessage)

    const durationMs = options?.durationMs ?? 2200
    hideTimerRef.current = setTimeout(() => {
      setMessage(null)
      hideTimerRef.current = null
    }, durationMs)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost message={message} kind={kind} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

