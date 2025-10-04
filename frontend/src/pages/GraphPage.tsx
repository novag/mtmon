import { useState, useEffect, useMemo, useContext, useRef } from "react";
import ForceGraph2D, {
  NodeObject,
  LinkObject,
  ForceGraphMethods,
} from "react-force-graph-2d";
import * as dagre from "@dagrejs/dagre";
import axios from "axios";
import { StateContext } from "@/providers/StateProvider";
import { MeshtasticNode } from "@/lib/types";
import { getApiUrl } from "@/lib/config";
import { DirectLinkData, ProcessedLink, getLinkColor } from "@/lib/linkUtils";
import { formatDistanceToNow } from "date-fns";
import { formatDate } from "@/lib/utils/formatters";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/theme-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { convertMeshtasticPosition } from "@/lib/utils";
import { MapPin, Loader2 } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { NodeInfoPanel } from "@/components/NodeInfoPanel";
import { useLocation, useNavigate } from "react-router-dom";

interface GraphNode extends NodeObject {
  id: number;
  name: string;
  long_name?: string;
  hw_model?: string;
  last_seen?: string;
  has_pos: boolean;
  x?: number;
  y?: number;
  originalNode?: MeshtasticNode;
}

interface GraphLink extends LinkObject {
  source: number | string | GraphNode;
  target: number | string | GraphNode;
  color: string;
  originalLink?: ProcessedLink;
}

interface AugmentedMeshtasticNode extends MeshtasticNode {
  last_snr?: number | null;
  last_rssi?: number | null;
  last_seen_direct?: string;
  direction?: string;
}

const runDagreLayout = (graphData: {
  nodes: GraphNode[];
  links: GraphLink[];
}) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setGraph({
    rankdir: "LR",
    align: "UL",
    ranker: "network-simplex",
    nodesep: 80,
    edgesep: 40,
    ranksep: 180,
    marginx: 20,
    marginy: 20,
  });
  dagreGraph.setDefaultNodeLabel(() => ({}));
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  graphData.nodes.forEach((node) => {
    dagreGraph.setNode(node.id.toString(), { width: 30, height: 30 });
  });

  graphData.links.forEach((link) => {
    const sourceId =
      typeof link.source === "object"
        ? link.source.id.toString()
        : link.source.toString();
    const targetId =
      typeof link.target === "object"
        ? link.target.id.toString()
        : link.target.toString();
    if (dagreGraph.hasNode(sourceId) && dagreGraph.hasNode(targetId)) {
      dagreGraph.setEdge(sourceId, targetId);
    } else {
      console.warn(
        "Skipping edge for missing node in Dagre:",
        sourceId,
        targetId,
      );
    }
  });

  try {
    dagre.layout(dagreGraph);

    graphData.nodes.forEach((node) => {
      const dagreNode = dagreGraph.node(node.id.toString());
      if (dagreNode) {
        node.x = dagreNode.x;
        node.y = dagreNode.y;
      }
    });
  } catch (error) {
    console.error("Dagre layout failed:", error);
  }

  return graphData;
};

function formatLinkDetails(
  link: GraphLink,
): { title: string; content: React.ReactNode } | null {
  const originalLink = link.originalLink;
  if (!originalLink) return null;

  const sourceNode = typeof link.source === "object" ? link.source : null;
  const targetNode = typeof link.target === "object" ? link.target : null;

  const sourceName =
    sourceNode?.name ||
    `!${typeof link.source === "number" ? link.source.toString(16) : "unknown"}`;
  const targetName =
    targetNode?.name ||
    `!${typeof link.target === "number" ? link.target.toString(16) : "unknown"}`;

  let title = "";
  let detailsContent: React.ReactNode = null;

  if (originalLink.direction === "bidirectional") {
    title = `Link: ${sourceName} ↔ ${targetName}`;

    const link1 = originalLink.link1;
    const link2 = originalLink.link2;

    const formatMetric = (
      value: number | null | undefined,
      precision: number = 0,
      unit: string = "",
    ) => {
      return value !== null && value !== undefined
        ? `${value.toFixed(precision)}${unit}`
        : "N/A";
    };
    const formatLastSeen = (dateString?: string) => {
      if (!dateString) return "N/A";
      const date = new Date(dateString);
      const relativeTime = formatDistanceToNow(date, { addSuffix: true });
      const exactTime = formatDate(date);
      return `<span title="${exactTime}">${relativeTime}</span>`;
    };
    const formatObs = (count?: number) => {
      return count !== null && count !== undefined ? `${count} obs` : "N/A";
    };
    const formatSource = (source?: string) => source || "N/A";

    detailsContent = (
      <div className="space-y-1.5">
        <div className="grid grid-cols-[auto,1fr,1fr] gap-x-4 items-center">
          <span className="font-medium text-right">Metric</span>
          <span className="font-medium text-left">
            {sourceName} → {targetName}
          </span>
          <span className="font-medium text-left">
            {targetName} → {sourceName}
          </span>

          {/* SNR */}
          <span className="text-muted-foreground text-right">SNR</span>
          <span className="text-left">
            {formatMetric(link1?.last_snr, 2, " dB")}
          </span>
          <span className="text-left">
            {formatMetric(link2?.last_snr, 2, " dB")}
          </span>

          {/* RSSI */}
          <span className="text-muted-foreground text-right">RSSI</span>
          <span className="text-left">
            {formatMetric(link1?.last_rssi, 0, " dBm")}
          </span>
          <span className="text-left">
            {formatMetric(link2?.last_rssi, 0, " dBm")}
          </span>

          {/* Observations */}
          <span className="text-muted-foreground text-right">Obs</span>
          <span className="text-left">
            {formatObs(link1?.observation_count)}
          </span>
          <span className="text-left">
            {formatObs(link2?.observation_count)}
          </span>

          {/* Last Seen */}
          <span className="text-muted-foreground text-right">Last Seen</span>
          <span className="text-left">{formatLastSeen(link1?.last_seen)}</span>
          <span className="text-left">{formatLastSeen(link2?.last_seen)}</span>

          {/* Source */}
          <span className="text-muted-foreground text-right">Source</span>
          <span className="text-left">{formatSource(link1?.source)}</span>
          <span className="text-left">{formatSource(link2?.source)}</span>
        </div>
      </div>
    );
  } else {
    // Unidirectional link
    title = `Link: ${sourceName} → ${targetName}`;
    const unidirectionalLink = originalLink.link1 || originalLink.link2;
    if (unidirectionalLink) {
      detailsContent = (
        <div key="uni-details" className="space-y-1">
          {unidirectionalLink.last_snr !== null &&
            unidirectionalLink.last_snr !== undefined && (
              <p>
                <span className="font-medium">Last SNR:</span>{" "}
                {unidirectionalLink.last_snr.toFixed(2)} dB
              </p>
            )}
          {unidirectionalLink.last_rssi !== null &&
            unidirectionalLink.last_rssi !== undefined && (
              <p>
                <span className="font-medium">Last RSSI:</span>{" "}
                {unidirectionalLink.last_rssi.toFixed(0)} dBm
              </p>
            )}
          <p>
            <span className="font-medium">Observations:</span>{" "}
            {unidirectionalLink.observation_count}
          </p>
          <p>
            <span className="font-medium">Last Seen:</span>{" "}
            <span title={formatDate(new Date(unidirectionalLink.last_seen))}>
              {formatDistanceToNow(new Date(unidirectionalLink.last_seen), {
                addSuffix: true,
              })}
            </span>
          </p>
          <p>
            <span className="font-medium">Source:</span>{" "}
            {unidirectionalLink.source}
          </p>
        </div>
      );
    }
  }

  // Construct byline URL if positions exist
  let bylineLinkElement: React.ReactNode = null;
  if (originalLink.pos1 && originalLink.pos2) {
    let bylineUrl = `https://byline.9tb.de/?startLat=${originalLink.pos1[0]}&startLng=${originalLink.pos1[1]}`;
    bylineUrl += `&endLat=${originalLink.pos2[0]}&endLng=${originalLink.pos2[1]}`;
    bylineLinkElement = (
      <a
        href={bylineUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline block pt-3 text-sm"
      >
        View on byline
      </a>
    );
  }

  return {
    title,
    content: (
      <>
        <div className="py-3 text-sm">{detailsContent}</div>
        {bylineLinkElement}
      </>
    ),
  };
}

export default function GraphPage() {
  const [nodes, setNodes] = useState<MeshtasticNode[]>([]);
  const [directLinks, setDirectLinks] = useState<DirectLinkData[]>([]);
  const [graphDimensions, setGraphDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);
  const [pinIconImage, setPinIconImage] = useState<HTMLImageElement | null>(
    null,
  );
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isLoadingDirectLinks, setIsLoadingDirectLinks] = useState(false);
  const [positionedGraphData, setPositionedGraphData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  } | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [directNodeCount, setDirectNodeCount] = useState<number | null>(null);
  const [initialNodeSelection, setInitialNodeSelection] = useState(false);
  const [isLoadingNodes, setIsLoadingNodes] = useState(false);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [isCalculatingLayout, setIsCalculatingLayout] = useState(false);

  const userClearedSelection = useRef(false);
  const hashUpdateFromUserClick = useRef(false);

  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<
    | ForceGraphMethods<NodeObject<GraphNode>, LinkObject<GraphNode, GraphLink>>
    | undefined
  >(undefined);

  const location = useLocation();
  const navigate = useNavigate();

  const context = useContext(StateContext);
  const { currentGatewayId } = context!;
  const { theme } = useTheme();

  const fetchNodes = async () => {
    setIsLoadingNodes(true);
    try {
      const gatewayParam = currentGatewayId
        ? `gateway_id=${currentGatewayId}`
        : "";

      // Fetch nodes seen in the last 48 hours
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const dateParam = `from_date=${fortyEightHoursAgo.toISOString()}`;

      const queryString = [gatewayParam, dateParam]
        .filter((p) => p) // Remove empty strings
        .join("&");

      const url = getApiUrl(`/nodes${queryString ? `?${queryString}` : ""}`);

      const response = await axios.get<MeshtasticNode[]>(url);
      setNodes(response.data);
    } catch (error) {
      console.error("Error fetching nodes for graph:", error);
    } finally {
      setIsLoadingNodes(false);
    }
  };

  const fetchDirectLinks = async () => {
    setIsLoadingLinks(true);
    try {
      const response = await axios.get<DirectLinkData[]>(
        getApiUrl(`/links/direct`),
      );
      setDirectLinks(response.data);
    } catch (error) {
      console.error("Error fetching direct links for graph:", error);
    } finally {
      setIsLoadingLinks(false);
    }
  };

  useEffect(() => {
    fetchNodes();
    fetchDirectLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGatewayId]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (graphContainerRef.current) {
        setGraphDimensions({
          width: graphContainerRef.current.offsetWidth,
          height: graphContainerRef.current.offsetHeight,
        });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const iconSize = 16;
    const iconColor = "#334155"; // slate-700

    const svgString = renderToStaticMarkup(
      <MapPin
        color={iconColor}
        size={iconSize}
        fill={iconColor}
        strokeWidth={1}
      />,
    );

    const svgBase64 = btoa(svgString);
    const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

    const img = new Image();
    img.onload = () => {
      setPinIconImage(img);
    };
    img.onerror = (error) => {
      console.error("Error loading pin icon image:", error);
    };
    img.src = dataUrl;
  }, []);

  const fetchSelectedNodeDirectLinks = async (nodeId: number) => {
    setIsLoadingDirectLinks(true);
    setDirectNodeCount(null);
    try {
      const response = await axios.get<AugmentedMeshtasticNode[]>(
        getApiUrl(`/nodes/${nodeId}/direct_nodes`),
      );
      if (response.data) {
        // Sort by last seen direct, most recent first
        const sortedLinks = [...response.data].sort((a, b) => {
          const dateA = a.last_seen_direct
            ? new Date(a.last_seen_direct).getTime()
            : 0;
          const dateB = b.last_seen_direct
            ? new Date(b.last_seen_direct).getTime()
            : 0;
          return dateB - dateA; // Descending order
        });
        setDirectNodeCount(sortedLinks.length);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log(`No direct links found for node ${nodeId.toString(16)}`);
        setDirectNodeCount(0);
      } else {
        console.error("Error fetching direct links for selected node:", error);
        setDirectNodeCount(-1);
      }
    } finally {
      setIsLoadingDirectLinks(false);
    }
  };

  const processedLinks = useMemo(() => {
    const linksMap = new Map<string, ProcessedLink>();
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    directLinks.forEach((link) => {
      const node1 = nodeMap.get(link.from_node_id);
      const node2 = nodeMap.get(link.to_node_id);

      if (!node1 || !node2) return;

      const pos1 = convertMeshtasticPosition(
        node1.position?.latitude_i,
        node1.position?.longitude_i,
      );
      const pos2 = convertMeshtasticPosition(
        node2.position?.latitude_i,
        node2.position?.longitude_i,
      );

      // Create a consistent key for the node pair (lowest ID first)
      const id1 = Math.min(link.from_node_id, link.to_node_id);
      const id2 = Math.max(link.from_node_id, link.to_node_id);
      const pairKey = `${id1}-${id2}`;

      const isAtoB = link.from_node_id === id1;

      if (!linksMap.has(pairKey)) {
        // First time seeing this pair
        linksMap.set(pairKey, {
          node1_id: id1,
          node2_id: id2,
          pos1: isAtoB ? pos1 : pos2,
          pos2: isAtoB ? pos2 : pos1,
          direction: isAtoB ? "AtoB" : "BtoA",
          link1: isAtoB ? link : undefined,
          link2: !isAtoB ? link : undefined,
        });
      } else {
        // Second time seeing this pair (opposite direction)
        const existing = linksMap.get(pairKey)!;
        existing.direction = "bidirectional"; // Mark as bidirectional
        if (isAtoB) {
          existing.link1 = link;
          existing.pos1 = pos1;
          existing.pos2 = pos2;
        } else {
          existing.link2 = link;
          // Keep pos1/pos2 consistent with id1/id2
          existing.pos1 = pos2;
          existing.pos2 = pos1;
        }
      }
    });

    return Array.from(linksMap.values());
  }, [directLinks, nodes]);

  const initialGraphData = useMemo(() => {
    const graphNodes: GraphNode[] = nodes.map((node) => {
      const lastSeenDate = node.gateways
        ?.map((gateway) => new Date(gateway.last_seen))
        ?.reduce(
          (latest, current) => (current > latest ? current : latest),
          new Date(0),
        );

      return {
        id: node.id,
        name: node.info?.short_name || `!${node.id.toString(16)}`,
        long_name: node.info?.long_name,
        hw_model: node.info?.hw_model,
        last_seen:
          lastSeenDate && lastSeenDate.getTime() > 0
            ? formatDistanceToNow(lastSeenDate, { addSuffix: true })
            : "Never",
        has_pos: !!(node.position?.latitude_i && node.position?.longitude_i),
        originalNode: node,
        // x, y will be set by Dagre later
      };
    });

    const graphLinks: GraphLink[] = processedLinks.map((link) => {
      const isBtoA = link.direction === "BtoA";
      return {
        source: isBtoA ? link.node2_id : link.node1_id,
        target: isBtoA ? link.node1_id : link.node2_id,
        color: getLinkColor(link),
        originalLink: link,
      };
    });

    const nodeIds = new Set(graphNodes.map((n) => n.id));
    const filteredLinks = graphLinks.filter(
      (link) =>
        nodeIds.has(link.source as number) &&
        nodeIds.has(link.target as number),
    );

    const connectedNodeIds = new Set<number>();
    filteredLinks.forEach((link) => {
      connectedNodeIds.add(link.source as number);
      connectedNodeIds.add(link.target as number);
    });

    const filteredNodes = graphNodes.filter((node) =>
      connectedNodeIds.has(node.id),
    );

    // Also filter links again to ensure both source and target are in the final filteredNodes list
    const finalNodeIds = new Set(filteredNodes.map((n) => n.id));
    const finalFilteredLinks = filteredLinks.filter(
      (link) =>
        finalNodeIds.has(link.source as number) &&
        finalNodeIds.has(link.target as number),
    );

    return { nodes: filteredNodes, links: finalFilteredLinks };
  }, [nodes, processedLinks]);

  // Parse node ID from hash on component mount
  useEffect(() => {
    // Don't process if user explicitly cleared selection
    if (userClearedSelection.current) return;

    const hash = location.hash;
    if (hash.startsWith("#node=")) {
      const nodeIdHex = hash.substring(6);
      try {
        const nodeId = parseInt(nodeIdHex, 16);
        if (!isNaN(nodeId)) {
          const nodeData =
            positionedGraphData?.nodes || initialGraphData?.nodes;
          if (nodeData && nodeData.length > 0) {
            const nodeToSelect = nodeData.find((n) => n.id === nodeId);
            if (nodeToSelect) {
              setSelectedNode(nodeToSelect);
              // Only zoom if hash change wasn't triggered by a click
              if (!hashUpdateFromUserClick.current) {
                setInitialNodeSelection(true);
              } else {
                setInitialNodeSelection(false);
              }
              setInfoPanelOpen(true);
              fetchSelectedNodeDirectLinks(nodeId);
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse node ID from URL hash:", e);
      }
    }
    hashUpdateFromUserClick.current = false;
  }, [location.hash, positionedGraphData, initialGraphData, nodes]);

  useEffect(() => {
    if (selectedNode !== null) {
      const nodeIdHex = selectedNode.id.toString(16);
      navigate({ hash: `node=${nodeIdHex}` }, { replace: true });
      userClearedSelection.current = false;
    } else if (location.hash && userClearedSelection.current) {
      navigate({ hash: "" }, { replace: true });
    }
  }, [selectedNode, navigate, location.hash]);

  const getNodeId = (nodeRef: number | string | GraphNode): number | null => {
    if (typeof nodeRef === "number") {
      return nodeRef;
    }
    if (typeof nodeRef === "object" && nodeRef !== null && "id" in nodeRef) {
      return nodeRef.id as number;
    }
    if (typeof nodeRef === "string") {
      const parsedId = parseInt(nodeRef, 10);
      return !isNaN(parsedId) ? parsedId : null;
    }
    console.warn("Could not get node ID from:", nodeRef);
    return null;
  };

  // Apply Dagre layout once data and dimensions are ready
  useEffect(() => {
    if (
      initialGraphData.nodes.length > 0 &&
      graphDimensions.width > 0 &&
      graphDimensions.height > 0
    ) {
      console.log("Applying Dagre layout...");
      setIsCalculatingLayout(true);
      // Create a deep copy to avoid modifying the memoized value directly
      const dataToLayout = {
        nodes: initialGraphData.nodes.map((n) => ({ ...n })),
        links: initialGraphData.links.map((l) => ({
          ...l,
          source: l.source,
          target: l.target,
        })),
      };
      const layoutResult = runDagreLayout(dataToLayout);
      setPositionedGraphData(layoutResult);
      setIsCalculatingLayout(false);
    } else {
      console.log("Skipping Dagre layout (no nodes or dimensions).");
      // Reset if data or dimensions are gone/invalid
      setPositionedGraphData(null);
    }
  }, [initialGraphData, graphDimensions]);

  // Configure D3 forces once the graph component is mounted
  useEffect(() => {
    const fg = graphRef.current;
    if (fg) {
      console.log("Configuring D3 forces...");
      // Give simulation time to stabilise Dagre layout before applying strong forces
      fg.d3Force("link")?.distance(60).strength(0.3);
      fg.d3Force("charge")?.strength(-200).distanceMax(300); // Slightly stronger repulsion, limited range
      fg.d3Force("center")?.strength(0.01); // Very weak center force initially
      // Remove X/Y forces to let Dagre dominate initial layout
      fg.d3Force("x", null);
      fg.d3Force("y", null);
    }
  }, []);

  // Zoom to fit after layout is applied
  useEffect(() => {
    const fg = graphRef.current;
    if (fg && positionedGraphData && positionedGraphData.nodes.length > 0) {
      const timer = setTimeout(() => {
        console.log("Zooming to fit graph...");
        fg.zoomToFit(400, 20);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [positionedGraphData]);

  // Filter nodes based on search term for highlighting
  const highlightedNodes = useMemo(() => {
    if (!searchTerm) {
      return new Set<number>();
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    const nodesToSearch =
      positionedGraphData?.nodes ?? initialGraphData.nodes ?? [];
    return new Set(
      nodesToSearch
        .filter(
          (node) =>
            node.name?.toLowerCase().includes(lowerSearchTerm) ||
            node.long_name?.toLowerCase().includes(lowerSearchTerm),
        )
        .map((node) => node.id),
    );
  }, [searchTerm, positionedGraphData, initialGraphData]);

  const finalGraphData = useMemo(() => {
    return positionedGraphData ?? { nodes: [], links: [] };
  }, [positionedGraphData]);

  const toggleInfoPanel = () => {
    setInfoPanelOpen(!infoPanelOpen);
  };

  const selectedMeshtasticNode = useMemo(() => {
    if (!selectedNode) return null;
    return nodes.find((node) => node.id === selectedNode.id) || null;
  }, [selectedNode, nodes]);

  // Zoom to the selected node when initialNodeSelection is true
  useEffect(() => {
    if (
      initialNodeSelection &&
      selectedNode &&
      graphRef.current &&
      positionedGraphData
    ) {
      const zoomTimeout = setTimeout(() => {
        const node = positionedGraphData.nodes.find(
          (n) => n.id === selectedNode.id,
        );

        if (node && typeof node.x === "number" && typeof node.y === "number") {
          console.log(
            `Zooming to node ${node.id.toString(16)} at position (${node.x}, ${node.y})`,
          );

          graphRef.current?.centerAt(node.x, node.y, 1000);
          graphRef.current?.zoom(3, 800);

          setInitialNodeSelection(false);
        } else {
          console.warn(
            "Cannot zoom to node - invalid position data or node not found",
          );
          if (positionedGraphData.nodes.length > 0) {
            setInitialNodeSelection(false);
          }
        }
      }, 800);

      return () => clearTimeout(zoomTimeout);
    }
  }, [initialNodeSelection, selectedNode, positionedGraphData]);

  const handleNodeClick = (node: GraphNode) => {
    const fullNodeData = (
      positionedGraphData?.nodes ?? initialGraphData.nodes
    )?.find((n) => n.id === node.id);
    if (fullNodeData) {
      // Mark that this hash update is from a user click
      hashUpdateFromUserClick.current = true;
      setSelectedNode(fullNodeData);
      setSelectedLink(null);
      fetchSelectedNodeDirectLinks(fullNodeData.id);
      setInfoPanelOpen(true);
      setInitialNodeSelection(false);
    } else {
      console.warn("Clicked node data not found:", node.id);
      setSelectedNode(null);
      setSelectedLink(null);
    }
  };

  const handleBackgroundClick = () => {
    if (selectedNode !== null || selectedLink !== null) {
      userClearedSelection.current = true;
    }
    setSelectedLink(null);
    setSelectedNode(null);
  };

  // Get nodes connected to the selected node
  const getConnectedNodeIds = useMemo(() => {
    if (!selectedNode || !finalGraphData.links) return new Set<number>();

    const connectedIds = new Set<number>();
    finalGraphData.links.forEach((link) => {
      const sourceId = getNodeId(link.source);
      const targetId = getNodeId(link.target);

      if (sourceId === selectedNode.id && targetId !== null) {
        connectedIds.add(targetId);
      } else if (targetId === selectedNode.id && sourceId !== null) {
        connectedIds.add(sourceId);
      }
    });

    return connectedIds;
  }, [selectedNode, finalGraphData.links]);

  const getNodesConnectedToSearched = useMemo(() => {
    if (!searchTerm || highlightedNodes.size === 0 || !finalGraphData.links)
      return new Set<number>();

    const connectedIds = new Set<number>();
    finalGraphData.links.forEach((link) => {
      const sourceId = getNodeId(link.source);
      const targetId = getNodeId(link.target);

      if (sourceId !== null && targetId !== null) {
        if (highlightedNodes.has(sourceId)) {
          connectedIds.add(targetId);
        } else if (highlightedNodes.has(targetId)) {
          connectedIds.add(sourceId);
        }
      }
    });

    return connectedIds;
  }, [searchTerm, highlightedNodes, finalGraphData.links]);

  const isLoading =
    isLoadingNodes ||
    isLoadingLinks ||
    isCalculatingLayout ||
    graphDimensions.width === 0;

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 sm:px-6 min-h-0">
      <div className="flex items-center gap-2">
        <Input
          type="search"
          placeholder="Search nodes by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div
        ref={graphContainerRef}
        className="flex-1 rounded-lg overflow-hidden relative bg-gray-50 dark:bg-gray-900 border"
      >
        {graphDimensions.width > 0 && graphDimensions.height > 0 && (
          <ForceGraph2D
            ref={graphRef}
            width={graphDimensions.width}
            height={graphDimensions.height}
            graphData={finalGraphData}
            nodeLabel="name"
            nodeVal={(node) => (node.has_pos ? 10 : 5)}
            cooldownTicks={100}
            cooldownTime={5000}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const label = node.name || `!${node.id.toString(16)}`;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              // Use a base radius, potentially adjusted by nodeVal or other properties later
              const baseRadius = node.has_pos ? 6 : 4;
              const nodeRadius = Math.max(
                2,
                baseRadius / Math.sqrt(globalScale),
              );

              const isHighlighted = highlightedNodes.has(node.id);
              const hasSearchTerm = searchTerm.length > 0;
              const isSelected = selectedNode?.id === node.id;
              const isConnectedToSelected = selectedNode
                ? getConnectedNodeIds.has(node.id)
                : false;

              // Define colors
              const baseColor = "rgba(34, 197, 94, 1)"; // Green-500
              const highlightFillColor = "rgba(250, 204, 21, 1)"; // Yellow-400
              const highlightOutlineColor = "rgba(234, 179, 8, 1)"; // Yellow-500
              const selectedOutlineColor = "rgba(59, 130, 246, 1)"; // Blue-500
              const dimOpacity = 0.15;

              let fillStyle: string;
              let nodeOpacity = 1;

              if (isSelected) {
                fillStyle = baseColor;
                nodeOpacity = 1;
              } else if (hasSearchTerm) {
                if (isHighlighted) {
                  fillStyle = highlightFillColor;
                  nodeOpacity = 1;
                } else {
                  fillStyle = baseColor;
                  nodeOpacity = dimOpacity;
                }
              } else {
                fillStyle = baseColor;
                nodeOpacity = 1;
              }

              // Apply opacity to the fill style
              const rgbaMatchFill = fillStyle.match(
                /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/,
              );
              if (rgbaMatchFill) {
                fillStyle = `rgba(${rgbaMatchFill[1]}, ${rgbaMatchFill[2]}, ${rgbaMatchFill[3]}, ${nodeOpacity})`;
              } else {
                ctx.globalAlpha = nodeOpacity;
              }

              // Draw the node circle
              ctx.beginPath();
              const drawX = typeof node.x === "number" ? node.x : 0;
              const drawY = typeof node.y === "number" ? node.y : 0;
              ctx.arc(drawX, drawY, nodeRadius, 0, 2 * Math.PI, false);
              ctx.fillStyle = fillStyle;
              ctx.fill();

              ctx.globalAlpha = 1.0;

              // Draw pin icon if node has position and image is loaded
              if (node.has_pos && pinIconImage) {
                const iconDrawSize = nodeRadius * 1.5;
                const iconX = drawX - iconDrawSize / 2;
                const iconY = drawY - iconDrawSize / 2;

                ctx.globalAlpha = nodeOpacity;

                ctx.drawImage(
                  pinIconImage,
                  iconX,
                  iconY,
                  iconDrawSize,
                  iconDrawSize,
                );

                ctx.globalAlpha = 1;
              }

              // Draw selection outline if node is selected
              if (isSelected) {
                ctx.strokeStyle = selectedOutlineColor;
                ctx.lineWidth = 2 / globalScale;
                ctx.stroke();
              } else if (hasSearchTerm && isHighlighted) {
                ctx.strokeStyle = highlightOutlineColor;
                ctx.lineWidth = 1.5 / globalScale;
                ctx.stroke();
              }

              // Determine if node is connected to a searched node
              const isConnectedToSearched =
                hasSearchTerm && getNodesConnectedToSearched.has(node.id);

              // Only show labels for: selected node, connected nodes to selected, connected to searched nodes, or when no node is selected
              const shouldShowLabel =
                isSelected ||
                isConnectedToSelected ||
                !selectedNode ||
                isConnectedToSearched;

              if (
                shouldShowLabel &&
                (isSelected ||
                  !hasSearchTerm ||
                  isHighlighted ||
                  isConnectedToSearched)
              ) {
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                const isLightMode =
                  theme === "light" ||
                  (theme === "system" &&
                    !window.matchMedia("(prefers-color-scheme: dark)").matches);
                const labelColorBase = isLightMode
                  ? "rgba(0, 0, 0, 0.9)"
                  : "rgba(255, 255, 255, 0.9)";
                const labelColorDim = isLightMode
                  ? "rgba(0, 0, 0, 0.4)"
                  : "rgba(255, 255, 255, 0.4)";

                const isDimmed = hasSearchTerm && !isHighlighted && !isSelected;
                ctx.fillStyle = isDimmed ? labelColorDim : labelColorBase;

                ctx.fillText(label, drawX, drawY + nodeRadius + fontSize * 0.7);
              }
            }}
            nodePointerAreaPaint={(node, color, ctx) => {
              // Make interaction area slightly larger than the node itself
              const nodeRadius = 8;
              ctx.fillStyle = color;
              ctx.beginPath();
              const drawX = typeof node.x === "number" ? node.x : 0;
              const drawY = typeof node.y === "number" ? node.y : 0;
              ctx.arc(
                drawX,
                drawY,
                nodeRadius / Math.sqrt(ctx.getTransform().a),
                0,
                2 * Math.PI,
                false,
              );
              ctx.fill();
            }}
            linkColor={(link) => {
              const hasSearchTerm = searchTerm.length > 0;
              const isNodeSelected = !!selectedNode;
              const source = link.source;
              const target = link.target;
              const sourceId = getNodeId(source);
              const targetId = getNodeId(target);

              if (hasSearchTerm || isNodeSelected) {
                if (sourceId === null || targetId === null)
                  return "rgba(156, 163, 175, 0.15)";
                const sourceHighlighted = highlightedNodes.has(sourceId);
                const targetHighlighted = highlightedNodes.has(targetId);
                const sourceSelected = selectedNode?.id === sourceId;
                const targetSelected = selectedNode?.id === targetId;

                // Keep original color if source/target is selected OR (no node is selected AND source/target is highlighted by search)
                if (
                  sourceSelected ||
                  targetSelected ||
                  (!isNodeSelected && (sourceHighlighted || targetHighlighted))
                ) {
                  return link.color;
                } else {
                  return "rgba(156, 163, 175, 0.15)";
                }
              }
              return link.color; // Default color if no search/selection
            }}
            linkWidth={(link) => {
              const hasSearchTerm = searchTerm.length > 0;
              const isNodeSelected = !!selectedNode;
              const source = link.source;
              const target = link.target;
              const sourceId = getNodeId(source);
              const targetId = getNodeId(target);

              let isDimmed = false;
              if (hasSearchTerm || isNodeSelected) {
                if (sourceId === null || targetId === null) {
                  isDimmed = true;
                } else {
                  const sourceHighlighted = highlightedNodes.has(sourceId);
                  const targetHighlighted = highlightedNodes.has(targetId);
                  const sourceSelected = selectedNode?.id === sourceId;
                  const targetSelected = selectedNode?.id === targetId;

                  isDimmed = !(
                    sourceSelected ||
                    targetSelected ||
                    (!isNodeSelected &&
                      (sourceHighlighted || targetHighlighted))
                  );
                }
              }

              if (isDimmed) {
                return 0.5;
              } else {
                return link.originalLink?.direction === "bidirectional" ? 2 : 1;
              }
            }}
            linkDirectionalArrowLength={(link) => {
              const hasSearchTerm = searchTerm.length > 0;
              const isNodeSelected = !!selectedNode;
              const isBidirectional =
                link.originalLink?.direction === "bidirectional";
              const source = link.source;
              const target = link.target;
              const sourceId = getNodeId(source);
              const targetId = getNodeId(target);

              let isDimmed = false;
              if (hasSearchTerm || isNodeSelected) {
                if (sourceId === null || targetId === null) {
                  isDimmed = true;
                } else {
                  const sourceHighlighted = highlightedNodes.has(sourceId);
                  const targetHighlighted = highlightedNodes.has(targetId);
                  const sourceSelected = selectedNode?.id === sourceId;
                  const targetSelected = selectedNode?.id === targetId;

                  isDimmed = !(
                    sourceSelected ||
                    targetSelected ||
                    (!isNodeSelected &&
                      (sourceHighlighted || targetHighlighted))
                  );
                }
              }

              return isDimmed || isBidirectional ? 0 : 5;
            }}
            linkDirectionalArrowRelPos={0.5}
            linkDirectionalParticles={(link) => {
              const hasSearchTerm = searchTerm.length > 0;
              const isNodeSelected = !!selectedNode;
              const isUnidirectional =
                link.originalLink?.direction !== "bidirectional";
              const source = link.source;
              const target = link.target;
              const sourceId = getNodeId(source);
              const targetId = getNodeId(target);

              let isDimmed = false;
              if (hasSearchTerm || isNodeSelected) {
                if (sourceId === null || targetId === null) {
                  isDimmed = true;
                } else {
                  const sourceHighlighted = highlightedNodes.has(sourceId);
                  const targetHighlighted = highlightedNodes.has(targetId);
                  const sourceSelected = selectedNode?.id === sourceId;
                  const targetSelected = selectedNode?.id === targetId;

                  isDimmed = !(
                    sourceSelected ||
                    targetSelected ||
                    (!isNodeSelected &&
                      (sourceHighlighted || targetHighlighted))
                  );
                }
              }

              return !isDimmed && isUnidirectional ? 1 : 0;
            }}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={0.005}
            d3AlphaDecay={0.03}
            d3VelocityDecay={0.3}
            onLinkClick={(link) => {
              const graphLink = link;
              if (graphLink.originalLink) {
                setSelectedLink(graphLink);
                setSelectedNode(null);
              } else {
                console.warn("Clicked link missing originalLink data:", link);
                setSelectedLink(null);
                setSelectedNode(null);
              }
            }}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            linkPointerAreaPaint={(link, color, ctx) => {
              ctx.strokeStyle = color;
              ctx.lineWidth = 6;
              ctx.beginPath();
              const sourceX = (link.source as GraphNode)?.x ?? 0;
              const sourceY = (link.source as GraphNode)?.y ?? 0;
              const targetX = (link.target as GraphNode)?.x ?? 0;
              const targetY = (link.target as GraphNode)?.y ?? 0;
              ctx.moveTo(sourceX, sourceY);
              ctx.lineTo(targetX, targetY);
              ctx.stroke();
            }}
          />
        )}

        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-gray-500">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p>
              {isLoadingNodes || isLoadingLinks
                ? "Loading network data..."
                : isCalculatingLayout
                  ? "Calculating graph layout..."
                  : "Initializing graph..."}
            </p>
          </div>
        )}

        {/* Node Info Panel */}
        {selectedMeshtasticNode && (
          <NodeInfoPanel
            node={selectedMeshtasticNode}
            isOpen={infoPanelOpen}
            togglePanel={toggleInfoPanel}
            directNodeCount={directNodeCount}
            isLoadingDirectCount={isLoadingDirectLinks}
          />
        )}
      </div>

      {/* Dialog for displaying selected link details */}
      <Dialog
        open={!!selectedLink}
        onOpenChange={(open) => !open && setSelectedLink(null)}
      >
        <DialogContent className="sm:max-w-md">
          {selectedLink &&
            (() => {
              const details = formatLinkDetails(selectedLink);
              if (!details) return null;
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>{details.title}</DialogTitle>
                  </DialogHeader>
                  {details.content}
                </>
              );
            })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLink(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
