"""WebSocket connection manager for broadcasting packets to clients."""

from fastapi import WebSocket

from backend.schemas import PacketSchema


class WSConnectionManager:
    """Manage active WebSocket connections grouped by gateway ID."""

    def __init__(self) -> None:
        """Initialize connection buckets."""
        self.active_connections: dict[str, list[WebSocket]] = {
            "*": [],
        }

    async def connect(self, websocket: WebSocket, gateway_id: str) -> None:
        """Accept and register a WebSocket under the given gateway bucket."""
        await websocket.accept()

        if gateway_id in self.active_connections:
            self.active_connections[gateway_id].append(websocket)
        else:
            self.active_connections[gateway_id] = [websocket]

    def disconnect(self, websocket: WebSocket, gateway_id: str) -> None:
        """Remove a WebSocket from its gateway bucket."""
        self.active_connections[gateway_id].remove(websocket)

    async def broadcast(self, gateway_id: int, packet: PacketSchema) -> None:
        """Send a packet JSON to all subscribers of '*' and the specific gateway."""
        gateway_id = f"{gateway_id:x}"

        packet_json = packet.model_dump(mode="json")

        for connection in self.active_connections["*"]:
            await connection.send_json(packet_json)

        for connection in self.active_connections.get(gateway_id, []):
            await connection.send_json(packet_json)
