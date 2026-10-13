param([string]$ReportPath = '')
$ErrorActionPreference = 'Stop'
$forkRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$forkHome = Join-Path $env:LOCALAPPDATA 'T3Code-Benji'
$forkNode = Join-Path $forkHome 'runtimes/node/node.exe'
& $forkNode (Join-Path $PSScriptRoot 'stage-client.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Fork client staging failed.' }
$forkLauncher = Join-Path $forkHome 'launcher/start-t3-source.ps1'
$nativeLauncher = Join-Path $forkRoot 'assets/benji-fork/bin/T3 Code Benji Fast.exe'
$legacyNativeLauncher = Join-Path $forkRoot 'assets/benji-fork/bin/T3 Code Benji.exe'
if (-not (Test-Path -LiteralPath $forkLauncher)) {
    throw 'The isolated T3 Benji Fork launcher must be installed first.'
}
$launcherText = Get-Content -LiteralPath $forkLauncher -Raw
if ($launcherText.Contains('apps/desktop/scripts/start-electron.mjs')) {
    $launcherText = $launcherText.Replace('apps/desktop/scripts/start-electron.mjs', 'scripts/benji-fork/start-desktop.mjs')
    Set-Content -LiteralPath $forkLauncher -Value $launcherText -NoNewline
}
$themeDirectory = Join-Path $forkHome 'userdata/themes'
New-Item -ItemType Directory -Path $themeDirectory -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $forkRoot 'assets/themes/benji-nier-archive.json') -Destination $themeDirectory
$iconSource = Join-Path $forkRoot 'assets/benji-fork/icon.ico'
# Embed the public artwork in the native launcher so the taskbar and relaunch
# target share one stable identity. Keep a copy with the private backup files.
$forkIcon = $iconSource
if (Test-Path -LiteralPath $nativeLauncher) { $forkIcon = $nativeLauncher }
Copy-Item -LiteralPath $iconSource -Destination (Join-Path $forkHome 'launcher/t3-nier.ico')

# Use the Windows shortcut property store, preserving the existing taskbar pin.
# Only links to this checkout's Electron or the isolated launcher are eligible.
if (-not ('BenjiFork.ShortcutIdentity' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
namespace BenjiFork {
    [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
    class ShellLink {}
    [StructLayout(LayoutKind.Sequential)]
    struct PropertyKey { public Guid fmtid; public uint pid; }
    [StructLayout(LayoutKind.Explicit, Size=24)]
    struct PropVariant {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public IntPtr value;
    }
    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore {
        void GetCount(out uint count);
        void GetAt(uint index, out PropertyKey key);
        void GetValue(ref PropertyKey key, out PropVariant value);
        void SetValue(ref PropertyKey key, ref PropVariant value);
        void Commit();
    }
    [ComImport, Guid("45E2B4AE-B1C3-11D0-B92F-00A0C90312E1"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellLinkDataList {
        void AddDataBlock(IntPtr data);
        void CopyDataBlock(uint signature, out IntPtr data);
        void RemoveDataBlock(uint signature);
        void GetFlags(out uint flags);
        void SetFlags(uint flags);
    }
    public static class ShortcutIdentity {
        [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
        static extern void SHChangeNotify(uint change, uint flags, string path, IntPtr other);
        public static void RefreshIcons() {
            SHChangeNotify(0x08000000, 0x1000, null, IntPtr.Zero);
        }
        public static void Set(string file) {
            var link = new ShellLink();
            try {
                var persist = (IPersistFile)link;
                persist.Load(file, 2);
                // WScript adds an expanded icon block using %USERPROFILE%.
                // Keep IconLocation absolute and remove only icon expansion.
                var data = (IShellLinkDataList)link;
                data.GetFlags(out uint flags);
                if ((flags & 0x4000) != 0) {
                    data.RemoveDataBlock(0xA0000007);
                    data.SetFlags(flags & ~0x4000u);
                }
                var store = (IPropertyStore)link;
                var key = new PropertyKey { fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5 };
                var value = new PropVariant { vt = 31, value = Marshal.StringToCoTaskMemUni("com.benji.t3code.fork") };
                try { store.SetValue(ref key, ref value); store.Commit(); persist.Save(file, true); }
                finally { Marshal.FreeCoTaskMem(value.value); }
            } finally { Marshal.FinalReleaseComObject(link); }
            SHChangeNotify(0x2000, 5, file, IntPtr.Zero);
        }
    }
}
'@
}

$shell = New-Object -ComObject WScript.Shell
$startMenuDirectory = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Microsoft/Windows/Start Menu/Programs/T3 Code Benji'
New-Item -ItemType Directory -Path $startMenuDirectory -Force | Out-Null
$startMenuLink = Join-Path $startMenuDirectory 'T3 Code — Benji Fork.lnk'
$pinDirectory = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Microsoft/Internet Explorer/Quick Launch/User Pinned/TaskBar'
$links = @($startMenuLink)
if (Test-Path -LiteralPath $pinDirectory) {
    foreach ($item in Get-ChildItem -LiteralPath $pinDirectory -Filter '*.lnk') {
        $link = $shell.CreateShortcut($item.FullName)
        $isForkElectron = $link.TargetPath.StartsWith($forkRoot + '\', [StringComparison]::OrdinalIgnoreCase) -and
            (Split-Path $link.TargetPath -Leaf) -eq 'electron.exe'
        $isForkLauncher = $link.Arguments.Contains($forkLauncher) -or $link.TargetPath -in @($nativeLauncher, $legacyNativeLauncher)
        if ($isForkElectron -or $isForkLauncher) { $links += $item.FullName }
    }
}
$shortcutReports = @()
foreach ($linkPath in $links) {
    $link = $shell.CreateShortcut($linkPath)
    $previousTarget = $link.TargetPath
    if (Test-Path -LiteralPath $nativeLauncher) {
        $link.TargetPath = $nativeLauncher
        $link.Arguments = ''
        $link.WorkingDirectory = Split-Path $nativeLauncher
    } else {
        $link.TargetPath = Join-Path $env:ProgramFiles 'PowerShell/7/pwsh.exe'
        $link.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $forkLauncher + '" -Mode desktop'
        $link.WorkingDirectory = Split-Path $forkLauncher
    }
    $link.IconLocation = $forkIcon + ',0'
    $link.Description = 'T3 Code — Benji Fork (isolated profile)'
    $link.WindowStyle = 7
    $link.Save()
    [BenjiFork.ShortcutIdentity]::Set($linkPath)
    $shortcutReports += [PSCustomObject]@{path=$linkPath;previousTarget=$previousTarget;target=$link.TargetPath;arguments=$link.Arguments;icon=$link.IconLocation}
    Write-Output ('Updated fork shortcut: ' + $linkPath)
}
[BenjiFork.ShortcutIdentity]::RefreshIcons()
if ($ReportPath) { $shortcutReports | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $ReportPath }
Write-Output 'NieR Archive is available in Settings > Appearance. Current theme selection was preserved.'
