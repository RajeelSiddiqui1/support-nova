'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE } from './api'

/**
 * Resolves the dynamic WebSocket URL from NEXT_PUBLIC_API_URL or current browser location.
 * Converts http:// -> ws:// and https:// -> wss://
 */
export function getWebSocketUrl(clientId = 'client', role = 'STAFF') {
  if (typeof window === 'undefined') return ''

  const apiBase = API_BASE || window.location.origin
  let wsUrl = apiBase.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://')
  
  // Clean trailing slashes
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

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return

    const url = getWebSocketUrl(clientId, role)
    if (!url) return

    try {
      const ws = new WebSocket(url)
      socketRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        // Setup keepalive ping every 25 seconds
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

          // Dispatch to any registered listeners for this event type
          const eventType = payload.event
          if (eventType && listenersRef.current.has(eventType)) {
            const callbacks = listenersRef.current.get(eventType)
            callbacks.forEach(cb => {
              try { cb(payload.data) } catch (e) {}
            })
          }

          // Also trigger wildcard '*' listeners
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
        // Auto-reconnect after 3 seconds with backoff
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch (e) {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 5000)
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
