import { createBrowserRouter, redirect } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import MenuLayout from "./layouts/MenuLayout";
import PacketPage from "./pages/PacketPage";
import MapPage from "./pages/MapPage";
import NodePacketsPage from "./pages/NodePacketsPage";
import StatsPage from "./pages/StatsPage";
import GraphPage from "./pages/GraphPage";

function indexLoader() {
  return redirect("/dashboard");
}

export default function createRouter() {
  return createBrowserRouter(
    [
      {
        id: "root",
        path: "/",
        children: [
          {
            index: true,
            loader: indexLoader,
          },
          {
            Component: MenuLayout,
            children: [
              {
                path: "dashboard",
                Component: DashboardPage,
              },
              {
                path: "map",
                Component: MapPage,
              },
              {
                path: "graph",
                Component: GraphPage,
              },
              {
                path: "packets/:packetId",
                Component: PacketPage,
              },
              {
                path: "packets",
                Component: NodePacketsPage,
              },
              {
                path: "stats",
                Component: StatsPage,
              },
            ],
          },
        ],
      },
    ],
    { basename: "/" },
  );
}
