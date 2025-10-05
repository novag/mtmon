"""SQLAlchemy models for the backend database schema."""

import enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
)
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy_utils import force_instant_defaults

from backend.sa_types import UtcDateTime

force_instant_defaults()


# Define the Enum for link sources
class LinkSourceEnum(enum.Enum):
    """Enumerate the sources from which a link observation may originate."""

    GATEWAY = "gateway"
    TRACEROUTE = "traceroute"
    NEIGHBORINFO = "neighborinfo"


Base = declarative_base()


class GatewayNodeLink(Base):
    """Association table linking gateways to nodes with last seen and signal."""

    __tablename__ = "gateway_node_links"

    gateway_id = Column(Integer, ForeignKey("gateways.id"), primary_key=True)
    node_id = Column(Integer, ForeignKey("nodes.id"), primary_key=True)
    last_seen = Column(UtcDateTime)
    rssi = Column(Integer, nullable=True)
    snr = Column(Float, nullable=True)

    gateway = relationship("Gateway", back_populates="nodes")
    node = relationship("Node", back_populates="gateways")


class PacketGatewayLink(Base):
    """Association table linking packets to gateways that observed them."""

    __tablename__ = "packet_gateway_links"

    packet_id = Column(Integer, primary_key=True)
    from_id = Column(Integer, primary_key=True)
    to_id = Column(Integer, primary_key=True)
    relay_node = Column(Integer, nullable=True)
    gateway_id = Column(Integer, ForeignKey("gateways.id"), primary_key=True)

    __table_args__ = (
        ForeignKeyConstraint(
            ["packet_id", "from_id", "to_id"],
            ["packets.id", "packets.from_id", "packets.to_id"],
        ),
    )

    seen_at = Column(UtcDateTime, index=True)
    hop_limit = Column(Integer)
    rssi = Column(Integer)
    snr = Column(Float)


class Gateway(Base):
    """Gateway device that participates in the mesh network."""

    __tablename__ = "gateways"

    id = Column(Integer, primary_key=True, index=True)
    first_seen = Column(UtcDateTime)
    last_seen = Column(UtcDateTime, index=True)

    nodes = relationship(GatewayNodeLink, back_populates="gateway")
    packets = relationship(PacketGatewayLink)


class Node(Base):
    """Node in the mesh network (non-gateway or gateway)."""

    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    first_seen = Column(UtcDateTime)
    last_seen = Column(UtcDateTime, index=True)
    hop_limit = Column(Integer, nullable=True)
    message_count = Column(Integer, default=0)
    legacy = Column(Boolean, default=False)
    position = Column(JSON, nullable=True)
    metrics = Column(JSON, nullable=True)
    info = Column(JSON, nullable=True)

    gateways = relationship(GatewayNodeLink, back_populates="node", lazy="selectin")


class Packet(Base):
    """Packet transmitted through the mesh network."""

    __tablename__ = "packets"

    id = Column(Integer, primary_key=True, index=True)
    from_id = Column(Integer, primary_key=True, index=True)
    to_id = Column(Integer, primary_key=True, index=True)
    first_seen = Column(UtcDateTime, index=True)
    length = Column(Integer)
    hop_start = Column(Integer)
    portnum = Column(Integer, nullable=True, index=True)

    hops = relationship(
        PacketGatewayLink,
        foreign_keys=[
            PacketGatewayLink.packet_id,
            PacketGatewayLink.from_id,
            PacketGatewayLink.to_id,
        ],
        order_by=PacketGatewayLink.hop_limit.asc(),
        lazy="selectin",
    )


class DirectLink(Base):
    """Directed link observation between two nodes with last seen metrics."""

    __tablename__ = "direct_links"

    from_node_id = Column(Integer, ForeignKey("nodes.id"), primary_key=True)
    to_node_id = Column(Integer, ForeignKey("nodes.id"), primary_key=True)
    last_seen = Column(UtcDateTime, index=True)
    last_snr = Column(Float, nullable=True)
    last_rssi = Column(Integer, nullable=True)
    source = Column(SQLAlchemyEnum(LinkSourceEnum), nullable=False)
    observation_count = Column(Integer, default=1)

    from_node = relationship(
        "Node", foreign_keys=[from_node_id], backref="outgoing_links"
    )
    to_node = relationship("Node", foreign_keys=[to_node_id], backref="incoming_links")
