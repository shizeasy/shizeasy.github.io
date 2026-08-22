import { Adb, adbDaemonAuthenticate } from "@yume-chan/adb";
import {
  AdbWebCryptoCredentialManager,
  TangoIndexedDbStorage,
} from "@yume-chan/adb-credential-web";
import { AdbDaemonWebUsbDeviceManager } from "@yume-chan/adb-daemon-webusb";
import "./style.css";

const SHIZUKU_COMMAND =
  "adb shell sh /sdcard/Android/data/moe.shizuku.privileged.api/start.sh";
const SHELL_COMMAND =
  "sh /sdcard/Android/data/moe.shizuku.privileged.api/start.sh";

let adb: Adb | undefined;
let selectedDevice: Awaited<
  ReturnType<AdbDaemonWebUsbDeviceManager["requestDevice"]>
> | undefined;

const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
const credentialManager = new AdbWebCryptoCredentialManager(
  new TangoIndexedDbStorage("shizuku-webadb"),
);

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">⌁</div>
        <div>
          <div class="brand-name">Shizuku WebADB</div>
          <div class="brand-sub">ADB in your browser</div>
        </div>
      </div>
      <a class="github" href="https://github.com/yume-chan/ya-webadb" target="_blank" rel="noreferrer">
        based on Tango / ya-webadb ↗
      </a>
    </header>

    <section class="hero">
      <div>
        <span class="eyebrow">USB • ADB • WEBUSB</span>
        <h1>Connect your Android.<br><span>Start Shizuku.</span></h1>
        <p class="lede">
          Pick an ADB-enabled device, authorize it in Android, then run the
          Shizuku start script directly from this page.
        </p>
      </div>
      <div class="hero-orb" aria-hidden="true"></div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="section-label">01 / DEVICE</div>
          <h2>Choose a device</h2>
        </div>
        <div id="status-pill" class="status-pill idle">Not connected</div>
      </div>

      <button id="connect" class="primary">
        <span class="button-icon">⌁</span>
        Pick Android device
      </button>

      <div id="device-card" class="device-card hidden">
        <div class="device-icon">▣</div>
        <div class="device-copy">
          <strong id="device-name">Android device</strong>
          <span id="device-serial"></span>
        </div>
        <div class="connected-dot"></div>
      </div>

      <div id="actions" class="actions hidden">
        <div class="section-label">02 / ACTION</div>
        <button id="shizuku" class="shizuku">
          <span class="shizuku-symbol">S</span>
          <span>
            <strong>Shizuku</strong>
            <small>Run the Shizuku start script</small>
          </span>
          <span class="arrow">→</span>
        </button>
      </div>

      <div id="output-wrap" class="output-wrap hidden">
        <div class="output-head">
          <span>ADB OUTPUT</span>
          <button id="clear-output">Clear</button>
        </div>
        <pre id="output"></pre>
      </div>
    </section>

    <section class="notes">
      <div>
        <strong>Requirements</strong>
        <span>Chromium browser + USB cable + USB debugging enabled</span>
      </div>
      <div>
        <strong>Command</strong>
        <code>${SHIZUKU_COMMAND}</code>
      </div>
    </section>

    <footer>
      <span>Runs locally in your browser. No ADB server required.</span>
      <span>WebUSB requires HTTPS or localhost.</span>
    </footer>
  </main>
`;

const connectButton = document.querySelector<HTMLButtonElement>("#connect")!;
const shizukuButton = document.querySelector<HTMLButtonElement>("#shizuku")!;
const deviceCard = document.querySelector<HTMLDivElement>("#device-card")!;
const actions = document.querySelector<HTMLDivElement>("#actions")!;
const outputWrap = document.querySelector<HTMLDivElement>("#output-wrap")!;
const output = document.querySelector<HTMLPreElement>("#output")!;
const statusPill = document.querySelector<HTMLDivElement>("#status-pill")!;
const deviceName = document.querySelector<HTMLElement>("#device-name")!;
const deviceSerial = document.querySelector<HTMLElement>("#device-serial")!;
const clearOutput = document.querySelector<HTMLButtonElement>("#clear-output")!;

function log(message: string) {
  outputWrap.classList.remove("hidden");
  output.textContent += `${message}\n`;
  output.scrollTop = output.scrollHeight;
}

function setStatus(text: string, kind: "idle" | "busy" | "ok" | "error") {
  statusPill.textContent = text;
  statusPill.className = `status-pill ${kind}`;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

connectButton.addEventListener("click", async () => {
  if (!manager) {
    log("WebUSB is not available in this browser. Use Chrome or Edge over HTTPS/localhost.");
    setStatus("WebUSB unavailable", "error");
    return;
  }

  connectButton.disabled = true;
  connectButton.innerHTML = `<span class="spinner"></span> Waiting for device…`;
  setStatus("Select device", "busy");

  try {
    selectedDevice = await manager.requestDevice();

    if (!selectedDevice) {
      setStatus("Not connected", "idle");
      return;
    }

    log(`Selected: ${selectedDevice.name || "Android device"} (${selectedDevice.serial})`);
    log("Opening ADB connection…");

    const connection = await selectedDevice.connect();

    const transport = await adbDaemonAuthenticate({
      serial: selectedDevice.serial,
      connection,
      credentialManager,
    });

    adb = new Adb(transport);

    deviceName.textContent =
      (await adb.getProp("ro.product.model")) || selectedDevice.name || "Android device";
    deviceSerial.textContent = selectedDevice.serial;

    deviceCard.classList.remove("hidden");
    actions.classList.remove("hidden");
    connectButton.classList.add("hidden");
    setStatus("Connected", "ok");

    log("ADB connected and authenticated.");
  } catch (error) {
    log(`ERROR: ${errorText(error)}`);
    setStatus("Connection failed", "error");
  } finally {
    connectButton.disabled = false;
    connectButton.innerHTML = `<span class="button-icon">⌁</span> Pick Android device`;
  }
});

shizukuButton.addEventListener("click", async () => {
  if (!adb) {
    log("Connect a device first.");
    return;
  }

  shizukuButton.disabled = true;
  shizukuButton.classList.add("running");
  setStatus("Running Shizuku", "busy");
  log(`> ${SHIZUKU_COMMAND}`);

  try {
    // The browser-side ADB library already has the device connection, so the
    // leading `adb shell` is represented by the subprocess API itself.
    const result = await adb.subprocess.shellProtocol.spawn(SHELL_COMMAND).wait();

    const stdout = new TextDecoder().decode(result.stdout);
    const stderr = new TextDecoder().decode(result.stderr);

    if (stdout) log(stdout.trimEnd());
    if (stderr) log(stderr.trimEnd());
    log(`Exit code: ${result.exitCode}`);

    if (result.exitCode === 0) {
      setStatus("Shizuku started", "ok");
    } else {
      setStatus("Shizuku returned an error", "error");
    }
  } catch (error) {
    log(`ERROR: ${errorText(error)}`);
    setStatus("Command failed", "error");
  } finally {
    shizukuButton.disabled = false;
    shizukuButton.classList.remove("running");
  }
});

clearOutput.addEventListener("click", () => {
  output.textContent = "";
  outputWrap.classList.add("hidden");
});
