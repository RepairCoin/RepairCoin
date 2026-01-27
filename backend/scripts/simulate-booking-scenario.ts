/**
 * Simulate the exact booking scenario from the screenshot
 * User at 02:30 AM Philippines time selecting Jan 6 (Tuesday)
 */
import { hoursUntilSlotAccurate, getCurrentTimeInTimezone } from '../src/utils/timezoneUtils';

function simulateScenario() {
  const shopTimezone = 'America/New_York';
  const userTimezone = 'Asia/Manila';
  const minBookingHours = 2;

  // Get current times
  const now = new Date();
  const shopTime = getCurrentTimeInTimezone(shopTimezone);
  const userTime = getCurrentTimeInTimezone(userTimezone);

  console.log('=== CURRENT STATE ===\n');
  console.log('UTC now:', now.toISOString());
  console.log('Shop (New York):', shopTime.dateString, shopTime.timeString);
  console.log('User (Philippines):', userTime.dateString, userTime.timeString);

  // Determine what date the user would select
  // In the screenshot, user selected Jan 6 (Tuesday)
  // Let's use the user's current date as the selected date
  const selectedDate = userTime.dateString;

  console.log('\n=== SCENARIO: User selects', selectedDate, '===\n');

  // Get the day of week for the selected date
  const [year, month, day] = selectedDate.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  console.log('Selected date is:', dayNames[dayOfWeek]);

  // Tuesday hours from screenshot: 10:00 AM - 11:00 PM
  // Monday hours from screenshot: 3:00 PM - 1:00 AM
  const shopHours: Record<number, { open: string; close: string }> = {
    0: { open: '09:00', close: '17:00' }, // Sunday
    1: { open: '15:00', close: '01:00' }, // Monday (overnight)
    2: { open: '10:00', close: '23:00' }, // Tuesday
    3: { open: '09:00', close: '17:00' }, // Wednesday
    4: { open: '09:00', close: '17:00' }, // Thursday
    5: { open: '09:00', close: '17:00' }, // Friday
    6: { open: '09:00', close: '17:00' }  // Saturday
  };

  const hours = shopHours[dayOfWeek];
  console.log('Shop hours for this day:', hours.open, '-', hours.close);

  // Generate time slots and check availability
  console.log('\n=== TIME SLOT AVAILABILITY ===\n');
  console.log('Minimum notice:', minBookingHours, 'hours\n');

  const [openHour, openMin] = hours.open.split(':').map(Number);
  const [closeHour, closeMin] = hours.close.split(':').map(Number);

  // Handle overnight hours
  const openMinutes = openHour * 60 + openMin;
  const closeMinutes = closeHour * 60 + closeMin;
  const isOvernight = closeMinutes <= openMinutes;

  console.log('Overnight hours:', isOvernight);

  let slotMinutes = openMinutes;
  const endMinutes = isOvernight ? closeMinutes + 24 * 60 : closeMinutes;
  const slotDuration = 30; // 30 minute slots

  let availableCount = 0;
  let unavailableCount = 0;

  while (slotMinutes < endMinutes) {
    const hour = Math.floor((slotMinutes % (24 * 60)) / 60);
    const min = slotMinutes % 60;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

    // Determine which date this slot is on
    let slotDate = selectedDate;
    if (isOvernight && slotMinutes >= 24 * 60) {
      // This slot is on the next day
      const nextDay = new Date(year, month - 1, day + 1);
      slotDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    }

    const hoursUntil = hoursUntilSlotAccurate(slotDate, timeStr, shopTimezone);
    const available = hoursUntil >= minBookingHours;

    if (available) {
      availableCount++;
    } else {
      unavailableCount++;
    }

    // Only print first few and last few slots
    if (unavailableCount <= 3 || availableCount <= 3 || slotMinutes >= endMinutes - slotDuration * 3) {
      const status = available ? '✓ AVAILABLE' : '✗ TOO SOON';
      console.log(`${timeStr} on ${slotDate} → ${hoursUntil.toFixed(2)}h until → ${status}`);
    } else if (unavailableCount === 4) {
      console.log('...');
    }

    slotMinutes += slotDuration;
  }

  console.log('\n=== SUMMARY ===');
  console.log('Unavailable (too soon):', unavailableCount);
  console.log('Available:', availableCount);

  // Also show what the user might expect
  console.log('\n=== USER EXPECTATION VS REALITY ===\n');
  console.log('User sees: "I am booking for', selectedDate, '"');
  console.log('User expects: Slots should be filtered based on current time + minimum notice');
  console.log('');
  console.log('Current shop time:', shopTime.timeString, '(', shopTime.dateString, ')');
  console.log('Current user time:', userTime.timeString, '(', userTime.dateString, ')');
  console.log('');

  if (shopTime.dateString !== selectedDate) {
    console.log('⚠️  The selected date is NOT today in shop timezone!');
    console.log('   Selected:', selectedDate);
    console.log('   Shop today:', shopTime.dateString);
    console.log('');
    console.log('   This means ALL slots for', selectedDate, 'are in the FUTURE');
    console.log('   and should be available (which is correct behavior).');
  } else {
    console.log('✓ The selected date IS today in shop timezone.');
    console.log('  Earliest bookable time:', `${shopTime.hours + minBookingHours}:${String(shopTime.minutes).padStart(2, '0')}`);
  }
}

simulateScenario();
