// Formatting helpers (sample code for CodeSentinel demos).
"use strict";

function money(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function pad(value, width, ch = " ") {
  return String(value).padStart(width, ch);
}

function truncate(text, max) {
  return text.length <= max ? text : text.slice(0, max - 1) + "\u2026";
}

function titleCase(text) {
  return text.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function sum(values) {
  return values.reduce((a, b) => a + b, 0);
}

function groupBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    (out[key] = out[key] || []).push(item);
  }
  return out;
}

module.exports = { money, pad, truncate, titleCase, sum, groupBy };
