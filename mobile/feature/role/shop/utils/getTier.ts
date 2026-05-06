export const getTierConfig = (tier: string) => {
  switch (tier?.toLowerCase()) {
    case "gold":
      return {
        color: "#FFD700",
        bgColor: "rgba(255, 215, 0, 0.15)",
        icon: "crown",
      };
    case "silver":
      return {
        color: "#C0C0C0",
        bgColor: "rgba(192, 192, 192, 0.15)",
        icon: "medal",
      };
    case "bronze":
      return {
        color: "#CD7F32",
        bgColor: "rgba(205, 127, 50, 0.15)",
        icon: "medal-outline",
      };
    default:
      return {
        color: "#666",
        bgColor: "rgba(102, 102, 102, 0.15)",
        icon: "medal-outline",
      };
  }
};
