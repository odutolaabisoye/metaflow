/**
 * MetaFlow Crypto Utility Unit Tests
 *
 * Tests the AES-256-GCM encrypt/decrypt round-trip and edge cases.
 * Uses Node.js built-in test runner.
 * Run with: npx tsx --test src/__tests__/crypto.test.ts
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

// Set a valid 64-char hex key before importing the module
const TEST_KEY = "a".repeat(64); // 32 bytes of 0xAA in hex
process.env.ENCRYPTION_KEY = TEST_KEY;

// Import AFTER setting the env var
import { encryptToken, decryptToken } from "../utils/crypto.js";

// ─────────────────────────────────────────────────────────────────────────────
// encryptToken
// ─────────────────────────────────────────────────────────────────────────────
describe("encryptToken", () => {
  test("Returns a string starting with enc:v1:", () => {
    const encrypted = encryptToken("my-secret-token");
    assert.ok(encrypted.startsWith("enc:v1:"), `Expected enc:v1: prefix, got: ${encrypted}`);
  });

  test("Output is different from input", () => {
    const plaintext = "shopify-access-token-abc123";
    const encrypted = encryptToken(plaintext);
    assert.notEqual(encrypted, plaintext);
  });

  test("Two encryptions of the same value produce different ciphertext (random IV)", () => {
    const plaintext = "same-token";
    const enc1 = encryptToken(plaintext);
    const enc2 = encryptToken(plaintext);
    assert.notEqual(enc1, enc2, "Each encryption should use a fresh IV");
  });

  test("Idempotent — already-encrypted value is returned unchanged", () => {
    const once  = encryptToken("my-token");
    const twice = encryptToken(once);
    assert.equal(twice, once, "Double-encrypting should be a no-op");
  });

  test("Empty string — returned unchanged (guard clause)", () => {
    assert.equal(encryptToken(""), "");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// decryptToken
// ─────────────────────────────────────────────────────────────────────────────
describe("decryptToken", () => {
  test("Round-trips plaintext correctly", () => {
    const plaintext = "meta-access-token-xyz-987";
    const encrypted = encryptToken(plaintext);
    const decrypted = decryptToken(encrypted);
    assert.equal(decrypted, plaintext);
  });

  test("Unicode / special characters round-trip", () => {
    const value = "token-with-unicode-🔑-ñ-€";
    assert.equal(decryptToken(encryptToken(value)), value);
  });

  test("Passthrough for legacy plaintext tokens (no enc:v1: prefix)", () => {
    // Existing tokens in DB that were stored before encryption was introduced
    const legacy = "old-unencrypted-token";
    assert.equal(decryptToken(legacy), legacy);
  });

  test("Empty string — returned unchanged", () => {
    assert.equal(decryptToken(""), "");
  });

  test("Long token (e.g. a full Shopify access token) round-trips", () => {
    const longToken = "shpat_" + "x".repeat(128);
    assert.equal(decryptToken(encryptToken(longToken)), longToken);
  });

  test("Tampered ciphertext throws or returns garbage — not the original plaintext", () => {
    const encrypted = encryptToken("sensitive-data");
    // Flip one base64 character to tamper with the ciphertext
    const tampered = encrypted.slice(0, -4) + "XXXX";
    assert.throws(
      () => decryptToken(tampered),
      /Decryption failed|unsupported state|bad decrypt|wrong final block length|authentication|Unsupported/i
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Combined round-trip stress
// ─────────────────────────────────────────────────────────────────────────────
describe("encrypt/decrypt stress", () => {
  const samples = [
    "short",
    "a".repeat(256),
    "token-with-dashes-and-underscores_123",
    "EAABsbCS1iHgBO" + "x".repeat(180), // typical Meta access token shape
    "shpat_" + "0123456789abcdef".repeat(8), // Shopify token shape
    "ck_live_" + "a".repeat(40) + ":" + "cs_live_" + "b".repeat(40) // WooCommerce key:secret
  ];

  for (const sample of samples) {
    test(`Round-trip: ${sample.slice(0, 30)}...`, () => {
      assert.equal(decryptToken(encryptToken(sample)), sample);
    });
  }
});
