# Windows SAPI TTS bridge (built into Windows, free, offline). FALLBACK when Piper is not installed.
# Called by pipeline/providers/voice/sapi.ts
# Input : -JobFile <json> {voice, rate, scenes:[{sceneId, text, out}]}
# Output: JSON on stdout {scenes:[{sceneId, out}]}
# NOTE: SAPI SpeakProgress AudioPosition values proved unreliable when captured from PowerShell
# (positions exceeded the file length in testing), so word timing is estimated in Node from the
# detected speech span instead. Piper gives exact phoneme alignments and is the primary engine.
param([Parameter(Mandatory = $true)][string]$JobFile)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech

$job = Get-Content -Raw -Encoding UTF8 $JobFile | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try { $synth.SelectVoice($job.voice) } catch { throw "SAPI voice '$($job.voice)' is not installed" }
$synth.Rate = [int]$job.rate
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)

$results = @()
foreach ($scene in $job.scenes) {
    $synth.SetOutputToWaveFile($scene.out, $format)
    $synth.Speak([string]$scene.text)
    $synth.SetOutputToNull()
    $results += @{ sceneId = $scene.sceneId; out = $scene.out }
}
$synth.Dispose()
@{ scenes = $results } | ConvertTo-Json -Depth 6 -Compress
