import { format, isToday, isYesterday } from "date-fns";

export function formatTimestamp(dateString?: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, "h:mma").toLowerCase();
    } else if (isYesterday(date)) {
      return "Yesterday";
    } else {
      return format(date, "MMM d");
    }
  } catch {
    return "";
  }
}

export function formatMessageTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, "h:mm a");
  } catch {
    return "";
  }
}

export function formatDateDivider(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMM d, yyyy");
  } catch {
    return "";
  }
}
