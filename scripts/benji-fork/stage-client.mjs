import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const root = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "../..");
const source = NodePath.join(root, "apps/web/dist");
const target = NodePath.join(root, "apps/server/dist/client");
const theme = JSON.parse(
  NodeFS.readFileSync(NodePath.join(root, "assets/themes/benji-nier-archive.json")),
);
const storedTheme = { ...theme, label: theme.name };
delete storedTheme.name;

// Staging stays outside upstream HTML. Keep old hashed assets available to a
// running client, and publish the entry last. Only public artwork is embedded.
NodeFS.mkdirSync(target, { recursive: true });
for (const entry of NodeFS.readdirSync(source, { withFileTypes: true })) {
  if (entry.name === "index.html") continue;
  NodeFS.cpSync(NodePath.join(source, entry.name), NodePath.join(target, entry.name), {
    recursive: true,
  });
}
NodeFS.copyFileSync(
  NodePath.join(root, "assets/benji-fork/icon.png"),
  NodePath.join(target, "benji-fork-icon.png"),
);
let html = NodeFS.readFileSync(NodePath.join(source, "index.html"), "utf8");
// Refresh this theme's cached palette before the upstream pre-paint resolver.
// Neither the selected theme nor the appearance preference is changed.
const refresh = `<script>try { const key = "t3code:themes:v1";
const themes = JSON.parse(localStorage.getItem(key) || "null");
if (Array.isArray(themes) && themes.some(t => t.id === ${JSON.stringify(theme.id)})) {
localStorage.setItem(key, JSON.stringify(themes.map(t => t.id === ${JSON.stringify(theme.id)} ? ${JSON.stringify(storedTheme)} : t)));
} } catch {}</script>`;
html = html.replace(/<script>/, `${refresh}<script>`);
const branding = `<style>
#boot-shell-logo { display: block; background: currentColor;
mask: url("/benji-fork-icon.png") center / 110% 110% no-repeat; }
html:not([data-theme-selected="true"]) #boot-shell { background: ${theme.colors.canvas}; color: ${theme.colors.text}; }
html.dark:not([data-theme-selected="true"]) #boot-shell { background: ${theme.variants.dark.canvas}; color: ${theme.variants.dark.text}; }
html[data-theme-id="${theme.id}"] #boot-shell { background: var(--boot-background); color: var(--boot-foreground);
background-image: radial-gradient(ellipse at 50% 60%, transparent, #7760430c); }
</style>`;
html = html.replace("</head>", `${branding}</head>`);
const logo = /<img\b[^>]*id="boot-shell-logo"[^>]*>/;
if (!logo.test(html)) throw Error("The upstream boot logo changed; review fork staging.");
html = html.replace(logo, '<span id="boot-shell-logo" role="img" aria-label="T3 Code"></span>');
const temporary = NodePath.join(target, ".benji-index.tmp");
NodeFS.writeFileSync(temporary, html);
NodeFS.renameSync(temporary, NodePath.join(target, "index.html"));
console.log("Staged the fork client and loading artwork.");
