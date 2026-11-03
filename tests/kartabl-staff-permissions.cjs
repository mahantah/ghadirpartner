'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'kartabl-sync-v1.js'), 'utf8');
const heading = { textContent: '' };
const usersSection = { querySelector: (selector) => selector === 'h3' ? heading : null };
const userTable = { innerHTML: '' };
const styles = [];
const selectedEditRoles = [
  { value: 'sales', checked: false, style: {} },
  { value: 'finance', checked: true, style: {} },
];
const selectedNewRoles = [
  { value: 'sales', checked: false },
  { value: 'prep', checked: true },
];
const users = [
  { id: 1, username: 'employee', mobile: '09120000000', roles: ['finance'], active: true },
  { id: 2, username: 'customer', roles: ['customer'], active: true },
];
const actions = { opened: [], edits: [], created: [] };
const window = {
  loadUsers: async () => {},
  openUserEdit: (id) => actions.opened.push(id),
  saveUser: async (id) => actions.edits.push({ id, selected: selectedEditRoles.filter((role) => role.checked).map((role) => role.value) }),
  addUser: async () => actions.created.push(selectedNewRoles.filter((role) => role.checked).map((role) => role.value)),
};
const document = {
  readyState: 'complete',
  head: { appendChild: (style) => styles.push(style) },
  createElement: () => ({ id: '', textContent: '' }),
  getElementById: (id) => ({ users: usersSection, utbody: userTable }[id] || null),
  querySelectorAll: (selector) => {
    if (selector === '.editrole') return selectedEditRoles;
    if (selector === '.newrole') return selectedNewRoles;
    return [];
  },
};
const sandbox = {
  window,
  document,
  USERS: users,
  roleNames: { sales: 'فروش', finance: 'نحوه تسویه', prep: 'انبار' },
  setTimeout: () => 0,
};

async function main() {
  vm.runInNewContext(source, sandbox, { filename: 'kartabl-sync-v1.js' });
  assert.equal(heading.textContent, 'کاربران اتوماسیون');
  assert.equal(styles.length, 1);
  assert.doesNotMatch(styles[0].textContent, /#users\s+\.checks/);
  assert.doesNotMatch(styles[0].textContent, /#users\s+table\s+th:nth-child/);

  await window.loadUsers();
  assert.match(userTable.innerHTML, /employee/);
  assert.match(userTable.innerHTML, /نحوه تسویه/);
  assert.doesNotMatch(userTable.innerHTML, /<td[^>]*><\/td>/);
  assert.doesNotMatch(userTable.innerHTML, />customer</);
  assert.equal((userTable.innerHTML.match(/<td/g) || []).length, 4);

  window.openUserEdit(1);
  assert.deepEqual(actions.opened, [1]);
  assert.equal(selectedEditRoles[0].style.display, undefined);

  selectedEditRoles[0].checked = true;
  selectedEditRoles[1].checked = false;
  await window.saveUser(1);
  assert.deepEqual(actions.edits, [{ id: 1, selected: ['sales'] }]);

  await window.addUser();
  assert.deepEqual(actions.created, [['prep']]);
  console.log('Staff role display and edit controls preserved.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
