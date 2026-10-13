using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: AssemblyTitle("T3 Code — Benji Fork")]
[assembly: AssemblyProduct("T3 Code — Benji Fork")]

static class ForkLauncher {
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern int SetCurrentProcessExplicitAppUserModelID(string id);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetNamedPipeServerProcessId(Microsoft.Win32.SafeHandles.SafePipeHandle pipe, out uint processId);
    [DllImport("user32.dll")]
    static extern bool AllowSetForegroundWindow(uint processId);
    static string PipeName(string home) {
        using (var sha = SHA256.Create()) {
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(Path.GetFullPath(home).Replace('/', '\\').ToLowerInvariant()));
            return "T3Code-Benji-" + BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant().Substring(0, 16);
        }
    }
    static bool Activate(string home) {
        try {
            using (var pipe = new NamedPipeClientStream(".", PipeName(home), PipeDirection.InOut, PipeOptions.Asynchronous)) {
                pipe.Connect(80);
                uint owner;
                if (GetNamedPipeServerProcessId(pipe.SafePipeHandle, out owner)) AllowSetForegroundWindow(owner);
                var request = Encoding.UTF8.GetBytes("{\"action\":\"activate\"}\n");
                pipe.Write(request, 0, request.Length);
                pipe.Flush();
                using (var reader = new StreamReader(pipe)) {
                    var response = reader.ReadLineAsync();
                    if (!response.Wait(750)) return false;
                    var value = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(response.Result);
                    return value.ContainsKey("ready") && (bool)value["ready"];
                }
            }
        } catch { return false; }
    }
    [STAThread]
    static void Main() {
        SetCurrentProcessExplicitAppUserModelID("com.benji.t3code.fork");
        string home = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "T3Code-Benji");
        // Only the explicitly hidden review entry may use a disposable profile.
        string audit = Environment.GetEnvironmentVariable("T3_BENJI_AUDIT_ENTRY");
        string review = Environment.GetEnvironmentVariable("T3_BENJI_REVIEW_HOME");
        if (!String.IsNullOrEmpty(audit) && !String.IsNullOrEmpty(review)) home = Path.GetFullPath(review);
        try {
            if (Activate(home)) return;
            string root = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(Application.ExecutablePath), "..", "..", ".."));
            string electron = Path.Combine(root, "apps", "desktop", "node_modules", "electron", "dist", "electron.exe");
            string entry = String.IsNullOrEmpty(audit) ? Path.Combine(root, "scripts", "benji-fork", "desktop-bootstrap.cjs") : audit;
            if (!File.Exists(electron) || !File.Exists(entry)) throw new IOException("Build the fork before launching it.");
            var start = new ProcessStartInfo(electron, "\"" + entry + "\"") {
                WorkingDirectory = Path.Combine(root, "apps", "desktop"), UseShellExecute = false,
                CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden
            };
            var keys = new List<string>();
            foreach (string key in start.EnvironmentVariables.Keys) keys.Add(key);
            foreach (string key in keys) {
                if (key.StartsWith("CODEX_", StringComparison.OrdinalIgnoreCase) ||
                    key.StartsWith("CLAUDE_", StringComparison.OrdinalIgnoreCase) ||
                    key.StartsWith("ANTHROPIC_", StringComparison.OrdinalIgnoreCase) ||
                    key == "OPENAI_API_KEY" || key == "ELECTRON_RUN_AS_NODE" ||
                    key == "VITE_DEV_SERVER_URL" || key == "VITE_HTTP_URL" || key == "VITE_WS_URL")
                    start.EnvironmentVariables.Remove(key);
            }
            start.EnvironmentVariables["T3CODE_HOME"] = home;
            start.EnvironmentVariables["APPDATA"] = Path.Combine(home, "Roaming");
            start.EnvironmentVariables["CODEX_HOME"] = Path.Combine(home, "providers", "codex");
            start.EnvironmentVariables["CLAUDE_CONFIG_DIR"] = Path.Combine(home, "providers", "claude");
            start.EnvironmentVariables["CLAUDE_CODE_GIT_BASH_PATH"] = @"C:\Program Files\Git\bin\bash.exe";
            start.EnvironmentVariables["DISABLE_AUTOUPDATER"] = "1";
            start.EnvironmentVariables["T3CODE_DISABLE_AUTO_UPDATE"] = "1";
            start.EnvironmentVariables["T3CODE_DESKTOP_APP_USER_MODEL_ID"] = "com.benji.t3code.fork";
            if (String.IsNullOrEmpty(audit)) start.EnvironmentVariables["T3CODE_PORT"] = "4773";
            string python = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Python", "Python311");
            start.EnvironmentVariables["PYTHONHOME"] = python;
            start.EnvironmentVariables["PATH"] = String.Join(";", new[] {
                Path.Combine(home, "runtimes", "python-shim"), python,
                Path.Combine(home, "runtimes", "codex"), Path.Combine(home, "runtimes", "claude"),
                Path.Combine(home, "runtimes", "node"), @"C:\Program Files\Git\cmd", start.EnvironmentVariables["PATH"]
            });
            string metadata = Path.Combine(root, "assets", "benji-fork", "bin", "launch-settings.json");
            if (File.Exists(metadata)) {
                var values = new JavaScriptSerializer().Deserialize<Dictionary<string, string>>(File.ReadAllText(metadata).TrimStart('\uFEFF'));
                start.EnvironmentVariables["T3CODE_COMMIT_HASH"] = values["commitHash"];
            }
            using (var child = Process.Start(start)) {
                child.WaitForExit();
                if (child.ExitCode != 0) throw new IOException("T3 exited with code " + child.ExitCode + ". See the fork's userdata/logs folder.");
            }
        } catch (Exception error) {
            if (Directory.Exists(home)) File.WriteAllText(Path.Combine(home, "native-launch-error.txt"), error.Message);
            if (String.IsNullOrEmpty(audit)) MessageBox.Show(error.Message, "T3 Code — Benji Fork", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Environment.ExitCode = 1;
        }
    }
}
