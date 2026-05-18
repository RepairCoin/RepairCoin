export const formatDate = (dateInput?: string | Date) => {
  if (!dateInput) return "N/A";
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};