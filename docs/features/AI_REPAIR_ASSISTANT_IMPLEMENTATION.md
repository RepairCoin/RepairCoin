# AI Repair Assistant - Implementation Document

**Feature:** AI-Powered Repair Diagnostic Assistant
**Priority:** High
**Estimated Effort:** 40-60 hours
**Target Launch:** 8-10 weeks

---

## 📊 Implementation Progress

**Overall Progress:** 🚧 **45% Complete** (Phase 1: 80% | Phase 2: 0% | Phase 3: 30% | Phase 4: 70%)

**Last Updated:** June 4, 2026

### Phase Status Summary

| Phase | Status | Progress | Hours Spent | Hours Remaining |
|-------|--------|----------|-------------|-----------------|
| **Phase 1: Foundation** | ✅ Complete (Frontend) | 80% | ~15h | ~5h (backend) |
| **Phase 2: AI Integration** | 🔜 Not Started | 0% | 0h | ~15-20h |
| **Phase 3: Image Analysis** | 🔜 Not Started (UI Ready) | 30% | 0h | ~10-15h |
| **Phase 4: Polish** | 🚧 Partial | 70% | ~5h | ~3-5h |
| **TOTAL** | 🚧 In Progress | **45%** | **~20h** | **~33-45h** |

### What's Complete ✅

- [x] All frontend UI components (9 components)
- [x] TypeScript types and interfaces
- [x] Zustand state management
- [x] Mock AI API service
- [x] Chat history persistence
- [x] Mobile-responsive design
- [x] Animations and loading states
- [x] Image upload interface
- [x] Quick actions
- [x] Error handling UI

### What's Pending ⏳

- [ ] Backend API endpoints
- [ ] Database schema setup
- [ ] OpenAI GPT-4 integration
- [ ] OpenAI Vision API integration
- [ ] DigitalOcean Spaces setup
- [ ] Service matching algorithm
- [ ] Cost estimation logic
- [ ] Analytics tracking
- [ ] A/B testing framework

### Next Steps 🎯

1. **Build Backend Phase 1** - Create API endpoints and database (5-8 hours)
2. **Integrate OpenAI GPT-4** - Connect real AI (15-20 hours)
3. **Add Vision Analysis** - Image AI integration (10-15 hours)
4. **Production Deployment** - Deploy and monitor (3-5 hours)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Vision](#product-vision)
3. [User Experience & UI Design](#user-experience--ui-design)
4. [Technical Architecture](#technical-architecture)
5. [Implementation Phases](#implementation-phases)
6. [Database Schema](#database-schema)
7. [API Specifications](#api-specifications)
8. [AI/ML Implementation](#aiml-implementation)
9. [Cost Analysis](#cost-analysis)
10. [Success Metrics](#success-metrics)
11. [Testing Strategy](#testing-strategy)
12. [Deployment Plan](#deployment-plan)

---

## Executive Summary

**What:** An AI-powered chatbot that helps customers diagnose device issues, upload damage photos for AI analysis, receive repair cost estimates, and get personalized service recommendations.

**Why:**
- Reduces booking friction and uncertainty
- Increases conversion rate by 25%+
- Provides instant value before booking
- Reduces support burden on shops
- Differentiates from competitors

**Where:** Bottom-right chat widget on customer pages (floating button)

**Value Proposition:**
- **For Customers:** Instant diagnosis, cost transparency, confidence in booking
- **For Shops:** Better-qualified leads, reduced "tire-kicker" bookings, higher satisfaction
- **For Platform:** Higher conversion, more transactions, competitive advantage

---

## Product Vision

### Customer Journey

**Before AI Assistant:**
```
Customer has broken phone
  → Unsure what's wrong
  → Unsure of cost
  → Browses services (confused)
  → Maybe books, maybe leaves

Conversion: ~15%
```

**With AI Assistant:**
```
Customer has broken phone
  → Opens AI Assistant
  → Uploads photo of damage
  → AI: "Cracked screen, $80-$120, 3 nearby shops"
  → Books in 2 clicks

Conversion: ~40% (target)
```

### Key Features

1. **Conversational Interface** - Natural chat experience
2. **Image Analysis** - Upload photos, AI diagnoses damage
3. **Cost Estimation** - Instant price range based on AI analysis
4. **Service Matching** - Auto-recommend relevant services
5. **One-Click Booking** - Seamless transition to checkout
6. **Multi-Device Support** - Phone, tablet, laptop repairs
7. **Chat History** - Save conversations for reference

---

## User Experience & UI Design

### Chat Widget Position

**Location:** Bottom-right corner of screen (floating)

**States:**
1. **Minimized:** Floating button with icon + badge
2. **Expanded:** Chat window (400px wide × 600px tall on desktop)
3. **Mobile:** Full-screen overlay on mobile

### Visual Design

#### Minimized State (Floating Button)
```
┌─────────────────────────────────────┐
│                                     │
│   [Website Content]                 │
│                                     │
│                                     │
│                              ┌────┐ │
│                              │ 🤖 │ │ ← Floating button
│                              │ 1  │ │ ← Notification badge
│                              └────┘ │
└─────────────────────────────────────┘
```

**Floating Button Specs:**
- Size: 60px × 60px circle
- Color: Primary brand color (with gradient)
- Icon: 🤖 robot or chat bubble
- Badge: Notification count (if unread messages)
- Animation: Subtle pulse on first load
- Shadow: `box-shadow: 0 4px 12px rgba(0,0,0,0.15)`

#### Expanded State (Chat Window)

```
┌─────────────────────────────────────┐
│                                     │
│   [Website Content]                 │
│                         ┌──────────┐│
│                         │ AI Help  ││
│                         │    [×]   ││
│                         ├──────────┤│
│                         │ 🤖       ││
│                         │ Hi! I can││
│                         │ help you ││
│                         │ diagnose ││
│                         │ your     ││
│                         │ device!  ││
│                         │          ││
│                         │ 👤       ││
│                         │ My phone ││
│                         │ screen   ││
│                         │ is broken││
│                         ├──────────┤│
│                         │[📷][💬]  ││
│                         └──────────┘│
└─────────────────────────────────────┘
```

**Chat Window Specs:**
- Width: 400px (desktop), 100% (mobile)
- Height: 600px (desktop), 100vh (mobile)
- Position: Fixed bottom-right (20px from edges)
- Border-radius: 12px (desktop), 0 (mobile)
- Shadow: `box-shadow: 0 8px 24px rgba(0,0,0,0.15)`
- Z-index: 9999

### Chat Interface Components

#### Header
```
┌────────────────────────────────┐
│ 🤖 AI Repair Assistant    [×] │
│ ● Online                       │
└────────────────────────────────┘
```

**Elements:**
- Robot icon + title
- Status indicator (online/offline)
- Close button (×)
- Background: Gradient or solid brand color

#### Chat Area
```
┌────────────────────────────────┐
│                                │
│  🤖 AI Bot                     │
│  ┌──────────────────────────┐ │
│  │ Hi! I'm your AI repair   │ │
│  │ assistant. I can help    │ │
│  │ diagnose device issues.  │ │
│  │                          │ │
│  │ What device needs repair?│ │
│  └──────────────────────────┘ │
│  10:30 AM                      │
│                                │
│                   You 👤       │
│  ┌──────────────────────────┐ │
│  │ My iPhone screen is      │ │
│  │ cracked                  │ │
│  └──────────────────────────┘ │
│  10:31 AM                      │
│                                │
└────────────────────────────────┘
```

**Styling:**
- Bot messages: Left-aligned, light gray background
- User messages: Right-aligned, brand color background
- Timestamps: Small text below each message
- Avatar: 32px circle for bot, optional for user
- Padding: 16px between messages
- Font: 14px body text

#### Input Area
```
┌────────────────────────────────┐
│ [📷] Type a message...    [→] │
└────────────────────────────────┘
```

**Elements:**
- Camera icon button (upload photo)
- Text input field
- Send button (arrow icon)
- Emoji picker (optional)
- Auto-resize textarea (multi-line)

#### Quick Actions (Chips)
```
┌────────────────────────────────┐
│ 🤖 What type of device is it?  │
│                                │
│ [📱 Phone] [💻 Laptop]        │
│ [⌚ Watch] [🎧 AirPods]        │
└────────────────────────────────┘
```

**Styling:**
- Pills/chips with icons
- Clickable, hover effects
- Colors: Outlined buttons with brand accent on hover

#### Photo Upload Interface
```
┌────────────────────────────────┐
│ 🤖 Upload a photo of the       │
│    damage for AI analysis      │
│                                │
│ ┌──────────────────────────┐  │
│ │                          │  │
│ │    📷 Click to Upload    │  │
│ │    or Drag & Drop        │  │
│ │                          │  │
│ └──────────────────────────┘  │
│                                │
│ ✅ Tip: Clear, well-lit photos │
│    work best!                  │
└────────────────────────────────┘
```

**Features:**
- Drag-and-drop support
- Click to upload
- Preview thumbnail
- Loading spinner during upload
- Progress bar for large files

#### AI Analysis Result
```
┌────────────────────────────────┐
│ 🤖 AI Analysis Complete! ✅    │
│                                │
│ ┌──────────────────────────┐  │
│ │ [Thumbnail of photo]     │  │
│ └──────────────────────────┘  │
│                                │
│ 📊 Diagnosis:                  │
│ • Cracked front screen         │
│ • Moderate damage (6/10)       │
│ • No internal damage visible   │
│                                │
│ 💰 Estimated Cost:             │
│ $80 - $120                     │
│                                │
│ 🔧 Recommended Service:        │
│ "iPhone Screen Replacement"    │
│                                │
│ [View Shops Near You →]        │
└────────────────────────────────┘
```

### Conversation Flow Examples

#### Flow 1: Photo-First Diagnosis

```
🤖 Hi! I'm your AI repair assistant.
   What device needs repair?

   [📱 Phone] [💻 Laptop] [⌚ Watch] [🎧 AirPods]

👤 [Clicks: Phone]

🤖 Got it! What's wrong with your phone?
   You can describe it or upload a photo.

👤 [Uploads photo of cracked screen]

🤖 [Analyzing image... ⏳]

🤖 Analysis complete! ✅

   📊 I can see:
   • Cracked front screen (top-left corner)
   • Severity: Moderate
   • Touchscreen likely still works

   💰 Estimated repair cost: $80-$120

   I found 3 shops nearby that can fix this:

   1. TechFix - $95 ⭐4.8 (0.5 mi)
   2. QuickRepair - $110 ⭐4.9 (1.2 mi)
   3. RepairPro - $100 ⭐4.7 (2.1 mi)

   [View All Options →] [Book Now →]

👤 [Clicks: View All Options]

🤖 [Opens service marketplace filtered to "iPhone Screen Repair"]
```

#### Flow 2: Text-Based Diagnosis

```
🤖 Hi! What brings you here today?

👤 My laptop won't turn on

🤖 I can help! Let's figure this out.

   What happens when you press the power button?

   [Nothing happens] [Lights flash] [Fan spins but no display]

👤 [Clicks: Nothing happens]

🤖 Got it. A few more questions:

   1. Is the charger plugged in?
   2. Does the charging light turn on?

👤 Yes, charger is plugged in but no light

🤖 Thanks! Based on your answers, this is likely:

   📊 Diagnosis:
   • Power supply issue (90% probability)
   • Possible motherboard issue (10% probability)

   💰 Estimated cost: $60-$150

   📸 Want to upload a photo for more accurate diagnosis?

   [Upload Photo] [Skip & Find Services]

👤 [Clicks: Skip & Find Services]

🤖 Here are shops that can help:

   1. Laptop Repair Pro - $80 diagnostic ⭐4.9
   2. TechSolutions - $50 diagnostic ⭐4.7

   [View Services →]
```

#### Flow 3: Quick Service Finder

```
🤖 Hi! Looking for a repair?

👤 iPhone battery replacement

🤖 Perfect! I can help you find iPhone battery services.

   What model is your iPhone?

   [iPhone 14] [iPhone 13] [iPhone 12] [Other]

👤 [Clicks: iPhone 13]

🤖 Great! iPhone 13 battery replacement.

   💰 Typical cost: $60-$90
   ⏱️ Typical time: 30-60 minutes

   🔋 Tips:
   • Battery health below 80%? Time to replace!
   • You'll earn 10 RCN after completion

   📍 Finding shops near you...

   [3 shops found near "Your Location"]

   [See Results →]
```

### Mobile Responsive Design

#### Mobile - Minimized
```
┌──────────────┐
│              │
│  [Content]   │
│              │
│              │
│         ┌──┐ │
│         │🤖│ │ ← 50px button
│         └──┘ │
└──────────────┘
```

#### Mobile - Expanded (Full-screen)
```
┌──────────────┐
│ AI Assistant │ ← Header
│         [×]  │
├──────────────┤
│              │
│  [Messages]  │ ← Chat area
│              │
│              │
│              │
├──────────────┤
│ [📷][Input]→ │ ← Input
└──────────────┘
```

### Accessibility Features

**WCAG 2.1 AA Compliance:**
- Keyboard navigation (Tab, Enter, Esc)
- Screen reader support (ARIA labels)
- High contrast mode
- Focus indicators
- Alt text for images
- Keyboard shortcuts:
  - `Ctrl+K` or `Cmd+K` - Open/close chat
  - `Esc` - Close chat
  - `Enter` - Send message

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │          AI Chat Widget Component                   │ │
│  │  • ChatWindow.tsx                                   │ │
│  │  • MessageList.tsx                                  │ │
│  │  • ImageUploader.tsx                                │ │
│  │  • ServiceRecommendations.tsx                       │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           ↓ API calls
┌─────────────────────────────────────────────────────────┐
│              Backend (Node.js + Express)                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │           AI Assistant Domain                       │ │
│  │  • ChatController.ts                                │ │
│  │  • AIAnalysisService.ts                             │ │
│  │  • ImageProcessingService.ts                        │ │
│  │  • ServiceMatchingService.ts                        │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
         ↓                    ↓                   ↓
┌──────────────┐   ┌──────────────────┐   ┌──────────────┐
│   OpenAI     │   │   PostgreSQL     │   │ DigitalOcean │
│   GPT-4      │   │   Database       │   │   Spaces     │
│   Vision API │   │   (chat history) │   │   (images)   │
└──────────────┘   └──────────────────┘   └──────────────┘
```

### Tech Stack

**Frontend:**
- React 19 with TypeScript
- Zustand for state management
- Framer Motion for animations
- React Dropzone for file uploads
- Socket.io-client for real-time (optional)

**Backend:**
- Node.js + Express
- OpenAI API (GPT-4 Vision)
- PostgreSQL for chat storage
- DigitalOcean Spaces for image storage
- Bull queue for async processing

**AI/ML:**
- OpenAI GPT-4 Turbo with Vision
- Custom prompt engineering
- Fine-tuned pricing model (optional Phase 2)

### Component Structure

```
frontend/src/components/ai-assistant/
├── AIChatWidget.tsx              # Main widget container
├── ChatWindow.tsx                # Expanded chat interface
├── FloatingButton.tsx            # Minimized state button
├── MessageList.tsx               # Scrollable message area
├── MessageBubble.tsx             # Individual message component
├── InputArea.tsx                 # Text input + upload
├── ImageUploader.tsx             # Photo upload component
├── ImagePreview.tsx              # Uploaded image preview
├── QuickActions.tsx              # Quick reply chips
├── ServiceRecommendationCard.tsx # Service suggestion card
├── TypingIndicator.tsx           # "AI is typing..." animation
└── hooks/
    ├── useAIChat.ts              # Chat logic hook
    ├── useChatHistory.ts         # History management
    └── useImageAnalysis.ts       # Image upload logic

frontend/src/stores/
└── aiChatStore.ts                # Zustand store for chat state

frontend/src/services/
└── aiAssistantService.ts         # API calls to backend

frontend/src/types/
└── aiChat.types.ts               # TypeScript interfaces
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2, 15-20 hours) ✅ COMPLETE

**Status:** ✅ **COMPLETED - June 4, 2026**

**Goal:** Build basic chat interface and backend structure

**Frontend Tasks:**
- [x] Create chat widget UI components
  - [x] FloatingButton.tsx
  - [x] ChatWindow.tsx
  - [x] MessageList.tsx
  - [x] MessageBubble.tsx
  - [x] InputArea.tsx
  - [x] QuickActions.tsx
  - [x] TypingIndicator.tsx
  - [x] ImageUploader.tsx
  - [x] AIChatWidget.tsx (main wrapper)
- [x] Set up Zustand store for chat state
- [x] Create TypeScript types/interfaces
- [x] Create API service with mock data
- [x] Chat history persistence (localStorage)
- [x] Unread message tracking
- [x] Error handling UI

**Backend Tasks:**
- [ ] Create backend AI Assistant domain
- [ ] Set up database schema
- [ ] Basic API endpoints

**Deliverables:**
- ✅ Floating chat button on customer pages
- ✅ Functional chat UI (send/receive messages)
- ✅ Mock AI responses (keyword-based)
- ✅ Image upload interface
- ✅ Quick actions (device type selection)
- ✅ Typing indicator animation
- ✅ Mobile-responsive design
- ✅ State persistence
- ⏳ Basic backend API endpoints (pending)
- ⏳ Database tables created (pending)

**Progress:** Frontend 100% | Backend 0% | Overall 80%

---

### Phase 2: AI Integration (Week 3-4, 15-20 hours) ⏳ PENDING

**Status:** 🔜 **NOT STARTED**

**Goal:** Integrate OpenAI GPT-4 for conversational AI

**Tasks:**
- [ ] Set up OpenAI API account and keys
- [ ] OpenAI GPT-4 API integration
- [ ] Prompt engineering for repair diagnosis
- [ ] Conversation flow logic
- [ ] Service matching algorithm
- [ ] Cost estimation logic
- [ ] Database queries for service matching
- [ ] Error handling for AI failures
- [ ] Rate limiting and usage tracking

**Deliverables:**
- ⏳ AI responds to customer queries
- ⏳ Natural conversation flow
- ⏳ Basic diagnosis via text
- ⏳ Service recommendations
- ⏳ Cost estimates from market data

**Progress:** 0%

---

### Phase 3: Image Analysis (Week 5-6, 10-15 hours) ⏳ PENDING

**Status:** 🔜 **NOT STARTED**

**Goal:** Add photo upload and AI vision analysis

**Tasks:**
- [ ] DigitalOcean Spaces setup
- [ ] Image storage integration
- [ ] OpenAI Vision API integration
- [ ] Image preprocessing (resize, optimize)
- [ ] Damage severity detection
- [ ] Device model recognition
- [ ] Image validation and security
- [ ] Cost estimation refinement based on images

**Deliverables:**
- ⏳ Photo upload from chat (UI ready ✅)
- ⏳ AI analyzes uploaded images
- ⏳ Visual damage assessment
- ⏳ Enhanced cost estimates
- ⏳ Device identification from photos

**Progress:** Frontend 100% | Backend 0% | Overall 30%

---

### Phase 4: Polish & Optimization (Week 7-8, 5-10 hours) 🚧 PARTIAL

**Status:** 🚧 **PARTIALLY COMPLETE**

**Goal:** Improve UX, performance, and edge cases

**Tasks:**
- [x] Loading states and animations
- [x] Chat history persistence
- [x] Mobile optimization
- [x] Accessibility improvements (keyboard nav, ARIA labels)
- [x] Smooth animations (Framer Motion)
- [x] Error handling UI
- [ ] Analytics tracking integration
- [ ] Performance optimization (lazy loading, code splitting)
- [ ] A/B testing setup
- [ ] Monitoring and alerting

**Deliverables:**
- ✅ Smooth animations
- ✅ Graceful error handling
- ✅ Mobile-responsive design
- ✅ Accessible to all users
- ⏳ Tracking events in analytics
- ⏳ Performance monitoring
- ⏳ A/B testing framework

**Progress:** 70%

---

## Database Schema

### Table: `ai_chat_sessions`

```sql
CREATE TABLE ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_address VARCHAR(42), -- Wallet address (nullable for guests)
  session_token VARCHAR(255) UNIQUE NOT NULL, -- For guest sessions
  device_type VARCHAR(50), -- 'phone', 'laptop', 'tablet', etc.
  device_model VARCHAR(100), -- 'iPhone 13', 'MacBook Pro', etc.
  issue_description TEXT, -- Customer's problem description
  diagnosis JSONB, -- AI's diagnosis result
  estimated_cost_min DECIMAL(10,2), -- Min cost estimate
  estimated_cost_max DECIMAL(10,2), -- Max cost estimate
  recommended_services JSONB, -- Array of service IDs
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'converted', 'abandoned'
  converted_to_booking_id UUID, -- References service_orders.id
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (customer_address) REFERENCES customers(wallet_address) ON DELETE SET NULL
);

CREATE INDEX idx_ai_chat_sessions_customer ON ai_chat_sessions(customer_address);
CREATE INDEX idx_ai_chat_sessions_token ON ai_chat_sessions(session_token);
CREATE INDEX idx_ai_chat_sessions_status ON ai_chat_sessions(status);
CREATE INDEX idx_ai_chat_sessions_created ON ai_chat_sessions(created_at DESC);
```

### Table: `ai_chat_messages`

```sql
CREATE TABLE ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  metadata JSONB, -- { quick_action: true, image_url: '...', etc. }
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_chat_messages_session ON ai_chat_messages(session_id, created_at);
```

### Table: `ai_uploaded_images`

```sql
CREATE TABLE ai_uploaded_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  message_id UUID NOT NULL,
  original_filename VARCHAR(255),
  storage_url TEXT NOT NULL, -- DigitalOcean Spaces URL
  file_size_bytes INT,
  mime_type VARCHAR(50),
  width INT,
  height INT,
  analysis_result JSONB, -- AI vision analysis
  damage_detected BOOLEAN,
  damage_severity VARCHAR(20), -- 'minor', 'moderate', 'severe'
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES ai_chat_messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_uploaded_images_session ON ai_uploaded_images(session_id);
CREATE INDEX idx_ai_uploaded_images_message ON ai_uploaded_images(message_id);
```

### Table: `ai_assistant_analytics`

```sql
CREATE TABLE ai_assistant_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- 'session_started', 'image_uploaded', 'service_recommended', 'converted', etc.
  event_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_assistant_analytics_type ON ai_assistant_analytics(event_type);
CREATE INDEX idx_ai_assistant_analytics_created ON ai_assistant_analytics(created_at DESC);
```

---

## API Specifications

### POST `/api/ai-assistant/chat/start`

**Description:** Initialize a new AI chat session

**Request:**
```json
{
  "customerAddress": "0x960aa...", // Optional (null for guests)
  "initialMessage": "My phone screen is cracked" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-here",
    "sessionToken": "token-for-guests",
    "message": {
      "id": "uuid",
      "role": "assistant",
      "content": "Hi! I'm your AI repair assistant. I can help diagnose device issues. What device needs repair?",
      "timestamp": "2026-06-04T10:30:00Z"
    }
  }
}
```

---

### POST `/api/ai-assistant/chat/message`

**Description:** Send a message to the AI assistant

**Request:**
```json
{
  "sessionId": "uuid-here",
  "sessionToken": "token-for-guests", // Required if not authenticated
  "message": "My iPhone screen is cracked",
  "quickAction": null // Optional: 'phone', 'laptop', etc.
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userMessage": {
      "id": "uuid",
      "role": "user",
      "content": "My iPhone screen is cracked",
      "timestamp": "2026-06-04T10:31:00Z"
    },
    "assistantMessage": {
      "id": "uuid",
      "role": "assistant",
      "content": "I can help with that! Can you upload a photo of the cracked screen? This will help me provide a more accurate diagnosis.",
      "timestamp": "2026-06-04T10:31:02Z",
      "metadata": {
        "showImageUpload": true
      }
    }
  }
}
```

---

### POST `/api/ai-assistant/chat/upload-image`

**Description:** Upload an image for AI analysis

**Request:** (multipart/form-data)
```
sessionId: uuid-here
sessionToken: token-for-guests
image: [file]
```

**Response:**
```json
{
  "success": true,
  "data": {
    "imageId": "uuid",
    "imageUrl": "https://spaces.digitalocean.com/...",
    "analysis": {
      "deviceType": "iPhone",
      "damageType": "cracked_screen",
      "severity": "moderate",
      "severityScore": 6,
      "confidence": 0.92,
      "diagnosis": "Cracked front screen with moderate damage. Touchscreen likely still functional.",
      "estimatedCost": {
        "min": 80,
        "max": 120,
        "currency": "USD"
      }
    },
    "assistantMessage": {
      "id": "uuid",
      "role": "assistant",
      "content": "Analysis complete! I can see a cracked front screen with moderate damage. Estimated repair cost: $80-$120. I found 3 shops nearby that can fix this. Would you like to see them?",
      "timestamp": "2026-06-04T10:32:00Z",
      "metadata": {
        "showServiceRecommendations": true
      }
    }
  }
}
```

---

### GET `/api/ai-assistant/chat/recommendations`

**Description:** Get service recommendations based on diagnosis

**Request:**
```
?sessionId=uuid-here
&sessionToken=token-for-guests
&latitude=37.7749
&longitude=-122.4194
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "serviceId": "uuid",
        "serviceName": "iPhone Screen Replacement",
        "shopId": "techfix",
        "shopName": "TechFix",
        "price": 95.00,
        "rating": 4.8,
        "reviewCount": 127,
        "distance": 0.5,
        "distanceUnit": "mi",
        "estimatedDuration": "30-60 minutes",
        "imageUrl": "https://...",
        "matchReason": "Exact match for iPhone screen repair"
      },
      // ... more recommendations
    ],
    "totalMatches": 3
  }
}
```

---

### GET `/api/ai-assistant/chat/history`

**Description:** Get chat history for a session

**Request:**
```
?sessionId=uuid-here
&sessionToken=token-for-guests
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "messages": [
      {
        "id": "uuid",
        "role": "assistant",
        "content": "Hi! I'm your AI repair assistant...",
        "timestamp": "2026-06-04T10:30:00Z"
      },
      {
        "id": "uuid",
        "role": "user",
        "content": "My iPhone screen is cracked",
        "timestamp": "2026-06-04T10:31:00Z"
      }
      // ... more messages
    ]
  }
}
```

---

## AI/ML Implementation

### OpenAI Integration

**Model:** GPT-4 Turbo with Vision (gpt-4-turbo-2024-04-09)

**Why GPT-4 Vision?**
- Handles both text and image inputs
- Excellent at understanding repair contexts
- Strong reasoning for diagnosis
- Good at cost estimation
- Natural conversation flow

### Prompt Engineering

#### System Prompt (Core Instructions)

```typescript
const SYSTEM_PROMPT = `You are an expert AI repair diagnostic assistant for RepairCoin, a repair services marketplace platform.

Your role:
- Help customers diagnose device issues (phones, laptops, tablets, watches, AirPods)
- Analyze photos of damaged devices
- Provide accurate repair cost estimates
- Recommend relevant services from our marketplace
- Be friendly, helpful, and conversational

Guidelines:
1. Ask clarifying questions to understand the issue
2. Request photos when visual inspection would help
3. Provide cost estimates based on typical market rates
4. Be honest about diagnosis confidence
5. Recommend booking with qualified shops
6. If unsure, suggest a professional diagnostic service

Cost estimation ranges (USD):
- Phone screen: $60-$150 (varies by model)
- Phone battery: $50-$90
- Laptop screen: $150-$400
- Laptop battery: $80-$200
- Water damage diagnostic: $50-$100
- General diagnostic: $30-$80

When analyzing images:
- Identify damage type and severity (minor/moderate/severe)
- Assess if repair is economical vs replacement
- Note any additional issues visible
- Provide confidence score for diagnosis

Keep responses:
- Concise (2-4 sentences per message)
- Friendly and empathetic
- Action-oriented (guide to next step)
- Honest about limitations

End conversations by recommending relevant services from our marketplace.`;
```

#### Image Analysis Prompt

```typescript
const IMAGE_ANALYSIS_PROMPT = `Analyze this image of a damaged device and provide:

1. Device type (phone/laptop/tablet/watch/AirPods)
2. Device model (if identifiable)
3. Damage type (cracked screen, water damage, physical damage, etc.)
4. Damage severity (minor: 1-3, moderate: 4-7, severe: 8-10)
5. Estimated repair cost range (USD)
6. Confidence in diagnosis (0.0 to 1.0)
7. Any additional visible issues
8. Repairability assessment (economical/borderline/not recommended)

Respond in JSON format:
{
  "deviceType": "phone",
  "deviceModel": "iPhone 13",
  "damageType": "cracked_screen",
  "severityScore": 6,
  "severity": "moderate",
  "estimatedCostMin": 80,
  "estimatedCostMax": 120,
  "confidence": 0.92,
  "additionalIssues": ["Minor scratches on camera lens"],
  "repairability": "economical",
  "diagnosis": "Cracked front screen with moderate damage extending from top-left corner. No visible LCD damage. Touchscreen likely still functional."
}`;
```

### Service Matching Algorithm

```typescript
interface ServiceMatchingLogic {
  // 1. Device type matching
  deviceTypeMatch: boolean; // Must match exactly

  // 2. Keyword matching
  keywordMatches: string[]; // From diagnosis to service name/description

  // 3. Category matching
  categoryMatch: boolean; // Service category matches issue type

  // 4. Price range filtering
  priceInRange: boolean; // Service price within estimated range ±30%

  // 5. Distance-based scoring
  distanceScore: number; // Closer = higher score

  // 6. Rating-based scoring
  ratingScore: number; // Higher rating = higher score

  // 7. Availability scoring
  availabilityScore: number; // Has open appointment slots
}

// Scoring formula
const matchScore =
  (deviceTypeMatch ? 40 : 0) +
  (keywordMatches.length * 10) +
  (categoryMatch ? 20 : 0) +
  (priceInRange ? 10 : 0) +
  (distanceScore * 10) +
  (ratingScore * 5) +
  (availabilityScore * 5);

// Return top 3-5 services sorted by matchScore
```

### Cost Estimation Logic

```typescript
interface CostEstimationFactors {
  deviceType: string; // Phone, laptop, etc.
  deviceBrand: string; // Apple, Samsung, Dell, etc.
  deviceModel: string; // iPhone 13, MacBook Pro 2021, etc.
  damageType: string; // Screen, battery, water damage, etc.
  damageSeverity: number; // 1-10 scale
  marketData: {
    averagePrice: number;
    priceStdDev: number;
  };
}

function estimateCost(factors: CostEstimationFactors): { min: number; max: number } {
  // Base cost from market data
  const baseMin = factors.marketData.averagePrice - factors.marketData.priceStdDev;
  const baseMax = factors.marketData.averagePrice + factors.marketData.priceStdDev;

  // Adjust for severity
  const severityMultiplier = 0.8 + (factors.damageSeverity / 10) * 0.4; // 0.8 to 1.2

  // Adjust for device brand (Apple typically 20% higher)
  const brandMultiplier = factors.deviceBrand === 'Apple' ? 1.2 : 1.0;

  return {
    min: Math.round(baseMin * severityMultiplier * brandMultiplier),
    max: Math.round(baseMax * severityMultiplier * brandMultiplier)
  };
}
```

### Conversation State Management

```typescript
interface ConversationState {
  sessionId: string;
  currentStep: 'greeting' | 'device_type' | 'issue_description' | 'photo_upload' | 'analysis' | 'recommendations';
  collectedData: {
    deviceType?: string;
    deviceModel?: string;
    issueDescription?: string;
    uploadedImages?: string[];
    diagnosis?: DiagnosisResult;
  };
  messages: ChatMessage[];
  lastActivity: Date;
}

// State transitions
const stateTransitions = {
  'greeting' -> 'device_type': 'User indicates device needs repair',
  'device_type' -> 'issue_description': 'Device type selected',
  'issue_description' -> 'photo_upload': 'Issue described, prompt for photo',
  'photo_upload' -> 'analysis': 'Image uploaded',
  'analysis' -> 'recommendations': 'AI analysis complete',
  'recommendations' -> 'booking': 'User selects a service'
};
```

---

## Cost Analysis

### Development Costs

| Phase | Hours | Rate | Cost |
|-------|-------|------|------|
| Phase 1: Foundation | 15-20h | - | - |
| Phase 2: AI Integration | 15-20h | - | - |
| Phase 3: Image Analysis | 10-15h | - | - |
| Phase 4: Polish | 5-10h | - | - |
| **Total Development** | **45-65h** | - | - |

### Monthly Operating Costs

| Service | Usage | Unit Cost | Monthly Cost |
|---------|-------|-----------|--------------|
| OpenAI GPT-4 Turbo | 10K messages/mo | $0.01/1K tokens (input) | $100-200 |
| OpenAI GPT-4 Vision | 1K images/mo | $0.01/image | $10 |
| DigitalOcean Spaces | 100GB storage | $5/mo | $5 |
| Image bandwidth | 500GB/mo | $0.01/GB | $5 |
| **Total Monthly** | - | - | **$120-220** |

**At Scale (100K messages/mo):**
- OpenAI: $1,000-2,000
- Storage/Bandwidth: $50
- **Total:** $1,050-2,050/month

### Cost Per Conversation

- Average tokens per conversation: 1,000-2,000
- Cost per conversation: $0.02-0.04
- With image analysis: $0.03-0.05

**ROI Calculation:**
- Average booking value: $100
- Platform fee (5%): $5.00
- Cost per conversation: $0.04
- **Profit per conversion:** $4.96
- **Break-even:** 1 booking per 125 conversations (0.8% conversion)
- **Target conversion:** 25%+ = $1.24 profit per conversation

---

## Success Metrics

### Primary KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Conversion Rate** | 25%+ | Sessions → Bookings |
| **User Engagement** | 4+ messages | Avg messages per session |
| **Image Upload Rate** | 40%+ | Sessions with image upload |
| **Satisfaction Score** | 4.5+/5 | Post-chat survey |
| **Diagnosis Accuracy** | 85%+ | Shop verification |

### Secondary KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Session completion rate | 70%+ | Sessions reaching recommendations |
| Avg session duration | 2-5 min | Time from start to recommendation |
| Repeat usage rate | 30%+ | Users with 2+ sessions |
| Cost estimate accuracy | ±20% | Estimated vs actual cost |
| Service match relevance | 4+/5 | User rating of recommendations |

### Analytics Events to Track

```typescript
enum AIAssistantEvent {
  SESSION_STARTED = 'ai_assistant_session_started',
  DEVICE_TYPE_SELECTED = 'ai_assistant_device_selected',
  ISSUE_DESCRIBED = 'ai_assistant_issue_described',
  IMAGE_UPLOADED = 'ai_assistant_image_uploaded',
  ANALYSIS_COMPLETED = 'ai_assistant_analysis_completed',
  RECOMMENDATIONS_VIEWED = 'ai_assistant_recommendations_viewed',
  SERVICE_CLICKED = 'ai_assistant_service_clicked',
  BOOKING_STARTED = 'ai_assistant_booking_started',
  BOOKING_COMPLETED = 'ai_assistant_booking_completed',
  SESSION_ABANDONED = 'ai_assistant_session_abandoned',
  FEEDBACK_SUBMITTED = 'ai_assistant_feedback_submitted',
}
```

### A/B Testing Ideas

1. **Greeting Message:**
   - A: "Hi! What device needs repair?"
   - B: "Hi! Upload a photo and I'll diagnose it instantly!"

2. **Image Upload Timing:**
   - A: Request photo immediately
   - B: Request photo after text description

3. **Cost Display:**
   - A: Show range ($80-$120)
   - B: Show average ($100)

4. **Recommendation Count:**
   - A: Show 3 services
   - B: Show 5 services

---

## Testing Strategy

### Unit Tests

```typescript
// Test prompt generation
describe('AIPromptService', () => {
  test('generates correct system prompt', () => {
    const prompt = generateSystemPrompt();
    expect(prompt).toContain('repair diagnostic assistant');
  });

  test('generates image analysis prompt', () => {
    const prompt = generateImageAnalysisPrompt();
    expect(prompt).toContain('JSON format');
  });
});

// Test service matching
describe('ServiceMatchingService', () => {
  test('matches services by device type', () => {
    const diagnosis = { deviceType: 'phone', damageType: 'cracked_screen' };
    const matches = matchServices(diagnosis);
    expect(matches.every(s => s.deviceType === 'phone')).toBe(true);
  });

  test('sorts by match score descending', () => {
    const matches = matchServices(diagnosis);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i-1].matchScore).toBeGreaterThanOrEqual(matches[i].matchScore);
    }
  });
});

// Test cost estimation
describe('CostEstimationService', () => {
  test('estimates iPhone screen repair cost', () => {
    const estimate = estimateCost({
      deviceType: 'phone',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 13',
      damageType: 'cracked_screen',
      damageSeverity: 6
    });
    expect(estimate.min).toBeGreaterThan(50);
    expect(estimate.max).toBeLessThan(200);
  });
});
```

### Integration Tests

```typescript
describe('AI Chat API', () => {
  test('starts new chat session', async () => {
    const response = await request(app)
      .post('/api/ai-assistant/chat/start')
      .send({ customerAddress: testAddress });

    expect(response.status).toBe(200);
    expect(response.body.data.sessionId).toBeDefined();
  });

  test('sends message and receives AI response', async () => {
    const response = await request(app)
      .post('/api/ai-assistant/chat/message')
      .send({
        sessionId: testSessionId,
        message: 'My phone screen is cracked'
      });

    expect(response.status).toBe(200);
    expect(response.body.data.assistantMessage.content).toBeDefined();
  });

  test('uploads image and receives analysis', async () => {
    const response = await request(app)
      .post('/api/ai-assistant/chat/upload-image')
      .attach('image', 'test-assets/cracked-phone.jpg')
      .field('sessionId', testSessionId);

    expect(response.status).toBe(200);
    expect(response.body.data.analysis.damageType).toBe('cracked_screen');
  });
});
```

### Manual Testing Checklist

**Functional Testing:**
- [ ] Chat widget opens/closes correctly
- [ ] Messages send and display properly
- [ ] Image upload works (drag-drop and click)
- [ ] AI responds within 3 seconds
- [ ] Service recommendations display
- [ ] One-click booking transition works
- [ ] Chat history persists on refresh
- [ ] Guest sessions work without login

**AI Quality Testing:**
- [ ] AI understands common repair issues
- [ ] Cost estimates are reasonable
- [ ] Image analysis is accurate (test 10+ images)
- [ ] Service recommendations are relevant
- [ ] Conversation flow feels natural
- [ ] AI handles edge cases gracefully

**Mobile Testing:**
- [ ] Widget works on iOS Safari
- [ ] Widget works on Android Chrome
- [ ] Full-screen mode on mobile
- [ ] Image upload from camera works
- [ ] Touch interactions smooth
- [ ] Keyboard doesn't obscure input

**Accessibility Testing:**
- [ ] Keyboard navigation works
- [ ] Screen reader announces messages
- [ ] High contrast mode works
- [ ] Focus indicators visible
- [ ] ARIA labels present

---

## Deployment Plan

### Staging Deployment (Week 7)

**Environment:** staging.repaircoin.com

**Steps:**
1. Deploy backend AI domain
2. Deploy frontend chat widget
3. Configure OpenAI API keys
4. Set up DigitalOcean Spaces bucket
5. Run database migrations
6. Smoke test all endpoints
7. Internal team testing (3 days)

**Success Criteria:**
- All API endpoints responding
- AI conversations working
- Image upload/analysis working
- No console errors

---

### Production Rollout (Week 8)

**Strategy:** Gradual rollout with feature flag

**Phase 1: 10% of users (Day 1-3)**
- Enable for 10% of customer traffic
- Monitor error rates and performance
- Collect user feedback
- A/B test against control group

**Phase 2: 50% of users (Day 4-7)**
- Expand to 50% if metrics positive
- Continue monitoring
- Optimize based on data

**Phase 3: 100% rollout (Day 8+)**
- Full rollout if all green
- Monitor conversion impact
- Iterate on prompts and UX

**Rollback Plan:**
- Feature flag can disable instantly
- Database rollback scripts ready
- Cached responses for downtime

---

### Monitoring & Alerting

**Key Metrics to Monitor:**
- API response times (target: <2s for text, <5s for images)
- Error rates (target: <1%)
- OpenAI API failures (alert if >5%)
- Conversion rate (alert if drops >10%)
- Cost per conversation (alert if >$0.10)

**Alert Thresholds:**
- 🔴 Critical: API down, error rate >5%
- 🟡 Warning: Response time >5s, error rate >2%
- 🟢 Info: Cost spike, conversion drop

---

## Future Enhancements (Phase 2)

### Advanced Features

1. **Voice Input**
   - Speak instead of type
   - Whisper API integration
   - Hands-free diagnosis

2. **Multi-Language Support**
   - Spanish, Chinese, French
   - Auto-detect language
   - Translate conversations

3. **Video Upload**
   - Record issue video
   - AI analyzes multiple angles
   - Better diagnosis accuracy

4. **Historical Tracking**
   - Device health history
   - "Your iPhone has 3 past repairs"
   - Predictive maintenance

5. **Shop Integration**
   - Shops can chat with customers
   - Handoff from AI to human
   - Seamless transition

6. **Fine-Tuned Model**
   - Train on RepairCoin data
   - More accurate cost estimates
   - Better service matching

---

## Conclusion

The AI Repair Assistant will be a game-changing feature for RepairCoin, providing:

✅ **Customer Value:** Instant diagnosis, cost transparency, confidence
✅ **Shop Value:** Qualified leads, reduced support burden, higher satisfaction
✅ **Platform Value:** 25%+ conversion increase, competitive differentiation, viral growth

**Next Steps:**
1. Review and approve this document
2. Set up OpenAI API access
3. Kick off Phase 1 development
4. Target launch: 8-10 weeks from start

---

**Document Version:** 1.0
**Last Updated:** June 4, 2026
**Status:** Ready for Development
