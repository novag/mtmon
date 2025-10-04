import { useContext, useEffect, useState, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  useMap,
  useMapEvents,
  Circle,
  LayersControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-polylinedecorator";
import L, { LatLngExpression } from "leaflet";
import { MeshtasticNode } from "@/lib/types";
import axios from "axios";
import { StateContext } from "@/providers/StateProvider";
import { convertMeshtasticPosition } from "@/lib/utils";
import { Icon, LatLngBounds, LatLng } from "leaflet";
import { getApiUrl } from "@/lib/config";
import { DirectLinkData, ProcessedLink, getLinkColor } from "@/lib/linkUtils";
import { useLocation, useNavigate } from "react-router-dom";
import { NodeInfoPanel } from "@/components/NodeInfoPanel";
import { formatDistanceToNow } from "date-fns";
import { formatDate } from "@/lib/utils/formatters";
import { renderToStaticMarkup } from "react-dom/server";
import { RefreshCw, Link, Link2Off } from "lucide-react";

interface DirectNodeInfo {
  id: number;
}

// Create a transparent icon for markers (invisible but clickable)
const transparentIcon = new Icon({
  iconUrl:
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", // transparent 1x1 pixel
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10],
  shadowUrl: undefined,
});

// Component to fit map bounds to all markers
interface MapBoundsProps {
  positions: [number, number][];
  shouldFitBounds: boolean;
}

function MapBounds({ positions, shouldFitBounds }: MapBoundsProps) {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0 && shouldFitBounds) {
      const bounds = new LatLngBounds(
        positions.map((pos) => new LatLng(pos[0], pos[1])),
      );

      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, positions, shouldFitBounds]);

  return null;
}

// Component to zoom to the selected node
interface ZoomToSelectedNodeProps {
  selectedNodeId: number | null;
  nodes: MeshtasticNode[];
  shouldZoom: boolean;
}

function ZoomToSelectedNode({
  selectedNodeId,
  nodes,
  shouldZoom,
}: ZoomToSelectedNodeProps) {
  const map = useMap();
  const hasZoomed = useRef(false);
  const lastZoomedNodeId = useRef<number | null>(null);

  useEffect(() => {
    if (selectedNodeId && shouldZoom && !hasZoomed.current) {
      const selectedNode = nodes.find((node) => node.id === selectedNodeId);
      if (
        selectedNode?.position?.latitude_i &&
        selectedNode.position?.longitude_i
      ) {
        const position = convertMeshtasticPosition(
          selectedNode.position.latitude_i,
          selectedNode.position.longitude_i,
        );

        if (position) {
          map.setView(position, 12, { animate: true });
          hasZoomed.current = true;
          lastZoomedNodeId.current = selectedNodeId;
        }
      }
    }
  }, [map, selectedNodeId, nodes, shouldZoom]);

  return null;
}

function MapClickHandler({
  setSelectedNodeId,
}: {
  setSelectedNodeId: (id: number | null) => void;
}) {
  useMapEvents({
    click() {
      setSelectedNodeId(null);
    },
  });
  return null;
}

interface LinkLineProps {
  link: ProcessedLink;
  selectedNodeId: number | null;
  nodes: MeshtasticNode[];
}

function LinkLine({ link, selectedNodeId, nodes }: LinkLineProps) {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(() => map.getZoom());
  const polylineRef = useRef<L.Polyline | null>(null);
  const decoratorRef = useRef<L.PolylineDecorator | null>(null);

  // Check if this link is connected to the selected node
  const isConnectedToSelectedNode = useMemo(() => {
    if (!selectedNodeId) return false;
    return link.node1_id === selectedNodeId || link.node2_id === selectedNodeId;
  }, [link, selectedNodeId]);

  useEffect(() => {
    const handleZoomEnd = () => {
      setCurrentZoom(map.getZoom());
    };

    map.on("zoomend", handleZoomEnd);

    return () => {
      map.off("zoomend", handleZoomEnd);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;

    const isNodeSelected = selectedNodeId !== null;
    if (isNodeSelected && !isConnectedToSelectedNode) {
      if (polylineRef.current && map.hasLayer(polylineRef.current)) {
        polylineRef.current.remove();
      }
      if (decoratorRef.current && map.hasLayer(decoratorRef.current)) {
        decoratorRef.current.remove();
      }
      return;
    }

    // Determine the correct order of positions based on direction
    const positions: LatLngExpression[] =
      link.direction === "BtoA"
        ? [link.pos2!, link.pos1!] // Reverse order for B to A
        : [link.pos1!, link.pos2!]; // Normal order for A to B or bidirectional

    const color = getLinkColor(link);
    const weight = 2;

    const opacity = 0.8;

    // Create or update the polyline using the determined positions order
    if (!polylineRef.current) {
      polylineRef.current = L.polyline(positions, {
        color: color,
        weight: weight,
        opacity: opacity,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    } else {
      polylineRef.current.setLatLngs(positions);
      polylineRef.current.setStyle({
        color: color,
        weight: weight,
        opacity: opacity,
      });
    }

    // --- Popup Logic ---
    // Get node objects
    const node1 = nodes.find((n) => n.id === link.node1_id);
    const node2 = nodes.find((n) => n.id === link.node2_id);

    // Get node display names (short name or hex id as fallback)
    const node1Name =
      node1?.info?.short_name || `!${link.node1_id.toString(16)}`;
    const node2Name =
      node2?.info?.short_name || `!${link.node2_id.toString(16)}`;

    let popupContent = `<div class="p-2 space-y-2 text-sm">`;
    let linkTitle = "";
    let linkDetails = "";

    const formatLastSeen = (dateString?: string) => {
      if (!dateString) return "N/A";
      const date = new Date(dateString);
      const relativeTime = formatDistanceToNow(date, { addSuffix: true });
      const exactTime = formatDate(date);
      return `<span title="${exactTime}">${relativeTime}</span>`;
    };

    if (link.direction === "bidirectional") {
      linkTitle = `<h4 class="font-semibold text-base pr-5 mb-2">Link: ${node1Name} &harr; ${node2Name}</h4>`;
      if (link.link1) {
        linkDetails += `<p><b>${node1Name} &rarr; ${node2Name}</b>:<br/>`;
        if (link.link1.last_snr !== null)
          linkDetails += `Last SNR: ${link.link1.last_snr.toFixed(2)}<br/>`;
        if (link.link1.last_rssi !== null)
          linkDetails += `Last RSSI: ${link.link1.last_rssi.toFixed(0)}<br/>`;
        linkDetails += `Observations: ${link.link1.observation_count}<br/>`;
        if (link.link1.last_seen) {
          linkDetails += `Last Seen: ${formatLastSeen(link.link1.last_seen)}<br/>`;
        }
        linkDetails += `Source: ${link.link1.source}`;
        linkDetails += `</p>`;
      }
      if (link.link2) {
        linkDetails += `<p><b>${node2Name} &rarr; ${node1Name}</b>:<br/>`;
        if (link.link2.last_snr !== null)
          linkDetails += `Last SNR: ${link.link2.last_snr.toFixed(2)}<br/>`;
        if (link.link2.last_rssi !== null)
          linkDetails += `Last RSSI: ${link.link2.last_rssi.toFixed(0)}<br/>`;
        linkDetails += `Observations: ${link.link2.observation_count}<br/>`;
        if (link.link2.last_seen) {
          linkDetails += `Last Seen: ${formatLastSeen(link.link2.last_seen)}<br/>`;
        }
        linkDetails += `Source: ${link.link2.source}`;
        linkDetails += `</p>`;
      }
    } else {
      const isAtoB = link.direction === "AtoB";
      const fromName = isAtoB ? node1Name : node2Name;
      const toName = isAtoB ? node2Name : node1Name;
      const unidirectionalLink = link.link1 || link.link2; // Should be only one
      linkTitle = `<h4 class="font-semibold text-base pr-5 mb-2">Link: ${fromName} &rarr; ${toName}</h4>`;
      if (unidirectionalLink) {
        linkDetails += `<div class="space-y-0.5">`;
        if (unidirectionalLink.last_snr !== null)
          linkDetails += `Last SNR: ${unidirectionalLink.last_snr.toFixed(2)}<br/>`;
        if (unidirectionalLink.last_rssi !== null)
          linkDetails += `Last RSSI: ${unidirectionalLink.last_rssi.toFixed(0)}<br/>`;
        linkDetails += `Observations: ${unidirectionalLink.observation_count}<br/>`;
        if (unidirectionalLink.last_seen) {
          linkDetails += `Last Seen: ${formatLastSeen(unidirectionalLink.last_seen)}<br/>`;
        }
        linkDetails += `Source: ${unidirectionalLink.source}`;
        linkDetails += `</div>`;
      }
    }

    let bylineUrl = `https://byline.9tb.de/?startLat=${link.pos1![0]}&startLng=${link.pos1![1]}`;
    // Note: We don't have altitude directly in ProcessedLink, might need adjustment if required
    bylineUrl += `&endLat=${link.pos2![0]}&endLng=${link.pos2![1]}`;

    popupContent += linkTitle + linkDetails;
    popupContent += `<a href="${bylineUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline block pt-1">View on byline</a>`;
    popupContent += `</div>`;

    if (polylineRef.current) {
      polylineRef.current.bindPopup(popupContent, {
        className: "link-popup",
        maxWidth: 300,
      });
    }

    const baseRepeatPixels = 200; // Base repeat distance in pixels at baseZoom
    const baseZoom = 12; // Zoom level for base distance
    const calculatedRepeatPixels = Math.min(
      500,
      Math.max(100, baseRepeatPixels * Math.pow(1.7, baseZoom - currentZoom)),
    );

    // Calculate pixel distance of the line segment at current zoom
    const latLng1 = L.latLng(link.pos1!);
    const latLng2 = L.latLng(link.pos2!);
    let pixelDistance = 0;
    try {
      const point1 = map.project(latLng1);
      const point2 = map.project(latLng2);
      pixelDistance = point1.distanceTo(point2);
    } catch {
      pixelDistance = calculatedRepeatPixels;
    }

    let patternOffset = "5%";
    let patternRepeat: string | number = calculatedRepeatPixels;
    if (pixelDistance > 0 && pixelDistance < calculatedRepeatPixels * 0.95) {
      patternOffset = "50%";
      patternRepeat = pixelDistance * 2;
    }

    const arrowPattern = {
      offset: patternOffset,
      repeat: patternRepeat,
      symbol: L.Symbol.arrowHead({
        pixelSize: 10,
        polygon: false,
        pathOptions: {
          stroke: true,
          color: color,
          weight: 1,
          opacity: opacity,
        },
      }),
    };

    // Remove existing decorator before creating/updating
    if (decoratorRef.current) {
      if (map && map.hasLayer(decoratorRef.current)) {
        decoratorRef.current.remove();
      }
      decoratorRef.current = null;
    }

    // Add decorator only for unidirectional links
    if (link.direction === "AtoB" || link.direction === "BtoA") {
      if (L.polylineDecorator && polylineRef.current) {
        if (map.hasLayer(polylineRef.current)) {
          decoratorRef.current = L.polylineDecorator(polylineRef.current, {
            patterns: [arrowPattern],
          }).addTo(map);
        }
      } else {
        console.error("L.polylineDecorator is not loaded correctly.");
      }
    }

    return () => {
      if (decoratorRef.current) {
        if (map && map.hasLayer(decoratorRef.current)) {
          decoratorRef.current.remove();
        }
        decoratorRef.current = null;
      }
      if (polylineRef.current) {
        if (map && map.hasLayer(polylineRef.current)) {
          polylineRef.current.remove();
        }
        polylineRef.current = null;
      }
    };
  }, [
    map,
    link,
    currentZoom,
    selectedNodeId,
    isConnectedToSelectedNode,
    nodes,
  ]);

  return null;
}

function MapControls({
  onRefresh,
  isLoading,
  showDirectLinks,
  setShowDirectLinks,
}: {
  onRefresh: () => void;
  isLoading: boolean;
  showDirectLinks: boolean;
  setShowDirectLinks: (show: boolean) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const controlContainer = L.DomUtil.create(
      "div",
      "leaflet-bar leaflet-control custom-controls-container",
    );
    controlContainer.style.backgroundColor = "transparent";
    controlContainer.style.border = "none";
    controlContainer.style.display = "flex";
    controlContainer.style.flexDirection = "column";
    controlContainer.style.gap = "8px";

    const refreshButton = L.DomUtil.create(
      "div",
      "leaflet-bar custom-control refresh-control",
      controlContainer,
    );
    refreshButton.style.backgroundColor = "white";
    refreshButton.style.width = "32px";
    refreshButton.style.height = "32px";
    refreshButton.style.display = "flex";
    refreshButton.style.alignItems = "center";
    refreshButton.style.justifyContent = "center";
    refreshButton.style.cursor = "pointer";
    refreshButton.style.borderRadius = "4px";
    refreshButton.style.padding = "6px";

    refreshButton.title = isLoading ? "Loading data..." : "Refresh Map Data";

    const refreshSvg = renderToStaticMarkup(
      <RefreshCw size={20} color="#000000" strokeWidth={2} />,
    );

    refreshButton.innerHTML = refreshSvg;

    const toggleButton = L.DomUtil.create(
      "div",
      "leaflet-bar custom-control toggle-links-control",
      controlContainer,
    );
    toggleButton.style.backgroundColor = "white";
    toggleButton.style.width = "32px";
    toggleButton.style.height = "32px";
    toggleButton.style.display = "flex";
    toggleButton.style.alignItems = "center";
    toggleButton.style.justifyContent = "center";
    toggleButton.style.cursor = "pointer";
    toggleButton.style.borderRadius = "4px";

    toggleButton.title = showDirectLinks
      ? "Hide Direct Links"
      : "Show Direct Links";

    const linkVisibleSvg = renderToStaticMarkup(
      <Link size={20} color="#000000" strokeWidth={2} />,
    );
    const linkHiddenSvg = renderToStaticMarkup(
      <Link2Off size={20} color="#000000" strokeWidth={2} />,
    );

    toggleButton.innerHTML = showDirectLinks ? linkVisibleSvg : linkHiddenSvg;

    L.DomEvent.on(refreshButton, "click", (e) => {
      L.DomEvent.stopPropagation(e);
      onRefresh();
    });

    L.DomEvent.on(toggleButton, "click", (e) => {
      L.DomEvent.stopPropagation(e);
      setShowDirectLinks(!showDirectLinks);
    });

    if (isLoading) {
      const svg = refreshButton.querySelector("svg");
      if (svg) {
        svg.style.animation = "spin 1s linear infinite";
      }

      if (!document.getElementById("spin-keyframes")) {
        const style = document.createElement("style");
        style.id = "spin-keyframes";
        style.textContent = `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }
    }

    const control = new L.Control({ position: "topleft" });
    control.onAdd = () => controlContainer;
    control.addTo(map);

    return () => {
      map.removeControl(control);
    };
  }, [map, onRefresh, isLoading, showDirectLinks, setShowDirectLinks]);

  return null;
}

function getPrecisionRadius(precision_bits?: number): number {
  if (!precision_bits) return 0;

  switch (precision_bits) {
    case 10:
      return 23300;
    case 11:
      return 11700;
    case 12:
      return 5800;
    case 13:
      return 2900;
    case 14:
      return 1500;
    case 15:
      return 729;
    case 16:
      return 364;
    case 17:
      return 182;
    case 18:
      return 91;
    case 19:
      return 45;
    default:
      return 0;
  }
}

function isPositionRecent(node: MeshtasticNode): boolean {
  // Always show nodes with manually set location
  if (node.position?.location_source === "LOC_MANUAL") {
    return true;
  }

  // Hide nodes with no time
  if (!node.position?.time) {
    return false;
  }

  const posTime = new Date(node.position.time * 1000);
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - 24);

  // Show nodes with position data from the last 24 hours
  return posTime >= cutoffTime;
}

export default function MapPage() {
  const [nodes, setNodes] = useState<MeshtasticNode[]>([]);
  const [directLinks, setDirectLinks] = useState<DirectLinkData[]>([]);
  const [mapCenter] = useState<[number, number]>([48.1351, 11.582]);
  const [shouldFitBounds] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedNodeLinks, setSelectedNodeLinks] = useState<Set<number>>(
    new Set(),
  );
  const [directNodeCount, setDirectNodeCount] = useState<number | null>(null);
  const [isLoadingDirectCount, setIsLoadingDirectCount] =
    useState<boolean>(false);
  const [showDirectLinks, setShowDirectLinks] = useState(true);
  const [initialNodeSelection, setInitialNodeSelection] =
    useState<boolean>(false);
  const [infoPanelOpen, setInfoPanelOpen] = useState<boolean>(true);
  const [shouldZoomToNode, setShouldZoomToNode] = useState<boolean>(false);
  const mapRef = useRef<L.Map | null>(null);
  const hashUpdateFromUserClick = useRef<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // React Router hooks
  const location = useLocation();
  const navigate = useNavigate();

  const context = useContext(StateContext);
  const { currentGatewayId } = context!;

  // Parse node ID from hash on component mount
  useEffect(() => {
    const hash = location.hash;
    if (hash.startsWith("#node=")) {
      const nodeIdHex = hash.substring(6);
      try {
        const nodeId = parseInt(nodeIdHex, 16);
        if (!isNaN(nodeId)) {
          setSelectedNodeId(nodeId);
          // Only zoom when this wasn't triggered by a user click
          if (!hashUpdateFromUserClick.current) {
            setShouldZoomToNode(true);
            setInitialNodeSelection(true);
          }
          setInfoPanelOpen(true);
        }
      } catch (e) {
        console.error("Failed to parse node ID from URL hash:", e);
      }
    }
    hashUpdateFromUserClick.current = false;
  }, [location.hash]);

  // Update URL hash when selectedNodeId changes
  useEffect(() => {
    if (selectedNodeId !== null) {
      const nodeIdHex = selectedNodeId.toString(16);
      navigate({ hash: `node=${nodeIdHex}` }, { replace: true });
    } else if (location.hash) {
      // Clear hash if no node is selected
      navigate({ hash: "" }, { replace: true });
    }

    if (shouldZoomToNode) {
      const timer = setTimeout(() => {
        setShouldZoomToNode(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [selectedNodeId, navigate, location.hash, shouldZoomToNode]);

  const fetchNodes = async () => {
    try {
      const parameters = currentGatewayId
        ? `?gateway_id=${currentGatewayId}`
        : "";
      const response = await axios.get<MeshtasticNode[]>(
        getApiUrl(`/nodes${parameters}`),
      );
      setNodes(response.data);
      return true;
    } catch {
      console.error("Error fetching nodes");
      return false;
    }
  };

  const fetchDirectLinks = async () => {
    try {
      const response = await axios.get<DirectLinkData[]>(
        getApiUrl(`/links/direct`),
      );
      setDirectLinks(response.data);
      return true;
    } catch {
      console.error("Error fetching direct links");
      return false;
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await Promise.all([fetchNodes(), fetchDirectLinks()]);
    setIsLoading(false);
  };

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchNodes(), fetchDirectLinks()]).finally(() => {
      setIsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGatewayId]);

  const fetchDirectNodeCount = async (nodeId: number | null) => {
    if (nodeId === null) {
      setDirectNodeCount(null);
      setIsLoadingDirectCount(false);
      setSelectedNodeLinks(new Set());
      return;
    }
    setIsLoadingDirectCount(true);
    setDirectNodeCount(null);
    try {
      const response = await axios.get<DirectNodeInfo[]>(
        getApiUrl(`/nodes/${nodeId}/direct_nodes`),
      );
      // API returns empty list for 404 or no neighbors, so response.data.length is safe
      setDirectNodeCount(response.data.length);

      // Update the set of direct links for highlighting
      const directNodeIds = new Set(response.data.map((node) => node.id));
      setSelectedNodeLinks(directNodeIds);
    } catch (error) {
      console.error("Error fetching direct node count for map popup:", error);
      setDirectNodeCount(-1);
      setSelectedNodeLinks(new Set());
    } finally {
      setIsLoadingDirectCount(false);
    }
  };

  useEffect(() => {
    fetchDirectNodeCount(selectedNodeId);
  }, [selectedNodeId]);

  const processedLinks = useMemo(() => {
    const linksMap = new Map<string, ProcessedLink>();

    directLinks.forEach((link) => {
      const node1 = nodes.find((n) => n.id === link.from_node_id);
      const node2 = nodes.find((n) => n.id === link.to_node_id);

      if (!node1 || !node2) return;

      // Skip links for nodes with outdated position data
      if (!isPositionRecent(node1) || !isPositionRecent(node2)) return;

      const pos1 = convertMeshtasticPosition(
        node1.position?.latitude_i,
        node1.position?.longitude_i,
      );
      const pos2 = convertMeshtasticPosition(
        node2.position?.latitude_i,
        node2.position?.longitude_i,
      );

      if (!pos1 || !pos2) return;

      // Create a consistent key for the node pair
      const id1 = Math.min(link.from_node_id, link.to_node_id);
      const id2 = Math.max(link.from_node_id, link.to_node_id);
      const pairKey = `${id1}-${id2}`;

      const isAtoB = link.from_node_id === id1;

      if (!linksMap.has(pairKey)) {
        // First time seeing this pair
        linksMap.set(pairKey, {
          node1_id: id1,
          node2_id: id2,
          pos1: (isAtoB ? pos1 : pos2) as [number, number],
          pos2: (isAtoB ? pos2 : pos1) as [number, number],
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
          // Ensure positions are consistent if node data updated
          existing.pos1 = pos1 as [number, number];
          existing.pos2 = pos2 as [number, number];
        } else {
          existing.link2 = link;
          // Ensure positions are consistent if node data updated
          existing.pos1 = pos2 as [number, number];
          existing.pos2 = pos1 as [number, number];
        }
      }
    });

    return Array.from(linksMap.values());
  }, [directLinks, nodes]);

  const nodesWithPositions = nodes.filter(
    (node) => node.position?.latitude_i && node.position?.longitude_i,
  );

  const validPositions = nodesWithPositions
    .map((node) =>
      convertMeshtasticPosition(
        node.position?.latitude_i,
        node.position?.longitude_i,
      ),
    )
    .filter((pos): pos is [number, number] => pos !== null);

  const isNodeConnectedToSelected = (nodeId: number): boolean => {
    if (!selectedNodeId) return false;
    if (nodeId === selectedNodeId) return true;
    return selectedNodeLinks.has(nodeId);
  };

  // Get the selected node object
  const selectedNode = useMemo(() => {
    if (selectedNodeId === null) return null;
    return nodes.find((node) => node.id === selectedNodeId) || null;
  }, [selectedNodeId, nodes]);

  const toggleInfoPanel = () => {
    setInfoPanelOpen(!infoPanelOpen);
  };

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 sm:px-6 min-h-0">
      <div className="h-full w-full rounded-lg overflow-hidden relative">
        <MapContainer
          center={mapCenter}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          ref={mapRef}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Positron">
              <TileLayer
                attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tiles-eu.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Streets">
              <TileLayer
                attribution='<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
                url="https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=oMB9k2lMQniV185dsbE5"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Outdoor">
              <TileLayer
                attribution='<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
                url="https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=oMB9k2lMQniV185dsbE5"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer
                attribution='&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community'
                url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          <MapControls
            onRefresh={handleRefresh}
            isLoading={isLoading}
            showDirectLinks={showDirectLinks}
            setShowDirectLinks={setShowDirectLinks}
          />

          <MapBounds
            positions={validPositions}
            shouldFitBounds={shouldFitBounds}
          />

          <ZoomToSelectedNode
            selectedNodeId={selectedNodeId}
            nodes={nodes}
            shouldZoom={initialNodeSelection}
          />

          <MapClickHandler setSelectedNodeId={setSelectedNodeId} />

          {showDirectLinks &&
            processedLinks.map((linkData, index) => (
              <LinkLine
                key={`link-${index}`}
                link={linkData}
                selectedNodeId={selectedNodeId}
                nodes={nodes}
              />
            ))}

          {nodesWithPositions.map((node) => {
            const position = convertMeshtasticPosition(
              node.position?.latitude_i,
              node.position?.longitude_i,
            );

            if (!position) return null;

            if (!isPositionRecent(node)) {
              return null;
            }

            const lastSeen = node.gateways
              ?.map((gateway) => new Date(gateway.last_seen))
              ?.reduce((latest, current) =>
                current > latest ? current : latest,
              );

            const isActive =
              lastSeen &&
              new Date().getTime() - lastSeen.getTime() < 12 * 60 * 60 * 1000; // 12 hours

            // Determine if this node should be highlighted or dimmed
            const isNodeSelected = selectedNodeId === node.id;
            const isConnected = isNodeConnectedToSelected(node.id);
            const shouldHighlight =
              !selectedNodeId || isNodeSelected || isConnected;
            const dimOpacity = 0.2;

            return (
              <div key={node.id}>
                {/* Invisible marker to handle clicks */}
                <Marker
                  position={position}
                  icon={transparentIcon}
                  eventHandlers={{
                    click: () => {
                      // Mark that this hash update is from a user click
                      hashUpdateFromUserClick.current = true;
                      setSelectedNodeId(node.id);
                      setShouldZoomToNode(false);
                      setInitialNodeSelection(false);
                      setInfoPanelOpen(true);
                    },
                  }}
                />

                {/* CircleMarker as the visual indicator */}
                <CircleMarker
                  center={position}
                  radius={8}
                  pathOptions={{
                    fillColor: isActive ? "#10b981" : "#94a3b8",
                    fillOpacity: shouldHighlight
                      ? isActive
                        ? 0.9
                        : 0.5
                      : dimOpacity,
                    weight: 1,
                    color: isNodeSelected ? "#3b82f6" : "#ffffff",
                  }}
                />

                {/* Circle to show position precision based on precision_bits */}
                {node.position?.precision_bits && (
                  <Circle
                    center={position}
                    radius={getPrecisionRadius(node.position.precision_bits)}
                    pathOptions={{
                      color: selectedNodeId === node.id ? "#3b82f6" : "#94a3b8",
                      fillColor:
                        selectedNodeId === node.id ? "#3b82f6" : "#94a3b8",
                      fillOpacity:
                        isActive || selectedNodeId === node.id
                          ? shouldHighlight
                            ? 0.1
                            : dimOpacity
                          : 0,
                      weight: isActive || selectedNodeId === node.id ? 1 : 0,
                    }}
                    interactive={false}
                  />
                )}
              </div>
            );
          })}
        </MapContainer>

        {/* Node Info Panel */}
        <NodeInfoPanel
          node={selectedNode}
          isOpen={infoPanelOpen && selectedNode !== null}
          togglePanel={toggleInfoPanel}
          directNodeCount={directNodeCount}
          isLoadingDirectCount={isLoadingDirectCount}
        />
      </div>
    </main>
  );
}
