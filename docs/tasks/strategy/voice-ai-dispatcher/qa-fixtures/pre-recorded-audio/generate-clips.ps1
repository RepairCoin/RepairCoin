# generate-clips.ps1 — regenerate the 10 Phase 6 QA voice clips via Windows SAPI.
#
# These clips are NOT committed (binary). This script reproduces them
# deterministically so anyone on Windows can run `npm run voice:qa` without a
# microphone. The phrases MUST stay in sync with ../fixtures.ts (the manifest
# the replay harness reads). If you edit a phrase there, edit it here too.
#
# Output: 16 kHz mono 16-bit WAV — clean, small input that Whisper handles well.
# The transcribe endpoint accepts wav/webm/ogg/mp4/mp3; we use wav because the
# built-in SAPI synth emits wav and no ffmpeg is required.
#
# Usage (from anywhere):
#   powershell -ExecutionPolicy Bypass -File generate-clips.ps1
#
# Note: synthetic TTS is fine for a functional router-accuracy + cost smoke
# test. For the "language drift" realism the QA guide mentions, re-record some
# clips in natural voices over time — drop any wav/webm here with a name from
# the manifest and the harness will pick it up.

Add-Type -AssemblyName System.Speech

$dir = $PSScriptRoot
$clips = [ordered]@{
  "insights-revenue-last-week.wav"      = "What was my revenue last week?"
  "insights-top-customers.wav"          = "Who are my top customers?"
  "insights-low-stock-items.wav"        = "Which items are low on stock?"
  "marketing-black-friday-campaign.wav" = "Make a Black Friday campaign, twenty percent off all services."
  "marketing-winback-email.wav"         = "Email the customers who haven't booked in ninety days."
  "marketing-slow-day-promo.wav"        = "Create a promotion for our slow weekdays."
  "help-export-bookings.wav"            = "How do I export my bookings?"
  "help-add-a-service.wav"              = "Where do I add a new service?"
  "oos-weather.wav"                     = "What's the weather today?"
  "oos-book-appointment.wav"            = "Book Alex for a screen repair at two PM."
}

$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)

foreach ($name in $clips.Keys) {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.Rate = -1   # slightly slower for cleaner transcription
  $path = Join-Path $dir $name
  $s.SetOutputToWaveFile($path, $fmt)
  $s.Speak($clips[$name])
  $s.Dispose()
  $kb = [math]::Round((Get-Item $path).Length / 1KB, 1)
  Write-Output ("{0,-40} {1} KB" -f $name, $kb)
}
Write-Output "--- done: $($clips.Count) clips written to $dir ---"
