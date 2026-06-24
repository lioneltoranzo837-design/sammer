$filePath = Join-Path $PSScriptRoot 'ts-src\rendering\textures.ts'
$lines = Get-Content $filePath
$before = $lines[0..2807]
$after = $lines[2994..($lines.Length-1)]
$result = @()
$result += $before
$result += ''
$result += $after
$result | Set-Content $filePath -Encoding UTF8
Write-Host "Removed orphaned lines 2809-2994. File now has $($result.Length) lines."
