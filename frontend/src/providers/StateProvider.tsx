import { Packet } from "@/lib/types";
import { createContext, ReactNode, useEffect, useRef, useState } from "react";
import { getWsUrl } from "@/lib/config";
import axios from "axios";
import { getApiUrl } from "@/lib/config";

interface NodeInfo {
  id: number;
  info: {
    long_name: string;
  };
  last_seen?: string;
}

export interface NodeNameMap {
  [key: number]: string;
}

interface MenuContextType {
  currentGatewayId: number;
  setCurrentGatewayId: React.Dispatch<React.SetStateAction<number>>;
  gateways: number[];
  setGateways: React.Dispatch<React.SetStateAction<number[]>>;
  nodeNameMap: NodeNameMap;
  setNodeNameMap: React.Dispatch<React.SetStateAction<NodeNameMap>>;
  avgChUtil: number | undefined;
  setAvgChUtil: React.Dispatch<React.SetStateAction<number | undefined>>;
  nodeLastSeenMap: { [key: number]: string };
  packets: Packet[];
  setPackets: React.Dispatch<React.SetStateAction<Packet[]>>;
}

const StateContext = createContext<MenuContextType | undefined>(undefined);

const StateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentGatewayId, setCurrentGatewayId] = useState<number>(0);
  const [gateways, setGateways] = useState<number[]>([]);
  const [nodeNameMap, setNodeNameMap] = useState<NodeNameMap>({});
  const [nodeLastSeenMap, setNodeLastSeenMap] = useState<{
    [key: number]: string;
  }>({});
  const [avgChUtil, setAvgChUtil] = useState<number>();
  const [packets, setPackets] = useState<Packet[]>([]);

  const ws = useRef<WebSocket | null>(null);
  const connectionAttempts = useRef<number>(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const response = await axios.get<NodeInfo[]>(getApiUrl(`/nodes`));
        const newNodeMap: NodeNameMap = {};
        const newLastSeenMap: { [key: number]: string } = {};
        response.data.forEach((node) => {
          newNodeMap[node.id] =
            node.info?.long_name || `Node ${node.id.toString(16)}`;
          if (node.last_seen) {
            newLastSeenMap[node.id] = node.last_seen;
          }
        });
        setNodeNameMap(newNodeMap);
        setNodeLastSeenMap(newLastSeenMap);
      } catch (error) {
        console.error("Error fetching nodes:", error);
      }
    };

    fetchNodes();
  }, []);

  useEffect(() => {
    const fetchGateways = async () => {
      try {
        const response = await axios.get<number[]>(getApiUrl("/gateways"));
        setGateways(response.data);
      } catch (error) {
        console.error("Error fetching gateways:", error);
      }
    };

    fetchGateways();
  }, []);

  useEffect(() => {
    connectionAttempts.current = 0;

    // Close existing connection if it exists
    if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
      console.log("Closing existing WebSocket connection.");
      ws.current.close();
      ws.current = null;
    }

    const connectWebSocket = () => {
      if (connectionAttempts.current >= maxReconnectAttempts) {
        console.error("Max reconnection attempts reached, giving up");
        return;
      }

      connectionAttempts.current += 1;
      console.log(`WebSocket connection attempt ${connectionAttempts.current}`);

      const parameters = currentGatewayId
        ? `?gateway_id=${currentGatewayId}`
        : "";

      try {
        ws.current = new WebSocket(getWsUrl(`/ws${parameters}`));

        ws.current.onopen = () => {
          console.log("WebSocket connection established");
          connectionAttempts.current = 0; // Reset on successful connection
        };

        ws.current.onmessage = (event) => {
          try {
            const newPacket: Packet = JSON.parse(event.data);
            setPackets((prevPackets) => {
              // Add or update packet (limit to 1000 packets to prevent memory issues)
              const packetIndex = prevPackets.findIndex(
                (packet) => packet.id === newPacket.id,
              );

              if (packetIndex === -1) {
                // Packet does not exist, add to list
                const newPackets = [newPacket, ...prevPackets];
                return newPackets.slice(0, 1000); // Limit to 1000 packets
              } else {
                // Update existing packet
                const updatedPackets = [...prevPackets];
                updatedPackets[packetIndex] = {
                  ...prevPackets[packetIndex],
                  hops: newPacket.hops,
                  first_seen:
                    new Date(newPacket.first_seen) <
                    new Date(prevPackets[packetIndex].first_seen)
                      ? newPacket.first_seen
                      : prevPackets[packetIndex].first_seen,
                };
                return updatedPackets;
              }
            });

            // Update last seen map for involved nodes
            const packetTimestamp = newPacket.first_seen;
            setNodeLastSeenMap((prevMap) => {
              const updatedMap = { ...prevMap };
              const fromNode = newPacket.from_id;
              const toNode = newPacket.to_id;

              // Update 'from' node if packet is newer than last seen
              if (
                !updatedMap[fromNode] ||
                new Date(packetTimestamp) > new Date(updatedMap[fromNode])
              ) {
                updatedMap[fromNode] = packetTimestamp;
              }

              // Update 'to' node if packet is newer than last seen
              if (
                !updatedMap[toNode] ||
                new Date(packetTimestamp) > new Date(updatedMap[toNode])
              ) {
                updatedMap[toNode] = packetTimestamp;
              }

              return updatedMap;
            });
          } catch (error) {
            console.error("Error processing WebSocket message:", error);
          }
        };

        ws.current.onclose = (event) => {
          console.log(
            `WebSocket connection closed: ${event.code} - ${event.reason}`,
          );

          // Only attempt to reconnect if it wasn't deliberately closed
          if (event.code !== 1000) {
            // Reconnect with exponential backoff
            const timeout = Math.min(
              1000 * Math.pow(2, connectionAttempts.current),
              30000,
            );
            setTimeout(connectWebSocket, timeout);
          }
        };

        ws.current.onerror = (error) => {
          console.error("WebSocket error:", error);
        };
      } catch (error) {
        console.error("Error creating WebSocket:", error);
        // Try to reconnect with a delay
        setTimeout(connectWebSocket, 2000);
      }
    };

    connectWebSocket();

    return () => {
      if (ws.current) {
        // Use a clean close code (1000) to indicate deliberate closure
        ws.current.close(1000, "Component unmounting or gateway changing");
        ws.current = null;
      }
    };
  }, [currentGatewayId]);

  return (
    <StateContext.Provider
      value={{
        currentGatewayId,
        setCurrentGatewayId,
        gateways,
        setGateways,
        nodeNameMap,
        setNodeNameMap,
        avgChUtil,
        setAvgChUtil,
        nodeLastSeenMap,
        packets,
        setPackets,
      }}
    >
      {children}
    </StateContext.Provider>
  );
};

export { StateContext, StateProvider };
