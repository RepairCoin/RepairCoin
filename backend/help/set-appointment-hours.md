# How do I set appointment hours for a service?

Configure when customers can book a specific service so the calendar
only shows real availability.

## When to do this

After you create a service, and any time your operating hours change
(new break times, a new working day, a holiday closure).

## Steps

1. From the shop dashboard, open the **Services** tab and click the
   service you want to configure.
2. Click the **Availability** tab on the service detail page.
3. In **Shop Operating Hours**, for each day of the week:
   - Toggle the day **On** if you want bookings that day, **Off** to
     close.
   - Set the day's open and close times.
   - Optional: add a **Break Time** if you take a midday break — slots
     during the break will be hidden from customers.
4. In the booking-settings section above the day grid, set:
   - **Buffer Time (minutes)** — time added between appointments for
     prep and cleanup. Use 0 if back-to-back is fine.
   - **Max Concurrent Bookings** — how many appointments you can run at
     the same time. Solo shops usually 1; team shops can go higher.
5. Save your changes.

## Common pitfalls

- **Slots show up at the wrong time.** Your shop timezone is set
  separately. If slots look an hour off, check that the shop timezone
  matches your physical location before adjusting hours.
- **Customers can't book even though the day is "On".** Confirm
  **Max Concurrent Bookings** is at least 1 and that no break time
  covers the slot they're trying to book.
- **Holiday closures.** One-off closures (a specific Tuesday off,
  Christmas Day) are handled with date overrides rather than editing
  the weekly hours. Adjust those when you need a closed exception
  without touching your normal week.

## See also

- [create-a-service.md](create-a-service.md) — create the service
  first, then configure its hours here.
- [read-your-no-show-policy.md](read-your-no-show-policy.md) — controls
  advance-booking requirements that interact with available slots.
