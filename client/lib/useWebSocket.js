'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE } from '../app/lib/api'

/**
 * Resolves the dynamic WebSocket URL from NEXT_PUBLIC_API_URL or current browser location.
 * Converts http:// -> ws:// and https:// -> wss://
 */
export function getWebSocketUrl(clientId = 'client', role = 'STAFF') {
  if (typeof window === 'undefined') return ''

  let apiBase = API_BASE
  if (!apiBase && typeof window !== 'undefined') {
    apiBase = window.location.origin
  }

  let wsUrl = apiBase.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://')
  wsUrl = wsUrl.replace(/\/+$/, '')
  return `${wsUrl}/ws/${clientId}?role=${role}`
}

/**
 * Custom React Hook for resilient, auto-reconnecting WebSocket real-time updates.
 */
export function useWebSocket(clientId = 'user', role = 'STAFF') {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)
  const socketRef = useRef(null)
  const listenersRef = useRef(new Map())
  const reconnectTimeoutRef = useRef(null)
  const pingIntervalRef = useRef(null)
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 3

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return

    if (retryCountRef.current >= MAX_RETRIES) {
      setIsConnected(false)
      return
    }

    const url = getWebSocketUrl(clientId, role)
    if (!url) return

    try {
      const ws = new WebSocket(url)
      socketRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        retryCountRef.current = 0
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping')
          }
        }, 25000)
      }

      ws.onmessage = (event) => {
        if (event.data === 'pong') return
        try {
          const payload = JSON.parse(event.data)
          setLastMessage(payload)

          const eventType = payload.event
          if (eventType && listenersRef.current.has(eventType)) {
            const callbacks = listenersRef.current.get(eventType)
            callbacks.forEach(cb => {
              try { cb(payload.data) } catch (e) {}
            })
          }

          if (listenersRef.current.has('*')) {
            const wildcards = listenersRef.current.get('*')
            wildcards.forEach(cb => {
              try { cb(payload) } catch (e) {}
            })
          }
        } catch (e) {}
      }

      ws.onclose = () => {
        setIsConnected(false)
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
        retryCountRef.current += 1
        
        if (retryCountRef.current < MAX_RETRIES) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, 3000)
        }
      }

      ws.onerror = () => {
        try { ws.close() } catch (e) {}
      }
    } catch (e) {
      retryCountRef.current += 1
      if (retryCountRef.current < MAX_RETRIES) {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, 5000)
      }
    }
  }, [clientId, role])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [connect])

  /**
   * Subscribe to specific WebSocket events.
   * Returns an unsubscribe function for cleanup in useEffect.
   */
  const subscribe = useCallback((eventType, callback) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set())
    }
    listenersRef.current.get(eventType).add(callback)

    return () => {
      if (listenersRef.current.has(eventType)) {
        listenersRef.current.get(eventType).delete(callback)
      }
    }
  }, [])

  return { isConnected, lastMessage, subscribe }
}

/**
 * Convenience Hook for pages: Automatically calls `onRefresh()` whenever relevant events occur.
 */
export function useRealtimeRefresh(onRefresh, events = ['TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_REASSIGNED', 'REVIEWER_ACTION', 'AGENT_WORKLOAD_CHANGED']) {
  const { isConnected, subscribe } = useWebSocket('staff-subscriber', 'STAFF')

  useEffect(() => {
    if (!onRefresh) return

    const unsubscribes = events.map(evt => {
      return subscribe(evt, () => {
        // Debounce or invoke refresh immediately
        onRefresh()
      })
    })

    return () => {
      unsubscribes.forEach(unsub => unsub())
    }
  }, [subscribe, onRefresh, events])

  return { isConnected }
}
