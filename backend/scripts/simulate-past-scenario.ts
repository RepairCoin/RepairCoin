/**
 * Simulate scenario where user's date is AFTER the shop's date
 * E.g., User on Jan 7 Philippines, Shop on Jan 6 NY
 * User selects Jan 6 - should some slots be filtered?
 */
import { hoursUntilSlotAccurate, getCurrentTimeInTimezone } from '../src/utils/timezoneUtils';

function simulatePastScenario() {
  const shopTimezone = 'America/New_York';
  const userTimezone = 'Asia/Manila';
  const minBookingHours = 2;

  console.log('=== SIMULATING: What if user is 13 hours ahead? ===\n');
  console.log('This simulates a user in Philippines at 2:30 AM on Jan 7');
  console.log('Which would be 1:30 PM on Jan 6 in New York\n');

  // Current time
  const now = new Date();
  const shopTime = getCurrentTimeInTimezone(shopTimezone);
  const userTime = getCurrentTimeInTimezone(userTimezone);

  console.log('Current shop time:', shopTime.dateString, shopTime.timeString);
  console.log('Current user time:', userTime.dateString, userTime.timeString);

  // The selected date would be the SHOP's current date (not user's)
  // If user on Jan 7 PHT selects "Jan 6", they're selecting the shop's "today"
  const selectedDate = shopTime.dateString;

  console.log('\n=== User selects:', selectedDate, '===\n');

  // Get day of week
  const [year, month, day] = selectedDate.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  console.log('Selected date is:', dayNames[dayOfWeek]);

  // Shop hours
  const shopHours: Record<number, { open: string; close: string }> = {
    0: { open: '09:00', close: '17:00' },
    1: { open: '15:00', close: '01:00' },
    2: { open: '10:00', close: '23:00' },
    3: { open: '09:00', close: '17:00' },
    4: { open: '09:00', close: '17:00' },
    5: { open: '09:00', close: '17:00' },
    6: { open: '09:00', close: '17:00' }
  };

  const hours = shopHours[dayOfWeek];
  console.log('Shop hours:', hours.open, '-', hours.close);
  console.log('');

  // Generate slots
  const [openHour, openMin] = hours.open.split(':').map(Number);
  const [closeHour, closeMin] = hours.close.split(':').map(Number);

  const openMinutes = openHour * 60 + openMin;
  const closeMinutes = closeHour * 60 + closeMin;
  const isOvernight = closeMinutes <= openMinutes;

  let slotMinutes = openMinutes;
  const endMinutes = isOvernight ? closeMinutes + 24 * 60 : closeMinutes;
  const slotDuration = 30;

  let availableCount = 0;
  let unavailableCount = 0;

  console.log('=== SLOTS ===\n');

  while (slotMinutes < endMinutes) {
    const hour = Math.floor((slotMinutes % (24 * 60)) / 60);
    const min = slotMinutes % 60;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

    let slotDate = selectedDate;
    if (isOvernight && slotMinutes >= 24 * 60) {
      const nextDay = new Date(year, month - 1, day + 1);
      slotDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    }

    const hoursUntil = hoursUntilSlotAccurate(slotDate, timeStr, shopTimezone);
    const available = hoursUntil >= minBookingHours;

    if (available) availableCount++;
    else unavailableCount++;

    const status = available ? '✓ AVAILABLE' : '✗ TOO SOON';
    console.log(`${timeStr} → ${hoursUntil.toFixed(2)}h → ${status}`);

    slotMinutes += slotDuration;
  }

  console.log('\n=== SUMMARY ===');
  console.log('Unavailable:', unavailableCount);
  console.log('Available:', availableCount);
  console.log('');

  // Calculate earliest bookable
  const shopMinutes = shopTime.hours * 60 + shopTime.minutes;
  const earliestMinutes = shopMinutes + minBookingHours * 60;
  const earliestHour = Math.floor(earliestMinutes / 60);
  const earliestMin = earliestMinutes % 60;

  console.log('=== EXPECTED ===');
  console.log('Current shop time:', shopTime.timeString);
  console.log('Minimum notice:', minBookingHours, 'hours');
  console.log('Earliest bookable:', `${String(earliestHour).padStart(2, '0')}:${String(earliestMin).padStart(2, '0')}`);

  if (shopTime.dateString === selectedDate) {
    console.log('\n✓ Slots before', `${String(earliestHour).padStart(2, '0')}:${String(earliestMin).padStart(2, '0')}`, 'should be filtered out');
  }
}

simulatePastScenario();
