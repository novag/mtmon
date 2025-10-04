"""Pydantic schemas used for serializing API responses and websocket payloads."""

from datetime import datetime
from typing import Any, ClassVar

from pydantic import BaseModel, Field
from pydantic.config import ConfigDict

from backend.models import LinkSourceEnum


class NodeSchema(BaseModel):
    """Serializable representation of a mesh node with optional computed metrics.

    Includes optional fields that some endpoints may attach dynamically, such as
    direct-link metrics and 24h message statistics.
    """

    id: int
    first_seen: datetime | None = None
    last_seen: datetime | None = None
    hop_limit: int | None = None
    message_count: int | None = None
    legacy: bool | None = None
    position: dict[str, Any] | None = None
    metrics: dict[str, Any] | None = None
    info: dict[str, Any] | None = None

    # Computed/augmented fields
    message_count_24h: int | None = None
    avg_msg_per_hour_24h: float | None = None

    # Direct link augmentation (used by /nodes/{id}/direct_nodes)
    last_snr: float | None = None
    last_rssi: int | None = None
    last_seen_direct: datetime | None = None
    direction: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PacketHopSchema(BaseModel):
    """Hop observation for a packet with per-gateway metrics."""

    gateway_id: int
    seen_at: datetime
    hop_limit: int
    rssi: int
    snr: float


class PacketSchema(BaseModel):
    """Packet data as published to WebSocket clients."""

    id: int
    first_seen: datetime
    from_id: int
    to_id: int
    want_ack: bool
    via_mqtt: bool
    hop_limit: int
    hop_start: int
    port: str
    payload: Any | None = None
    hops: list[PacketHopSchema] = Field(default_factory=list)

    class Config:
        """Model configuration for JSON encoding."""

        json_encoders: ClassVar[dict[type, object]] = {
            datetime: lambda v: v.isoformat(),
        }


class PacketDbSchema(BaseModel):
    """REST representation of a persisted packet row with derived fields."""

    id: int
    first_seen: datetime
    from_id: int
    to_id: int
    length: int
    hop_start: int
    # Derived string added by endpoints for convenience
    port: str

    model_config = ConfigDict(from_attributes=True)


class DirectLinkSchema(BaseModel):
    """Serializable representation of a directed link observation."""

    from_node_id: int
    to_node_id: int
    last_seen: datetime
    last_snr: float | None = None
    last_rssi: int | None = None
    source: LinkSourceEnum
    observation_count: int

    model_config = ConfigDict(from_attributes=True)
