import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, Eye, Network, RadioTower } from "lucide-react";
import { useContext, useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { Link } from "react-router-dom";
import { Packet } from "@/lib/types";
import { StateContext } from "@/providers/StateProvider";
import { formatDate, renderValue } from "@/lib/utils/formatters";
import NodeSelector from "./NodeSelector";

export const columns: ColumnDef<Packet>[] = [
  {
    accessorKey: "timestamp",
    accessorFn: (row) => formatDate(row.first_seen),
    header: ({ column }) => {
      return (
        <>
          Time
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-transparent text-stone-400 hover:text-stone-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
          Gateways
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-transparent text-stone-400 hover:text-stone-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </>
      );
    },
    cell: ({ row }) => <div>{row.getValue("gateway_count")}</div>,
  },
  {
    accessorKey: "rssi",
    accessorFn: (row) => row.hops?.[0]?.rssi,
    header: ({ column }) => {
      return (
        <>
          RSSI
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-transparent text-stone-400 hover:text-stone-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
    accessorFn: (row) => row.hops?.[0]?.snr,
    header: ({ column }) => {
      return (
        <>
          SNR
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-transparent text-stone-400 hover:text-stone-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
    accessorKey: "packet_id",
    accessorFn: (row) => row.id.toString(16),
    header: "Packet ID",
    cell: ({ row }) => <div>{row.getValue("packet_id")}</div>,
  },
  {
    accessorKey: "want_ack",
    accessorFn: (row) => (row.want_ack ? "Yes" : "No"),
    header: ({ column }) => {
      return (
        <>
          Want ACK
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-transparent text-stone-400 hover:text-stone-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </>
      );
    },
    cell: ({ row }) => <div>{row.getValue("want_ack")}</div>,
  },
  {
    accessorKey: "via_mqtt",
    accessorFn: (row) => (row.via_mqtt ? "Yes" : "No"),
    header: ({ column }) => {
      return (
        <>
          Via MQTT
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-transparent text-stone-400 hover:text-stone-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </>
      );
    },
    cell: ({ row }) => <div>{row.getValue("via_mqtt")}</div>,
  },
  {
    accessorKey: "ttl",
    accessorFn: (row) => row.hops?.[0]?.hop_limit,
    header: ({ column }) => {
      return (
        <>
          TTL
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-transparent text-stone-400 hover:text-stone-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </>
      );
    },
    cell: ({ row }) => <div>{row.getValue("ttl")}</div>,
  },
  {
    accessorKey: "hop_limit",
    accessorFn: (row) => row.hop_start,
    header: ({ column }) => {
      return (
        <>
          Hop Limit
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-transparent text-stone-400 hover:text-stone-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </>
      );
    },
    cell: ({ row }) => <div>{row.getValue("hop_limit")}</div>,
  },
  {
    accessorKey: "port",
    header: ({ column }) => {
      return (
        <>
          Port
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-transparent text-stone-400 hover:text-stone-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </>
      );
    },
    cell: ({ row }) => <div>{row.getValue("port")}</div>,
  },
  {
    accessorKey: "payload",
    enableHiding: false,
    header: "",
    cell: ({ row }) => {
      return <PacketActionsCell rowOriginal={row.original} />;
    },
  },
];

interface PacketMonitorProps {
  gatewayId: number;
}

export default function PacketMonitor({ gatewayId }: PacketMonitorProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedFromNodeId, setSelectedFromNodeId] = useState<number | null>(
    null,
  );
  const [selectedToNodeId, setSelectedToNodeId] = useState<number | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => {
      const savedVisibilityState = localStorage.getItem(
        `columnVisibility-packetMonitor`,
      );
      return savedVisibilityState
        ? JSON.parse(savedVisibilityState)
        : {
            gateway_count: false,
            rssi: false,
            snr: false,
          };
    },
  );

  // Memoize filtered data to prevent excessive re-calculations
  const [filteredPackets, setFilteredPackets] = useState<Packet[]>([]);

  const context = useContext(StateContext);
  const { packets } = context!;

  // Update filtered packets when packets, gatewayId, or selected nodes change
  useEffect(() => {
    // Limit how many packets we process to prevent excessive CPU usage
    const maxPacketsToProcess = 200;
    const packetsToProcess = packets.slice(0, maxPacketsToProcess);

    const newFilteredPackets = packetsToProcess.filter((packet) => {
      const gatewayMatch = gatewayId
        ? packet.hops.some((hop) => hop.gateway_id === gatewayId)
        : true;
      const fromNodeMatch =
        selectedFromNodeId !== null
          ? packet.from_id === selectedFromNodeId
          : true;
      const toNodeMatch =
        selectedToNodeId !== null ? packet.to_id === selectedToNodeId : true;

      return gatewayMatch && fromNodeMatch && toNodeMatch;
    });

    setFilteredPackets(newFilteredPackets);
  }, [packets, gatewayId, selectedFromNodeId, selectedToNodeId]);

  const table = useReactTable({
    data: filteredPackets,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((old) => {
        const newVisibility =
          typeof updater === "function" ? updater(old) : updater;
        localStorage.setItem(
          `columnVisibility-packetMonitor`,
          JSON.stringify(newVisibility),
        );
        return newVisibility;
      });
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  });

  return (
    <>
      <ScrollArea>
        <div className="flex items-center gap-2 py-2">
          {/* From Node Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              From Node
            </label>
            <NodeSelector
              selectedNodeId={selectedFromNodeId}
              onNodeSelect={setSelectedFromNodeId}
              allowAll={true}
              allNodesLabel="All Nodes"
              disabled={false}
            />
          </div>

          {/* To Node Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              To Node
            </label>
            <NodeSelector
              selectedNodeId={selectedToNodeId}
              onNodeSelect={setSelectedToNodeId}
              allowAll={true}
              allNodesLabel="All Nodes"
              disabled={false}
            />
          </div>

          {/* Columns Dropdown */}
          <div className="flex flex-col gap-1.5 ml-auto">
            <label className="text-sm font-medium text-muted-foreground opacity-0">
              Columns
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Columns</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <ScrollArea className="flex flex-col flex-1 min-h-0 rounded-md border w-full">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2 whitespace-nowrap">
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
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Waiting for packets...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </>
  );
}

function PacketActionsCell({ rowOriginal }: { rowOriginal: Packet }) {
  const [packetId, setPacketId] = useState<number>();
  const [currentHops, setCurrentHops] = useState<Packet["hops"]>();
  const [currentPayload, setCurrentPayload] = useState<Packet["payload"]>();

  const handleDialogOpen = () => {
    setPacketId(rowOriginal.id);
    setCurrentHops(rowOriginal.hops);
    setCurrentPayload(rowOriginal.payload);
  };

  return (
    <div className="text-right">
      <Link to={`/packets/${rowOriginal.id}`}>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">View propagation</span>
          <Network className="h-4 w-4" />
        </Button>
      </Link>

      {/* Gateways Dialog */}
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
        <DialogContent className="h-min w-full sm:w-auto max-h-[100vh] max-w-[100vw] sm:max-h-[70vh] sm:max-w-[70vw]">
          <DialogHeader className="text-left min-h-0">
            <DialogTitle>
              Gateways for packet #{packetId?.toString(16)}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[90vh] max-w-[90vw] sm:max-h-[60vh] sm:max-w-[60vw]">
            {currentHops && (
              <div className="text-sm font-mono mt-2">
                {renderValue(currentHops)}
              </div>
            )}

            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Payload Dialog */}
      <Dialog>
        <DialogTrigger>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={handleDialogOpen}
          >
            <span className="sr-only">View payload</span>
            <Eye className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="h-min w-full sm:w-auto max-h-[100vh] max-w-[100vw] sm:max-h-[70vh] sm:max-w-[70vw]">
          <DialogHeader className="text-left min-h-0">
            <DialogTitle>Packet: #{packetId?.toString(16)}</DialogTitle>
            <ScrollArea className="flex-1 max-h-[90vh] max-w-[90vw] sm:max-h-[60vh] sm:max-w-[60vw]">
              {!!currentPayload && (
                <div className="text-sm font-mono mt-2">
                  {renderValue(currentPayload)}
                </div>
              )}

              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
