/**
 * Encapsulates device server registration data
 */
export declare type Registration = {
    url: string;
    body: Record<string, any>;
};
/**
 * Sets the last registration information so that the device push token
 * gets pushed to the given registration endpoint
 * @param registration Registration endpoint to inform of new tokens
 */
export declare function setAutoServerRegistrationAsync(registration: Registration): Promise<void>;
/**
 * Removes last Expo server registration, future device push token
 * updates won't get sent there anymore.
 */
export declare function removeAutoServerRegistrationAsync(): Promise<void>;
