const INITIAL_DELAY = 500; // 500 ms
const MAXIMUM_DELAY = 2 * 60 * 1000; // 2 minutes
const EXPONENTIAL_FACTOR = 2;

export default async function* generateRetries<T>(
  func: (retry: () => void) => Promise<T>,
  options?: {
    initialDelay?: number;
    maximumDelay?: number;
    exponentialFactor?: number;
  }
  // @ts-ignore: TS thinks it's possible we may return undefined
  // by not entering the while. The function logic prevents it.
): AsyncGenerator<T, T, T> {
  const initialDelay = options?.initialDelay ?? INITIAL_DELAY;
  const maximumDelay = options?.maximumDelay ?? MAXIMUM_DELAY;
  const exponentialFactor = options?.exponentialFactor ?? EXPONENTIAL_FACTOR;

  let delay = initialDelay;
  let shouldTry = true;
  function retry() {
    shouldTry = true;
  }
  while (shouldTry) {
    // If func doesn't call retry we won't retry.
    shouldTry = false;
    const result = yield await func(retry);
    if (shouldTry) {
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(maximumDelay, delay * exponentialFactor);
    } else {
      return result;
    }
  }
}
