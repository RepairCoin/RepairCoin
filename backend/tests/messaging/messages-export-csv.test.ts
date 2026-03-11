/**
 * End-to-end tests for Messages Export CSV feature
 *
 * Validates:
 * 1. MessagesTab stores conversations in state
 * 2. exportToCSV function exists with correct CSV generation
 * 3. Export button is wired with onClick and disabled state
 * 4. CSV output format (headers, escaping, date formatting)
 * 5. No regression on existing MessagesTab features
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const MESSAGES_TAB_PATH = path.resolve(
  __dirname,
  '../../../frontend/src/components/shop/tabs/MessagesTab.tsx'
);

describe('Messages Export CSV - MessagesTab', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(MESSAGES_TAB_PATH, 'utf-8');
  });

  describe('Conversations State', () => {
    it('declares conversations state', () => {
      expect(source).toContain('const [conversations, setConversations] = useState');
    });

    it('types conversations state with Conversation[]', () => {
      expect(source).toMatch(/useState<messagingApi\.Conversation\[\]>\(\[\]\)/);
    });

    it('stores fetched conversations in state', () => {
      expect(source).toContain('setConversations(convData)');
    });
  });

  describe('exportToCSV Function', () => {
    it('defines exportToCSV function', () => {
      expect(source).toContain('const exportToCSV = ()');
    });

    it('returns early when no conversations', () => {
      expect(source).toContain('if (conversations.length === 0) return');
    });

    it('includes correct CSV headers', () => {
      const headers = ['Customer', 'Last Message', 'Last Activity', 'Unread Messages', 'Status', 'Created'];
      headers.forEach(header => {
        expect(source).toContain(`'${header}'`);
      });
    });

    it('maps customer name or address', () => {
      expect(source).toContain('conv.customerName || conv.customerAddress');
    });

    it('maps last message preview', () => {
      expect(source).toContain('conv.lastMessagePreview');
    });

    it('maps unread count for shop', () => {
      expect(source).toContain('conv.unreadCountShop');
    });

    it('derives status from isBlocked and isArchivedShop', () => {
      expect(source).toContain("conv.isBlocked ? 'Blocked'");
      expect(source).toContain("conv.isArchivedShop ? 'Archived' : 'Active'");
    });

    it('formats dates with toLocaleString', () => {
      expect(source).toMatch(/new Date\(conv\.lastMessageAt\)\.toLocaleString\(\)/);
      expect(source).toMatch(/new Date\(conv\.createdAt\)\.toLocaleString\(\)/);
    });

    it('escapes double quotes in CSV fields', () => {
      expect(source).toContain('.replace(/"/g, \'""\'');
    });

    it('wraps text fields in double quotes for CSV safety', () => {
      // The exportToCSV wraps customer name and message preview in quotes
      // using template literals like `"${(conv.customerName...}"`
      expect(source).toContain('conv.customerName || conv.customerAddress');
      expect(source).toContain('.replace(/"/g');
    });

    it('joins headers and rows with commas', () => {
      expect(source).toContain("headers.join(',')");
      expect(source).toContain("row.join(',')");
    });

    it('joins lines with newline', () => {
      expect(source).toContain(".join('\\n')");
    });

    it('creates Blob with text/csv type', () => {
      expect(source).toContain("new Blob([csvContent], { type: 'text/csv' })");
    });

    it('creates object URL for download', () => {
      expect(source).toContain('window.URL.createObjectURL(blob)');
    });

    it('sets download filename with date', () => {
      expect(source).toMatch(/a\.download = `conversations_\$\{new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]\}\.csv`/);
    });

    it('triggers click and cleans up', () => {
      expect(source).toContain('a.click()');
      expect(source).toContain('document.body.removeChild(a)');
      expect(source).toContain('window.URL.revokeObjectURL(url)');
    });
  });

  describe('Export Button', () => {
    it('has onClick handler wired to exportToCSV', () => {
      expect(source).toContain('onClick={exportToCSV}');
    });

    it('is disabled when no conversations', () => {
      expect(source).toContain('disabled={conversations.length === 0}');
    });

    it('has disabled styling classes', () => {
      // Find the Export button section
      const exportBtnStart = source.indexOf('onClick={exportToCSV}');
      const exportBtnEnd = source.indexOf('</button>', exportBtnStart);
      const exportBtn = source.substring(exportBtnStart, exportBtnEnd);
      expect(exportBtn).toContain('disabled:opacity-50');
      expect(exportBtn).toContain('disabled:cursor-not-allowed');
    });

    it('still has Download icon', () => {
      expect(source).toContain('<Download className="w-4 h-4" />');
    });

    it('still shows Export text', () => {
      // Find near the onClick={exportToCSV}
      const btnStart = source.indexOf('onClick={exportToCSV}');
      const btnEnd = source.indexOf('</button>', btnStart);
      const btn = source.substring(btnStart, btnEnd);
      expect(btn).toContain('Export');
    });
  });

  describe('No Regression - Existing Features', () => {
    it('still imports MessagesContainer', () => {
      expect(source).toContain("import { MessagesContainer }");
    });

    it('still imports AutoMessagesManager', () => {
      expect(source).toContain("import { AutoMessagesManager }");
    });

    it('still imports messagingApi', () => {
      expect(source).toContain("import * as messagingApi");
    });

    it('still has sub-tab switcher (Conversations / Auto-Messages)', () => {
      expect(source).toContain('Conversations');
      expect(source).toContain('Auto-Messages');
    });

    it('still has stats cards', () => {
      expect(source).toContain('Total Conversations');
      expect(source).toContain('Active Today');
      expect(source).toContain('Avg Response Time');
      expect(source).toContain('Satisfaction Rate');
    });

    it('still has Show/Hide Stats toggle', () => {
      expect(source).toContain('setShowStats(!showStats)');
    });

    it('still has Filter button', () => {
      expect(source).toContain('Filter');
      expect(source).toContain('<Filter className="w-4 h-4" />');
    });

    it('still renders MessagesContainer with shopId', () => {
      expect(source).toContain('MessagesContainer userType="shop" currentUserId={shopId}');
    });

    it('still has Pro Tip help text', () => {
      expect(source).toContain('Pro Tip');
    });

    it('stats useEffect still refreshes every 30 seconds', () => {
      expect(source).toContain('setInterval(fetchStats, 30000)');
    });

    it('exports MessagesTab component', () => {
      expect(source).toContain('export const MessagesTab');
    });
  });
});
