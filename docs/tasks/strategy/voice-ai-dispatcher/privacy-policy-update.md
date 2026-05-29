# Privacy Policy Update — Voice Feature

**For:** Legal / Compliance / Comms review
**Author:** Engineering
**Created:** 2026-05-29
**Status:** Draft for review. Needs legal sign-off before voice
launches in production.

---

## Where the existing privacy policy lives

- **Code location:** `frontend/src/app/privacy-policy/page.tsx`
- **Public URL:** `/privacy-policy` on the deployed frontend
- **Linked from:** site footer (`components/Footer.tsx`), shop
  registration form, shop subscription flow
- **Length:** 197 lines, 9 numbered sections + a "Children's
  Privacy" sub-section
- **Contact for rights requests:** `Repaircoin2025@gmail.com`
  (per existing §7 of the policy)

Legal can edit the policy directly in that file. The suggested
text in §3 of this draft is written to drop into the existing §9
"Third-Party Services" section.

---

## Issues found in the existing policy

Two issues surfaced while reading the existing policy. Both need
attention from legal, the second is **directly blocking** the
voice launch.

### Issue 1 (blocking) — §2 says we don't collect audio

The existing policy's §2 "Information We Do NOT Collect" lists:

> "Audio or video recordings"
> *(`frontend/src/app/privacy-policy/page.tsx` line 65)*

Adding voice means we DO collect audio. This line is a direct
contradiction the moment voice ships. Three options:

| Option | Edit | Trade-off |
|---|---|---|
| A | Remove the line entirely | Loses the explicit "no video" commitment too — they're bundled in one bullet |
| B | Rewrite to "Video recordings" (drop "audio") | Honest, preserves the no-video commitment, smallest change |
| C | Rewrite to "Audio recordings, except as explicitly described in §9 (voice command transcription)" | Most precise, points readers to the voice disclosure |

**Engineering recommendation: Option C.** The cross-reference
keeps the policy internally consistent and means readers who scan
the "DO NOT Collect" list still get pointed at the voice disclosure
rather than walking away with a stale impression.

### Issue 2 (separate, pre-existing) — Anthropic isn't named

The existing policy's §9 "Third-Party Services" lists Stripe,
Thirdweb, and DigitalOcean. **It does NOT mention Anthropic** —
which currently processes every word a shop owner types into the
existing AI panels (Insights, Marketing, Help). This is a
pre-existing gap unrelated to voice, but adding the voice
disclosure is a natural moment to also add the Anthropic
disclosure since both share the "AI request" data flow.

Flagging this to legal as a parallel item — not a voice blocker,
but worth fixing in the same policy update for completeness.

---

## What's changing

We're adding a voice command feature to the shop dashboard. A shop
owner taps a mic button, speaks a request, and the AI handles it —
the same things they can do today by typing, but now hands-free.

Adding voice means we send the audio recording to a third-party
service to convert speech to text. That third party is **OpenAI**,
via their Whisper API. Once the text comes back, the rest of the
flow is identical to typing — same AI, same data scope, same
controls.

The audio-to-text conversion step is the **new disclosure**. The
Anthropic (AI response) step is a **pre-existing gap** (see Issue
2 above) that legal may want to close in the same policy update.

---

## What OpenAI receives, retains, and does

Facts to verify with legal counsel against current OpenAI terms:

| Item | What OpenAI's API terms commit (as of 2026-05) |
|---|---|
| **What's sent** | The raw audio clip the shop owner records (typically 5-30 seconds, WebM format). Nothing else — no account info, no shop ID, no customer PII unless the shop owner says it aloud. |
| **What OpenAI does with it** | Transcribes the audio to text. Returns the text. That's the entire transaction. |
| **Training use** | OpenAI's API terms explicitly state they **do not use API data to train their models** (this is different from the consumer ChatGPT product, which does train on user input). |
| **Retention** | Audio submissions are retained by OpenAI for **up to 30 days for abuse-monitoring purposes**, then deleted automatically. |
| **Geographic processing** | Processed in OpenAI's US data centers by default. EU data residency options exist on their Enterprise tier (not our tier in v1). |
| **Sub-processors** | OpenAI uses standard cloud infrastructure (Microsoft Azure for compute). Disclosed on their sub-processor list. |

**Action for legal:** verify each of the above against the current
OpenAI API Terms of Service and Data Processing Addendum (DPA)
before launch. The links live on platform.openai.com/docs/ — terms
change occasionally, and the policy text below assumes the
2026-05 version.

---

## Suggested policy text (paste-ready)

The block below is what we'd add to the existing privacy policy
at `frontend/src/app/privacy-policy/page.tsx`. Specifically:

- **Drop into existing §9 "Third-Party Services"** as a new
  bulleted item after the existing Stripe / Thirdweb /
  DigitalOcean entries.
- Also add a standalone subsection (the block below) within or
  immediately after §9, since voice has additional disclosure
  obligations beyond a one-line vendor mention.
- Pair with the fix to existing §2 line 65 described in
  "Issues found" above.

> ### Voice features
>
> Our shop dashboard includes an optional voice command feature.
> When you tap the microphone button and speak a request, your
> audio recording is sent to OpenAI (Whisper API) to convert your
> speech into text. The text is then processed by our AI features
> the same way as if you had typed it.
>
> **What's sent:** only the audio clip you record. No account
> information, customer data, or other personal information is
> transmitted with the audio.
>
> **How long it's kept:** OpenAI retains audio submissions for
> up to 30 days to monitor for service abuse, after which the
> audio is deleted. The text transcription is retained within
> our system as part of your chat history, subject to our standard
> data retention policy.
>
> **Training:** OpenAI does not use audio submitted through their
> API to train their models.
>
> **Your choice:** Voice is optional. You can use the typed
> equivalents of every voice command, and you can disable
> microphone access in your browser at any time without affecting
> any other feature.
>
> If you do not want your voice to be processed by OpenAI, please
> use the text input options provided throughout the dashboard.

---

## In-app notification options

Three approaches to telling the shop owner what's happening. Pick
one (or combine) based on legal's read of disclosure obligations:

| Option | What it looks like | Trade-off |
|---|---|---|
| **A — One-time first-use disclosure** | The first time a shop owner taps the mic, a modal appears: *"Your voice will be sent to OpenAI to convert to text. We don't share anything else. Continue?"* with **Accept** + **Use text instead** buttons. Recorded preference; never asked again unless they reset. | Friction on day one; cleanest consent record. |
| **B — Persistent indicator** | A small "Powered by OpenAI Whisper" line under the mic pill, always visible. No modal. | Less friction, but disclosure may be missed if user doesn't read fine print. |
| **C — Both** | One-time modal AND persistent indicator. | Maximum coverage; minor day-one friction. |

**Engineering recommendation:** Option A + a small persistent
indicator (effectively C). Maximum legal coverage, only a single
extra click on the first use.

---

## User controls (already in place)

For the privacy policy to be honest, these controls need to exist.
Confirming each:

| Control | Status | Notes |
|---|---|---|
| Mic is optional — every voice command has a typed equivalent | ✅ Built into the design | Text input always available alongside the mic button |
| Browser-level mic permission revocable at any time | ✅ Browser-native | The standard browser mic-permission UX applies |
| Shop owner can review the transcript before sending | ✅ Phase 5 of implementation | "Edit before send" is mandatory in the v1 spec |
| Shop owner can delete their account / data | ✅ Existing policy §7 | Mechanism is email request to `Repaircoin2025@gmail.com`. Not in-app self-service. |
| Shop owner can export their data | ✅ Existing policy §7 | Same mechanism — email request. |

**Mechanism is email-based, not in-app self-service** — that's a
UX vs legal-coverage trade-off. The existing policy makes the
commitment; the in-app surface to action it doesn't exist today.
Worth flagging to product as a parallel workstream, but not a
voice-launch blocker since the commitment is already made.

---

## Jurisdictional considerations

Items legal should check based on where our shops operate:

- **EU (GDPR):** Audio is biometric-adjacent data; voice samples
  can be used for voiceprint identification. Recommend explicit
  consent (Option A modal) for EU users. Also: OpenAI's standard
  API processes data in the US — if we onboard EU shops at scale,
  we may need to upgrade to OpenAI's Enterprise tier for EU data
  residency, OR document the Standard Contractual Clauses (SCCs)
  position.
- **California (CCPA / CPRA):** Voice may qualify as "sensitive
  personal information" under CPRA. Confirm whether our current
  policy's "right to limit use of sensitive personal information"
  section covers voice transcription.
- **Texas (where many of our shops are):** Texas Capture or Use of
  Biometric Identifier Act (CUBI) covers voiceprints specifically.
  Whisper does not extract voiceprints — it transcribes speech.
  Probably out of scope, but worth a one-paragraph legal note.
- **Other states with biometric privacy laws:** Illinois (BIPA),
  Washington, New York all have biometric privacy frameworks.
  Same analysis — Whisper doesn't extract biometric identifiers,
  so likely out of scope. Legal to confirm.

---

## What happens if a shop owner asks "is this private?"

Suggested customer-support script if the question comes in:

> *"When you use voice commands, your audio is sent to OpenAI's
> Whisper service to convert your speech to text. OpenAI keeps
> the audio for up to 30 days to monitor for abuse, then deletes
> it. They don't use it to train their models. The text comes
> back to us and is processed the same way typed messages are.
> You can use typed input for any command instead, and you can
> revoke microphone access in your browser at any time."*

This script aligns with the suggested policy text above. Comms
should keep them in sync.

---

## Risk summary for legal

| Risk | Likelihood | Impact | Notes |
|---|---|---|---|
| OpenAI changes their data-retention policy unfavorably | Low | Medium | We'd need to update the policy text + notify users. Same exposure as any third-party vendor relationship. |
| Shop owner says something containing PII (a customer's name + phone) aloud and that audio sits at OpenAI for 30 days | Medium | Low-Medium | This is no different from the shop owner typing the same information into the chat. Our standard data-processing terms with shops already cover this. |
| Audio breach at OpenAI exposes 30 days of shop owner audio | Low | High | Standard third-party-breach exposure. Mitigation = our DPA with OpenAI + cyber insurance. Legal should verify both. |
| EU shop owner objects to US data processing | Medium (if/when EU shops onboard) | Medium | Mitigated by Option A consent + upgrade to OpenAI Enterprise tier if EU shop count grows. |
| State biometric law applies and we didn't get explicit consent | Low | High | Mitigated by Option A modal — explicit consent is the safest default regardless of jurisdiction. |

---

## What legal needs to sign off on before launch

**Voice-launch blockers (must be cleared before production):**

1. The suggested policy text — final wording.
2. The in-app disclosure approach (A / B / C).
3. **Fix to existing policy §2 line 65** ("Audio or video
   recordings" listed under "DO NOT Collect") — pick Option A, B,
   or C from the "Issues found" section above. **This is a direct
   contradiction with voice; cannot ship voice without this fix.**
4. Whether we need a separate Data Processing Addendum (DPA) with
   OpenAI signed before launch (recommended — they offer one on
   their developer portal).
5. Whether the existing email-based delete / export mechanism
   (existing policy §7) is sufficient for jurisdictions our shops
   operate in, or whether in-app self-service is required.

**Parallel / non-blocking items:**

6. Adding **Anthropic** to the existing policy's §9 "Third-Party
   Services" list. Pre-existing gap unrelated to voice — Anthropic
   currently processes every word typed into the existing AI
   panels (Insights / Marketing / Help). Natural to fix in the
   same policy update.
7. Any jurisdiction-specific notices we need to add for EU,
   California, or other applicable laws.

Engineering will not enable the voice feature in production until
items 1, 2, 3, and 4 are signed off. Item 5 should be addressed
in the same review pass. Items 6 and 7 may land separately.

---

## Timeline

If legal can return feedback within **5 business days** of
receiving this draft, voice can launch in production on schedule
(roughly 3 weeks after Phase 1 engineering starts). Longer legal
review pushes the launch by the same amount.

Engineering's first ready-for-disclosure code lands on staging at
the end of Phase 2 (~3-4 days into the build). The disclosure
modal (if Option A is chosen) is part of Phase 5; lead time on
final policy text is therefore **~2 weeks from today**.

---

## Open questions for legal

These came up while drafting and need an actual legal opinion,
not engineering's guess:

1. Is "voice command audio sent to OpenAI" a material enough
   change to require notifying existing users via email, or is
   updating the policy on the website sufficient?
2. Do we need to retain a record of each shop owner's consent
   timestamp (Option A modal)? If yes, that's a small extra
   database change.
3. Should the disclosure name OpenAI specifically, or use generic
   language ("a third-party speech-to-text provider")? Naming
   them gives users more information; generic language gives us
   flexibility if we change vendors later.
4. Is there a separate notice requirement for shop owners
   operating in regulated industries (lawyers, medical) where
   voice commands might inadvertently capture privileged
   information about THEIR customers?
