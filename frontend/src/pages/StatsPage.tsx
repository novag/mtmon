import { useState, useEffect, useContext } from "react";
import { StateContext } from "@/providers/StateProvider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { addDays, format } from "date-fns";
import { DateRange } from "react-day-picker";
import axios from "axios";
import { getApiUrl } from "@/lib/config";
import PacketTypeStatsChart from "@/components/stats/PacketTypeStatsChart";
import NoisyNodesTable from "@/components/stats/NoisyNodesTable";

// Interface for the simplified portnum fetch
interface PortnumStats {
  [key: string]: number;
}

export default function StatsPage() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -7),
    to: new Date(),
  });
  // State to hold available portnums for the filter
  const [availablePortnums, setAvailablePortnums] = useState<string[]>([]);
  const [portnumsLoading, setPortnumsLoading] = useState<boolean>(false);

  const context = useContext(StateContext);
  const { nodeNameMap, currentGatewayId } = context!;

  // Fetch overall portnum stats just to get the list of types for the filter
  const fetchAvailablePortnums = async () => {
    setPortnumsLoading(true);
    try {
      const params = new URLSearchParams();
      // Fetch for all nodes, but use the selected date range
      if (date?.from) params.append("start_time", date.from.toISOString());
      if (date?.to) params.append("end_time", date.to.toISOString());

      const response = await axios.get<PortnumStats>(
        getApiUrl(`/stats/portnums?${params.toString()}`),
      );
      setAvailablePortnums(Object.keys(response.data).sort()); // Sort alphabetically
    } catch (error) {
      console.error("Error fetching available portnums:", error);
      setAvailablePortnums([]);
    } finally {
      setPortnumsLoading(false);
    }
  };

  // Fetch available portnums when the date range changes
  useEffect(() => {
    fetchAvailablePortnums();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <main className="flex-1 flex flex-col gap-6 p-4 sm:px-6 sm:py-6">
      {/* Shared Date Range Picker */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className={cn("grid gap-1.5")}>
          <label
            htmlFor="date-range"
            className="text-sm font-medium text-muted-foreground"
          >
            Date Range
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date-range"
                variant={"outline"}
                disabled={portnumsLoading} // Disable while fetching initial portnums
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !date && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <PacketTypeStatsChart date={date} gatewayId={currentGatewayId} />
      <NoisyNodesTable
        date={date}
        nodeNameMap={nodeNameMap}
        availablePortnums={availablePortnums}
        gatewayId={currentGatewayId}
      />
    </main>
  );
}
