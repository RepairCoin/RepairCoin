/**
 * Format date string for display
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const dateStr = date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
  return `${time} • ${dateStr}`;
};
