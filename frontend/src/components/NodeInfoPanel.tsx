import { MeshtasticNode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Eye, Network } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { convertMeshtasticPosition } from "@/lib/utils";
import { NodeDetailsDialog } from "@/components/NodeDetailsDialog";
import { DirectNodesDialog } from "@/components/DirectNodesDialog";

interface NodeInfoPanelProps {
  node: MeshtasticNode | null;
  isOpen: boolean;
  togglePanel: () => void;
  directNodeCount: number | null;
  isLoadingDirectCount: boolean;
}

export function NodeInfoPanel({
  node,
  isOpen,
  togglePanel,
  directNodeCount,
  isLoadingDirectCount,
}: NodeInfoPanelProps) {
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [directNodesDialogOpen, setDirectNodesDialogOpen] = useState(false);

  if (!node) return null;

  const position = convertMeshtasticPosition(
    node.position?.latitude_i,
    node.position?.longitude_i,
  );

  const lastSeen = node.gateways
    ?.map((gateway) => new Date(gateway.last_seen))
    ?.reduce(
      (latest, current) => (current > latest ? current : latest),
      new Date(0),
    );

  const nodeName = node.info?.short_name || `Node !${node.id.toString(16)}`;

  return (
    <>
      <div
        className={`absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-[1000] transition-all duration-300 ${
          isOpen ? "w-80" : "max-w-xs"
        }`}
      >
        {/* Header with node name and collapse button */}
        <div className="flex items-center justify-between px-4 py-2 border-b dark:border-gray-700">
          <h3 className="font-bold truncate pr-2">{nodeName}</h3>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDetailsDialogOpen(true)}
              title="View Node Details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDirectNodesDialogOpen(true)}
              title="View Direct Nodes (Last 24h)"
            >
              <Network className="h-4 w-4" />
            </Button>
            <button
              onClick={togglePanel}
              className="flex items-center justify-center w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-full"
              aria-label={isOpen ? "Collapse panel" : "Expand panel"}
            >
              {isOpen ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Details section */}
        <div className={`p-4 ${isOpen ? "block" : "hidden"}`}>
          <p>ID: !{node.id.toString(16)}</p>
          {node.info?.long_name && <p>Name: {node.info.long_name}</p>}
          {node.info?.hw_model && <p>Hardware: {node.info.hw_model}</p>}
          {lastSeen && lastSeen.getTime() > 0 && (
            <p>
              Last seen:{" "}
              {formatDistanceToNow(lastSeen, {
                addSuffix: true,
              })}
            </p>
          )}
          {position && (
            <p>
              Position: {position[0].toFixed(6)}, {position[1].toFixed(6)}
            </p>
          )}
          {node.position?.altitude && (
            <p>Altitude: {node.position.altitude}m</p>
          )}
          {node.position?.precision_bits && (
            <p>
              Precision: {getPrecisionRadius(node.position.precision_bits)}m
              radius
            </p>
          )}
          {node.position?.location_source && (
            <p>Location Source: {node.position.location_source}</p>
          )}
          {isLoadingDirectCount ? (
            <p>Loading connections...</p>
          ) : directNodeCount !== null && directNodeCount >= 0 ? (
            <p>Direct connections: {directNodeCount}</p>
          ) : null}
        </div>
      </div>

      {/* Shared dialogs */}
      <NodeDetailsDialog
        node={node}
        isOpen={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />

      <DirectNodesDialog
        nodeId={node.id}
        isOpen={directNodesDialogOpen}
        onOpenChange={setDirectNodesDialogOpen}
      />
    </>
  );
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
