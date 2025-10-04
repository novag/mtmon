import { MeshtasticNode } from "@/lib/types";
import { renderValue } from "@/lib/utils/formatters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { cn } from "@/lib/utils";

interface NodeDetailsDialogProps {
  node: MeshtasticNode | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NodeDetailsDialog({
  node,
  isOpen,
  onOpenChange,
}: NodeDetailsDialogProps) {
  if (!node) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "h-min w-full sm:w-auto max-h-[100vh] max-w-[100vw] sm:max-h-[70vh] sm:max-w-[70vw]",
          "z-[10000]", // Higher z-index to appear above map elements
        )}
      >
        <DialogHeader className="text-left min-h-0">
          <DialogTitle>
            Node: !{node?.id?.toString(16)}{" "}
            {node?.info?.short_name && `(${node?.info?.short_name})`}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 max-h-[90vh] max-w-[90vw] sm:max-h-[60vh] sm:max-w-[60vw]">
          <div className="text-sm font-mono mt-2">
            {[
              ...Object.entries(node)
                .filter(
                  ([, value]) => typeof value !== "object" || value === null,
                )
                .sort(([keyA], [keyB]) => {
                  const priorityOrder = [
                    "id",
                    "first_seen",
                    "last_seen",
                    "hop_limit",
                    "message_count",
                    "legacy",
                  ];
                  const indexA = priorityOrder.indexOf(keyA);
                  const indexB = priorityOrder.indexOf(keyB);

                  if (indexA !== -1 && indexB !== -1) {
                    return indexA - indexB; // Both are priority keys
                  } else if (indexA !== -1) {
                    return -1; // Only A is priority
                  } else if (indexB !== -1) {
                    return 1; // Only B is priority
                  } else {
                    return keyA.localeCompare(keyB); // Neither is priority, sort alphabetically
                  }
                }),
              ...Object.entries(node)
                .filter(
                  ([key, value]) =>
                    typeof value === "object" &&
                    value !== null &&
                    key !== "gateways",
                )
                .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)),
              ...Object.entries(node).filter(([key]) => key === "gateways"),
            ].map(([key, value]) => (
              <div key={key} className="mb-2 flex">
                <span className="font-semibold mr-2 whitespace-nowrap">
                  {key}:
                </span>{" "}
                <div className="flex-1 break-words">
                  {key === "id" && typeof value === "number"
                    ? `!${value.toString(16)} (${value})`
                    : renderValue(value, key)}
                </div>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
