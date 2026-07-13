import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = {
  console,
  crypto: globalThis.crypto,
  window: null
};
context.window = context;

vm.createContext(context);
vm.runInContext(fs.readFileSync("shared.js", "utf8"), context, { filename: "shared.js" });

const { normalizeWhatsAppPhoneNumber } = context;

assert.equal(normalizeWhatsAppPhoneNumber("0559922718"), "972559922718");
assert.equal(normalizeWhatsAppPhoneNumber("+972559922718"), "972559922718");
assert.equal(normalizeWhatsAppPhoneNumber("972559922718"), "972559922718");
assert.equal(normalizeWhatsAppPhoneNumber("055 992 2718"), "972559922718");
assert.equal(normalizeWhatsAppPhoneNumber("055-992-2718"), "972559922718");
assert.equal(normalizeWhatsAppPhoneNumber("(055) 992-2718"), "972559922718");
assert.equal(normalizeWhatsAppPhoneNumber(""), "");
assert.equal(normalizeWhatsAppPhoneNumber("abc0559922718"), "");
assert.equal(normalizeWhatsAppPhoneNumber("+14155552671"), "14155552671");
assert.equal(normalizeWhatsAppPhoneNumber("https://wa.me/0559922718"), "");
assert.equal(normalizeWhatsAppPhoneNumber("javascript:alert(1)"), "");

console.log("phone-format-test: passed");
