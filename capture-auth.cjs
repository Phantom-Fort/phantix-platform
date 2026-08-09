const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SHOTS = "C:\\Users\\USER\\Downloads\\Phantix Reading\\Phantix Application\\FE-DOCS\\docs\\screenshots";
const RELAY = "C:\\Users\\USER\\AppData\\Local\\Temp\\opencode\\otp-relay";
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(RELAY, { recursive: true });
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const WAIT_FILE = path.join(RELAY, "otp-wait.txt");
const VALUE_FILE = path.join(RELAY, "otp-value.txt");

function clearRelay() {
  try { fs.unlinkSync(WAIT_FILE); } catch {}
  try { fs.unlinkSync(VALUE_FILE); } catch {}
}

async function waitForOtp(page, which) {
  // Let dev OTP auto-resolve if visible
  const body = await page.locator("body").textContent().catch(() => "");
  const dev = body.match(/(?:Dev OTP|dev_otp|dev code)[:\s]*([0-9]{6})/);
  if (dev) {
    console.log(`[${which}] OTP auto (dev): ${dev[1]}`);
    await fillOtp(page, dev[1]);
    return;
  }
  // Signal we need the user's OTP
  fs.writeFileSync(WAIT_FILE, which, "utf8");
  console.log(`[${which}] WAITING FOR OTP... (see ${WAIT_FILE})`);
  // Poll up to 5 minutes
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    if (fs.existsSync(VALUE_FILE)) {
      const code = fs.readFileSync(VALUE_FILE, "utf8").trim();
      try { fs.unlinkSync(VALUE_FILE); } catch {}
      try { fs.unlinkSync(WAIT_FILE); } catch {}
      console.log(`[${which}] OTP received: ${code}`);
      await fillOtp(page, code);
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`[${which}] Timed out waiting for OTP`);
}

async function fillOtp(page, code) {
  const single = page.locator(`input[inputmode="numeric"], input[maxlength="6"]`).first();
  if (await single.count()) { await single.fill(code.slice(0, 6)); await single.press("Enter"); return; }
  const boxes = page.locator(`input[maxlength="1"]`);
  const n = await boxes.count();
  if (n > 0) { for (let i = 0; i < n && i < code.length; i++) await boxes.nth(i).fill(code[i]); await page.keyboard.press("Enter"); return; }
  const any = page.locator("input:visible").last();
  if (await any.count()) { await any.fill(code); await any.press("Enter"); }
}

async function shot(page, name) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
  console.log("SHOT:", name);
}

async function clickButton(page, label) {
  const btn = page.locator(`button:has-text("${label}")`).first();
  await btn.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  await btn.click();
}
async function hasOtpField(page) {
  const count = await page.locator(`input[inputmode="numeric"], input[maxlength="6"], input[maxlength="1"]`).count();
  const body = await page.locator("body").textContent().catch(() => "");
  return count > 0 || /6.?digit|verification code|one-time code/i.test(body);
}

async function loginPlatform(page, email, password) {
  await page.goto("https://platform.phantix.site/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.locator('input[type="text"], input[placeholder*="you@company.com"]').first().fill(email);
  await clickButton(page, "Continue");
  await page.waitForTimeout(2000);
  if (await page.locator('input[type="password"]').count()) {
    await page.locator('input[type="password"]').first().fill(password);
    await clickButton(page, "Continue");
    await page.waitForTimeout(2500);
  }
  if (await hasOtpField(page)) await waitForOtp(page, "platform");
  await page.waitForTimeout(3000);
  console.log("PLATFORM URL:", page.url());
}

async function loginStaff(page, email, password) {
  await page.goto("https://staff.phantix.site/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"], input[type="text"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await clickButton(page, "Sign In");
  await page.waitForTimeout(3000);
  if (await hasOtpField(page)) await waitForOtp(page, "staff");
  await page.waitForTimeout(3000);
  console.log("STAFF URL:", page.url());
}

async function loginApp(page, email, password) {
  await page.goto("https://app.phantix.site/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.locator('input[type="text"], input[placeholder*="you@company.com"]').first().fill(email);
  await clickButton(page, "Continue");
  await page.waitForTimeout(2000);
  if (await page.locator('input[type="password"]').count()) {
    await page.locator('input[type="password"]').first().fill(password);
    await clickButton(page, "Continue");
    await page.waitForTimeout(2500);
  }
  if (await hasOtpField(page)) await waitForOtp(page, "app");
  await page.waitForTimeout(3000);
  console.log("APP URL:", page.url());
}

(async () => {
  clearRelay();
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ["--no-sandbox"] });

  // Platform
  const platform = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await loginPlatform(platform, "phantomayoola@gmail.com", "Phan7omSec4321");
  await shot(platform, "platform-dashboard.png");

  // Staff
  const staff = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await loginStaff(staff, "posiayoola102@gmail.com", "l76inLHaZUNJwLLjCLW4057U");
  await shot(staff, "staff-dashboard.png");

  // App / Command Centre
  const app = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await loginApp(app, "phantomayoola@gmail.com", "Phan7omSec4321");
  await shot(app, "app-dashboard.png");

  await browser.close();
  console.log("ALL_AUTH_DONE");
  try { fs.unlinkSync(WAIT_FILE); } catch {}
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
