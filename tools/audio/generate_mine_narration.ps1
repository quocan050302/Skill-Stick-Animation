param(
  [string]$OutDir = "workspace/cache/mine_audio",
  [string]$VoiceName = "Microsoft David Desktop",
  [int]$Rate = 1
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech

if (!(Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$beats = @(
  @{ id = "hook";   text = "Buyers cheered when gold glinted inside dark stone." },
  @{ id = "secret"; text = "Earlier, swindlers brushed gold dust onto barren rock" },
  @{ id = "test";   text = "and slipped nuggets inside rigged sample sacks." },
  @{ id = "belief"; text = "On the brass scale, that sample spiked high." },
  @{ id = "check";  text = "Blind bedrock sampling exposed empty gray stone." },
  @{ id = "payoff"; text = "Mine salting: the gold was real, the mine was empty." }
)

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voices = $synth.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object { $_.VoiceInfo.Name }
if ($voices -contains $VoiceName) {
  $synth.SelectVoice($VoiceName)
} elseif ($voices.Count -gt 0) {
  $VoiceName = $voices[0]
  $synth.SelectVoice($VoiceName)
}
$synth.Rate = $Rate
$synth.Volume = 100

$beatMeta = New-Object System.Collections.ArrayList

for ($i = 0; $i -lt $beats.Count; $i++) {
  $b = $beats[$i]
  $rawBeatWav = Join-Path $OutDir ("beat_" + $i + "_" + $b.id + ".wav")
  $words = New-Object System.Collections.ArrayList
  $evWord = Register-ObjectEvent -InputObject $synth -EventName SpeakProgress -MessageData $words -Action {
    $ev = $EventArgs
    [void]$Event.MessageData.Add([pscustomobject]@{
      word = $ev.Text
      rawMs = [Math]::Round($ev.AudioPosition.TotalMilliseconds, 1)
    })
  }
  $synth.SetOutputToWaveFile($rawBeatWav)
  $synth.Speak($b.text)
  $synth.SetOutputToNull()
  Unregister-Event -SubscriptionId $evWord.Id -ErrorAction SilentlyContinue

  [void]$beatMeta.Add([pscustomobject]@{
    index = $i
    id = $b.id
    text = $b.text
    wav = $rawBeatWav
    words = @($words.ToArray())
  })
}

$synth.Dispose()

$manifest = [pscustomobject]@{
  engine = "Windows_SAPI5_System.Speech"
  voice = $VoiceName
  rate = $Rate
  provenance = "ORIGINAL_LOCAL_TTS_SAPI5"
  beats = @($beatMeta.ToArray())
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $OutDir "beats_raw.json") -Encoding UTF8
Write-Output ("Synthesized " + $beats.Count + " beat WAVs in " + $OutDir)
