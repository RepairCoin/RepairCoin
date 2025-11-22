# Service Marketplace Implementation Plan

## Overview
Building a unified service marketplace where customers can browse and book services from all shops, with integrated Stripe payments.

**Approach**: Unified Marketplace (Phase 1 MVP)
- Single marketplace showing all services from all shops
- Filters for shop, category, search
- Shop profile pages
- Stripe payment integration

---

## ✅ Completed (Session: Nov 17, 2025)

### Database Layer
- [x] Created `shop_services` table
  - Fields: service_id, shop_id, service_name, description, price_usd, duration_minutes, category, image_url, active
  - Indexes on: shop_id, category, active, created_at
  - Foreign key to shops table

- [x] Created `service_orders` table
  - Fields: order_id, service_id, customer_address, shop_id, stripe_payment_intent_id, status, total_amount, booking_date, completed_at, notes
  - Statuses: pending, paid, completed, cancelled, refunded
  - Indexes on: service_id, customer_address, shop_id, status, stripe_payment_intent_id
  - Foreign keys to shop_services and shops tables

- [x] Migration files created in `backend/migrations/`
  - `035_add_icon_to_affiliate_shop_groups.sql`
  - `036_create_shop_services.sql`
  - `037_create_service_orders.sql`

- [x] Migrations applied to database
- [x] Changes committed and pushed to repository

---

## 🔄 In Progress

### Backend Structure
- [ ] ServiceDomain directory structure created
  - `backend/src/domains/ServiceDomain/`
  - Subdirectories: controllers/, services/

---

## 📋 Remaining Tasks

### Backend Implementation

#### 1. Repositories
- [ ] Create `ServiceRepository.ts`
  - `createService(data)` - Shop creates a service
  - `getServiceById(serviceId)` - Get single service
  - `getServicesByShop(shopId)` - Get all services for a shop
  - `getAllActiveServices(filters)` - Get all services with filters (shop, category, search)
  - `updateService(serviceId, data)` - Update service
  - `deleteService(serviceId)` - Soft delete (set active = false)
  - `getServiceWithShopInfo(serviceId)` - Join with shops table for marketplace view

- [ ] Create `OrderRepository.ts`
  - `createOrder(data)` - Create order record
  - `getOrderById(orderId)` - Get single order
  - `getOrdersByCustomer(customerAddress)` - Customer order history
  - `getOrdersByShop(shopId)` - Shop order management
  - `updateOrderStatus(orderId, status)` - Update order status
  - `updatePaymentIntent(orderId, paymentIntentId)` - Store Stripe intent ID

#### 2. Services Layer
- [ ] Create `ServiceManagementService.ts`
  - Business logic for service CRUD
  - Validation rules

- [ ] Create `PaymentService.ts`
  - `createPaymentIntent(serviceId, customerAddress)` - Create Stripe Payment Intent
  - `confirmPayment(orderId, paymentIntentId)` - Verify payment with Stripe
  - `handleWebhook(event)` - Process Stripe webhooks
  - Integration with existing StripeService

#### 3. Controllers
- [ ] Create `ServiceController.ts`
  ```
  POST   /api/services              - Create service (shop)
  GET    /api/services              - Get all services (marketplace)
  GET    /api/services/:id          - Get service details
  GET    /api/services/shop/:shopId - Get shop's services
  PUT    /api/services/:id          - Update service (shop)
  DELETE /api/services/:id          - Delete service (shop)
  ```

- [ ] Create `OrderController.ts`
  ```
  POST   /api/services/orders/create-payment-intent  - Create payment
  POST   /api/services/orders/confirm                - Confirm payment
  GET    /api/services/orders/customer               - Customer orders
  GET    /api/services/orders/shop                   - Shop orders
  PUT    /api/services/orders/:id/status             - Update status
  POST   /api/services/webhooks/stripe               - Stripe webhook
  ```

#### 4. Domain Setup
- [ ] Create `ServiceDomain/index.ts` (implements DomainModule)
- [ ] Create `ServiceDomain/routes.ts` (wire up controllers)
- [ ] Register ServiceDomain in `app.ts`
- [ ] Add Swagger documentation for APIs

#### 5. Stripe Integration
- [ ] Set up webhook endpoint with signature verification
- [ ] Handle `payment_intent.succeeded` event
- [ ] Handle `payment_intent.payment_failed` event
- [ ] Update order status based on webhook events
- [ ] Emit events for RCN rewards integration

---

### Frontend Implementation

#### 1. API Service Layer
- [ ] Create `frontend/src/services/api/services.ts`
  ```typescript
  // Types
  interface ShopService { ... }
  interface ServiceOrder { ... }
  interface CreateServiceData { ... }

  // Service APIs
  createService(data)
  getAllServices(filters?)
  getServiceById(id)
  getServicesByShop(shopId)
  updateService(id, data)
  deleteService(id)

  // Order APIs
  createPaymentIntent(serviceId)
  confirmPayment(orderId, paymentIntentId)
  getMyOrders()
  getShopOrders()
  updateOrderStatus(orderId, status)
  ```

#### 2. Shop Dashboard - Services Management
- [ ] Create `frontend/src/components/shop/services/ServicesTab.tsx`
  - List all shop's services
  - Create, Edit, Delete buttons
  - Active/Inactive toggle

- [ ] Create `CreateServiceModal.tsx`
  - Form fields: name, description, price, category, duration, image
  - Category dropdown (oil_change, brake_repair, tire_rotation, etc.)
  - Image upload (optional)

- [ ] Create `EditServiceModal.tsx`
  - Pre-populate with existing data
  - Update service

- [ ] Create `ServiceOrdersTab.tsx`
  - List shop's orders
  - Filter by status
  - Mark as completed

#### 3. Customer - Service Marketplace
- [ ] Create `frontend/src/app/customer/services/page.tsx`
  - Main marketplace page
  - Grid layout of service cards

- [ ] Create `ServiceCard.tsx`
  - Display: image, name, price, shop info, rating
  - Shop badge with name and distance
  - "Book Now" button
  - Click to view details

- [ ] Create `ServiceFilters.tsx`
  - Shop dropdown (all shops)
  - Category dropdown
  - Search input
  - Location filter (nearby, 5mi, 10mi)
  - Price range slider

- [ ] Create `ServiceDetailsModal.tsx`
  - Full service details
  - Shop information
  - "Book Now" → Opens checkout

- [ ] Create `ServiceCheckoutModal.tsx`
  - Install: `@stripe/stripe-js` and `@stripe/react-stripe-js`
  - Stripe Elements integration
  - Payment form
  - Confirmation

#### 4. Customer - Orders
- [ ] Create `frontend/src/app/customer/orders/page.tsx`
  - List customer's order history
  - Filter by status
  - Order details

#### 5. Customer - Shop Profile
- [ ] Create `frontend/src/app/customer/shops/[shopId]/page.tsx`
  - Shop header (name, rating, address, contact)
  - About section
  - List of shop's services
  - Click service to book

#### 6. Navigation Updates
- [ ] Add "Services" to shop dashboard navigation
- [ ] Add "Marketplace" to customer dashboard navigation
- [ ] Add "My Orders" to customer dashboard navigation

---

## Testing Plan

### Unit Tests
- [ ] Test ServiceRepository CRUD operations
- [ ] Test OrderRepository CRUD operations
- [ ] Test PaymentService Stripe integration
- [ ] Test webhook handler logic

### Integration Tests
- [ ] Shop creates service → verify in database
- [ ] Customer views marketplace → all services returned
- [ ] Customer books service → payment intent created
- [ ] Payment succeeds → order status updated
- [ ] Shop views orders → correct orders returned

### End-to-End Flow
- [ ] Shop Dashboard:
  1. Shop logs in
  2. Navigates to Services tab
  3. Creates new service (oil change, $49.99)
  4. Verifies service appears in list

- [ ] Customer Marketplace:
  1. Customer logs in
  2. Navigates to Marketplace
  3. Sees oil change service from Shop A
  4. Filters by category "oil_change"
  5. Clicks "Book Now"
  6. Completes Stripe payment
  7. Order appears in "My Orders"

- [ ] Shop Order Management:
  1. Shop sees new order
  2. Customer comes in for service
  3. Shop marks order as "completed"
  4. RCN rewards issued to customer

---

## Service Categories (Standard List)

```typescript
export const SERVICE_CATEGORIES = [
  { value: 'oil_change', label: 'Oil Change' },
  { value: 'brake_repair', label: 'Brake Repair' },
  { value: 'tire_rotation', label: 'Tire Rotation' },
  { value: 'tire_replacement', label: 'Tire Replacement' },
  { value: 'alignment', label: 'Wheel Alignment' },
  { value: 'battery', label: 'Battery Service' },
  { value: 'diagnostics', label: 'Diagnostics' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'transmission', label: 'Transmission Service' },
  { value: 'engine', label: 'Engine Repair' },
  { value: 'cooling_system', label: 'Cooling System' },
  { value: 'exhaust', label: 'Exhaust System' },
  { value: 'other', label: 'Other' },
];
```

---

## Stripe Configuration

### Environment Variables Needed
```
STRIPE_PUBLISHABLE_KEY=pk_test_...  (frontend)
STRIPE_SECRET_KEY=sk_test_...       (backend - already have)
STRIPE_WEBHOOK_SECRET=whsec_...     (backend - need for services)
```

### Webhook Events to Handle
- `payment_intent.succeeded` → Update order status to 'paid'
- `payment_intent.payment_failed` → Update order status to 'cancelled'

---

## Future Enhancements (Phase 2+)

- [ ] Service reviews and ratings
- [ ] Appointment scheduling with time slots
- [ ] Map view for nearby services
- [ ] Service bundles/packages
- [ ] Promotional pricing
- [ ] Loyalty program integration
- [ ] Push notifications for order updates
- [ ] Service images gallery
- [ ] FAQ section per service
- [ ] Refund handling
- [ ] Deposit/partial payment options

---

## Notes

- Use existing Stripe integration patterns from shop subscriptions
- Follow domain-driven architecture like AffiliateShopGroupDomain
- Emit events for RCN rewards (existing TokenDomain can listen)
- All prices in USD (Decimal 10,2)
- Soft delete services (active flag)
- Order statuses: pending → paid → completed
- Customer address stored as wallet address (lowercase)

---

## Session Progress Tracker

**Last Updated**: November 17, 2025

**Completed Today**:
1. Database schema design and migrations
2. Tables created and verified in production database
3. Migration files committed to repository

**Next Session**:
- Start with ServiceRepository implementation
- Then OrderRepository
- Then PaymentService with Stripe integration
