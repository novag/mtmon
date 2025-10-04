"""Packet ingestion and processing from MQTT into the database and WebSocket."""

import asyncio
import base64
import json
import traceback
from datetime import UTC, datetime

import aiomqtt
import google.protobuf
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from meshtastic.protobuf import mesh_pb2, mqtt_pb2, portnums_pb2, telemetry_pb2
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tabulate import tabulate

from backend.main import async_session
from backend.models import (
    DirectLink,
    Gateway,
    GatewayNodeLink,
    LinkSourceEnum,
    Node,
    Packet,
    PacketGatewayLink,
)
from backend.schemas import PacketHopSchema, PacketSchema
from backend.ws_connection_handler import WSConnectionManager

PRINT_SERVICE_ENVELOPE = False
AUTO_RECONNECT = True
AUTO_RECONNECT_DELAY = 5
NODENUM_BROADCAST = 0xFFFFFFFF

DEFAULT_KEY_1 = "1PG7OiApB1nwvP+rz05pAQ=="


class PacketHandler:
    """Handle MQTT subscription, packet parsing, persistence and broadcasting."""

    def __init__(
        self,
        mqtt_broker: str,
        mqtt_port: int,
        mqtt_username: str,
        mqtt_password: str,
        ws_manager: WSConnectionManager,
    ) -> None:
        """Initialize the MQTT client and WebSocket manager."""
        self.client = aiomqtt.Client(
            hostname=mqtt_broker,
            port=mqtt_port,
            username=mqtt_username,
            password=mqtt_password,
        )
        self.ws_manager = ws_manager

    async def listen(self, root_topic: str) -> None:
        """Continuously listen to the MQTT broker and process messages."""
        while True:
            try:
                async with self.client:
                    await self.client.subscribe(root_topic + "#")

                    async for message in self.client.messages:
                        async with async_session() as session:
                            try:
                                await self.on_message(session, message)
                            except Exception:
                                print(traceback.format_exc())
            except aiomqtt.MqttError:
                print(f"Connection lost. Reconnecting in {AUTO_RECONNECT_DELAY}s...")
                await asyncio.sleep(AUTO_RECONNECT_DELAY)

    async def on_message(self, session: AsyncSession, msg: aiomqtt.Message) -> None:
        """Parse and process a single MQTT message."""
        seen_at = datetime.now(UTC)

        try:
            se = mqtt_pb2.ServiceEnvelope()
            se.ParseFromString(msg.payload)
            if PRINT_SERVICE_ENVELOPE:
                print("\nService Envelope:")
                print(se)
            mp = se.packet

            gateway_id = int(se.gateway_id.lstrip("!"), 16)
            from_id = getattr(mp, "from")

            is_legacy = mp.hop_start == 0 and mp.hop_limit != 0
            await self.update_node(
                session=session,
                gateway_id=gateway_id,
                node_id=from_id,
                seen_at=seen_at,
                hop_limit=mp.hop_start,
                legacy=is_legacy,
            )

            if mp.hop_limit == mp.hop_start:
                await self.update_node_rx(
                    session=session,
                    gateway_id=gateway_id,
                    node_id=from_id,
                    rssi=mp.rx_rssi,
                    snr=mp.rx_snr,
                    seen_at=seen_at,
                )

            packet_data = PacketSchema(
                id=mp.id,
                first_seen=seen_at,
                from_id=from_id,
                to_id=mp.to,
                want_ack=mp.want_ack,
                via_mqtt=mp.via_mqtt,
                hop_limit=mp.hop_limit,
                hop_start=mp.hop_start,
                port=portnums_pb2.PortNum.Name(mp.decoded.portnum)
                if mp.HasField("decoded")
                else "UNKNOWN",
                payload=mp.decoded.payload.hex(" ") if mp.HasField("decoded") else None,
                hops=[],
            )

            headers = [
                "Gateway",
                "RSSI",
                "SNR",
                "From",
                "To",
                "PacketID",
                "ACK",
                "MQTT",
                "TTL",
                "HopL",
                "Port",
            ]
            rows = [
                [
                    f"{gateway_id:x}",
                    mp.rx_rssi,
                    mp.rx_snr,
                    f"{packet_data.from_id:x}",
                    f"{packet_data.to_id:x}",
                    f"{packet_data.id:x}",
                    "Yes" if packet_data.want_ack else "No",
                    "Yes" if packet_data.via_mqtt else "No",
                    packet_data.hop_limit,
                    packet_data.hop_start,
                    packet_data.port,
                ]
            ]
            print()
            print(tabulate(rows, headers=headers, tablefmt="simple_grid"))
            print()
        except Exception as e:
            print(f"*** ParseFromString: {e!s}")
            print(traceback.format_exc())
            return

        if mp.HasField("encrypted") and not mp.HasField("decoded"):
            self.decode_encrypted(mp=mp)

        if mp.decoded.portnum == portnums_pb2.TEXT_MESSAGE_APP:
            text_payload = mp.decoded.payload.decode("utf-8")
            print(text_payload)
            print()

            packet_data.payload = {
                "message": text_payload,
            }

        elif mp.decoded.portnum == portnums_pb2.NODEINFO_APP:
            info = mesh_pb2.User()
            info.ParseFromString(mp.decoded.payload)

            info_dict = google.protobuf.json_format.MessageToDict(
                info,
                preserving_proto_field_name=True,
            )
            if "macaddr" in info_dict:
                info_dict["macaddr"] = ":".join([f"{b:02x}" for b in info.macaddr])
            if "role" not in info_dict:
                info_dict["role"] = "CLIENT"

            await self.update_nodeinfo(session=session, node_id=from_id, info=info_dict)

            packet_data.payload = info_dict

            self.print_dict(info_dict)

        elif mp.decoded.portnum == portnums_pb2.POSITION_APP:
            position = mesh_pb2.Position()
            position.ParseFromString(mp.decoded.payload)

            position_dict = google.protobuf.json_format.MessageToDict(
                position,
                preserving_proto_field_name=True,
            )
            await self.update_position(
                session=session, node_id=from_id, position=position_dict
            )

            packet_data.payload = position_dict

            self.print_dict(position_dict)

        elif mp.decoded.portnum == portnums_pb2.TELEMETRY_APP:
            telemetry = telemetry_pb2.Telemetry()
            telemetry.ParseFromString(mp.decoded.payload)

            telemetry_dict = google.protobuf.json_format.MessageToDict(
                telemetry,
                preserving_proto_field_name=True,
            )

            if "device_metrics" in telemetry_dict:
                if "air_util_tx" not in telemetry_dict["device_metrics"]:
                    telemetry_dict["device_metrics"]["air_util_tx"] = 0

                if "channel_utilization" not in telemetry_dict["device_metrics"]:
                    telemetry_dict["device_metrics"]["channel_utilization"] = 0

            await self.update_metrics(
                session=session, node_id=from_id, metrics=telemetry_dict
            )

            packet_data.payload = telemetry_dict

            self.print_dict(telemetry_dict)

        elif mp.decoded.portnum == portnums_pb2.NEIGHBORINFO_APP:
            neighbor_info = mesh_pb2.NeighborInfo()
            neighbor_info.ParseFromString(mp.decoded.payload)

            neighbor_info_dict = google.protobuf.json_format.MessageToDict(
                neighbor_info, preserving_proto_field_name=True
            )

            packet_data.payload = neighbor_info_dict
            self.print_dict(neighbor_info_dict)

            for neighbor in neighbor_info.neighbors:
                await self.update_direct_link(
                    session=session,
                    from_id=neighbor.node_id,
                    to_id=from_id,
                    seen_at=seen_at,
                    snr=neighbor.snr,
                    rssi=None,
                    source=LinkSourceEnum.NEIGHBORINFO,
                )

        elif mp.decoded.portnum == portnums_pb2.TRACEROUTE_APP:
            if mp.decoded.payload:
                route_discovery = mesh_pb2.RouteDiscovery()
                route_discovery.ParseFromString(mp.decoded.payload)

                route_dict = google.protobuf.json_format.MessageToDict(
                    route_discovery,
                    preserving_proto_field_name=True,
                )

                packet_data.payload = route_dict
                self.print_dict(route_dict)

                if route_discovery.snr_towards or route_discovery.snr_back:
                    if route_discovery.snr_towards and not route_discovery.snr_back:
                        # Forward path
                        traceroute_initiator = from_id
                        traceroute_target = mp.to
                    else:
                        # Backward path
                        traceroute_initiator = mp.to
                        traceroute_target = from_id

                    # Process forward path (I -> ... -> T)
                    if route_discovery.snr_towards:
                        if route_discovery.route:
                            # First link: I -> route[0]
                            first_hop_id = route_discovery.route[0]
                            if first_hop_id != NODENUM_BROADCAST:
                                await self.update_direct_link(
                                    session=session,
                                    from_id=traceroute_target,
                                    to_id=first_hop_id,
                                    seen_at=seen_at,
                                    snr=route_discovery.snr_towards[0] / 4.0
                                    if route_discovery.snr_towards[0] != -128
                                    else None,
                                    rssi=None,
                                    source=LinkSourceEnum.TRACEROUTE,
                                )

                            # Intermediate links: route[i-1] -> route[i]
                            for i in range(1, len(route_discovery.route)):
                                from_hop_id = route_discovery.route[i - 1]
                                to_hop_id = route_discovery.route[i]
                                if (
                                    from_hop_id == NODENUM_BROADCAST
                                    or to_hop_id == NODENUM_BROADCAST
                                ):
                                    continue

                                if len(route_discovery.snr_towards) <= i:
                                    print("Warning: Invalid SNR data in forward path.")
                                    continue

                                await self.update_direct_link(
                                    session=session,
                                    from_id=from_hop_id,
                                    to_id=to_hop_id,
                                    seen_at=seen_at,
                                    snr=route_discovery.snr_towards[i] / 4.0
                                    if route_discovery.snr_towards[i] != -128
                                    else None,
                                    rssi=None,
                                    source=LinkSourceEnum.TRACEROUTE,
                                )

                            # Last link: route[-1] -> T
                            if (
                                len(route_discovery.snr_towards)
                                == len(route_discovery.route) + 1
                            ):
                                last_hop_id = route_discovery.route[-1]
                                if last_hop_id != NODENUM_BROADCAST:
                                    await self.update_direct_link(
                                        session=session,
                                        from_id=last_hop_id,
                                        to_id=traceroute_target,
                                        seen_at=seen_at,
                                        snr=route_discovery.snr_towards[-1] / 4.0
                                        if route_discovery.snr_towards[-1] != -128
                                        else None,
                                        rssi=None,
                                        source=LinkSourceEnum.TRACEROUTE,
                                    )
                            else:
                                print("Warning: Invalid data in forward path.")
                        else:  # Direct link ( I -> T)
                            await self.update_direct_link(
                                session=session,
                                from_id=traceroute_initiator,
                                to_id=traceroute_target,
                                seen_at=seen_at,
                                snr=route_discovery.snr_towards[0] / 4.0
                                if route_discovery.snr_towards[0] != -128
                                else None,
                                rssi=None,
                                source=LinkSourceEnum.TRACEROUTE,
                            )

                    # Process backward path (T -> ... -> I)
                    if route_discovery.route_back and route_discovery.snr_back:
                        # First link back: T -> route_back[0]
                        first_hop_id = route_discovery.route_back[0]
                        if first_hop_id != NODENUM_BROADCAST:
                            await self.update_direct_link(
                                session=session,
                                from_id=traceroute_target,
                                to_id=first_hop_id,
                                seen_at=seen_at,
                                snr=route_discovery.snr_back[0] / 4.0
                                if route_discovery.snr_back[0] != -128
                                else None,
                                rssi=None,
                                source=LinkSourceEnum.TRACEROUTE,
                            )

                        # Intermediate links back: route_back[i-1] -> route_back[i]
                        for i in range(1, len(route_discovery.route_back)):
                            from_hop_id = route_discovery.route_back[i - 1]
                            to_hop_id = route_discovery.route_back[i]
                            if (
                                from_hop_id == NODENUM_BROADCAST
                                or to_hop_id == NODENUM_BROADCAST
                            ):
                                continue

                            if len(route_discovery.snr_back) <= i:
                                print("Warning: Invalid SNR data in backward path.")
                                continue

                            await self.update_direct_link(
                                session=session,
                                from_id=from_hop_id,
                                to_id=to_hop_id,
                                seen_at=seen_at,
                                snr=route_discovery.snr_back[i] / 4.0
                                if route_discovery.snr_back[i] != -128
                                else None,
                                rssi=None,
                                source=LinkSourceEnum.TRACEROUTE,
                            )

                        # Last link back: route_back[-1] -> I
                        if (
                            len(route_discovery.snr_back)
                            == len(route_discovery.route_back) + 1
                        ):
                            last_hop_id = route_discovery.route_back[-1]
                            if last_hop_id != NODENUM_BROADCAST:
                                await self.update_direct_link(
                                    session=session,
                                    from_id=last_hop_id,
                                    to_id=traceroute_initiator,
                                    seen_at=seen_at,
                                    snr=route_discovery.snr_back[-1] / 4.0
                                    if route_discovery.snr_back[-1] != -128
                                    else None,
                                    rssi=None,
                                    source=LinkSourceEnum.TRACEROUTE,
                                )
                        else:
                            print("Warning: Invalid data in backward path.")

        await self.store_or_update_packet(
            session=session,
            gateway_id=gateway_id,
            packet_id=mp.id,
            from_id=from_id,
            to_id=mp.to,
            length=len(mp.decoded.payload) if mp.HasField("decoded") else -1,
            hop_start=mp.hop_start,
            hop_limit=mp.hop_limit,
            portnum=mp.decoded.portnum if mp.HasField("decoded") else None,
            rssi=mp.rx_rssi,
            snr=mp.rx_snr,
            seen_at=seen_at,
        )

        # Update direct link information if packet was heard directly by gateway
        if mp.hop_limit == mp.hop_start and from_id != gateway_id:
            await self.update_direct_link(
                session=session,
                from_id=from_id,
                to_id=gateway_id,
                seen_at=seen_at,
                snr=mp.rx_snr,
                rssi=mp.rx_rssi,
                source=LinkSourceEnum.GATEWAY,
            )

        await session.commit()

        packet_gateways = await session.execute(
            select(PacketGatewayLink)
            .where(PacketGatewayLink.packet_id == mp.id)
            .where(PacketGatewayLink.from_id == from_id)
            .where(PacketGatewayLink.to_id == mp.to)
            .order_by(PacketGatewayLink.hop_limit.asc())
        )
        packet_data.hops = [
            PacketHopSchema(
                gateway_id=gw.gateway_id,
                seen_at=gw.seen_at,
                hop_limit=gw.hop_limit,
                rssi=gw.rssi,
                snr=gw.snr,
            )
            for gw in packet_gateways.scalars().all()
        ]

        await self.ws_manager.broadcast(gateway_id, packet_data)

    def decode_encrypted(self, mp: mesh_pb2.MeshPacket) -> None:
        """Attempt to decrypt encrypted payload and populate decoded field."""
        try:
            key_bytes = base64.b64decode(DEFAULT_KEY_1.encode("ascii"))

            packet_id = mp.id.to_bytes(8, "little")
            from_node_id = getattr(mp, "from").to_bytes(8, "little")
            nonce = packet_id + from_node_id

            cipher = Cipher(
                algorithms.AES(key_bytes), modes.CTR(nonce), backend=default_backend()
            )
            decryptor = cipher.decryptor()
            decrypted_bytes = decryptor.update(mp.encrypted) + decryptor.finalize()

            data = mesh_pb2.Data()
            data.ParseFromString(decrypted_bytes)
            mp.decoded.CopyFrom(data)
        except Exception:
            print(traceback.format_exc())

    async def update_node(
        self,
        session: AsyncSession,
        gateway_id: int,
        node_id: int,
        seen_at: datetime,
        hop_limit: int,
        *,
        legacy: bool,
    ) -> None:
        """Create or update gateway and node metadata and their association."""
        gateway = await session.get(Gateway, gateway_id)
        if gateway:
            gateway.last_seen = seen_at
        else:
            gateway = Gateway(id=gateway_id, first_seen=seen_at, last_seen=seen_at)
            session.add(gateway)

        node = await session.get(Node, node_id)
        if node:
            node.last_seen = seen_at
            node.hop_limit = hop_limit
        else:
            node = Node(
                id=node_id,
                first_seen=seen_at,
                last_seen=seen_at,
                hop_limit=hop_limit,
            )
            session.add(node)

        # if a node was once marked not legacy, keep it
        if node.legacy:
            node.legacy = legacy

        result = await session.execute(
            select(GatewayNodeLink)
            .where(GatewayNodeLink.gateway_id == gateway_id)
            .where(GatewayNodeLink.node_id == node_id)
        )
        gateway_node_link = result.scalar_one_or_none()

        if not gateway_node_link:
            gateway_node_link = GatewayNodeLink(
                gateway_id=gateway_id,
                node_id=node_id,
                last_seen=seen_at,
            )
            session.add(gateway_node_link)
        else:
            gateway_node_link.last_seen = seen_at

    async def update_node_rx(
        self,
        session: AsyncSession,
        gateway_id: int,
        node_id: int,
        rssi: int,
        snr: float,
        seen_at: datetime,
    ) -> None:
        """Update the latest RSSI/SNR metrics for a gateway->node link."""
        result = await session.execute(
            select(GatewayNodeLink)
            .where(GatewayNodeLink.gateway_id == gateway_id)
            .where(GatewayNodeLink.node_id == node_id)
        )
        gateway_node_link = result.scalar_one_or_none()
        if gateway_node_link:
            gateway_node_link.rssi = rssi
            gateway_node_link.snr = snr
            gateway_node_link.last_seen = seen_at

    async def update_nodeinfo(
        self, session: AsyncSession, node_id: int, info: dict[str, dict]
    ) -> None:
        """Update node info payload (from NODEINFO)."""
        node = await session.get(Node, node_id)
        if node:
            node.info = info

    async def update_position(
        self, session: AsyncSession, node_id: int, position: dict[str, dict]
    ) -> None:
        """Update node position payload."""
        node = await session.get(Node, node_id)
        if node:
            node.position = position

    async def update_metrics(
        self, session: AsyncSession, node_id: int, metrics: dict[str, dict]
    ) -> None:
        """Update node metrics payload (from TELEMETRY)."""
        node = await session.get(Node, node_id)
        if node:
            node.metrics = metrics

    async def update_direct_link(
        self,
        session: AsyncSession,
        from_id: int,
        to_id: int,
        seen_at: datetime,
        snr: float | None,
        rssi: int | None,
        source: LinkSourceEnum,
    ) -> None:
        """Insert or update a record in the DirectLink table."""
        # Ensure both nodes exist before creating a link, creating them if necessary
        from_node = await session.get(Node, from_id)
        if not from_node:
            from_node = Node(
                id=from_id,
                first_seen=seen_at,
                last_seen=seen_at,
                legacy=False,
            )
            session.add(from_node)
            print(f"Info: Created placeholder node {from_id:x}.")

        to_node = await session.get(Node, to_id)
        if not to_node:
            to_node = Node(
                id=to_id,
                first_seen=seen_at,
                last_seen=seen_at,
                legacy=False,
            )
            session.add(to_node)
            print(f"Info: Created placeholder node {to_id:x}.")

        # Prevent self-links
        if from_id == to_id:
            return

        link = await session.get(DirectLink, (from_id, to_id))

        if link:
            link.last_seen = seen_at
            link.last_snr = snr
            link.last_rssi = rssi
            link.source = source
            link.observation_count = DirectLink.observation_count + 1
        else:
            link = DirectLink(
                from_node_id=from_id,
                to_node_id=to_id,
                last_seen=seen_at,
                last_snr=snr,
                last_rssi=rssi,
                source=source,
                observation_count=1,
            )
            session.add(link)

    async def store_or_update_packet(
        self,
        session: AsyncSession,
        gateway_id: int,
        packet_id: int,
        from_id: int,
        to_id: int,
        length: int,
        hop_start: int,
        hop_limit: int,
        portnum: int | None,
        rssi: int,
        snr: float,
        seen_at: datetime,
    ) -> None:
        """Persist packet row and its gateway observation if new for that gateway."""
        packet = await session.get(Packet, (packet_id, from_id, to_id))
        if not packet:
            packet = Packet(
                id=packet_id,
                from_id=from_id,
                to_id=to_id,
                first_seen=seen_at,
                length=length,
                hop_start=hop_start,
                portnum=portnum,
            )
            session.add(packet)

        result = await session.execute(
            select(PacketGatewayLink)
            .where(PacketGatewayLink.packet_id == packet_id)
            .where(PacketGatewayLink.from_id == from_id)
            .where(PacketGatewayLink.to_id == to_id)
            .where(PacketGatewayLink.gateway_id == gateway_id)
        )
        packet_gateway_link = result.scalar_one_or_none()

        if not packet_gateway_link:
            packet_gateway_link = PacketGatewayLink(
                packet_id=packet_id,
                from_id=from_id,
                to_id=to_id,
                gateway_id=gateway_id,
                seen_at=seen_at,
                hop_limit=hop_limit,
                rssi=rssi,
                snr=snr,
            )
            session.add(packet_gateway_link)

            # Increment message count only for non-duplicate packets per gateway
            node = await session.get(Node, from_id)
            if node:
                node.message_count += 1
        else:
            print(
                f"Warning: duplicate packet received: "
                f"packet_id={packet_id:x}, "
                f"gateway_id={gateway_id:x}"
            )

    def print_dict(self, data: dict) -> None:
        """Pretty-print a dict-like payload for debugging."""
        print(json.dumps(data, indent=2))
