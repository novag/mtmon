import { format } from "date-fns";
import React from "react";

// Helper function to format date objects or ISO strings
export function formatDate(date?: Date | string | number): string {
  if (!date) {
    return "";
  }
  try {
    const dateObj =
      typeof date === "string" || typeof date === "number"
        ? new Date(date)
        : date;
    return format(dateObj, "yyyy-MM-dd HH:mm:ss");
  } catch {
    console.error("Error formatting date");
    return String(date); // Fallback to string representation
  }
}

// Helper function to render nested data with specific formatting
export const renderValue = (
  value: unknown,
  parentKey?: string,
): React.ReactNode => {
  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      // Handle arrays
      return (
        <div className="pl-4">
          {value.map((item, index) => (
            <div key={index} className="mt-1 border-l-2 border-gray-300 pl-2">
              {/* Format items in route/route_back arrays as hex */}
              {(parentKey === "route" || parentKey === "route_back") &&
              typeof item === "number"
                ? `!${item.toString(16)} (${item})`
                : renderValue(item, parentKey)}{" "}
              {/* Recursive call for array items, passing parentKey */}
            </div>
          ))}
          {value.length === 0 && (
            <span className="text-gray-500">[Empty Array]</span>
          )}
        </div>
      );
    } else {
      // Handle nested objects
      return (
        <div className="pl-4">
          {Object.entries(value)
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sort entries by key
            .map(([subKey, subValue]) => {
              // Hide node_id if the parent key is 'gateways'
              if (subKey === "node_id" && parentKey === "gateways") {
                return null;
              }
              return (
                <div key={subKey} className="mb-1 flex">
                  <span className="font-semibold mr-2 whitespace-nowrap">
                    {subKey}:
                  </span>{" "}
                  <div className="flex-1 break-words">
                    {/* Specific formatting rules for nested keys */}
                    {
                      (subKey === "node_id" || subKey === "gateway_id") &&
                      typeof subValue === "number"
                        ? `!${subValue.toString(16)} (${subValue})`
                        : (subKey === "time" || subKey === "timestamp") &&
                            typeof subValue === "number"
                          ? // Assume time is seconds timestamp if it's a number
                            `${formatDate(new Date(subValue * 1000))} (${subValue})`
                          : renderValue(
                              subValue,
                              subKey,
                            ) /* Recursive call with parent key */
                    }
                  </div>
                </div>
              );
            })}
          {Object.keys(value).length === 0 && (
            <span className="text-gray-500">{"{Empty Object}"}</span>
          )}
        </div>
      );
    }
  } else if (value === null) {
    return <span className="text-gray-500">null</span>;
  } else {
    // Handle primitive values like strings, numbers
    // Format date strings nicely if they match ISO-like format
    if (
      typeof value === "string" &&
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
    ) {
      try {
        return formatDate(value);
      } catch {
        // fallback if date parsing fails
      }
    }
    // Check for specific top-level keys handled outside this nested logic (like 'id')
    // Or just return the string value
    return String(value);
  }
};
