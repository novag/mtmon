import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FilterFnOption,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, Eye, Network } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Option } from "./MultipleSelector";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { MeshtasticNode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { NodeDetailsDialog } from "@/components/NodeDetailsDialog";
import { DirectNodesDialog } from "@/components/DirectNodesDialog";

const ROLES: Option[] = [
  { label: "CLIENT", value: "CLIENT" },
  { label: "CLIENT_HIDDEN", value: "CLIENT_HIDDEN" },
  { label: "CLIENT_MUTE", value: "CLIENT_MUTE" },
  { label: "LOST_AND_FOUND", value: "LOST_AND_FOUND" },
  { label: "REPEATER", value: "REPEATER" },
  { label: "ROUTER", value: "ROUTER" },
  { label: "ROUTER_CLIENT", value: "ROUTER_CLIENT" },
  { label: "ROUTER_LATE", value: "ROUTER_LATE" },
  { label: "SENSOR", value: "SENSOR" },
  { label: "TAK", value: "TAK" },
  { label: "TAK_TRACKER", value: "TAK_TRACKER" },
  { label: "TRACKER", value: "TRACKER" },
];

const PRIORITY_ROLES: string[] = [
  "REPEATER",
  "ROUTER",
  "ROUTER_CLIENT",
  "ROUTER_LATE",
];

const multiSelectFilter: FilterFnOption<MeshtasticNode> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true;
  const rowValue = row.getValue(columnId);
  return !!filterValue.find((option) => option === rowValue);
};

export const columns: ColumnDef<MeshtasticNode>[] = [
  {
    accessorKey: "id",
    accessorFn: (row) => row.id.toString(16),
    header: "ID",
    cell: ({ row }) => (
      <div
        className={cn({
          "font-bold": PRIORITY_ROLES.includes(row.original.info?.role ?? ""),
        })}
      >
        {row.getValue("id")}
      </div>
    ),
  },
  {
    accessorKey: "short_name",
    accessorFn: (row) => row.info?.short_name ?? "",
    header: ({ column }) => {
      return (
        <>
          Short
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
    cell: ({ row }) => (
      <div
        className={cn({
          "font-bold": PRIORITY_ROLES.includes(row.original.info?.role ?? ""),
        })}
      >
        {row.getValue("short_name")}
      </div>
    ),
  },
  {
    accessorKey: "long_name",
    accessorFn: (row) => row.info?.long_name ?? "",
    header: ({ column }) => {
      return (
        <>
          Long
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
    cell: ({ row }) => (
      <div
        className={cn({
          "font-bold": PRIORITY_ROLES.includes(row.original.info?.role ?? ""),
        })}
      >
        {row.getValue("long_name")}
      </div>
    ),
  },
  {
    accessorKey: "channel_utilization",
    accessorFn: (row) => row?.metrics?.device_metrics?.channel_utilization,
    header: ({ column }) => {
      return (
        <>
          ChUtil
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
    cell: ({ row }) => {
      let chUtil: number | undefined = row.getValue("channel_utilization");
      return (
        chUtil !== undefined && <div>{Math.round(chUtil * 10) / 10} %</div>
      );
    },
  },
  {
    accessorKey: "air_util_tx",
    accessorFn: (row) => row?.metrics?.device_metrics?.air_util_tx,
    header: ({ column }) => {
      return (
        <>
          AirUtilTx
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
    cell: ({ row }) => {
      let airUtilTx: number | undefined = row.getValue("air_util_tx");
      return airUtilTx && <div>{Math.round(airUtilTx * 10) / 10} %</div>;
    },
  },
  {
    accessorKey: "hop_limit",
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
    cell: ({ row }) => {
      const hopLimit = row.getValue("hop_limit") as number | null;
      const displayValue =
        hopLimit === null || hopLimit === undefined ? "N/A" : hopLimit;
      const isHigh = typeof hopLimit === "number" && hopLimit > 5;

      return (
        <div className={cn({ "text-red-600": isHigh })}>{displayValue}</div>
      );
    },
  },
  {
    accessorKey: "message_count",
    header: ({ column }) => {
      return (
        <>
          Msg/h
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
    cell: ({ row }) => {
      return <div>{row.original.avg_msg_per_hour_24h ?? 0}</div>;
    },
  },
  {
    accessorKey: "role",
    accessorFn: (row) => row.info?.role,
    header: ({ column }) => {
      return (
        <>
          Role
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
    cell: ({ row }) => (
      <div
        className={cn({
          "text-red-600": PRIORITY_ROLES.includes(
            row.original.info?.role ?? "",
          ),
        })}
      >
        {row.getValue("role")}
      </div>
    ),
    filterFn: multiSelectFilter,
  },
  {
    accessorKey: "legacy",
    header: ({ column }) => {
      return (
        <>
          Legacy
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
    cell: ({ row }) => <div>{row.getValue("legacy") ? "Yes" : "No"}</div>,
  },
  {
    accessorKey: "first_seen",
    accessorFn: (row) => formatDate(new Date(row.first_seen)),
    header: ({ column }) => {
      return (
        <>
          First Seen
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
    cell: ({ row }) => <div>{row.getValue("first_seen")}</div>,
  },
  {
    accessorKey: "last_seen",
    accessorFn: (row) => {
      const gateways = row.gateways;
      if (!gateways || gateways.length === 0) {
        return new Date(row.first_seen);
      }

      const latestGatewaySeen = gateways
        .map((gateway) => new Date(gateway.last_seen))
        .reduce(
          (latest, current) => (current > latest ? current : latest),
          new Date(0),
        );
      return latestGatewaySeen;
    },
    header: ({ column }) => {
      return (
        <>
          Last Seen
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
    cell: ({ row }) => <div>{formatDate(row.getValue("last_seen"))}</div>,
  },
  {
    id: "actions",
    enableHiding: false,
    header: "",
    cell: ({ row }) => {
      return <NodeActionsCell rowOriginal={row.original} />;
    },
  },
];

interface NodeListProps {
  nodes: MeshtasticNode[];
  storageKey: string;
  isLoading: boolean;
  defaultVisibilityState?: VisibilityState;
  defaultColumnFilters?: ColumnFiltersState;
}

export default function NodeList({
  nodes,
  storageKey,
  isLoading,
  defaultVisibilityState,
  defaultColumnFilters,
}: NodeListProps) {
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "last_seen",
      desc: true,
    },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    defaultColumnFilters ? defaultColumnFilters : [],
  );
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => {
      const savedVisibilityState = localStorage.getItem(
        `columnVisibility-${storageKey}`,
      );
      return savedVisibilityState
        ? JSON.parse(savedVisibilityState)
        : defaultVisibilityState || {
            channel_utilization: false,
            legacy: false,
            first_seen: false,
          };
    },
  );
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const table = useReactTable({
    data: nodes,
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
          `columnVisibility-${storageKey}`,
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

  useEffect(() => {
    table.getColumn("role")?.setFilterValue(selectedRoles);
  }, [selectedRoles, table]);

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <ScrollArea>
        <div className="flex items-center py-2">
          <Input
            placeholder="Filter ID (hex)..."
            value={(table.getColumn("id")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("id")?.setFilterValue(event.target.value)
            }
            className="min-w-36 max-w-36 mr-1"
          />
          <Input
            placeholder="Filter short name..."
            value={
              (table.getColumn("short_name")?.getFilterValue() as string) ?? ""
            }
            onChange={(event) =>
              table.getColumn("short_name")?.setFilterValue(event.target.value)
            }
            className="min-w-48 max-w-48 mr-1"
          />
          <Input
            placeholder="Filter long name..."
            value={
              (table.getColumn("long_name")?.getFilterValue() as string) ?? ""
            }
            onChange={(event) =>
              table.getColumn("long_name")?.setFilterValue(event.target.value)
            }
            className="min-w-48 max-w-48 mr-1"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="mr-1">
                Roles
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ROLES.map((role) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={role.value}
                    checked={selectedRoles.includes(role.value)}
                    onCheckedChange={(value) =>
                      setSelectedRoles((prevSelectedRoles) => {
                        if (value) {
                          return [...prevSelectedRoles, role.value];
                        } else {
                          return prevSelectedRoles.filter(
                            (i) => i !== role.value,
                          );
                        }
                      })
                    }
                  >
                    {role.label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Columns
              </Button>
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

        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <ScrollArea className="flex-1 rounded-md border w-full">
        <Table className={cn({ relative: isLoading })}>
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

          {isLoading ? (
            <TableBody>
              {[...Array(10)].map((_, i) => (
                <TableRow key={`skel-row-${i}`}>
                  <TableCell>
                    <Skeleton className="h-5 w-20 mx-1" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 mx-1" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-48 mx-1" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 mx-1" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 mx-1" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 mx-1" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24 mx-1" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-40 mx-1" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 mx-1" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          ) : (
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="py-0 whitespace-nowrap"
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
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No nodes available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          )}
        </Table>

        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

function NodeActionsCell({ rowOriginal }: { rowOriginal: MeshtasticNode }) {
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDirectNodesDialogOpen, setIsDirectNodesDialogOpen] = useState(false);

  const handleViewDialogOpen = () => {
    setCurrentNodeId(rowOriginal.id);
    setIsViewDialogOpen(true);
  };

  const handleDirectNodesDialogOpen = () => {
    setCurrentNodeId(rowOriginal.id);
    setIsDirectNodesDialogOpen(true);
  };

  return (
    <div className="text-right space-x-1 flex justify-end">
      <Button
        variant="ghost"
        className="h-8 w-8 p-0"
        onClick={handleViewDialogOpen}
        title="View Node Details"
      >
        <span className="sr-only">View node</span>
        <Eye className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        className="h-8 w-8 p-0"
        onClick={handleDirectNodesDialogOpen}
        title="View Direct Nodes (Last 24h)"
      >
        <span className="sr-only">View Direct Nodes</span>
        <Network className="h-4 w-4" />
      </Button>

      <NodeDetailsDialog
        node={currentNodeId ? rowOriginal : null}
        isOpen={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
      />

      <DirectNodesDialog
        nodeId={currentNodeId}
        isOpen={isDirectNodesDialogOpen}
        onOpenChange={setIsDirectNodesDialogOpen}
      />
    </div>
  );
}
