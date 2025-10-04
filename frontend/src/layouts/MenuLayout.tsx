import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StateContext } from "@/providers/StateProvider";
import {
  Info,
  LayoutDashboard,
  Router,
  MapPin,
  Waypoints,
  LineChart,
} from "lucide-react";
import { useContext, useState, useCallback, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import NodeSelector from "@/components/NodeSelector";

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [isGatewaySwitching, setIsGatewaySwitching] = useState(false);

  const context = useContext(StateContext);
  const {
    currentGatewayId,
    setCurrentGatewayId,
    gateways,
    avgChUtil,
    nodeNameMap,
  } = context!;

  // Handle navigation changes
  const handleNavigation = useCallback(
    (path: string) => {
      if (location.pathname === path) {
        // Force reload of current page if we're already there
        navigate(path, { replace: true });
        return;
      }
      navigate(path);
    },
    [location.pathname, navigate],
  );

  // Handle gateway selection with loading state
  const handleGatewaySelect = useCallback(
    (nodeId: number | null) => {
      setIsGatewaySwitching(true);
      setCurrentGatewayId(nodeId === null ? 0 : nodeId);
    },
    [setCurrentGatewayId],
  );

  // Reset loading state after gateway change is processed
  useEffect(() => {
    if (isGatewaySwitching) {
      // Small delay to ensure state has updated properly
      const timer = setTimeout(() => {
        setIsGatewaySwitching(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentGatewayId, isGatewaySwitching]);

  // Handle info dialog state changes for tracking
  const handleInfoDialogChange = useCallback((open: boolean) => {
    setInfoDialogOpen(open);
  }, []);

  // Connect dialog environment-driven values (with sensible defaults)
  const connectMeshLocation =
    import.meta.env.VITE_CONNECT_MESH_LOCATION || "<MESH_LOCATION>";
  const connectMqttAddress =
    import.meta.env.VITE_CONNECT_MQTT_ADDRESS || "<MQTT_ADDRESS>";
  const connectMqttUsername =
    import.meta.env.VITE_CONNECT_MQTT_USERNAME || "<MQTT_USERNAME>";
  const connectMqttPassword =
    import.meta.env.VITE_CONNECT_MQTT_PASSWORD || "<MQTT_PASSWORD>";

  return (
    <>
      <div className="flex flex-col min-h-0 md:max-h-screen h-screen">
        <div className="border-b">
          <div className="flex h-16 items-center justify-center px-4">
            <div className="flex-1 flex justify-between items-center space-x-4">
              <div className="flex items-center">
                <ModeToggle />

                <NodeSelector
                  nodes={gateways.map((id) => ({
                    id,
                    name: nodeNameMap[id] || `!${id.toString(16)}`,
                  }))}
                  selectedNodeId={
                    currentGatewayId === 0 ? null : currentGatewayId
                  }
                  onNodeSelect={handleGatewaySelect}
                  disabled={isGatewaySwitching}
                  allowAll={true}
                  allNodesLabel="All gateways"
                  triggerButtonProps={{
                    variant: "ghost",
                    size: "sm",
                    className:
                      "ml-1 border gap-1 max-w-[250px] sm:px-3 sm:justify-between sm:bg-transparent sm:hover:bg-accent sm:hover:text-accent-foreground",
                  }}
                  triggerContent={
                    <div className="flex items-center sm:gap-2">
                      <Router className="h-4 w-4" />
                      <span className="hidden sm:inline truncate">
                        {isGatewaySwitching
                          ? "Switching..."
                          : currentGatewayId
                            ? nodeNameMap[currentGatewayId] ||
                              `!${currentGatewayId.toString(16)}`
                            : "All gateways"}
                      </span>
                    </div>
                  }
                  scrollHeight="h-auto"
                />
              </div>

              <Link to="/">
                <p className="text-center font-bold hidden md:block">
                  Meshtastic Monitor
                </p>
              </Link>

              <div className="flex items-center space-x-4">
                <div className="flex space-x-2">
                  <Button
                    variant={
                      location.pathname === "/dashboard" ? "default" : "ghost"
                    }
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => handleNavigation("/dashboard")}
                    disabled={isGatewaySwitching}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Button>
                  <Button
                    variant={location.pathname === "/map" ? "default" : "ghost"}
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => handleNavigation("/map")}
                    disabled={isGatewaySwitching}
                  >
                    <MapPin className="h-4 w-4" />
                    <span className="hidden sm:inline">Map</span>
                  </Button>
                  <Button
                    variant={
                      location.pathname === "/graph" ? "default" : "ghost"
                    }
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => handleNavigation("/graph")}
                    disabled={isGatewaySwitching}
                  >
                    <Waypoints className="h-4 w-4" />
                    <span className="hidden sm:inline">Graph</span>
                  </Button>
                  <Button
                    variant={
                      location.pathname === "/stats" ? "default" : "ghost"
                    }
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => handleNavigation("/stats")}
                    disabled={isGatewaySwitching}
                  >
                    <LineChart className="h-4 w-4" />
                    <span className="hidden sm:inline">Stats</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => {
                      setInfoDialogOpen(true);
                    }}
                    disabled={isGatewaySwitching}
                  >
                    <Info className="h-4 w-4" />
                    <span className="hidden sm:inline">Connect</span>
                  </Button>
                </div>
                {avgChUtil ? (
                  <p className="hidden sm:block text-sm">
                    ChUtil 15m:{" "}
                    <span className="font-bold whitespace-nowrap">
                      {avgChUtil} %
                    </span>
                  </p>
                ) : (
                  <p></p>
                )}
              </div>
            </div>
          </div>
        </div>

        <Dialog open={infoDialogOpen} onOpenChange={handleInfoDialogChange}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Connecting to Meshtastic Monitor</DialogTitle>
              <DialogDescription>
                Instructions for connecting your Meshtastic device to the
                Meshtastic Monitor
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="h-[calc(90vh-8rem)]">
              <div className="space-y-4 mt-4 px-1">
                <div className="p-3 border border-yellow-500 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 rounded-md">
                  <p className="font-semibold text-yellow-800 dark:text-yellow-400">
                    Important Note
                  </p>
                  <p>
                    This instance is specifically for the {connectMeshLocation}{" "}
                    mesh network. Please only add nodes that are located in{" "}
                    {connectMeshLocation} or are reliably connected to the{" "}
                    {connectMeshLocation} mesh.
                  </p>
                </div>

                <h3 className="text-lg font-semibold mt-4">Requirements</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>
                    A Meshtastic device with firmware version 2.5.17 or newer
                  </li>
                  <li>A local MQTT proxy/forwarder (e.g. Mosquitto)</li>
                  <li>
                    A proxy device if your Meshtastic device doesn't have
                    internet connectivity
                  </li>
                </ul>

                <div className="p-3 border border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 rounded-md mt-2">
                  <p className="text-sm">
                    Firmware version 2.5.14 introduced a restriction that
                    prevents uplinking all traffic to MQTT servers. This
                    limitation was lifted in version 2.5.17, which allows
                    uplinking to MQTT servers in private networks.
                  </p>
                </div>

                <h3 className="text-lg font-semibold mt-4">
                  Proxy Device Options
                </h3>
                <p>
                  If your Meshtastic device doesn't have direct internet
                  connectivity, you need one of these:
                </p>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>
                    <strong>Smartphone with client proxy enabled</strong>
                    <p className="text-sm">
                      Use an old smartphone with the Meshtastic app and enable
                      client proxy.{" "}
                      <a
                        href="https://www.meshtastic.org/docs/configuration/module/mqtt/#client-proxy-enabled"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Learn more
                      </a>
                    </p>
                  </li>
                  <li>
                    <strong>Home Assistant with Meshtastic plugin</strong>
                    <p className="text-sm">
                      Use the Home Assistant Meshtastic plugin which has a TCP
                      proxy, allowing you to still use your Meshtastic app with
                      the same device.{" "}
                      <a
                        href="https://github.com/broglep/homeassistant-meshtastic"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Learn more
                      </a>
                    </p>
                  </li>
                </ol>

                <h3 className="text-lg font-semibold mt-4">
                  Mosquitto Installation Options
                </h3>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">1. Docker</h4>
                    <p className="text-sm">
                      Use the official Mosquitto Docker image:{" "}
                      <a
                        href="https://hub.docker.com/_/eclipse-mosquitto"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        https://hub.docker.com/_/eclipse-mosquitto
                      </a>
                    </p>
                    <p className="text-sm mt-1">
                      Add the following to your mosquitto config:
                    </p>
                    <pre className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md text-xs mt-1 overflow-x-auto">
                      {`connection mtmon
address ${connectMqttAddress}

remote_username ${connectMqttUsername}
remote_password ${connectMqttPassword}
remote_clientid <YOUR_NODE_ID>

topic msh/# out 0
cleansession true
try_private false
start_type automatic
notifications false`}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-medium">2. Home Assistant</h4>
                    <p className="text-sm">
                      Use the Mosquitto add-on:{" "}
                      <a
                        href="https://github.com/home-assistant/addons/blob/master/mosquitto/DOCS.md"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        https://github.com/home-assistant/addons/blob/master/mosquitto/DOCS.md
                      </a>
                    </p>
                    <ol className="list-lower-alpha text-sm pl-5 space-y-1 mt-1">
                      <li>
                        In the customize textarea enter:
                        <pre className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md text-xs mt-1">
                          {`active: true
folder: mosquitto`}
                        </pre>
                      </li>
                      <li>
                        You can also add mosquitto specific users in the logins
                        textarea:
                        <pre className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md text-xs mt-1">
                          {`- username: test
  password: test123`}
                        </pre>
                      </li>
                      <li>
                        Use the file editor or VS Code addon (or SSH) and
                        navigate to /share/mosquitto/
                      </li>
                      <li>
                        Add a bridge.conf file with the following content:
                        <pre className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md text-xs mt-1">
                          {`connection mtmon
address ${connectMqttAddress}

remote_username ${connectMqttUsername}
remote_password ${connectMqttPassword}
remote_clientid <YOUR_NODE_ID e.g. a1b2c3d4>

topic msh/# out 0
cleansession true
try_private false
start_type automatic
notifications false`}
                        </pre>
                      </li>
                      <li>Add an accesscontrol list if desired.</li>
                    </ol>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mt-4">
                  Meshtastic MQTT Settings
                </h3>
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md">
                  <ul className="space-y-1">
                    <li>
                      <strong>Enabled:</strong> Active
                    </li>
                    <li>
                      <strong>Server Address:</strong> Address of your local
                      MQTT server (must be a private IP!)
                    </li>
                    <li>
                      <strong>Username:</strong> &lt;your mqtt username&gt;
                    </li>
                    <li>
                      <strong>Password:</strong> &lt;your mqtt password&gt;
                    </li>
                    <li>
                      <strong>Encryption Enabled:</strong> Disabled
                    </li>
                    <li>
                      <strong>JSON Enabled:</strong> Disabled
                    </li>
                    <li>
                      <strong>TLS Enabled:</strong> Disabled (except if you are
                      using TLS with a private IP)
                    </li>
                  </ul>
                </div>

                <h3 className="text-lg font-semibold mt-4">
                  Meshtastic Channel Settings (for LongFast)
                </h3>
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md">
                  <ul className="space-y-1">
                    <li>
                      <strong>Uplink enabled:</strong> Active
                    </li>
                    {/* Add other LongFast specific settings here if needed */}
                  </ul>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {isGatewaySwitching ? (
          <div className="flex-1 flex items-center justify-center bg-background">
            <div className="text-center">
              <p className="text-lg mb-2">Switching gateway...</p>
              <p className="text-muted-foreground">
                Please wait while data is loading
              </p>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </>
  );
}

export default App;
