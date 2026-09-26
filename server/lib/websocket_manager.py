import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect

class WebSocketManager:
    """
    Central Real-Time WebSocket Manager for NovaWear Apparel Platform.
    Enables instant, zero-reload UI synchronization across Reviewer Queue,
    Admin Oversight, Agent Workspace, and Customer Live Channels.
    """

    def __init__(self):
        # List of all active WebSocket client connections
        self.active_connections: List[WebSocket] = []
        # Mapping of connection to client metadata: {ws: {"user_id": str, "role": str, "client_id": str}}
        self.connection_meta: Dict[WebSocket, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, client_id: Optional[str] = None, role: Optional[str] = None):
        """Accepts and registers a new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)
            self.connection_meta[websocket] = {
                "client_id": client_id or "anonymous",
                "role": role or "GUEST",
                "connected_at": datetime.utcnow().isoformat()
            }
        print(f"[WEBSOCKET] Client connected: {client_id} (Role: {role}). Total active: {len(self.active_connections)}")
        
        # Send initial welcome confirmation
        try:
            await websocket.send_json({
                "event": "CONNECTED",
                "data": {
                    "status": "online",
                    "client_id": client_id,
                    "active_clients": len(self.active_connections),
                    "timestamp": datetime.utcnow().isoformat()
                }
            })
        except Exception:
            pass

    async def disconnect(self, websocket: WebSocket):
        """Safely removes a disconnected client."""
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
            meta = self.connection_meta.pop(websocket, None)
            cid = meta.get("client_id") if meta else "unknown"
            print(f"[WEBSOCKET] Client disconnected: {cid}. Total remaining: {len(self.active_connections)}")

    async def broadcast(self, event: str, data: Dict[str, Any], role_filter: Optional[str] = None):
        """
        Broadcasts an event with payload to all active clients (or filtered by role).
        Prunes dead connections automatically without raising exceptions.
        """
        message = {
            "event": event,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }

        async with self._lock:
            clients_snapshot = list(self.active_connections)

        dead_connections = []
        for ws in clients_snapshot:
            # Role filtering if specified
            if role_filter:
                meta = self.connection_meta.get(ws, {})
                client_role = (meta.get("role") or "").upper()
                if client_role != role_filter.upper() and client_role != "ADMIN":
                    continue

            try:
                await ws.send_json(message)
            except Exception as e:
                dead_connections.append(ws)

        if dead_connections:
            async with self._lock:
                for dead_ws in dead_connections:
                    if dead_ws in self.active_connections:
                        self.active_connections.remove(dead_ws)
                    self.connection_meta.pop(dead_ws, None)

    # Convenience broadcast helpers for domain events:
    async def notify_ticket_created(self, ticket: Dict[str, Any]):
        """Notifies all staff and clients that a new complaint ticket arrived."""
        await self.broadcast("TICKET_CREATED", ticket)

    async def notify_ticket_updated(self, ticket_id: str, updates: Dict[str, Any]):
        """Notifies that ticket data/status/compliance changed."""
        payload = {"ticket_id": ticket_id, **updates}
        await self.broadcast("TICKET_UPDATED", payload)

    async def notify_ticket_reassigned(self, ticket_id: str, old_agent_id: Optional[str], new_agent_id: Optional[str], reason: str):
        """Notifies that a manager or admin reassigned a ticket to a new agent."""
        payload = {
            "ticket_id": ticket_id,
            "old_agent_id": old_agent_id,
            "new_agent_id": new_agent_id,
            "reason": reason
        }
        await self.broadcast("TICKET_REASSIGNED", payload)

    async def notify_reviewer_action(self, ticket_id: str, action: str, reviewer_name: str, new_status: str):
        """Notifies that a reviewer approved, modified, reclassified, or escalated a ticket."""
        payload = {
            "ticket_id": ticket_id,
            "action": action,
            "reviewer_name": reviewer_name,
            "new_status": new_status
        }
        await self.broadcast("REVIEWER_ACTION", payload)

    async def notify_agent_workload_change(self):
        """Signals managers and admins to refresh agent roster metrics live."""
        await self.broadcast("AGENT_WORKLOAD_CHANGED", {"trigger": "realtime_update"})

# Global Singleton Instance
ws_manager = WebSocketManager()
