#!/usr/bin/env node
/**
 * update-stats-history.js
 *
 * Reads reports/manifest.json and maintains stats-history.json
 * with aggregated daily stats per platform and environment.
 *
 * Stats are preserved even after report pruning (10-day retention).
 * This script should run BEFORE pruning to capture data from reports
 * that are about to be deleted.
 *
 * Usage: node update-stats-history.js [reports-dir]
 * Default reports-dir: ./reports
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const REPORTS_DIR = process.argv[2] || path.join(SCRIPT_DIR, 'reports');
const MANIFEST_PATH = path.join(REPORTS_DIR, 'manifest.json');
const STATS_PATH = path.join(SCRIPT_DIR, 'stats-history.json');

/* ─── Platform detection from job name ─── */
function detectPlatform(job) {
  var j = (job || '').toLowerCase();
  if (j.includes('android')) return 'android';
  if (j.includes('ios')) return 'ios';
  if (j.includes('browser') || j.includes('desktop') || j.includes('responsive')) return 'browser';
  return 'other';
}

/* ─── Normalize environment ─── */
function normalizeEnv(env) {
  var e = (env || '').toLowerCase();
  if (e.includes('sandbox')) return 'sandbox';
  if (e.includes('staging')) return 'staging';
  if (e.includes('flux')) return 'flux';
  if (e.includes('local')) return 'local';
  return e || 'unknown';
}

/* ─── Extract date from timestamp "2026-02-18_143000" → "2026-02-18" ─── */
function extractDate(timestamp) {
  if (!timestamp) return null;
  var m = timestamp.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function main() {
  // Read manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('[stats] Manifest not found: ' + MANIFEST_PATH);
    process.exit(1);
  }

  var manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  console.log('[stats] Read ' + manifest.length + ' entries from manifest.json');

  // Read existing stats history
  var history = { lastUpdated: null, entries: [] };
  if (fs.existsSync(STATS_PATH)) {
    try {
      history = JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8'));
      console.log('[stats] Existing history: ' + history.entries.length + ' days');
    } catch (e) {
      console.warn('[stats] Could not parse existing stats-history.json, starting fresh');
      history = { lastUpdated: null, entries: [] };
    }
  }

  // Build map of existing entries by date
  var existingMap = {};
  history.entries.forEach(function (entry) {
    existingMap[entry.date] = entry;
  });

  // Aggregate manifest data by date
  var newDataByDate = {};

  manifest.forEach(function (report) {
    var date = extractDate(report.timestamp);
    if (!date) return;

    var platform = detectPlatform(report.job);
    var env = normalizeEnv(report.environment);
    var passed = parseInt(report.passed) || 0;
    var failed = parseInt(report.failed) || 0;

    if (!newDataByDate[date]) {
      newDataByDate[date] = {
        date: date,
        totals: { runs: 0, passed: 0, failed: 0 },
        platforms: {},
        environments: {}
      };
    }

    var day = newDataByDate[date];

    // Totals
    day.totals.runs++;
    day.totals.passed += passed;
    day.totals.failed += failed;

    // Platform
    if (!day.platforms[platform]) {
      day.platforms[platform] = { runs: 0, passed: 0, failed: 0 };
    }
    day.platforms[platform].runs++;
    day.platforms[platform].passed += passed;
    day.platforms[platform].failed += failed;

    // Environment
    if (!day.environments[env]) {
      day.environments[env] = { runs: 0, passed: 0, failed: 0 };
    }
    day.environments[env].runs++;
    day.environments[env].passed += passed;
    day.environments[env].failed += failed;
  });

  // Merge: new data overwrites existing entries for the same date
  // Old dates NOT in manifest are preserved (history beyond retention)
  Object.keys(newDataByDate).forEach(function (date) {
    existingMap[date] = newDataByDate[date];
  });

  // Sort entries by date ascending
  var mergedEntries = Object.keys(existingMap)
    .sort()
    .map(function (date) { return existingMap[date]; });

  // Write updated history
  var updatedHistory = {
    lastUpdated: new Date().toISOString(),
    entries: mergedEntries
  };

  fs.writeFileSync(STATS_PATH, JSON.stringify(updatedHistory, null, 2));
  console.log('[stats] Updated stats-history.json with ' + mergedEntries.length + ' days of history');

  // Print summary
  var newDates = Object.keys(newDataByDate).sort();
  if (newDates.length > 0) {
    console.log('[stats] Date range in manifest: ' + newDates[0] + ' → ' + newDates[newDates.length - 1]);
  }
  if (mergedEntries.length > 0) {
    console.log('[stats] Total history span: ' + mergedEntries[0].date + ' → ' + mergedEntries[mergedEntries.length - 1].date);
  }
}

main();
