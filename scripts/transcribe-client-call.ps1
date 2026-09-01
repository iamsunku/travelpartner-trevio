# Transcribe a client call recording with local OpenAI Whisper.
# Usage: .\scripts\transcribe-client-call.ps1 [-Model small|medium|large] [-VideoPath "path\to\file.mp4"]

param(
    [string]$VideoPath = "C:\Users\user\Downloads\Screen Recording 2026-08-29 133717.mp4",
    [ValidateSet("tiny", "base", "small", "medium", "large")]
    [string]$Model = "small",
    [string]$OutputDir = "$PSScriptRoot\..\docs\transcripts"
)

$ErrorActionPreference = "Stop"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")

if (-not (Test-Path $VideoPath)) {
    throw "Video not found: $VideoPath"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Write-Host "Transcribing with Whisper model '$Model'..."
Write-Host "Input:  $VideoPath"
Write-Host "Output: $OutputDir"
Write-Host "This may take 30-90+ minutes on CPU for a 1-hour recording."

whisper $VideoPath `
    --model $Model `
    --output_dir $OutputDir `
    --output_format all `
    --verbose True

Write-Host "Done. Transcript files are in $OutputDir"
