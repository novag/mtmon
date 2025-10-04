import NodeList from "@/components/NodeList";
import PacketMonitor from "@/components/PacketMonitor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MeshtasticNode } from "@/lib/types";
import { StateContext } from "@/providers/StateProvider";
import axios from "axios";
import { getApiUrl } from "@/lib/config";
import { useContext, useEffect, useState } from "react";

function calculateAverageChannelUtilization(nodes: MeshtasticNode[]) {
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

  const recentNodes = nodes.filter((node) => {
    const lastSeen =
      node.gateways
        ?.map((gateway) => new Date(gateway.last_seen))
        ?.reduce(
          (latest, current) => (current > latest ? current : latest),
          new Date(0),
        ) ?? new Date(0);

    return (
      lastSeen >= fifteenMinutesAgo &&
      node?.metrics?.device_metrics &&
      typeof node.metrics?.device_metrics.channel_utilization === "number"
    );
  });

  if (recentNodes.length === 0) {
    return undefined;
  }

  const totalUtilization = recentNodes.reduce((total, node) => {
    return total + (node.metrics?.device_metrics?.channel_utilization ?? 0);
  }, 0);

  const averageUtilization = totalUtilization / recentNodes.length;

  return Math.round(averageUtilization * 10) / 10;
}

export default function DashboardPage() {
  const [nodes, setNodes] = useState<MeshtasticNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const context = useContext(StateContext);
  const { currentGatewayId, setAvgChUtil } = context!;

  const fetchNodes = async () => {
    try {
      const parameters = currentGatewayId
        ? `?gateway_id=${currentGatewayId}`
        : "";
      const response = await axios.get<MeshtasticNode[]>(
        getApiUrl(`/nodes${parameters}`),
      );
      setNodes(response.data);
      setAvgChUtil(calculateAverageChannelUtilization(response.data));
    } catch (error) {
      console.log("Error fetching data: ", error);
    } finally {
      if (isLoading) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 10000);
    return () => clearInterval(interval);
    // fetchNodes is stable enough here; including currentGatewayId to refetch on gateway change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGatewayId]);

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 sm:px-6 min-h-0">
      <div className="shrink-0 grid grid-cols-1 gap-4 min-h-0 md:grid-cols-1 md:min-h-96 md:h-[50%]">
        <Card className="flex flex-col h-96 md:h-full min-h-0">
          <CardHeader className="pb-1">
            <CardTitle className="text-lg">Nodes</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 pt-0">
            <NodeList nodes={nodes} storageKey="nodes" isLoading={isLoading} />
          </CardContent>
        </Card>
      </div>
      <Card className="flex-1 flex flex-col min-h-80 md:min-h-96 md:h-[50%]">
        <CardHeader className="pb-1">
          <CardTitle className="text-lg">Packet Monitor</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 pt-0">
          <PacketMonitor
            key={`pmon_${currentGatewayId}`}
            gatewayId={currentGatewayId}
          />
        </CardContent>
      </Card>
    </main>
  );
}
