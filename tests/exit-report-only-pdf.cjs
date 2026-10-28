/** Use the existing sanitized owner-page fixture and check the report/PDF surface. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const fixture = fs.readFileSync(path.join(__dirname, 'warehouse-nav-stability.cjs'), 'utf8').split('const assert = require("assert/strict");')[0];
const checks = String.raw`
const assert = require('assert/strict');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
setTimeout(async () => {
  try {
    const w = dom.window;
    w.document.querySelector('#warehouseNavGroup [data-tab="reports"]').click();
    await pause(400);
    const reports = w.document.getElementById('reports');
    const visibleChildren = [...reports.children].filter(el => w.getComputedStyle(el).display !== 'none');
    assert.equal(visibleChildren.length, 1);
    assert(visibleChildren[0].classList.contains('gp-exit-report-sheet'));
    assert.equal(reports.querySelectorAll('details').length, 0);
    assert.equal(reports.querySelector('.gp-exit-report-sheet').querySelectorAll('input,select,.smart-list-tools').length, 0);
    assert.equal(reports.querySelector('.gp-exit-report-sheet h3').textContent, 'گزارش خروج');
    assert(w.document.getElementById('repBody').textContent.includes('FIXTURE-001'));
    assert.equal(w.getComputedStyle(w.document.getElementById('gpSearchFabRoot')).display, 'none');
    let printCount = 0, html = '';
    w.open = () => ({document:{write(text){html += text},close(){}},focus(){},print(){printCount++}});
    w.document.getElementById('exitReportPdf').click();
    assert.equal(printCount, 1, JSON.stringify({errors, onclick:w.document.getElementById('exitReportPdf').getAttribute('onclick'), html:html.slice(0,80)}));
    const pdf = new JSDOM(html).window.document;
    assert.equal(pdf.title, 'گزارش خروج');
    assert.equal(pdf.querySelector('table tbody').textContent, w.document.getElementById('repBody').textContent);
    assert.equal(pdf.querySelectorAll('button,input,select,summary').length, 0);
    assert(!pdf.body.textContent.includes('لیست مشتریان'));
    assert(!pdf.body.textContent.includes('انبارگردانی'));
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS: one report sheet, no customer-list accordion or extra controls, PDF contains displayed rows only');
  } catch (e) {console.error(e);process.exitCode=1} finally {dom.window.close()}
}, 5500);
`;
vm.runInNewContext(fixture + checks, {require, process, console, setTimeout, clearTimeout, Buffer, URL}, {filename: __filename});
