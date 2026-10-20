# Benji fork

This Windows source fork adds the optional **NieR Archive** theme, its application
icon, and an isolated native launcher. The skin paints the existing interface;
it does not change navigation, panel geometry, fonts, or provider behavior.

## Appearance

Select **Settings → Appearance → Colors & themes → NieR Archive**. Select another
theme to remove the decorations. The accepted artwork is the minimal structural
ruins in `apps/web/src/skins/nier-archive/ruins-structural.webp`. Static grain,
orbital diagrams, and registration marks accompany it. Light uses parchment;
dark uses brown charcoal with ivory conversation text. The sidebar, composer,
and project menu share the dark surface shade. Interrupt uses the Start/Play
palette; error and diff colors retain their distinct meanings.

The Sun/Moon button immediately to the right of Usage switches Light/Dark and
saves the existing appearance preference. Settings, the command palette, and
**Ctrl+Alt+Shift+A** still offer Light/Dark/System. The web and Electron clients
share the skin; the native mobile client is unchanged.

## Windows launch

The native launcher uses `%LOCALAPPDATA%\T3Code-Benji` for data, provider settings,
authentication, and private runtimes. It expects the isolated setup to exist,
including `runtimes/node`, `runtimes/codex`, and `runtimes/claude`. Provider sign-ins
are independent of the original Codex and Claude installations. Credentials and
profile files must stay outside Git.

From the checkout, after installing dependencies and building the desktop:

```powershell
vp i
vp run build:desktop
pwsh -NoProfile -File scripts/benji-fork/build-launcher.ps1
pwsh -NoProfile -File scripts/benji-fork/install-appearance.ps1
```

Run installation in an ordinary Windows terminal so AppData resolves to the
physical profile rather than a Store application's redirected cache. Installation
publishes the theme, stages the branded loading screen, and refreshes the fork's
Start Menu shortcut and existing taskbar pin. It creates no desktop shortcut.
The generated launcher binaries are ignored by Git. The selected icon is stored
in `icon.png` and `icon.ico`; the Windows icon and in-app mark use the accepted
larger presentation without changing their layout boxes.

Closing the window retains the fork in the tray. Clicking its pin reopens the
same window. On Windows, press **Alt** to reveal the app menu, then choose
**File → Exit** to stop it completely. The tray also offers **Quit T3 Code**.
Cold launches still wait for the backend to become ready. A
private backend bytecode cache speeds subsequent launches and does not pass
cache settings to provider processes. No startup entries or scheduled tasks are
installed. Official automatic updates are disabled for this launcher.

## Update and backup

Fully quit the fork before backing up `%LOCALAPPDATA%\T3Code-Benji`. Keep backups
private because they include credentials and conversations. Existing Codex and
Claude installations and profiles are separate.

Preserve local changes in Git, fetch `upstream`, and merge `upstream/main` without
dropping the fork's custom commits. For unattended updates, prepare and validate
the merge and build in a separate checkout before promoting it. Then repeat the
build and installation commands above. Resolve conflicts before building.

On Windows, a running app can lock native package files. If dependency import
reports `EPERM`, retry the isolated checkout with copied packages and a fresh
virtual store: pass `-- --package-import-method=copy
--virtual-store-dir=node_modules/.pnpm-update` to `vp install`. Finish installation,
including the declared dependency patches, before validating or publishing.

After appearance-only rebuilds, **Ctrl+R in T3** reloads the client.
Native shell or launcher changes require a full quit and relaunch.

To undo the appearance, choose another theme. To restore a profile backup, fully
quit the fork first, retain a copy of the current profile, and restore the backup
to the same private profile directory. This does not restore or modify the
original Codex or Claude profiles.
