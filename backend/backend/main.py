"""FastAPI application entrypoint and HTTP/WebSocket endpoints."""

import asyncio
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime, timedelta

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from meshtastic.protobuf import portnums_pb2
from sqlalchemy import and_, func
from sqlalchemy.future import select

from backend.db import async_session, init_db
from backend.models import (
    DirectLink,
    Gateway,
    GatewayNodeLink,
    Node,
    Packet,
    PacketGatewayLink,
)
from backend.packet_handler import PacketHandler
from backend.schemas import DirectLinkSchema, NodeSchema, PacketDbSchema
from backend.ws_connection_handler import WSConnectionManager

# Default settings
MQTT_BROKER = os.environ.get("MQTT_BROKER", "mosquitto")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_USERNAME = os.environ.get("MQTT_USERNAME", "mt")
MQTT_PASSWORD = os.environ.get("MQTT_PASSWORD", "")
ROOT_TOPIC = os.environ.get("ROOT_TOPIC", "msh/EU_868/2/e/LongFast/")

CORS_ALLOW_ORIGINS = os.environ.get("CORS_ALLOW_ORIGINS", "*").split(",")


# Main script
ws_manager = WSConnectionManager()
packet_handler = PacketHandler(
    mqtt_broker=MQTT_BROKER,
    mqtt_port=MQTT_PORT,
    mqtt_username=MQTT_USERNAME,
    mqtt_password=MQTT_PASSWORD,
    ws_manager=ws_manager,
)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan manager to start and stop background tasks."""
    await init_db()
    loop = asyncio.get_event_loop()
    mqtt_task = loop.create_task(packet_handler.listen(root_topic=ROOT_TOPIC))

    yield

    mqtt_task.cancel()
    with suppress(asyncio.CancelledError):
        await mqtt_task


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/gateways")
async def get_gateways(from_date: datetime | None = None) -> list[int]:
    """Return gateway IDs seen since the given date (default 30 days)."""
    if from_date is None:
        from_date = datetime.now() - timedelta(days=30)

    async with async_session() as session:
        result = await session.execute(
            select(Gateway.id).filter(Gateway.last_seen >= from_date)
        )

        return result.scalars().all()


@app.get("/nodes", response_model=list[NodeSchema])
async def get_nodes(
    gateway_id: int | None = None, from_date: datetime | None = None
) -> list[NodeSchema]:
    """Return nodes seen since the given date, optionally filtered by gateway."""
    if from_date is None:
        from_date = datetime.now(UTC) - timedelta(days=7)
    elif from_date.tzinfo is None:
        from_date = from_date.replace(tzinfo=UTC)

    async with async_session() as session:
        now = datetime.now(UTC)
        twenty_four_hours_ago = now - timedelta(hours=24)

        # Subquery to count PacketGatewayLink entries FROM the node in the last 24h
        count_subquery = (
            select(func.count(PacketGatewayLink.packet_id))
            .where(PacketGatewayLink.from_id == Node.id)
            .where(PacketGatewayLink.seen_at >= twenty_four_hours_ago)
            .scalar_subquery()
        )

        if gateway_id:
            gateway = await session.get(Gateway, gateway_id)
            if not gateway:
                raise HTTPException(status_code=404, detail="Gateway not found")

            stmt = (
                select(
                    Node, func.coalesce(count_subquery, 0).label("message_count_24h")
                )
                .join(GatewayNodeLink, Node.id == GatewayNodeLink.node_id)
                .filter(GatewayNodeLink.gateway_id == gateway_id)
                .filter(Node.last_seen >= from_date)
            )
        else:
            stmt = select(
                Node, func.coalesce(count_subquery, 0).label("message_count_24h")
            ).filter(Node.last_seen >= from_date)

        result = await session.execute(stmt)
        nodes_with_count = result.all()

        nodes_data = []
        for node, count_24h in nodes_with_count:
            # Calculate the duration in hours for the average calculation
            # node.first_seen is now guaranteed to be UTC-aware by UtcDateTime
            start_time = max(node.first_seen, twenty_four_hours_ago)
            duration_seconds = (now - start_time).total_seconds()

            avg_rate = 0.0
            # 1 minute minimum duration for meaningful rate
            if duration_seconds > 60:
                duration_hours = duration_seconds / 3600
                avg_rate = round((count_24h / duration_hours), 1)

            # Add both raw count and calculated rate as attributes
            node.message_count_24h = count_24h
            node.avg_msg_per_hour_24h = avg_rate
            nodes_data.append(node)

        return [NodeSchema.model_validate(node) for node in nodes_data]


@app.get("/packets/{packet_id}", response_model=PacketDbSchema)
async def get_packet(packet_id: str) -> PacketDbSchema:
    """Return a packet by ID (hex or int)."""
    try:
        packet_id = int(packet_id, 0)
    except ValueError as e:
        raise HTTPException(status_code=404, detail="Packet not found") from e

    async with async_session() as session:
        result = await session.execute(select(Packet).where(Packet.id == packet_id))
        packet = result.scalars().first()
        if packet is None:
            raise HTTPException(status_code=404, detail="Packet not found")

        # Enrich with derived string port name for convenience
        if packet.portnum is not None:
            packet.port = portnums_pb2.PortNum.Name(packet.portnum)
        else:
            packet.port = "UNKNOWN"

        return PacketDbSchema.model_validate(packet)


@app.get("/nodes/{node_id}/packets", response_model=list[PacketDbSchema])
async def get_node_packets(
    node_id: int,
    filter_mode: str | None = "all",
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> list[PacketDbSchema]:
    """Return packets related to a node, filtered by mode and time range."""
    if start_date is None:
        # Default start_date to the beginning of today
        today = datetime.now()
        start_date = today.replace(hour=0, minute=0, second=0, microsecond=0)

    if end_date is None:
        end_date = datetime.now()

    # Validate date range
    if (end_date - start_date) > timedelta(days=7):
        raise HTTPException(status_code=400, detail="Date range cannot exceed 7 days.")

    async with async_session() as session:
        # Base query with distinct to avoid duplicates when joining
        base_query = select(Packet).distinct()

        time_filters = []
        if start_date:
            time_filters.append(Packet.first_seen >= start_date)
        if end_date:
            time_filters.append(Packet.first_seen <= end_date)

        mode_filter = None
        # Apply filter based on filter_mode
        if filter_mode == "sent_by":
            mode_filter = Packet.from_id == node_id
        elif filter_mode == "sent_to":
            mode_filter = Packet.to_id == node_id
        elif filter_mode == "received":
            # Join is required to filter by gateway reception
            base_query = base_query.join(
                PacketGatewayLink,
                and_(
                    Packet.id == PacketGatewayLink.packet_id,
                    Packet.from_id == PacketGatewayLink.from_id,
                    Packet.to_id == PacketGatewayLink.to_id,
                ),
            )
            mode_filter = PacketGatewayLink.gateway_id == node_id
        else:
            # Default to 'sent_by' if filter_mode is invalid or not provided
            if (
                filter_mode != "sent_by"
                and filter_mode != "sent_to"
                and filter_mode != "received"
            ):
                print(f"Warning: Invalid filter '{filter_mode}', default to 'sent_by'.")
            mode_filter = Packet.from_id == node_id

        # Combine filters and apply ordering
        final_query = base_query.where(and_(*time_filters, mode_filter)).order_by(
            Packet.first_seen.desc()
        )

        result = await session.execute(final_query)
        packets_raw = result.scalars().all()

        # Add the string port name to each packet object before serialization
        for packet in packets_raw:
            port_name = (
                portnums_pb2.PortNum.Name(packet.portnum)
                if packet.portnum is not None
                else "UNKNOWN"
            )
            # Dynamically add the 'port' attribute to the SQLAlchemy object
            packet.port = port_name

        # Return the list of augmented Packet objects
        return [PacketDbSchema.model_validate(p) for p in packets_raw]


@app.get("/stats/portnums")
async def get_portnum_stats(
    node_id: int | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
) -> dict[str, int]:
    """Return counts of packets per port number with optional filters."""
    async with async_session() as session:
        # Identify packets sent by a gateway and only seen by that same gateway
        gateway_self_report_subquery = (
            select(Packet.id)
            .join(
                PacketGatewayLink,
                and_(
                    Packet.id == PacketGatewayLink.packet_id,
                    Packet.from_id == PacketGatewayLink.from_id,
                    Packet.to_id == PacketGatewayLink.to_id,
                ),
            )
            .join(Gateway, Packet.from_id == Gateway.id)  # Check if sender is a gateway
            .group_by(Packet.id, Packet.from_id)
            .having(
                # Only one gateway saw this packet...
                func.count(PacketGatewayLink.gateway_id) == 1,
                # ...and that gateway was the sender
                func.min(PacketGatewayLink.gateway_id) == Packet.from_id,
            )
            .scalar_subquery()
        )

        # Main query for portnum stats
        query = (
            select(Packet.portnum, func.count(Packet.id))
            .filter(
                Packet.id.notin_(gateway_self_report_subquery)
            )  # Exclude self-reported gateway packets
            .group_by(Packet.portnum)
        )

        filters = []
        if node_id is not None:
            filters.append((Packet.from_id == node_id) | (Packet.to_id == node_id))
        if start_time is not None:
            filters.append(Packet.first_seen >= start_time)
        if end_time is not None:
            filters.append(Packet.first_seen <= end_time)

        if filters:
            query = query.where(and_(*filters))

        result = await session.execute(query)
        stats = result.all()

        # Convert port numbers to names
        portnum_stats = {}
        for portnum, count in stats:
            port_name = (
                portnums_pb2.PortNum.Name(portnum) if portnum is not None else "UNKNOWN"
            )
            portnum_stats[port_name] = count

        return portnum_stats


@app.get("/stats/nodes")
async def get_noisy_nodes_stats(
    portnum: str | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
) -> list[dict[str, int]]:
    """Return top nodes by packet count with optional filters."""
    async with async_session() as session:
        # Identify packets sent by a gateway and only seen by that same gateway
        # Subquery for this function's scope
        gateway_self_report_subquery = (
            select(Packet.id)
            .join(
                PacketGatewayLink,
                and_(
                    Packet.id == PacketGatewayLink.packet_id,
                    Packet.from_id == PacketGatewayLink.from_id,
                    Packet.to_id == PacketGatewayLink.to_id,
                ),
            )
            .join(Gateway, Packet.from_id == Gateway.id)  # Check if sender is a gateway
            .group_by(Packet.id, Packet.from_id)
            .having(
                # Only one gateway saw this packet...
                func.count(PacketGatewayLink.gateway_id) == 1,
                # ...and that gateway was the sender
                func.min(PacketGatewayLink.gateway_id) == Packet.from_id,
            )
            .scalar_subquery()
        )

        # Select source node ID and count packets, excluding self-reported packets
        query = (
            select(Packet.from_id, func.count(Packet.id))
            .filter(
                Packet.id.notin_(gateway_self_report_subquery)
            )  # Exclude self-reported gateway packets
            .group_by(Packet.from_id)
            .order_by(func.count(Packet.id).desc())
            .limit(15)  # Limit to top 15 nodes
        )

        filters = []
        # Filter by portnum if provided and valid
        if portnum is not None and portnum != "UNKNOWN":
            try:
                # Convert port name string back to integer value for DB query
                portnum_val = portnums_pb2.PortNum.Value(portnum)
                filters.append(Packet.portnum == portnum_val)
            except ValueError:
                # Ignore invalid portnum filter
                print(
                    f"Warning: Invalid portnum '{portnum}' received, ignoring filter."
                )
        elif portnum == "UNKNOWN":
            filters.append(Packet.portnum is None)  # Filter for null portnum

        # Filter by time range
        if start_time is not None:
            filters.append(Packet.first_seen >= start_time)
        if end_time is not None:
            filters.append(Packet.first_seen <= end_time)

        if filters:
            query = query.where(and_(*filters))

        result = await session.execute(query)
        stats = result.all()

        node_stats = [{"nodeId": node_id, "count": count} for node_id, count in stats]

        return node_stats


@app.get("/nodes/{node_id}/direct_nodes", response_model=list[NodeSchema])
async def get_node_direct_nodes(node_id: int) -> list[NodeSchema]:
    """Return neighbor nodes directly linked to the given node in last 24h."""
    twenty_four_hours_ago = datetime.now(UTC) - timedelta(hours=24)

    async with async_session() as session:
        # Check if the node_id exists at all
        node_exists = await session.get(Node, node_id)
        if not node_exists:
            raise HTTPException(status_code=404, detail="Node not found")

        # Query DirectLink table for links involving the node_id in the last 24h
        query = select(DirectLink).where(
            (DirectLink.from_node_id == node_id) | (DirectLink.to_node_id == node_id),
            DirectLink.last_seen >= twenty_four_hours_ago,
        )
        result = await session.execute(query)
        links = result.scalars().all()

        if not links:
            return []

        # Collect neighbor IDs and store link data mapped by neighbor ID
        neighbor_ids = set()
        links_by_neighbor = {}
        for link in links:
            neighbor_id = (
                link.to_node_id if link.from_node_id == node_id else link.from_node_id
            )
            neighbor_ids.add(neighbor_id)
            if neighbor_id not in links_by_neighbor:
                links_by_neighbor[neighbor_id] = []
            links_by_neighbor[neighbor_id].append(link)

        # Fetch neighbor node details
        nodes_query = select(Node).where(Node.id.in_(neighbor_ids))
        result = await session.execute(nodes_query)
        neighbor_nodes_list = result.scalars().unique().all()

        # Augment neighbor nodes with link quality data
        augmented_nodes = []
        for neighbor_node in neighbor_nodes_list:
            relevant_links = links_by_neighbor.get(neighbor_node.id, [])

            # Prioritize link TO the requested node_id if available
            link_to_node = next(
                (link for link in relevant_links if link.to_node_id == node_id),
                None,
            )

            selected_link = link_to_node or (
                relevant_links[0] if relevant_links else None
            )

            if selected_link:
                # Add link quality metrics directly to the node object
                neighbor_node.last_snr = selected_link.last_snr
                neighbor_node.last_rssi = selected_link.last_rssi
                neighbor_node.last_seen_direct = selected_link.last_seen
                # Determine and add link direction
                if selected_link.from_node_id == node_id:
                    neighbor_node.direction = "outgoing"
                elif selected_link.to_node_id == node_id:
                    neighbor_node.direction = "incoming"
                else:
                    # This case should ideally not happen based on query logic
                    neighbor_node.direction = "unknown"
            else:
                # Should not happen if links_by_neighbor was populated correctly
                neighbor_node.last_snr = None
                neighbor_node.last_rssi = None
                neighbor_node.last_seen_direct = None
                neighbor_node.direction = None  # Or 'unknown'

            augmented_nodes.append(neighbor_node)

        # Sort by last seen time (descending) from the DirectLink table
        # Need to fetch last_seen from the selected link for sorting
        def get_sort_key(node: Node) -> datetime:
            # Access the attribute we added earlier
            return (
                node.last_seen_direct
                if node.last_seen_direct
                else datetime.min.replace(tzinfo=UTC)
            )

        augmented_nodes.sort(key=get_sort_key, reverse=True)

        return [NodeSchema.model_validate(node) for node in augmented_nodes]


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket, gateway_id: int | None = None
) -> None:
    """Handle websocket connections and forward real-time packets."""
    gateway_str = f"{gateway_id:x}" if gateway_id else "*"

    await ws_manager.connect(websocket, gateway_str)

    try:
        while True:
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, gateway_str)


@app.get("/links/direct", response_model=list[DirectLinkSchema])
async def get_direct_links() -> list[DirectLinkSchema]:
    """Return directed links observed within the last 24 hours."""
    twenty_four_hours_ago = datetime.now(UTC) - timedelta(hours=24)

    async with async_session() as session:
        # Query the DirectLink table for links seen recently
        query = select(DirectLink).where(DirectLink.last_seen >= twenty_four_hours_ago)

        result = await session.execute(query)
        links_raw = result.scalars().all()

    return [DirectLinkSchema.model_validate(link) for link in links_raw]
