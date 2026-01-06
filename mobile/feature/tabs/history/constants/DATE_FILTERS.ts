import { DateFilter } from "../types";

export const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];
