import { createServer } from "node:http";
import { access, readFile, stat } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
const port = 4173;
const debuggingPort = 9300 + Math.floor(Math.random() * 500);
const browserCandidates = [
  process.env.CHROME_PATH,
  "msedge",
  "chrome",
  "google-chrome",
  "chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function resolveBrowserPath() {
  for (const candidate of browserCandidates) {
    if (/[/\\]/.test(candidate)) {
      try {
        await access(candidate);
        return candidate;
      } catch {
        continue;
      }
    }
    const lookup = process.platform === "win32"
      ? spawnSync("where", [candidate], { stdio: "ignore" })
      : spawnSync("sh", ["-lc", `command -v ${candidate}`], { stdio: "ignore" });
    if (lookup.status === 0) return candidate;
  }
  throw new Error("Could not find Chrome or Edge. Set CHROME_PATH to the browser executable.");
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");

    if (relativePath === "supabase-config.js") {
      response.writeHead(200, { "Content-Type": mimeTypes[".js"] });
      response.end("window.SUPABASE_CONFIG = { url: '', anonKey: '' };\n");
      return;
    }

    const filePath = normalize(join(root, relativePath));
    assert(filePath.startsWith(normalize(root)), "Blocked path outside project");
    assert((await stat(filePath)).isFile(), "Not a file");
    let body = await readFile(filePath);

    if (extname(filePath) === ".html") {
      const html = body.toString("utf8").replace(
        /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2"><\/script>/,
        "<script>window.supabase = {};</script>"
      );
      body = Buffer.from(html, "utf8");
    }

    response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
const browserPath = await resolveBrowserPath();
const browser = spawn(browserPath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-allow-origins=*",
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${join(tmpdir(), `booking-audit-${Date.now()}`)}`,
  `http://127.0.0.1:${port}/index.html`
], { stdio: "ignore" });

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    if (this.socket.readyState !== WebSocket.OPEN) {
      await new Promise((resolve, reject) => {
        this.socket.addEventListener("open", resolve, { once: true });
        this.socket.addEventListener("error", reject, { once: true });
      });
    }
    this.socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.id) {
        const pending = this.pending.get(payload.id);
        if (!pending) return;
        this.pending.delete(payload.id);
        if (payload.error) pending.reject(new Error(payload.error.message));
        else pending.resolve(payload.result);
        return;
      }
      (this.listeners.get(payload.method) || []).forEach((listener) => listener(payload.params));
    });
  }

  on(method, listener) {
    this.listeners.set(method, [...(this.listeners.get(method) || []), listener]);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  }
}

async function getPageTarget() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`).then((response) => response.json());
      const target = targets.find((item) => item.type === "page" && item.url.startsWith(`http://127.0.0.1:${port}/`));
      if (target) return target;
    } catch {
      // Browser is still starting.
    }
    await wait(100);
  }
  throw new Error(`Could not connect to browser at ${browserPath}`);
}

const tests = [];
const consoleErrors = [];
const failedLocalRequests = [];
const requestUrls = new Map();
let client;

async function test(name, callback) {
  await callback();
  tests.push(name);
}

try {
  const target = await getPageTarget();
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Network.enable");

  client.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    consoleErrors.push(exceptionDetails.exception?.description || exceptionDetails.text);
  });
  client.on("Network.requestWillBeSent", ({ requestId, request }) => requestUrls.set(requestId, request.url));
  client.on("Network.loadingFailed", ({ requestId, canceled }) => {
    const requestUrl = requestUrls.get(requestId) || "";
    if (!canceled && requestUrl.startsWith(`http://127.0.0.1:${port}/`)) failedLocalRequests.push(requestUrl);
  });

  await wait(700);
  await test("public page fails closed without Supabase", async () => {
    const result = await client.evaluate(`({
      rtl: document.documentElement.dir === 'rtl',
      revealed: !document.documentElement.classList.contains('app-booting'),
      errorTitle: document.querySelector('#businessName')?.textContent,
      ownerLoginButton: Boolean(document.querySelector('#openSellerLogin'))
    })`);
    assert(result.rtl && result.revealed && result.ownerLoginButton, "Public page did not load safely");
    assert(result.errorTitle === "\u05dc\u05d0 \u05d4\u05e6\u05dc\u05d7\u05e0\u05d5 \u05dc\u05d8\u05e2\u05d5\u05df \u05d0\u05ea \u05d4\u05e2\u05e1\u05e7", "Public page displayed fallback business data");
  });

  await test("customer account forms and password visibility", async () => {
    const result = await client.evaluate(`(() => {
      document.querySelector('#openCustomerLogin').click();
      document.querySelector('#openCustomerSignupButton').click();
      const form = document.querySelector('#customerSignupForm');
      const password = form.elements.password;
      document.querySelector('[data-password-toggle="customerSignupPassword"]').click();
      return {
        visible: form.classList.contains('is-active'),
        fields: ['firstName','lastName','phone','email','password','confirmPassword'].every((name) => Boolean(form.elements[name])),
        passwordVisible: password.type === 'text'
      };
    })()`);
    assert(Object.values(result).every(Boolean), "Customer signup form is incomplete");
  });

  await test("legacy local data is purged", async () => {
    await client.evaluate(`localStorage.setItem('booking_app_local_working_v2', JSON.stringify({ users: [{ phone: '0500000000' }] })); location.reload()`);
    await wait(700);
    assert(await client.evaluate(`localStorage.getItem('booking_app_local_working_v2') === null`), "Legacy customer cache was not removed");
  });

  await test("mobile public layout has no horizontal overflow", async () => {
    await client.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
    const layout = await client.evaluate(`({
      viewport: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      topbarWidth: document.querySelector('.topbar')?.getBoundingClientRect().width || 0
    })`);
    assert(layout.pageWidth <= layout.viewport + 2 && layout.topbarWidth <= layout.viewport + 2, "Public mobile layout overflows horizontally");
  });

  await client.send("Page.navigate", { url: `http://127.0.0.1:${port}/owner.html` });
  await wait(700);
  await test("owner page remains protected without Supabase", async () => {
    const owner = await client.evaluate(`({
      rtl: document.documentElement.dir === 'rtl',
      revealed: !document.documentElement.classList.contains('app-booting'),
      loginVisible: !document.querySelector('#ownerLoginGate').classList.contains('is-hidden'),
      dashboardHidden: document.querySelector('#ownerLayout').classList.contains('is-hidden'),
      username: document.querySelector('#ownerLoginForm').elements.username.value,
      message: document.querySelector('#ownerAccessMessage').textContent
    })`);
    assert(owner.rtl && owner.revealed && owner.loginVisible && owner.dashboardHidden, "Owner page exposed the dashboard");
    assert(owner.username === "admin" && owner.message.includes("\u05d4\u05d7\u05d9\u05d1\u05d5\u05e8 \u05d4\u05de\u05d0\u05d5\u05d1\u05d8\u05d7"), "Owner login state is unclear");
  });

  await test("owner mobile layout has no horizontal overflow", async () => {
    const layout = await client.evaluate(`({ viewport: innerWidth, pageWidth: document.documentElement.scrollWidth })`);
    assert(layout.pageWidth <= layout.viewport + 2, "Owner mobile layout overflows horizontally");
  });

  assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(" | ")}`);
  assert(failedLocalRequests.length === 0, `Failed local requests: ${failedLocalRequests.join(" | ")}`);
  process.stdout.write(JSON.stringify({ ok: true, tests, consoleErrors, failedLocalRequests }, null, 2));
} finally {
  if (client?.socket?.readyState === WebSocket.OPEN) client.socket.close();
  browser.kill();
  await new Promise((resolve) => server.close(resolve));
}
