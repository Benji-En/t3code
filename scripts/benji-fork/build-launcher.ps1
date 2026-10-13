param([string]$OutputName = 'T3 Code Benji Fast.exe')
$ErrorActionPreference = 'Stop'
$forkRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$outputDirectory = Join-Path $forkRoot 'assets/benji-fork/bin'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'The Windows C# compiler is missing.' }
& $compiler /nologo /target:winexe /optimize+ /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll "/win32icon:$(Join-Path $forkRoot 'assets/benji-fork/icon.ico')" "/out:$(Join-Path $outputDirectory $OutputName)" (Join-Path $PSScriptRoot 'ForkLauncher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Fork launcher compilation failed.' }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'ForkLauncher.exe.config') -Destination (Join-Path $outputDirectory ($OutputName + '.config'))
@{commitHash=(git -C $forkRoot rev-parse HEAD).Trim()} | ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $outputDirectory 'launch-settings.json')
Write-Output (Join-Path $outputDirectory $OutputName)
