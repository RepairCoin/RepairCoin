# Feature: Messaging Search

**Status:** ✅ Completed
**Priority:** MEDIUM
**Est. Effort:** 2-3 hours
**Created:** 2026-03-13
**Completed:** 2026-03-13

---

## Problem

Users cannot search through their conversations. As conversation count grows, finding a specific customer/shop becomes difficult.

## Current State

- No search functionality in MessagesScreen
- Backend doesn't support search query parameter
- Only filter is Active/Archived tabs

## Implementation

### Backend Changes

#### 1. Update MessageController

Add `search` query parameter:

```typescript
getConversations = async (req: Request, res: Response) => {
  const page = req.query.page ? parseInt(req.query.page as string) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const archived = req.query.archived === 'true';
  const search = req.query.search as string | undefined;

  const result = await this.messageService.getConversations(
    identifier,
    userType,
    { page, limit, archived, search }
  );
  // ...
}
```

#### 2. Update MessageRepository

```typescript
async getCustomerConversations(
  customerAddress: string,
  options: { page?: number; limit?: number; archived?: boolean; search?: string } = {}
): Promise<PaginatedResult<Conversation>> {
  const { search } = options;

  let whereClause = `WHERE c.customer_address = $1 AND c.is_archived_customer = $2`;
  const params = [customerAddress.toLowerCase(), archived];

  if (search) {
    whereClause += ` AND (s.name ILIKE $${params.length + 1})`;
    params.push(`%${search}%`);
  }
  // ... rest of query
}
```

### Mobile Changes

#### 1. Add Search Input to MessagesScreen

```tsx
import { TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const [searchQuery, setSearchQuery] = useState("");
const debouncedSearch = useDebounce(searchQuery, 300);

<View className="flex-row items-center bg-zinc-800 rounded-lg mx-4 my-2 px-3">
  <Ionicons name="search" size={20} color="#71717A" />
  <TextInput
    value={searchQuery}
    onChangeText={setSearchQuery}
    placeholder="Search conversations..."
    placeholderTextColor="#71717A"
    className="flex-1 text-white py-3 ml-2"
  />
  {searchQuery && (
    <Pressable onPress={() => setSearchQuery("")}>
      <Ionicons name="close-circle" size={20} color="#71717A" />
    </Pressable>
  )}
</View>
```

#### 2. Update useMessages Hook

```typescript
export function useMessages() {
  const [searchQuery, setSearchQuery] = useState("");

  const fetchConversations = useCallback(async (archived: boolean, search?: string) => {
    const response = await messageApi.getConversations(1, 20, archived, search);
    setConversations(response.data || []);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConversations(filter === "archived", searchQuery || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, filter]);

  return {
    // ... existing
    searchQuery,
    setSearchQuery,
  };
}
```

#### 3. Update API Service

```typescript
async getConversations(
  page: number = 1,
  limit: number = 20,
  archived: boolean = false,
  search?: string
): Promise<GetConversationsResponse> {
  let url = `/messages/conversations?page=${page}&limit=${limit}&archived=${archived}`;
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  return await apiClient.get<GetConversationsResponse>(url);
}
```

## Files to Modify

**Backend:**
- `backend/src/repositories/MessageRepository.ts`
- `backend/src/domains/messaging/services/MessageService.ts`
- `backend/src/domains/messaging/controllers/MessageController.ts`

**Mobile:**
- `mobile/feature/messages/services/message.services.ts`
- `mobile/feature/messages/hooks/ui/useMessages.ts`
- `mobile/feature/messages/screens/MessagesScreen.tsx`

## Verification Checklist

- [x] Search input appears above conversation list
- [x] Typing filters conversations in real-time
- [x] Search works with debounce (300ms)
- [x] Clear button clears search
- [x] Search works in all tabs (Active, Resolved, Archived)
- [x] Empty state shows "No results for [query]"
- [x] Search is case-insensitive (ILIKE in PostgreSQL)
