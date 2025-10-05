import { useEffect, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ArrowUpDown, Network, RadioTower } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MeshtasticNode, Packet } from "@/lib/types";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  ColumnDef,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { getApiUrl } from "@/lib/config";
import NodeSelector from "@/components/NodeSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatIsoTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return format(date, "yyyy-MM-dd HH:mm:ss");
}

export default function NodePacketsPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [loadingPackets, setLoadingPackets] = useState(false);
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [nodes, setNodes] = useState<MeshtasticNode[]>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "first_seen", desc: true },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filterMode, setFilterMode] = useState<string>("sent_by");

  // Date range state
  const [startDate, setStartDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }); // Start of today
  const [endDate, setEndDate] = useState<Date>(new Date());

  // Table columns
  const columns: ColumnDef<Packet>[] = [
    {
      accessorKey: "timestamp",
      accessorFn: (row) => formatIsoTimestamp(row.first_seen),
      header: ({ column }) => {
        return (
          <>
            Time
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-transparent text-stone-400 hover:text-stone-900"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </>
        );
      },
      cell: ({ row }) => <div>{row.getValue("timestamp")}</div>,
    },
    {
      accessorKey: "gateway_count",
      accessorFn: (row) => row.hops.length,
      header: ({ column }) => {
        return (
          <>
            GWs
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-transparent text-stone-400 hover:text-stone-900"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </>
        );
      },
      cell: ({ row }) => <div>{row.getValue("gateway_count")}</div>,
    },
    {
      accessorKey: "relay_node",
      accessorFn: (row) => {
        if (filterMode !== "received" || !selectedNodeId) return null;
        const receivingHop = row.hops.find(
          (hop) => hop.gateway_id === selectedNodeId,
        );
        return receivingHop?.relay_node ?? null;
      },
      header: ({ column }) => {
        return (
          <>
            Relay
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-transparent text-stone-400 hover:text-stone-900"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </>
        );
      },
      cell: ({ row }) => {
        const value = row.getValue<number | null>("relay_node");
        return <div>{value == null ? "-" : value.toString(16)}</div>;
      },
    },
    {
      accessorKey: "rssi",
      accessorFn: (row) => {
        if (!row.hops || row.hops.length === 0) return null;
        // Find the hop with the lowest RSSI value
        const lowestRssi = row.hops
          .filter((hop) => hop.rssi !== undefined)
          .map((hop) => hop.rssi)
          .sort((a, b) => a - b)[0];
        return lowestRssi;
      },
      header: ({ column }) => {
        return (
          <>
            RSSI
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-transparent text-stone-400 hover:text-stone-900"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </>
        );
      },
      cell: ({ row }) => <div>{row.getValue("rssi")}</div>,
    },
    {
      accessorKey: "snr",
      accessorFn: (row) => {
        if (!row.hops || row.hops.length === 0) return null;

        // Find the hop with the lowest RSSI
        let lowestRssiHop = null;
        let lowestRssiValue = Infinity;

        for (const hop of row.hops) {
          if (hop.rssi !== undefined && hop.rssi < lowestRssiValue) {
            lowestRssiValue = hop.rssi;
            lowestRssiHop = hop;
          }
        }

        // Return the SNR from the hop with the lowest RSSI
        return lowestRssiHop?.snr;
      },
      header: ({ column }) => {
        return (
          <>
            SNR
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-transparent text-stone-400 hover:text-stone-900"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </>
        );
      },
      cell: ({ row }) => <div>{row.getValue("snr")}</div>,
    },
    {
      accessorKey: "from",
      accessorFn: (row) => row.from_id.toString(16),
      header: "From",
      cell: ({ row }) => <div>!{row.getValue("from")}</div>,
    },
    {
      accessorKey: "to",
      accessorFn: (row) => row.to_id.toString(16),
      header: "To",
      cell: ({ row }) => <div>!{row.getValue("to")}</div>,
    },
    {
      accessorKey: "port",
      accessorFn: (row) => row.port,
      header: ({ column }) => {
        return (
          <>
            Port
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-transparent text-stone-400 hover:text-stone-900"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </>
        );
      },
      cell: ({ row }) => <div>{row.getValue("port")}</div>,
    },
    {
      accessorKey: "packet_id",
      accessorFn: (row) => row.id.toString(16),
      header: "Packet ID",
      cell: ({ row }) => <div>{row.getValue("packet_id")}</div>,
    },
    {
      accessorKey: "hop_start",
      accessorFn: (row) => row.hop_start,
      header: ({ column }) => {
        return (
          <>
            Hop Start
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-transparent text-stone-400 hover:text-stone-900"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </>
        );
      },
      cell: ({ row }) => <div>{row.getValue("hop_start")}</div>,
    },
    {
      accessorKey: "hop_limit",
      accessorFn: (row) => {
        // Only show hop limit when the node is the receiving gateway
        if (filterMode !== "received" || !selectedNodeId) return null;

        const receivingHop = row.hops.find(
          (hop) => hop.gateway_id === selectedNodeId,
        );
        return receivingHop?.hop_limit;
      },
      header: ({ column }) => {
        return (
          <>
            TTL
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-transparent text-stone-400 hover:text-stone-900"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </>
        );
      },
      cell: ({ row }) => <div>{row.getValue("hop_limit") ?? "-"}</div>,
    },
    {
      accessorKey: "length",
      accessorFn: (row) => {
        if (typeof row.payload === "string") return row.payload.length;
        if (Array.isArray(row.payload)) return row.payload.length;
        return 0;
      },
      header: ({ column }) => {
        return (
          <>
            Size
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-transparent text-stone-400 hover:text-stone-900"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </>
        );
      },
      cell: ({ row }) => <div>{row.getValue("length")} bytes</div>,
    },
    {
      accessorKey: "payload",
      enableHiding: false,
      header: "",
      cell: ({ row }) => {
        return <NodePacketsActionsCell rowOriginal={row.original} />;
      },
    },
  ];

  const table = useReactTable({
    data: packets,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((old: VisibilityState) => {
        const newVisibility =
          typeof updater === "function" ? updater(old) : updater;
        localStorage.setItem(
          `columnVisibility-nodePackets`,
          JSON.stringify(newVisibility),
        );
        return newVisibility;
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Fetch all nodes to populate the node picker
  const fetchNodes = async () => {
    setLoadingNodes(true);
    try {
      const response = await axios.get<MeshtasticNode[]>(getApiUrl("/nodes"));
      const fetchedNodes = response.data;

      // Sort nodes alphabetically by long_name, falling back to short_name or ID
      fetchedNodes.sort((a, b) => {
        const nameA =
          a.info?.long_name || a.info?.short_name || `!${a.id.toString(16)}`;
        const nameB =
          b.info?.long_name || b.info?.short_name || `!${b.id.toString(16)}`;
        return nameA.localeCompare(nameB);
      });

      setNodes(fetchedNodes);
    } catch (error) {
      console.error("Error fetching nodes:", error);
    } finally {
      setLoadingNodes(false);
    }
  };

  // Fetch packets for the selected node and date range
  const fetchPackets = async () => {
    if (!selectedNodeId) return;

    setLoadingPackets(true);
    try {
      const response = await axios.get<Packet[]>(
        getApiUrl(`/nodes/${selectedNodeId}/packets`),
        {
          params: {
            node_id: selectedNodeId,
            filter_mode: filterMode,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
          },
        },
      );
      setPackets(response.data);
    } catch (error) {
      console.error("Error fetching packets:", error);
    } finally {
      setLoadingPackets(false);
    }
  };

  // Load nodes on initial render
  useEffect(() => {
    fetchNodes();
  }, []);

  // Fetch packets when node or date range changes
  useEffect(() => {
    if (selectedNodeId) {
      fetchPackets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId, startDate, endDate, filterMode]);

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 sm:px-6 min-h-0">
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg">Node Packet History</CardTitle>
          <CardDescription>
            View all packets sent or received by a specific node
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            {/* Node selector */}
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium" htmlFor="node-select">
                Select Node
              </label>
              <NodeSelector
                nodes={nodes.map((node) => ({
                  id: node.id,
                  name: node.info?.long_name,
                }))}
                selectedNodeId={selectedNodeId}
                onNodeSelect={setSelectedNodeId}
                disabled={loadingNodes}
              />
            </div>

            {/* Date range picker */}
            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
              {/* Filter Mode Selector */}
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium">Filter Mode</label>
                <Select value={filterMode} onValueChange={setFilterMode}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Select filter mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sent_by">Sent by</SelectItem>
                    <SelectItem value="sent_to">Sent to</SelectItem>
                    <SelectItem value="received">Received (Gateway)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex flex-col space-y-1">
                  <label className="text-sm font-medium">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? (
                          format(startDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-sm font-medium">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? (
                          format(endDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => date && setEndDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>

          {/* Packets table */}
          <div className="rounded-md border overflow-hidden">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className="whitespace-nowrap"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {loadingPackets ? (
                    <TableRow>
                      <TableCell
                        colSpan={table.getVisibleFlatColumns().length}
                        className="text-center py-4"
                      >
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className="py-2 whitespace-nowrap"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={table.getVisibleFlatColumns().length}
                        className="text-center py-4"
                      >
                        {selectedNodeId
                          ? "No packets found for the selected criteria"
                          : "Select a node to view packets"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function NodePacketsActionsCell({ rowOriginal }: { rowOriginal: Packet }) {
  const [packetId, setPacketId] = useState<number>();
  const [currentHops, setCurrentHops] = useState<Packet["hops"]>();

  const handleDialogOpen = () => {
    setPacketId(rowOriginal.id);
    setCurrentHops(rowOriginal.hops);
  };

  return (
    <div className="text-right">
      <Link to={`/packets/${rowOriginal.id}`}>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">View propagation</span>
          <Network className="h-4 w-4" />
        </Button>
      </Link>
      <Dialog>
        <DialogTrigger>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={handleDialogOpen}
          >
            <span className="sr-only">View gateways</span>
            <RadioTower className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="h-min w-min max-h-[100vh] max-w-[100vw] sm:max-h-[70vh] sm:max-w-[70vw]">
          <DialogHeader className="text-left min-h-0">
            <DialogTitle>
              Gateways for packet #{packetId?.toString(16)}
            </DialogTitle>
            <ScrollArea className="flex-1 max-h-[90vh] max-w-[90vw] sm:max-h-[60vh] sm:max-w-[60vw]">
              <pre>{JSON.stringify(currentHops, null, 2)}</pre>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
