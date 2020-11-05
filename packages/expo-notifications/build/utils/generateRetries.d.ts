export default function generateRetries<T>(func: (retry: () => void) => Promise<T>, options?: {
    initialDelay?: number;
    maximumDelay?: number;
    exponentialFactor?: number;
}): AsyncGenerator<T | undefined, T | undefined, T | undefined>;
