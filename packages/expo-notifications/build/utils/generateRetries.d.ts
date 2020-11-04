export default function generateRetries(func: (retry: () => void) => Promise<void>, options?: {
    initialDelay?: number;
    maximumDelay?: number;
}): AsyncGenerator<void, any, unknown>;
