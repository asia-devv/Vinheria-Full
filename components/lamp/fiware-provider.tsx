"use client"

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react"
import useSWR from "swr"
import { fetchLamps, type Lamp } from "@/lib/fiware"

const SERVER_KEY = "fiware-servidor"
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

export type ActivityItem = {
  id: number
  kind: "on" | "off" | "create" | "delete" | "error" | "info"
  message: string
  at: Date
}

type FiwareContextValue = {
  server: string
  setServer: (value: string) => void
  lamps: Lamp[]
  isLoading: boolean
  isValidating: boolean
  error: Error | undefined
  refresh: () => Promise<unknown>
  patchLamp: (id: string, patch: Partial<Lamp>) => void
  activity: ActivityItem[]
  log: (kind: ActivityItem["kind"], message: string) => void
}

const FiwareContext = createContext<FiwareContextValue | null>(null)

export function FiwareProvider({ children }: { children: React.ReactNode }) {
  // The server address is a browser-local preference, matching the original project.
  const server = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(SERVER_KEY) ?? "",
    () => "",
  )

  const setServer = useCallback((value: string) => {
    localStorage.setItem(SERVER_KEY, value.trim())
    listeners.forEach((l) => l())
  }, [])

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    server ? ["lamps", server] : null,
    ([, s]) => fetchLamps(s),
    { refreshInterval: 5000, keepPreviousData: true, revalidateOnFocus: true },
  )

  const patchLamp = useCallback(
    (id: string, patch: Partial<Lamp>) => {
      mutate((current) => current?.map((l) => (l.id === id ? { ...l, ...patch } : l)), { revalidate: false })
    },
    [mutate],
  )

  const [activity, setActivity] = useState<ActivityItem[]>([])
  const log = useCallback((kind: ActivityItem["kind"], message: string) => {
    setActivity((items) => [{ id: Date.now() + Math.random(), kind, message, at: new Date() }, ...items].slice(0, 30))
  }, [])

  const value = useMemo<FiwareContextValue>(
    () => ({
      server,
      setServer,
      lamps: data ?? [],
      isLoading,
      isValidating,
      error,
      refresh: () => mutate(),
      patchLamp,
      activity,
      log,
    }),
    [server, setServer, data, isLoading, isValidating, error, mutate, patchLamp, activity, log],
  )

  return <FiwareContext.Provider value={value}>{children}</FiwareContext.Provider>
}

export function useFiware() {
  const ctx = useContext(FiwareContext)
  if (!ctx) throw new Error("useFiware must be used within FiwareProvider")
  return ctx
}
