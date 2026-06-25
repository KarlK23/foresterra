const test = require("node:test");
const assert = require("node:assert/strict");
const { acquireWriteLock } = require("../db");

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

test("acquireWriteLock serialise les acquisitions concurrentes (FIFO)", async function () {
  const order = [];

  async function task(label, delayMs) {
    const release = await acquireWriteLock();
    order.push("start:" + label);
    await wait(delayMs);
    order.push("end:" + label);
    release();
  }

  // Lancees "en concurrence" - sans verrou, elles s'entrelaceraient
  // (ex: start:A, start:B, start:C, end:C, end:B, end:A).
  const p1 = task("A", 30);
  const p2 = task("B", 10);
  const p3 = task("C", 5);

  await Promise.all([p1, p2, p3]);

  assert.deepEqual(order, [
    "start:A", "end:A",
    "start:B", "end:B",
    "start:C", "end:C"
  ]);
});

test("une tache qui n'a pas encore libere le verrou bloque la suivante", async function () {
  let secondAcquired = false;

  const release1 = await acquireWriteLock();
  acquireWriteLock().then(function () { secondAcquired = true; });

  await wait(20);
  assert.equal(secondAcquired, false);

  release1();
  await wait(20);
  assert.equal(secondAcquired, true);
});
