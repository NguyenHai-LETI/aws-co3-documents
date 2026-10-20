// [v5] π Per-device LAN tokens (server/lib/lan-devices.ts) with a fake clock in a temp folder: tokens verify by hash,
// expiry and revocation, the legacy entry is a permanent tombstone (R3), pre-v5 cookies are upgraded a bounded number of
// times, and pairing never evicts an active device. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DeviceLimitError, DeviceStore, LEGACY_UPGRADES, MAX_DEVICES, deviceName } from '../server/lib/lan-devices.ts';

const DAY = 86_400_000;
function fresh() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-dev-'));
  const clock = { now: Date.parse('2026-10-20T00:00:00Z') };
  return { dir, clock, store: new DeviceStore(path.join(dir, 'lan-devices.json'), () => clock.now), done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('pairing: <id>.<secret> verifies by hash only, 30-day expiry, revoke, rename', () => {
  const { store, clock, dir, done } = fresh();
  try {
    const { device, token } = store.pair({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Mobile Safari/604.1', ip: '10.0.0.5' });
    assert.match(token, /^[0-9a-z]{8}\.[A-Za-z0-9_-]{22}$/);
    assert.equal(device.name, 'iPhone · Safari');
    assert.ok(!fs.readFileSync(path.join(dir, 'lan-devices.json'), 'utf8').includes(token.split('.')[1]), 'the secret is not stored');
    assert.equal(store.verify(token).reason, undefined);
    assert.equal(store.verify(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')).reason, 'unknown');
    assert.equal(store.verify('nodot').reason, 'unknown');
    assert.ok(store.rename(device.id, '  Điện thoại\n của tôi '));
    assert.equal(store.list()[0].name, 'Điện thoại của tôi');
    clock.now += 31 * DAY;
    assert.equal(store.verify(token).reason, 'expired');
    const b = store.pair({});
    assert.ok(store.revoke(b.device.id));
    assert.equal(store.verify(b.token).reason, 'revoked');
    assert.equal(store.revoke(b.device.id), false, 'already revoked');
    assert.equal(deviceName(undefined), 'Thiết bị');
  } finally {
    done();
  }
});

test('[R3] a revoked or expired legacy entry stays refused — never purged and re-created with 30 fresh days', () => {
  const { store, clock, done } = fresh();
  try {
    assert.equal(store.state(store.legacy(true)!).reason, undefined, 'first pre-v5 visit accepted');
    store.revoke('legacy');
    clock.now += 8 * DAY;
    store.pair({}); // any write purges entries gone for a week …
    assert.equal(store.state(store.legacy(true)!).reason, 'revoked', '… but not the legacy tombstone');
    const other = fresh();
    try {
      other.store.legacy(true);
      other.clock.now += 48 * DAY;
      other.store.pair({});
      assert.equal(other.store.state(other.store.legacy(true)!).reason, 'expired', 'the 30-day cap holds after the purge window');
    } finally {
      other.done();
    }
    // rotation (revokeAll) leaves the tombstone revoked too
    clock.now += 100 * DAY;
    store.revokeAll();
    assert.equal(store.state(store.legacy(true)!).reason, 'revoked');
  } finally {
    done();
  }
});

test('[R3] legacy upgrades are bounded; pairing refuses at the cap instead of evicting active devices', () => {
  const { store, done } = fresh();
  try {
    store.legacy(true);
    const upgraded = Array.from({ length: LEGACY_UPGRADES + 5 }, () => store.upgradeLegacy({ ua: 'flood' }));
    assert.equal(upgraded.filter(Boolean).length, LEGACY_UPGRADES, 'a client ignoring Set-Cookie cannot flood the list');
    const first = upgraded[0]!;
    for (let i = store.list().filter((d) => !d.legacy).length; i < MAX_DEVICES; i++) store.pair({});
    assert.throws(() => store.pair({}), DeviceLimitError);
    assert.equal(store.verify(first.token).reason, undefined, 'the oldest active device was not evicted');
    assert.equal(store.upgradeLegacy({}), undefined, 'no upgrade at the cap either (the legacy entry keeps working)');
    store.revoke(first.device.id);
    assert.doesNotThrow(() => store.pair({}), 'room again after a revoke');
  } finally {
    done();
  }
});
