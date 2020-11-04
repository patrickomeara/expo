// Create an interruptable function out of provided async function generator.
// It awaits on the generator and on the yielded values.
// See: https://dev.to/chromiumdev/cancellable-async-functions-in-javascript-5gp7
export default function makeInterruptible<Arguments extends any[] = any[], Result = void>(
  func: (...args: Arguments) => AsyncGenerator<unknown, Result, unknown>
): [(...args: Arguments) => Promise<Result | undefined>, () => boolean, () => void] {
  // eslint-disable-next-line @typescript-eslint/ban-types
  let globalNonce: null | Object = null;
  async function callFunc(...args: Arguments) {
    // eslint-disable-next-line no-new-object
    globalNonce = new Object();
    const localNonce = globalNonce;

    const iter = func(...args);
    let resumeValue: any;
    for (;;) {
      // Guard before await
      if (localNonce !== globalNonce) {
        return; // a new call was made
      }
      // We can use a mix of function generator and asynchronous function
      // as per https://www.pluralsight.com/guides/using-asyncawait-with-generator-functions
      const n = await iter.next(resumeValue);
      if (n.done) {
        return n.value; // final return value of passed generator
      }

      // Guard before await
      if (localNonce !== globalNonce) {
        return; // a new call was made
      }
      // whatever the generator yielded, _now_ run await on it
      resumeValue = await n.value;
      // next loop, we give resumeValue back to the generator
    }
  }
  function hasBeenCalledAtLeastOnce() {
    // `globalNonce` starts as `null`,
    // if it's not, it must have been
    // modified by `callFunc`.
    return globalNonce != null;
  }
  function interrupt() {
    // By changing `globalNonce` we forbid
    // progress for any existing `callFunc` calls.
    // eslint-disable-next-line no-new-object
    globalNonce = new Object();
  }
  return [callFunc, hasBeenCalledAtLeastOnce, interrupt];
}
