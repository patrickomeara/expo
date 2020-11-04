const INITIAL_DELAY = 500; // 500 ms
const MAXIMUM_DELAY = 2 * 60 * 1000; // 2 minutes
const EXPONENTIAL_FACTOR = 2;
export default async function* generateRetries(func, options) {
    const initialDelay = options?.initialDelay ?? INITIAL_DELAY;
    const maximumDelay = options?.maximumDelay ?? MAXIMUM_DELAY;
    let delay = initialDelay;
    let shouldTry = true;
    while (shouldTry) {
        shouldTry = false;
        const result = yield await func(() => {
            shouldTry = true;
        });
        if (!shouldTry) {
            return result;
        }
        else {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(maximumDelay, delay * EXPONENTIAL_FACTOR);
        }
    }
}
//# sourceMappingURL=generateRetries.js.map