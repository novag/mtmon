import axios from "axios";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ReactFlow,
  Node,
  Controls,
  Edge,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import Dagre from "@dagrejs/dagre";

import "@xyflow/react/dist/style.css";
import { useTheme } from "@/components/theme-provider";
import { Packet } from "@/lib/types";
import { getApiUrl } from "@/lib/config";

const nodeWidth = 350;
const nodeHeight = 35;

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB" });

  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  nodes.forEach((node) =>
    g.setNode(node.id, {
      ...node,
      width: node.measured?.width ?? nodeWidth,
      height: node.measured?.height ?? nodeHeight,
    }),
  );

  Dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const position = g.node(node.id);
      const x = position.x - (node.measured?.width ?? nodeWidth) / 2;
      const y = position.y - (node.measured?.height ?? nodeHeight) / 2;

      return { ...node, position: { x, y } };
    }),
    edges,
  };
};

const generateEdges = (packet: Packet) => {
  const sortedHops = packet.hops
    .filter((hop) => hop.gateway_id !== packet.from_id)
    .sort((a, b) => b.hop_limit - a.hop_limit);
  const edges: Edge[] = [];

  const hopStart = packet.hop_start || sortedHops[0].hop_limit;

  const firstHops = sortedHops.filter(
    (hop) => hop.hop_limit === sortedHops[0].hop_limit,
  );
  firstHops.forEach((hop) => {
    edges.push({
      id: `e${packet.from_id}-${hop.gateway_id}`,
      source: packet.from_id.toString(),
      target: hop.gateway_id.toString(),
      label: `Hop 0 ➡ ${hopStart - hop.hop_limit + 1}`,
      labelBgStyle: {
        fill: "hsl(var(--background)) !important",
      },
      animated: true,
    });
  });

  sortedHops.forEach((hop) => {
    const nextHops = sortedHops.filter(
      (nextHop) => nextHop.hop_limit < hop.hop_limit,
    );
    nextHops.forEach((nextHop) => {
      edges.push({
        id: `e${hop.gateway_id}-${nextHop.gateway_id}`,
        source: hop.gateway_id.toString(),
        target: nextHop.gateway_id.toString(),
        label: `Hop ${hopStart - hop.hop_limit + 1} ➡ ${hopStart - nextHop.hop_limit + 1}`,
        labelBgStyle: {
          fill: "hsl(var(--background)) !important",
        },
        animated: true,
      });
    });
  });

  return edges;
};

function PacketPage() {
  const { packetId } = useParams();
  const [packet, setPacket] = useState<Packet>();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const { theme } = useTheme();
  const { fitView } = useReactFlow();

  const fetchPacketGateways = async () => {
    try {
      const response = await axios.get<Packet>(
        getApiUrl(`/packets/${packetId}`),
      );
      setPacket(response.data);
    } catch {
      console.log("Error fetching data");
    }
  };

  useEffect(() => {
    fetchPacketGateways();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packetId]);

  useEffect(() => {
    if (packet) {
      const nodes = [
        {
          id: packet.from_id.toString(),
          data: { label: `!${packet.from_id.toString(16)}` },
          position: { x: 0, y: 0 },
        },
        ...packet.hops.map((gateway) => ({
          id: gateway.gateway_id.toString(),
          data: { label: `!${gateway.gateway_id.toString(16)}` },
          position: { x: 0, y: 0 },
        })),
      ];

      const edges = generateEdges(packet);

      const layouted = getLayoutedElements(nodes, edges);
      setNodes([...layouted.nodes]);
      setEdges([...layouted.edges]);

      window.requestAnimationFrame(() => {
        fitView();
      });
    }
  }, [packet, fitView]);

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex h-16 items-center justify-between px-4 border-b">
        <p className="text-center font-bold">
          Packet {Number(packetId).toString(16)}
        </p>

        <div className="flex flex-col text-right">
          <p>From: !{packet?.from_id?.toString(16)}</p>
          <p>To: !{packet?.to_id?.toString(16)}</p>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodesConnectable={false}
        fitView
        proOptions={{ hideAttribution: true }}
        colorMode={theme}
      >
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default function () {
  return (
    <ReactFlowProvider>
      <PacketPage />
    </ReactFlowProvider>
  );
}
