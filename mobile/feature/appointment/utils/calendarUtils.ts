export function getDaysInMonth(date: Date): {
  firstDay: number;
  daysInMonth: number;
} {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

export function getScrollableDays(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  const currentDay = today.getDay();

  // Start from 6 weeks ago (Sunday of that week)
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - currentDay - 42);

  // Generate 84 days (12 weeks)
  for (let i = 0; i < 84; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    days.push(day);
  }
  return days;
}
