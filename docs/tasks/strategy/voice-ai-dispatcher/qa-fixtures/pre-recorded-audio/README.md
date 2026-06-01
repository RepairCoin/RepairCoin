# Pre-recorded audio clips — Voice Dispatcher Phase 6

`replay-fixtures.ts` plays these 10 clips through the live
`/api/ai/voice/transcribe` → `/api/ai/dispatch` pipeline to measure router
accuracy and per-command cost.

**These `.webm` files are NOT committed to git** (binary, and they contain a
real voice — re-record in your own voice). They are `.gitignore`-style absent
by design. The manifest that names them and their expected routing lives in
`../fixtures.ts`. Record each file at the name listed there.

## The 10 clips (must match `fixtures.ts`)

| File | Phrase | Expect |
|---|---|---|
| `insights-revenue-last-week.webm` | "What was my revenue last week?" | insights |
| `insights-top-customers.webm` | "Who are my top customers?" | insights |
| `insights-low-stock-items.webm` | "Which items are low on stock?" | insights |
| `marketing-black-friday-campaign.webm` | "Make a Black Friday campaign, twenty percent off all services." | marketing |
| `marketing-winback-email.webm` | "Email the customers who haven't booked in ninety days." | marketing |
| `marketing-slow-day-promo.webm` | "Create a promotion for our slow weekdays." | marketing |
| `help-export-bookings.webm` | "How do I export my bookings?" | help |
| `help-add-a-service.webm` | "Where do I add a new service?" | help |
| `oos-weather.webm` | "What's the weather today?" | out_of_scope |
| `oos-book-appointment.webm` | "Book Alex for a screen repair at two PM." | out_of_scope |

## How to record

The production capture path is `useVoiceRecorder` → WebM/Opus. To match what
real users send, record WebM/Opus mono, ~16 kHz, 5–12 seconds, under 5 MB.

**Quickest — regenerate all 10 via Windows SAPI (no mic, no ffmpeg):**
```powershell
powershell -ExecutionPolicy Bypass -File generate-clips.ps1
```
Produces deterministic 16 kHz mono WAVs from the manifest phrases. Synthetic
but clear — Whisper transcribes them accurately (verified 2026-06-01). Good for
a functional router-accuracy + cost smoke test; supplement with natural-voice
clips over time for drift realism.

**Easiest — capture from the app itself (closest to production):**
1. Open the shop dashboard, tap the voice pill, speak the phrase.
2. In DevTools → Network, find the `transcribe` request, right-click the
   uploaded `audio` part → save, rename to the manifest filename.

**Or with ffmpeg (from any mic recording):**
```bash
ffmpeg -i raw.wav -ac 1 -ar 16000 -c:a libopus insights-revenue-last-week.webm
```

**Or with the browser console (one-off recorder):**
```js
const s = await navigator.mediaDevices.getUserMedia({ audio: true });
const r = new MediaRecorder(s, { mimeType: "audio/webm;codecs=opus" });
const chunks = [];
r.ondataavailable = (e) => chunks.push(e.data);
r.onstop = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(chunks, { type: "audio/webm" }));
  a.download = "insights-revenue-last-week.webm";
  a.click();
};
r.start(); setTimeout(() => r.stop(), 6000); // speak now, stops in 6s
```

## Notes

- Clips you haven't recorded yet are **skipped** by `replay-fixtures.ts`, not
  failed — so you can record and test one at a time.
- Keep phrasing close to the manifest. The point is to baseline the router on
  natural shop-owner language, not to trick it; save adversarial phrasings for
  a separate stress set once the baseline is green.
- Re-recording in different voices/accents over time is a cheap way to widen
  the regression set (implementation.md §9 risk: "router accuracy degrades as
  language drifts").
