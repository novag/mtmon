import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import axios from "axios";
import { getApiUrl } from "@/lib/config";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ValueType,
  NameType,
} from "recharts/types/component/DefaultTooltipContent";
import { DateRange } from "react-day-picker";
import NodeSelector from "@/components/NodeSelector";

const MOBILE_BREAKPOINT = 768;

interface PortnumStats {
  [key: string]: number;
}

const formatPercentageTick = (value: number): string => {
  return `${value}%`;
};

const abbreviateLabel = (label: string): string => {
  if (!label) return "";
  const parts = label.split("_");
  if (parts.length === 1) {
    return label.charAt(0).toUpperCase();
  }
  return (
    label.charAt(0) +
    parts
      .slice(1)
      .map((part) => part.charAt(0))
      .join("")
  ).toUpperCase();
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1 text-sm">
          <p className="text-muted-foreground">Type:</p>
          <p className="font-medium">{label}</p>
          <p className="text-muted-foreground">Percent:</p>
          <p className="font-medium">{Number(payload[0].value).toFixed(1)}%</p>
          <p className="text-muted-foreground">Count:</p>
          <p className="font-medium">{data.count}</p>
        </div>
      </div>
    );
  }
  return null;
};

interface PacketTypeStatsChartProps {
  date: DateRange | undefined;
  gatewayId?: number;
}

export default function PacketTypeStatsChart({
  date,
  gatewayId,
}: PacketTypeStatsChartProps) {
  const [stats, setStats] = useState<PortnumStats>({});
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState(
    window.innerWidth < MOBILE_BREAKPOINT,
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const params = new URLSearchParams();
      if (selectedNodeId !== null) {
        params.append("node_id", selectedNodeId.toString());
      }
      if (date?.from) params.append("start_time", date.from.toISOString());
      if (date?.to) params.append("end_time", date.to.toISOString());
      if (gatewayId) params.append("gateway_id", gatewayId.toString());

      const response = await axios.get<PortnumStats>(
        getApiUrl(`/stats/portnums?${params.toString()}`),
      );
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching portnum stats:", error);
      setStats({});
    } finally {
      setLoadingStats(false);
    }
  }, [selectedNodeId, date?.from, date?.to, gatewayId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totalCount = Object.values(stats).reduce(
    (sum, count) => sum + count,
    0,
  );

  const chartData = Object.entries(stats)
    .map(([name, count]) => ({
      name,
      percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
      count: count,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Packet Type Statistics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="node-select"
              className="text-sm font-medium text-muted-foreground"
            >
              Node
            </label>
            <NodeSelector
              selectedNodeId={selectedNodeId}
              onNodeSelect={setSelectedNodeId}
              allowAll={true}
              allNodesLabel="All Nodes"
              disabled={loadingStats}
            />
          </div>
        </div>

        <div className="h-[450px] w-full">
          {loadingStats ? (
            <div className="flex flex-col space-y-3 h-full pt-4">
              <Skeleton className="h-[125px] w-full rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </div>
              <Skeleton className="h-[250px] w-full rounded-xl" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full border rounded-lg bg-muted/40">
              <p className="text-muted-foreground">
                No data available for the selected criteria.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={true}
                  axisLine={true}
                  dy={10}
                  stroke="hsl(var(--foreground))"
                  tickFormatter={(value) =>
                    isMobile ? abbreviateLabel(value) : value
                  }
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={true}
                  axisLine={true}
                  dx={-10}
                  stroke="hsl(var(--foreground))"
                  tickFormatter={formatPercentageTick}
                  domain={[0, 100]}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                />
                <Legend />
                <Bar
                  dataKey="percentage"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
