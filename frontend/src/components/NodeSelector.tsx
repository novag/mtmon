import { useState, useContext } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import React from "react";
import { StateContext } from "@/providers/StateProvider";

interface MinimalNode {
  id: number;
  name?: string;
}

interface NodeSelectorProps {
  nodes?: MinimalNode[];
  selectedNodeId: number | null;
  onNodeSelect: (nodeId: number | null) => void;
  allowAll?: boolean;
  allNodesLabel?: string;
  disabled?: boolean;
  triggerButtonProps?: React.ComponentProps<typeof Button>;
  triggerContent?: React.ReactNode;
  scrollHeight?: string;
}

export default function NodeSelector({
  nodes: nodesProp,
  selectedNodeId,
  onNodeSelect,
  allowAll = false,
  allNodesLabel = "All Nodes",
  disabled = false,
  triggerButtonProps,
  triggerContent,
  scrollHeight = "h-[250px]",
}: NodeSelectorProps) {
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const context = useContext(StateContext);

  // Determine the node list to use: prop override or filtered context fallback
  const nodes = (() => {
    if (nodesProp) {
      return nodesProp;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const nodeNameMap = context?.nodeNameMap ?? {};
    const nodeLastSeenMap = context?.nodeLastSeenMap ?? {};

    return Object.entries(nodeNameMap)
      .map(([idStr, name]) => ({ id: parseInt(idStr, 10), name }))
      .filter((node) => {
        const lastSeen = nodeLastSeenMap[node.id];
        // Keep node if it has been seen within the last 7 days
        return lastSeen && new Date(lastSeen) >= sevenDaysAgo;
      })
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  })();

  const getDisplayLabel = (nodeId: number | null): string => {
    if (nodeId === null && allowAll) {
      return allNodesLabel;
    }
    if (nodeId !== null) {
      // Find the node in the list to get its long_name
      const node = nodes.find((n) => n.id === nodeId);
      const idHex = `!${nodeId.toString(16)}`;
      if (node?.name) {
        return `${node.name} (${idHex})`;
      }
      return idHex; // Fallback to hex ID if long_name is missing
    }
    return "Select node...";
  };

  return (
    <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={comboboxOpen}
          className={cn(
            "w-auto justify-between text-left font-normal min-w-[200px]",
            triggerButtonProps?.className,
          )}
          id="node-select-combobox"
          disabled={disabled}
          {...triggerButtonProps}
        >
          {triggerContent || getDisplayLabel(selectedNodeId)}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-auto" align="start">
        <Command>
          <CommandInput placeholder="Search node..." />
          <CommandList>
            <ScrollArea className={scrollHeight}>
              <CommandEmpty>No node found.</CommandEmpty>
              <CommandGroup>
                {allowAll && (
                  <CommandItem
                    key="all-nodes"
                    value={allNodesLabel} // Use label directly as value for 'all' option
                    onSelect={() => {
                      onNodeSelect(null);
                      setComboboxOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedNodeId === null ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {allNodesLabel}
                  </CommandItem>
                )}
                {nodes.map((node) => {
                  const idHex = `!${node.id.toString(16)}`;
                  const longName = node.name || "";
                  // Construct display name directly
                  const displayName = longName
                    ? `${longName} (${idHex})`
                    : idHex;
                  // Simplify search value
                  const searchValue = `${node.id}|${longName}|${idHex}`;

                  return (
                    <CommandItem
                      key={node.id}
                      value={searchValue} // Use the simplified search value
                      onSelect={() => {
                        // Directly use node.id from the map context
                        onNodeSelect(node.id);
                        setComboboxOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedNodeId === node.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      {displayName} {/* Use the constructed display name */}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
