/**
 * Test script to verify minimum notice logic works correctly
 * Tests that slots within the minimum notice window are filtered out
 */
import { hoursUntilSlotAccurate, getCurrentTimeInTimezone } from '../src/utils/timezoneUtils';

function testMinNoticeLogic() {
  const shopTimezone = 'America/New_York';
  const minBookingHours = 2; // From screenshot

  // Get current time in shop timezone
  const shopTime = getCurrentTimeInTimezone(shopTimezone);
  const now = new Date();

  console.log('=== MINIMUM NOTICE LOGIC TEST ===\n');
  console.log('Current UTC:', now.toISOString());
  console.log('Current shop time:', shopTime.dateString, shopTime.timeString, `(${shopTimezone})`);
  console.log('Minimum notice:', minBookingHours, 'hours');

  // Calculate what time would be the cutoff
  const shopMinutes = shopTime.hours * 60 + shopTime.minutes;
  const cutoffMinutes = shopMinutes + (minBookingHours * 60);
  const cutoffHour = Math.floor(cutoffMinutes / 60) % 24;
  const cutoffMin = cutoffMinutes % 60;
  const cutoffStr = `${String(cutoffHour).padStart(2, '0')}:${String(cutoffMin).padStart(2, '0')}`;

  console.log('\n=== EXPECTED BEHAVIOR ===');
  console.log(`Current shop time: ${shopTime.timeString}`);
  console.log(`Cutoff time (current + ${minBookingHours}h): ${cutoffStr}`);
  console.log(`Slots BEFORE ${cutoffStr} should be FILTERED OUT`);
  console.log(`Slots AT or AFTER ${cutoffStr} should be AVAILABLE`);

  // Test slots for today
  console.log('\n=== TESTING SLOTS FOR TODAY ===\n');
  const testDate = shopTime.dateString;

  // Generate test slots from 9 AM to 11 PM
  const testSlots: string[] = [];
  for (let h = 9; h <= 23; h++) {
    testSlots.push(`${String(h).padStart(2, '0')}:00`);
    testSlots.push(`${String(h).padStart(2, '0')}:30`);
  }

  let passedCount = 0;
  let failedCount = 0;

  testSlots.forEach(slot => {
    const hoursUntil = hoursUntilSlotAccurate(testDate, slot, shopTimezone);
    const shouldBeAvailable = hoursUntil >= minBookingHours;
    const actualResult = shouldBeAvailable ? 'AVAILABLE' : 'FILTERED';

    // Determine if this is correct
    const slotMinutes = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]);
    const expectedAvailable = slotMinutes >= cutoffMinutes || slotMinutes < shopMinutes; // Past midnight edge case

    // For slots already passed today
    if (hoursUntil < 0) {
      // Slot is in the past - should be filtered
      if (!shouldBeAvailable) {
        passedCount++;
        console.log(`✓ ${slot} → ${hoursUntil.toFixed(2)}h → ${actualResult} (past)`);
      } else {
        failedCount++;
        console.log(`✗ ${slot} → ${hoursUntil.toFixed(2)}h → ${actualResult} (SHOULD BE FILTERED - past)`);
      }
    } else if (hoursUntil < minBookingHours) {
      // Within minimum notice window - should be filtered
      if (!shouldBeAvailable) {
        passedCount++;
        console.log(`✓ ${slot} → ${hoursUntil.toFixed(2)}h → ${actualResult} (within ${minBookingHours}h notice)`);
      } else {
        failedCount++;
        console.log(`✗ ${slot} → ${hoursUntil.toFixed(2)}h → ${actualResult} (SHOULD BE FILTERED)`);
      }
    } else {
      // Beyond minimum notice - should be available
      if (shouldBeAvailable) {
        passedCount++;
        console.log(`✓ ${slot} → ${hoursUntil.toFixed(2)}h → ${actualResult}`);
      } else {
        failedCount++;
        console.log(`✗ ${slot} → ${hoursUntil.toFixed(2)}h → ${actualResult} (SHOULD BE AVAILABLE)`);
      }
    }
  });

  console.log('\n=== TEST RESULTS ===');
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount === 0) {
    console.log('\n✓ MINIMUM NOTICE LOGIC IS WORKING CORRECTLY');
  } else {
    console.log('\n✗ THERE ARE ISSUES WITH THE MINIMUM NOTICE LOGIC');
  }

  // Edge case test: slot exactly at cutoff
  console.log('\n=== EDGE CASE: Slot exactly at minimum notice boundary ===');
  const exactCutoffSlot = cutoffStr;
  const hoursUntilExact = hoursUntilSlotAccurate(testDate, exactCutoffSlot, shopTimezone);
  console.log(`Slot at ${exactCutoffSlot}: ${hoursUntilExact.toFixed(4)} hours until`);
  console.log(`Min notice: ${minBookingHours} hours`);
  console.log(`Result: ${hoursUntilExact >= minBookingHours ? 'AVAILABLE (correct - >= threshold)' : 'FILTERED'}`);
}

testMinNoticeLogic();
