import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import axios from "axios";
import { getApiUrl } from "@/lib/config";
import { DateRange } from "react-day-picker";
import { NodeNameMap } from "@/providers/StateProvider";

interface NoisyNodeStat {
  nodeId: number;
  count: number;
}

interface NoisyNodesTableProps {
  date: DateRange | undefined;
  nodeNameMap: NodeNameMap;
  availablePortnums: string[]; // Pass down available portnums for the filter
  gatewayId?: number;
}

export default function NoisyNodesTable({
  date,
  nodeNameMap,
  availablePortnums,
  gatewayId,
}: NoisyNodesTableProps) {
  const [noisyNodesData, setNoisyNodesData] = useState<NoisyNodeStat[]>([]);
  const [selectedPortnum, setSelectedPortnum] = useState<string | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  const fetchNoisyNodes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPortnum && selectedPortnum !== "all")
        params.append("portnum", selectedPortnum);
      if (date?.from) params.append("start_time", date.from.toISOString());
      if (date?.to) params.append("end_time", date.to.toISOString());
      if (gatewayId) params.append("gateway_id", gatewayId.toString());

      const response = await axios.get<NoisyNodeStat[]>(
        getApiUrl(`/stats/nodes?${params.toString()}`),
      );
      // Data is already sorted by backend
      setNoisyNodesData(response.data);
    } catch (error) {
      console.error("Error fetching noisy nodes stats:", error);
      setNoisyNodesData([]);
    } finally {
      setLoading(false);
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchNoisyNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPortnum, date, gatewayId]); // Re-fetch when portnum filter, date, or gateway changes

  return (
    <Card>
      <CardHeader>
        <CardTitle>Noisy Nodes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Portnum Selector */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="portnum-select"
              className="text-sm font-medium text-muted-foreground"
            >
              Packet Type (Portnum)
            </label>
            <Select
              value={selectedPortnum ?? "all"}
              onValueChange={(value) =>
                setSelectedPortnum(value === "all" ? undefined : value)
              }
              disabled={loading}
            >
              <SelectTrigger id="portnum-select" className="w-[200px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {availablePortnums.map((portnum) => (
                  <SelectItem key={portnum} value={portnum}>
                    {portnum}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Loading indicator for subsequent loads */}
        {loading && !isInitialLoading && (
          <Progress value={undefined} className="w-full h-1 mb-2" />
        )}

        <div className="h-auto min-h-[250px] w-full overflow-x-auto">
          {/* Show skeletons ONLY on initial load */}
          {isInitialLoading ? (
            <div className="flex flex-col space-y-3 pt-4">
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ) : noisyNodesData.length === 0 ? (
            <div className="flex items-center justify-center h-[100px] border rounded-lg bg-muted/40">
              <p className="text-muted-foreground">
                No node data available for the selected criteria.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Node Name</TableHead>
                  <TableHead className="w-[40%]">Node ID</TableHead>
                  <TableHead className="w-[20%] text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {noisyNodesData.map((node) => (
                  <TableRow key={node.nodeId}>
                    <TableCell className="font-medium">
                      {nodeNameMap[node.nodeId] || "Unknown Name"}
                    </TableCell>
                    <TableCell>{node.nodeId.toString(16)}</TableCell>
                    <TableCell className="text-right">{node.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
