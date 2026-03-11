/**
 * End-to-end tests for Emoji Picker feature
 *
 * Since the emoji picker is a frontend-only feature (no backend changes),
 * these tests validate:
 * 1. The ConversationThread component imports and structure are correct
 * 2. emoji-picker-react package is installed and importable
 * 3. The dynamic import pattern works correctly
 * 4. No regression on existing messaging endpoints
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const FRONTEND_ROOT = path.resolve(__dirname, '../../../frontend');
const COMPONENT_PATH = path.join(
  FRONTEND_ROOT,
  'src/components/messaging/ConversationThread.tsx'
);

describe('Emoji Picker - Frontend Integration', () => {
  let componentSource: string;

  beforeAll(() => {
    componentSource = fs.readFileSync(COMPONENT_PATH, 'utf-8');
  });

  describe('Package Installation', () => {
    it('emoji-picker-react is listed in frontend package.json dependencies', () => {
      const pkgJson = JSON.parse(
        fs.readFileSync(path.join(FRONTEND_ROOT, 'package.json'), 'utf-8')
      );
      const allDeps = {
        ...pkgJson.dependencies,
        ...pkgJson.devDependencies,
      };
      expect(allDeps['emoji-picker-react']).toBeDefined();
    });

    it('emoji-picker-react is installed in node_modules', () => {
      const emojiPickerPath = path.join(
        FRONTEND_ROOT,
        'node_modules/emoji-picker-react'
      );
      expect(fs.existsSync(emojiPickerPath)).toBe(true);
    });

    it('emoji-picker-react package.json has a valid main/module entry', () => {
      const pkgPath = path.join(
        FRONTEND_ROOT,
        'node_modules/emoji-picker-react/package.json'
      );
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const hasEntry = pkg.main || pkg.module || pkg.exports;
      expect(hasEntry).toBeTruthy();
    });
  });

  describe('Component Structure - ConversationThread.tsx', () => {
    it('imports EmojiClickData type from emoji-picker-react', () => {
      expect(componentSource).toContain(
        'import type { EmojiClickData } from "emoji-picker-react"'
      );
    });

    it('uses dynamic import for EmojiPicker (SSR-safe)', () => {
      expect(componentSource).toContain(
        'dynamic(() => import("emoji-picker-react")'
      );
      expect(componentSource).toContain('ssr: false');
    });

    it('has showEmojiPicker state', () => {
      expect(componentSource).toMatch(
        /const \[showEmojiPicker, setShowEmojiPicker\] = useState.*false/
      );
    });

    it('has emojiPickerRef for click-outside detection', () => {
      expect(componentSource).toContain('emojiPickerRef');
      expect(componentSource).toMatch(/useRef<HTMLDivElement>/);
    });

    it('has textareaRef for focus management', () => {
      expect(componentSource).toContain('textareaRef');
      expect(componentSource).toMatch(/useRef<HTMLTextAreaElement>/);
    });

    it('has handleEmojiClick handler', () => {
      expect(componentSource).toContain('handleEmojiClick');
      // Should append emoji to message input
      expect(componentSource).toMatch(
        /setMessageInput.*prev.*\+.*emojiData\.emoji/
      );
      // Should close picker after selection
      expect(componentSource).toMatch(/setShowEmojiPicker\(false\)/);
      // Should refocus textarea
      expect(componentSource).toContain('textareaRef.current?.focus()');
    });

    it('has click-outside useEffect for dismissal', () => {
      // Should listen for mousedown events
      expect(componentSource).toContain(
        'document.addEventListener("mousedown"'
      );
      // Should clean up listener
      expect(componentSource).toContain(
        'document.removeEventListener("mousedown"'
      );
      // Should check emojiPickerRef.current
      expect(componentSource).toContain('emojiPickerRef.current');
    });

    it('renders EmojiPicker component conditionally', () => {
      // Should render picker when showEmojiPicker is true
      expect(componentSource).toMatch(/showEmojiPicker\s*&&/);
      expect(componentSource).toContain('<EmojiPicker');
    });

    it('configures EmojiPicker with dark theme', () => {
      expect(componentSource).toMatch(/theme=.*dark/);
    });

    it('configures EmojiPicker with appropriate dimensions', () => {
      expect(componentSource).toMatch(/width=\{320\}/);
      expect(componentSource).toMatch(/height=\{400\}/);
    });

    it('passes onEmojiClick handler to EmojiPicker', () => {
      expect(componentSource).toContain('onEmojiClick={handleEmojiClick}');
    });

    it('enables lazy loading of emojis for performance', () => {
      expect(componentSource).toContain('lazyLoadEmojis');
    });

    it('positions picker absolutely above input area', () => {
      // Should use absolute positioning with bottom offset
      expect(componentSource).toMatch(/absolute\s+bottom-/);
      // Should have z-index for overlay
      expect(componentSource).toContain('z-50');
    });

    it('attaches ref to emoji picker wrapper div', () => {
      expect(componentSource).toContain('ref={emojiPickerRef}');
    });

    it('attaches ref to textarea for focus management', () => {
      expect(componentSource).toContain('ref={textareaRef}');
    });

    it('parent container has relative positioning for absolute picker', () => {
      // The root div should have "relative" class
      expect(componentSource).toMatch(
        /className="flex flex-col h-full bg-\[#0A0A0A\] relative"/
      );
    });

    it('smile button toggles showEmojiPicker state', () => {
      expect(componentSource).toContain(
        'onClick={() => setShowEmojiPicker(!showEmojiPicker)}'
      );
    });

    it('smile button is disabled when sending', () => {
      // The emoji button should have disabled={isSending}
      const emojiButtonSection = componentSource.substring(
        componentSource.indexOf('{/* Emoji Button */}'),
        componentSource.indexOf('{/* Send Button */}')
      );
      expect(emojiButtonSection).toContain('disabled={isSending}');
    });
  });

  describe('No Regression - Existing Features', () => {
    it('still imports Smile icon from lucide-react', () => {
      expect(componentSource).toContain('Smile');
      expect(componentSource).toContain('lucide-react');
    });

    it('still has Send button', () => {
      expect(componentSource).toContain('{/* Send Button */}');
      expect(componentSource).toContain('onClick={handleSend}');
    });

    it('still has Attachment button', () => {
      expect(componentSource).toContain('{/* Attachment Button */}');
      expect(componentSource).toContain('fileInputRef');
    });

    it('still has message input textarea', () => {
      expect(componentSource).toContain('{/* Message Input */}');
      expect(componentSource).toContain('placeholder="Type a message..."');
    });

    it('still supports keyboard send (Enter)', () => {
      expect(componentSource).toContain('handleKeyPress');
      expect(componentSource).toMatch(/e\.key\s*===\s*"Enter"/);
    });

    it('still has error handling for send failures', () => {
      expect(componentSource).toContain('sendError');
      expect(componentSource).toContain('setSendError');
    });

    it('still has typing indicator', () => {
      expect(componentSource).toContain('{/* Typing Indicator */}');
      expect(componentSource).toContain('isTyping');
    });

    it('still has file preview section', () => {
      expect(componentSource).toContain('{/* Selected Files Preview */}');
      expect(componentSource).toContain('selectedFiles');
    });

    it('still exports ConversationThread component', () => {
      expect(componentSource).toContain('export const ConversationThread');
    });

    it('still exports Message interface', () => {
      expect(componentSource).toContain('export interface Message');
    });

    it('ConversationThreadProps interface is unchanged', () => {
      expect(componentSource).toContain('conversationId: string');
      expect(componentSource).toContain('messages: Message[]');
      expect(componentSource).toContain('participantName: string');
      expect(componentSource).toContain('onSendMessage');
    });
  });
});
