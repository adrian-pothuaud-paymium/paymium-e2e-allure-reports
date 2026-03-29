#!/usr/bin/env node
/**
 * fix-stats-from-allure-data.js
 *
 * One-shot fix: recomputes PASSED/FAILED/TOTAL for every report
 * by reading data/test-cases/*.json (the Allure report's own data)
 * instead of trusting the old JUnit-derived numbers.
 *
 * For each report folder it:
 *   1. Reads all data/test-cases/*.json and counts by status
 *   2. Updates .metadata (PASSED, FAILED, TOTAL)
 *   3. Renames the folder if the status tag in the name changed
 *
 * After processing all reports it:
 *   4. Regenerates manifest.json
 *   5. Regenerates stats-history.json
 *
 * Usage: node fix-stats-from-allure-data.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const SCRIPT_DIR = __dirname;
const REPORTS_DIR = path.join(SCRIPT_DIR, 'reports');

if (DRY_RUN) console.log('[fix] *** DRY RUN — no changes will be written ***\n');

/* ─── Read official counts from Allure's widgets/summary.json ─── */
function countFromSummary(reportDir) {
    const summaryPath = path.join(reportDir, 'widgets', 'summary.json');
    if (!fs.existsSync(summaryPath)) return null;

    try {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
        const stat = summary.statistic;
        if (!stat) return null;

        const passed = stat.passed || 0;
        const failed = stat.failed || 0;
        const broken = stat.broken || 0;
        const skipped = stat.skipped || 0;
        const unknown = stat.unknown || 0;

        // "broken" counts as failed for our dashboard reporting
        return {
            passed,
            failed: failed + broken,
            total: passed + failed + broken,
            detail: { passed, failed, broken, skipped, unknown }
        };
    } catch (e) {
        return null;
    }
}

/* ─── Build expected status tag ─── */
function statusTag(passed, failed) {
    return failed > 0 ? `${passed}passed_${failed}failed` : `${passed}passed`;
}

/* ─── Parse and update .metadata ─── */
function updateMetadata(metaPath, passed, failed, total) {
    let content = fs.readFileSync(metaPath, 'utf-8');
    content = content.replace(/^TOTAL=.*$/m, `TOTAL=${total}`);
    content = content.replace(/^PASSED=.*$/m, `PASSED=${passed}`);
    content = content.replace(/^FAILED=.*$/m, `FAILED=${failed}`);
    return content;
}

/* ─── Main ─── */
function main() {
    if (!fs.existsSync(REPORTS_DIR)) {
        console.error('[fix] Reports dir not found:', REPORTS_DIR);
        process.exit(1);
    }

    const folders = fs.readdirSync(REPORTS_DIR)
        .filter(f => fs.statSync(path.join(REPORTS_DIR, f)).isDirectory())
        .sort();

    console.log(`[fix] Found ${folders.length} report folders\n`);

    let fixedCount = 0;
    let skippedCount = 0;
    let unchangedCount = 0;
    const renames = []; // defer renames to avoid iterator issues

    for (const folder of folders) {
        const reportDir = path.join(REPORTS_DIR, folder);
        const metaPath = path.join(reportDir, '.metadata');

        // Count from allure widgets/summary.json
        const counts = countFromSummary(reportDir);
        if (!counts) {
            console.log(`  SKIP  ${folder}  (no widgets/summary.json)`);
            skippedCount++;
            continue;
        }

        // Read current metadata values
        let oldPassed = '?', oldFailed = '?', oldTotal = '?';
        if (fs.existsSync(metaPath)) {
            const meta = fs.readFileSync(metaPath, 'utf-8');
            oldPassed = (meta.match(/^PASSED=(.*)$/m) || [])[1] || '?';
            oldFailed = (meta.match(/^FAILED=(.*)$/m) || [])[1] || '?';
            oldTotal = (meta.match(/^TOTAL=(.*)$/m) || [])[1] || '?';
        }

        const newPassed = counts.passed;
        const newFailed = counts.failed;
        const newTotal = counts.total;

        // Check if anything changed
        if (String(oldPassed) === String(newPassed) &&
            String(oldFailed) === String(newFailed) &&
            String(oldTotal) === String(newTotal)) {
            unchangedCount++;
            continue;
        }

        const d = counts.detail;
        console.log(`  FIX   ${folder}`);
        console.log(`        old: ${oldPassed}p / ${oldFailed}f / ${oldTotal}t`);
        console.log(`        new: ${newPassed}p / ${newFailed}f / ${newTotal}t  (allure: ${d.passed} passed, ${d.failed} failed, ${d.broken} broken, ${d.skipped} skipped)`);

        if (!DRY_RUN) {
            // Update .metadata
            if (fs.existsSync(metaPath)) {
                const updatedMeta = updateMetadata(metaPath, newPassed, newFailed, newTotal);
                fs.writeFileSync(metaPath, updatedMeta);
            }

            // Compute new folder name if status tag changed
            const oldTag = statusTag(parseInt(oldPassed) || 0, parseInt(oldFailed) || 0);
            const newTag = statusTag(newPassed, newFailed);
            if (oldTag !== newTag) {
                // Replace the status tag at the end of the folder name
                // Folder pattern: {timestamp}__{job}__{env}__{branch}__{statusTag}
                const parts = folder.split('__');
                // The status tag is always the last part
                const lastPart = parts[parts.length - 1];
                // Verify it looks like a status tag (contains "passed")
                if (lastPart.includes('passed')) {
                    parts[parts.length - 1] = newTag;
                    const newFolder = parts.join('__');
                    renames.push({ oldPath: reportDir, newPath: path.join(REPORTS_DIR, newFolder), oldName: folder, newName: newFolder });
                    console.log(`        rename → ${newFolder}`);
                }
            }
        }

        fixedCount++;
    }

    // Apply renames
    if (!DRY_RUN) {
        for (const r of renames) {
            if (fs.existsSync(r.newPath)) {
                console.log(`\n  WARN  Cannot rename ${r.oldName} → target already exists, skipping rename`);
                continue;
            }
            fs.renameSync(r.oldPath, r.newPath);
        }
    }

    console.log(`\n[fix] Summary: ${fixedCount} fixed, ${unchangedCount} unchanged, ${skippedCount} skipped`);
    if (renames.length > 0) console.log(`[fix] ${renames.length} folder(s) renamed`);

    // Regenerate manifest and stats
    if (!DRY_RUN && fixedCount > 0) {
        console.log('\n[fix] Regenerating manifest.json...');
        try {
            require('child_process').execSync(
                `sh "${path.join(SCRIPT_DIR, 'generate-manifest.sh')}" "${REPORTS_DIR}"`,
                { stdio: 'inherit', cwd: SCRIPT_DIR }
            );
            console.log('[fix] Done — manifest.json and stats-history.json updated.');
        } catch (e) {
            console.error('[fix] Warning: manifest regeneration failed:', e.message);
            console.error('[fix] Run manually: sh generate-manifest.sh');
        }
    }
}

main();
