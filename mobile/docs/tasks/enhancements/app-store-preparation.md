# Feature: Mobile App Store Preparation

**Status:** In Progress
**Priority:** High
**Est. Effort:** Ongoing
**Created:** 2026-03-10
**Updated:** 2026-03-10

---

## Notes

- Branch: `feat/expo-client-setup`

## Recent Commits

- Performance optimization (quick wins)
- Apple Team ID configuration
- Environment switcher
- Tester installation guides

## Remaining Before Submission

- [ ] Fix critical mobile bugs (RCN balance, shop profile)
- [ ] Complete E2E testing of booking flow
- [ ] App Store screenshots
- [ ] Privacy policy / Terms of Service URLs
- [ ] App Store Connect metadata

## Build Commands

```bash
npm run deploy:testflight   # Build for TestFlight
npm run submit:testflight   # Submit to TestFlight
npm run deploy:production   # Build for production
npm run submit:production   # Submit to App Store
```
