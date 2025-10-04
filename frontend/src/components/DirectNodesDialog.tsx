import { MeshtasticNode } from "@/lib/types";
import { formatDate } from "@/lib/utils/formatters";
import { getApiUrl } from "@/lib/config";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface AugmentedMeshtasticNode extends MeshtasticNode {
  last_snr?: number | null;
  last_rssi?: number | null;
  message_count_24h?: number;
  avg_msg_per_hour_24h?: number;
  last_seen_direct?: string;
  direction?: string;
}

interface DirectNodesDialogProps {
  nodeId: number | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DirectNodesDialog({
  nodeId,
  isOpen,
  onOpenChange,
}: DirectNodesDialogProps) {
  const [directNodes, setDirectNodes] = useState<AugmentedMeshtasticNode[]>([]);
  const [isLoadingDirectNodes, setIsLoadingDirectNodes] = useState(false);

  useEffect(() => {
    const fetchDirectNodes = async () => {
      if (!nodeId || !isOpen) return;

      setIsLoadingDirectNodes(true);
      setDirectNodes([]);

      try {
        const response = await fetch(
          getApiUrl(`/nodes/${nodeId}/direct_nodes`),
        );
        if (!response.ok) {
          if (response.status === 404) {
            setDirectNodes([]);
          } else {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        } else {
          const data: AugmentedMeshtasticNode[] = await response.json();
          setDirectNodes(data);
        }
      } catch (error) {
        console.error("Failed to fetch direct nodes:", error);
        setDirectNodes([]);
      } finally {
        setIsLoadingDirectNodes(false);
      }
    };

    fetchDirectNodes();
  }, [nodeId, isOpen]);

  if (!nodeId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "h-min w-full sm:w-auto max-h-[100vh] max-w-[100vw] sm:max-h-[70vh] sm:max-w-[70vw]",
          "z-[10000]", // Higher z-index to appear above map elements
        )}
      >
        <DialogHeader className="text-left min-h-0">
          <DialogTitle>
            Direct Nodes (24h) for !{nodeId?.toString(16)}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 max-h-[90vh] sm:max-h-[60vh] sm:max-w-[60vw]">
          {isLoadingDirectNodes ? (
            <p>Loading...</p>
          ) : directNodes.length > 0 ? (
            <Table className="mt-2 w-full [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Short Name</TableHead>
                  <TableHead>Long Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last SNR</TableHead>
                  <TableHead>Last RSSI</TableHead>
                  <TableHead>Last Seen (Direct Link)</TableHead>
                  <TableHead>Direction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...directNodes]
                  .sort((a, b) => {
                    const dateA = a.last_seen_direct
                      ? new Date(a.last_seen_direct).getTime()
                      : 0;
                    const dateB = b.last_seen_direct
                      ? new Date(b.last_seen_direct).getTime()
                      : 0;

                    // Sort by date descending (most recent first)
                    if (dateA !== dateB) {
                      return dateB - dateA;
                    }

                    // If dates are equal or both are unknown, sort by ID ascending
                    return (a.id ?? 0) - (b.id ?? 0);
                  })
                  .map((node) => {
                    const lastSeenDirectDate = node.last_seen_direct
                      ? new Date(node.last_seen_direct)
                      : undefined;

                    return (
                      <TableRow key={node.id}>
                        <TableCell>!{node.id?.toString(16)}</TableCell>
                        <TableCell>{node.info?.short_name ?? "N/A"}</TableCell>
                        <TableCell>{node.info?.long_name ?? "N/A"}</TableCell>
                        <TableCell>{node.info?.role ?? "N/A"}</TableCell>
                        <TableCell>
                          {node.last_snr?.toFixed(1) ?? "N/A"}
                        </TableCell>
                        <TableCell>
                          {node.last_rssi?.toFixed(0) ?? "N/A"}
                        </TableCell>
                        <TableCell>
                          {lastSeenDirectDate
                            ? formatDate(lastSeenDirectDate)
                            : "N/A"}
                        </TableCell>
                        <TableCell>{node.direction ?? "N/A"}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          ) : (
            <p>No directly connected nodes found in the last 24 hours.</p>
          )}
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
