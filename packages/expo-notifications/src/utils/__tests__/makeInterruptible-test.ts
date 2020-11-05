import generateRetries from '../generateRetries';
import makeInterruptible from '../makeInterruptible';

it(`caller calls the generator function`, async () => {
  let hasBeenCalled = false;
  const [caller] = makeInterruptible(async function*() {
    hasBeenCalled = true;
  });
  await caller();
  expect(hasBeenCalled).toBe(true);
});

it(`hasBeenCalled returns true if caller has been called`, async () => {
  const [caller, hasBeenCalled] = makeInterruptible(async function*() {});
  caller();
  expect(hasBeenCalled()).toBe(true);
});

it(`hasBeenCalled returns false if caller has not been called`, async () => {
  const [, hasBeenCalled] = makeInterruptible(async function*() {});
  expect(hasBeenCalled()).toBe(false);
});

it(`awaits the result of the generator func`, async () => {
  let hasFinished = false;
  const [caller] = makeInterruptible(async function*() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    hasFinished = true;
  });
  await caller();
  expect(hasFinished).toBe(true);
});

it(`returns the result of the generator func`, async () => {
  const expectedResultValue = 42;
  const [caller] = makeInterruptible(async function*() {
    return expectedResultValue;
  });
  expect(await caller()).toBe(expectedResultValue);
});

it(`aborts the call if abort is called`, async () => {
  let hasStarted = false;
  let hasFinished = false;
  const [caller, , abort] = makeInterruptible(async function*() {
    hasStarted = true;
    yield new Promise(resolve => setTimeout(resolve, 200));
    hasFinished = true;
  });
  // We start the call
  caller();
  // and abort
  abort();
  // Wait for caller call to finish (it won't, but without
  // this delay the test wouldn't make sense)
  await new Promise(resolve => setTimeout(resolve, 500));
  expect(hasStarted).toBe(true);
  expect(hasFinished).toBe(false);
});

it(`aborts the call if another call occurs`, async () => {
  const startTimes: Date[] = [];
  const finishTimes: Date[] = [];
  const [caller] = makeInterruptible(async function*() {
    startTimes.push(new Date());
    yield new Promise(resolve => setTimeout(resolve, 200));
    finishTimes.push(new Date());
  });
  // We start the call
  caller();
  await new Promise(resolve => setTimeout(resolve, 50));
  // and another one
  caller();
  // Wait for calls to finish
  await new Promise(resolve => setTimeout(resolve, 500));
  expect(startTimes.length).toBe(2); // Two callers start
  expect(finishTimes.length).toBe(1); // but only one finishes
});

it(`aborts the call only on yields`, async () => {
  const startTimes: Date[] = [];
  const middleTimes: Date[] = [];
  const finishTimes: Date[] = [];
  const [caller] = makeInterruptible(async function*() {
    startTimes.push(new Date());
    await new Promise(resolve => setTimeout(resolve, 100));
    middleTimes.push(new Date());
    yield new Promise(resolve => setTimeout(resolve, 100));
    finishTimes.push(new Date());
  });
  // We start the call
  caller();
  // and another one
  caller();
  // Wait for calls to finish naturally
  await new Promise(resolve => setTimeout(resolve, 400));
  expect(startTimes.length).toBe(2); // Two callers start
  expect(middleTimes.length).toBe(2); // we can't abort without a yield
  expect(finishTimes.length).toBe(1); // only one finishes
});

it(`allows us to abort retrying function`, async () => {
  const retryingFunctionCallTimes: Date[] = [];
  const [caller, , abort] = makeInterruptible(async function*() {
    const retryingIterator = generateRetries(
      async retry => {
        retryingFunctionCallTimes.push(new Date());
        retry();
      },
      {
        initialDelay: 50,
        exponentialFactor: 1,
      }
    );
    let result = (yield retryingIterator.next()) as IteratorResult<void, void>;
    while (!result.done) {
      // We specifically want to yield the result here
      // to the calling function so that call to this generator
      // may be interrupted between retries.
      result = (yield retryingIterator.next()) as IteratorResult<void, void>;
    }
  });
  caller();
  await new Promise(resolve => setTimeout(resolve, 500));
  abort();
  await new Promise(resolve => setTimeout(resolve, 500));
  expect(retryingFunctionCallTimes.length).toBe(10);
});
