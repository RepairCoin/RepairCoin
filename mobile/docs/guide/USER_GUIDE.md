# FixFlow Mobile App - User Guide

Welcome to **FixFlow** — a service marketplace and rewards platform where customers earn and redeem RCN tokens for everyday services like repairs, wellness, and more.

**Platforms:** iOS & Android
**Built with:** React Native

---

## Getting Started

### 1. Download the App
- Install FixFlow on your iOS or Android device
- Open the app to see the welcome screens

### 2. Sign In
- Swipe through the onboarding slides
- Tap **"Connect Wallet"** on the final slide
- Choose your sign-in method:
  - **Google Sign-In** (easiest — just use your Google account)
  - **Wallet Connect** (MetaMask, WalletConnect, etc.)
- If you're new, you'll be asked to fill in your name, email, and phone

### 3. Choose Your Role
- **I'm a Customer** — book services and earn rewards
- **I'm a Shop Owner** — offer services and manage bookings

---

## For Customers

### Home Dashboard

When you open the app, you'll see:

- **Your RCN Balance** — your total reward tokens
- **Your Tier** — Bronze, Silver, or Gold (more tokens = better rewards)
- **On-Chain Wallet Balance** — tokens stored in your blockchain wallet
- **Quick Actions**:
  - **Gift Token** — send tokens to friends
  - **QR Code** — show your code to shops
  - **Tier Info** — see your progress to the next tier
  - **Redeem** — use your tokens for discounts
- **Trending Services** — popular services this week
- **Recently Viewed** — services you've looked at recently

### Browsing Services

1. Tap the **Services** tab
2. Browse services in a 2-column grid
3. Use the **search bar** to find specific services
4. Tap the **filter icon** to narrow down:
   - Category (repair, wellness, cleaning, etc.)
   - Price range
   - Sort by price, duration, or newest
5. Tap the **heart icon** to save favorites
6. Tap the **share icon** to share with friends

### Booking a Service

1. Tap any service to see details
2. Read the description, price, duration, and reviews
3. Tap **"Book Now"**
4. **Step 1 — Schedule**:
   - Pick a date on the calendar
   - Choose an available time slot
5. **Step 2 — Apply Discount** (optional):
   - Enter how many RCN tokens to use for a discount
   - Tap **MAX** to use the maximum allowed
6. **Step 3 — Payment**:
   - You'll be redirected to a secure payment page
   - Enter your card details
   - After payment, you'll return to the app automatically
7. Your booking appears in **My Bookings**

**Note:** The discount amount depends on where you earned the tokens:
- **Same shop you earned at** — use up to 100% as discount
- **Different shop** — use up to 20% as discount

### Managing Your Bookings

1. Go to the **Bookings** tab
2. Filter by status: All, Approved, Completed, Cancelled, No Show, Expired
3. Tap a booking to see full details
4. Available actions:
   - **Write a Review** — after a completed service
   - **Cancel Booking** — with a reason
   - **Book Again** — reorder the same service
   - **Contact Shop** — open a chat

### Earning & Using RCN Tokens

**How to earn:**
- Complete service bookings
- Refer friends (+25 RCN per referral)
- Receive tokens from other customers

**How to use:**
- Apply as a discount when booking
- Gift to friends and family
- Redeem directly at partner shops

**Tier Benefits:**
- **Bronze** (starter) — standard earnings
- **Silver** (2,000+ lifetime RCN) — +2 RCN bonus per repair
- **Gold** (5,000+ lifetime RCN) — +5 RCN bonus per repair

### Messaging Shops

1. Tap the **Messages** tab
2. Start a conversation with any shop
3. Send text messages or photos
4. **Secure Messages**: Tap the lock icon to send password-protected messages
   - Add a hint to help the recipient remember the password
   - Only they can unlock it with the correct password

### Your Profile

1. Tap the **Account** tab
2. View your stats:
   - RCN earned over time
   - Total redeemed
   - Completed repairs
   - Referrals
3. Edit your profile (photo, name, email, phone)
4. See your tier progression
5. Access settings and support

### Referring Friends

1. Go to Account → tap **Refer Friends**
2. Share your unique code via WhatsApp, social media, or copy the link
3. When your friend completes their first repair:
   - **You earn 25 RCN**
   - **Your friend earns 10 RCN**

---

## For Shop Owners

### Getting Approved

1. Register your shop through the onboarding flow
2. Fill in business details (name, address, phone, category)
3. Your shop will be marked as **"Pending Approval"**
4. Wait for admin verification (you'll be notified via email)
5. Once approved, you can start offering services

### Home Dashboard

After approval, your dashboard shows:

- Today's bookings count
- Revenue this month
- Active services
- Pending actions (bookings to approve, reschedule requests, disputes)
- Subscription status

### Managing Services

**Create a new service:**
1. Go to the **Services** tab
2. Tap **+ Add Service**
3. Fill in:
   - Service name
   - Description
   - Category
   - Price (USD)
   - Duration (minutes)
   - Upload a photo
   - Tags
4. Configure availability:
   - Operating hours for each day
   - Break times
   - Booking slot duration
   - Advance booking window (how far ahead customers can book)
   - Minimum notice required
5. Tap **Save**

**Edit/Delete services:**
- Tap any service card to edit
- Use the delete button to remove a service

### Managing Bookings

1. Go to the **Bookings** tab
2. Switch between **Calendar** and **List** views
3. Calendar view shows all bookings with color-coded dots:
   - **Blue** — Approved
   - **Green** — Completed
   - **Red** — Cancelled
   - **Gray** — Expired
4. Tap a booking to see customer details
5. Available actions:
   - **Approve** — confirm the booking
   - **Mark Complete** — after service is done (customer gets RCN)
   - **Mark No-Show** — if customer didn't show up
   - **Cancel** — refund the customer
   - **Reschedule** — change the date/time
6. **Manual Bookings** — create bookings for walk-ins or phone reservations

### Handling Reschedule Requests

1. In the Bookings tab, tap the **⋮ More** button
2. Select **Reschedule** (red badge shows pending count)
3. View customer requests with old vs new time
4. **Approve** to accept the new time
5. **Reject** to keep the original booking

### Handling Disputes

1. In the Bookings tab, tap the **⋮ More** button
2. Select **Disputes** (red badge shows pending count)
3. Review customer dispute reasons for no-show marks
4. **Approve** the dispute to reverse the no-show penalty
5. **Reject** the dispute (requires explanation) to keep the penalty

### Customer Management

1. Go to the **Customers** tab
2. View **My Customers** (customers who booked with you) or **Search All**
3. Filter by tier (Bronze/Silver/Gold) or sort by earnings/activity
4. Tap a customer to see their full profile
5. Send direct messages
6. **Block** problematic customers to prevent future bookings

### Analytics

1. Access from the Services tab → Analytics
2. View metrics:
   - Total revenue
   - Number of bookings
   - Top performing services
   - Customer ratings
   - RCN redemption rates
3. Filter by 7, 30, or 90 days

### Subscription

FixFlow requires a **$500/month subscription** to list services.

1. Go to Settings → Subscription
2. Subscribe via Stripe (secure)
3. Your subscription auto-renews monthly
4. Cancel anytime through Settings

### Availability Settings

Set when customers can book:

1. Go to Services → Availability
2. Configure **Operating Hours** for each day
3. Set **Break Times** (e.g., lunch break)
4. Configure **Booking Settings**:
   - Slot duration (e.g., 60 minutes)
   - Buffer time between bookings
   - Maximum concurrent bookings
   - How far ahead customers can book (e.g., 7 days)
   - Minimum notice (e.g., 2 hours)
   - Allow weekend bookings?
5. Add **Date Overrides** for holidays or special hours

---

## Safety & Security

- **Encrypted Messages**: Your password-locked messages are encrypted with AES-256 — only the recipient can read them with the correct password
- **Secure Payments**: All payments are processed through Stripe — we never store card details
- **Wallet Security**: Your wallet and private keys stay on your device
- **Moderation**: Shops can block problematic customers; customers can report issues

---

## Tips for a Great Experience

### For Customers
- **Save favorite services** for quick booking later
- **Check shop ratings** before booking
- **Read reviews** to know what to expect
- **Book in advance** — some shops require 2+ hours notice
- **Apply your RCN** for automatic discounts at checkout
- **Refer friends** to earn bonus tokens

### For Shop Owners
- **Keep services up-to-date** with clear descriptions and photos
- **Respond to messages quickly** to win customer trust
- **Set realistic availability** to avoid overbooking
- **Review analytics weekly** to spot trends
- **Approve bookings promptly** so customers know you're active

---

## Frequently Asked Questions

**Q: How do I connect my wallet?**
A: Tap "Connect Wallet" on the onboarding screen and choose Google Sign-In (easiest) or a crypto wallet.

**Q: Can I use the app without a crypto wallet?**
A: Yes! Sign in with your Google account and Thirdweb creates a wallet for you automatically.

**Q: How much does it cost to use the app as a customer?**
A: Free! Customers only pay for the services they book. Shops pay a $500/month subscription.

**Q: Can I get a refund?**
A: Yes. Cancel your booking and a refund will be processed automatically. Shop-initiated cancellations receive a full refund.

**Q: What are RCN tokens worth?**
A: 1 RCN = $0.10 USD. You can use them as discounts at participating shops.

**Q: Why can't I redeem 100% at every shop?**
A: You can use up to 100% at the shop where you earned the tokens (your "home shop"), but only 20% at other shops. This encourages loyalty.

**Q: How do I delete my account?**
A: Visit https://repaircoin.ai/delete-account and follow the instructions.

**Q: What if the shop marks me as no-show by mistake?**
A: You can submit a dispute from your booking details. The shop will review and approve or reject it.

---

## Need Help?

- **Email**: Repaircoin2025@gmail.com
- **Website**: https://repaircoin.ai
- **Privacy Policy**: https://repaircoin.ai/privacy-policy
- **Contact Us**: https://repaircoin.ai/contact-us

---

**Thank you for using FixFlow!** We hope you enjoy earning rewards while getting great service. ⭐
