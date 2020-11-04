import { CodedError, Platform } from '@unimodules/core';
import * as Application from 'expo-application';

import ServerRegistrationModule from './ServerRegistrationModule';
import { addPushTokenListener } from './TokenEmitter';
import { DevicePushToken } from './Tokens.types';
import generateRetries from './utils/generateRetries';

/**
 * Encapsulates device server registration data
 */
export type Registration = {
  url: string;
  body: Record<string, any>;
  pendingDevicePushToken?: DevicePushToken | null;
};

/**
 * Sets the last registration information so that the device push token
 * gets pushed to the given registration endpoint
 * @param registration Registration endpoint to inform of new tokens
 */
export async function setAutoServerRegistrationAsync(
  registration: Omit<Registration, 'pendingDevicePushToken'>
) {
  await ServerRegistrationModule.setLastRegistrationInfoAsync?.(JSON.stringify(registration));
}

/**
 * Removes last Expo server registration, future device push token
 * updates won't get sent there anymore.
 */
export async function removeAutoServerRegistrationAsync() {
  await ServerRegistrationModule.setLastRegistrationInfoAsync?.(null);
}

// Verify if last persisted registration
// has successfully uploaded last known
// device push token. If not, retry.
ServerRegistrationModule.getLastRegistrationInfoAsync?.().then(lastRegistrationInfo => {
  if (!lastRegistrationInfo) {
    // No last registration info, nothing to do
    return;
  }
  try {
    const lastRegistration: Registration = JSON.parse(lastRegistrationInfo);
    if (lastRegistration?.pendingDevicePushToken) {
      updatePushTokenAsync(lastRegistration.pendingDevicePushToken);
    }
  } catch (e) {
    console.warn(
      '[expo-notifications] Error encountered while fetching last registration information for auto token updates.',
      e
    );
  }
});

// A global scope (to get all the updates) device push token
// subscription, never cleared.
addPushTokenListener(token => {
  // Dispatch an abortable task to update
  // last registration with new token.
  updatePushTokenAsync(token);
});

async function updatePushTokenAsync(token: DevicePushToken) {
  // Fetch the latest registration info from the persisted storage
  const lastRegistrationInfo = await ServerRegistrationModule.getLastRegistrationInfoAsync?.();
  // If there is none, do not do anything.
  if (!lastRegistrationInfo) {
    return;
  }

  // Prepare request body
  const lastRegistration: Registration = JSON.parse(lastRegistrationInfo);
  // Persist `pendingDevicePushToken` in case the app gets killed
  // before we finish registering to server.
  await ServerRegistrationModule.setLastRegistrationInfoAsync?.(
    JSON.stringify({
      ...lastRegistration,
      pendingDevicePushToken: token,
    })
  );

  const body = {
    ...lastRegistration.body,
    // Information whether a token is applicable
    // to development or production notification service
    // should never be persisted as it can change between
    // Xcode development and TestFlight/AppStore without
    // backing store being resetted (development registration
    // remains in production environment).
    development: await shouldUseDevelopmentNotificationService(),
    deviceToken: token.data,
    type: getTypeOfToken(token),
  };

  const retriesIterator = generateRetries(async retry => {
    try {
      await fetch(lastRegistration.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      }).catch(error => {
        throw new CodedError(
          'ERR_NOTIFICATIONS_NETWORK_ERROR',
          `Error encountered while updating device push token in server: ${error}.`
        );
      });
    } catch (e) {
      console.warn(
        '[expo-notifications] Error thrown while updating device push token in server:',
        e
      );

      // We only want to retry if it was a network error.
      // Other error may be JSON.parse error which we can do nothing about.
      if (e instanceof CodedError && (e as CodedError).code === 'ERR_NOTIFICATIONS_NETWORK_ERROR') {
        retry();
      } else {
        // If we aren't going to try again, throw the error
        throw e;
      }
    }
  });

  let result = await retriesIterator.next();
  while (!result.done) {
    result = await retriesIterator.next(result);
  }

  // We uploaded the token successfully, let's clear the `lastPushedToken`
  // from the registration so that we don't try to upload the same token
  // again.
  await ServerRegistrationModule.setLastRegistrationInfoAsync?.(
    JSON.stringify({
      ...lastRegistration,
      lastPushedToken: null,
    })
  );
}

// Same as in getExpoPushTokenAsync
function getTypeOfToken(devicePushToken: DevicePushToken) {
  switch (devicePushToken.type) {
    case 'ios':
      return 'apns';
    case 'android':
      return 'fcm';
    // This probably will error on server, but let's make this function future-safe.
    default:
      return devicePushToken.type;
  }
}

// Same as in getExpoPushTokenAsync
async function shouldUseDevelopmentNotificationService() {
  if (Platform.OS === 'ios') {
    try {
      const notificationServiceEnvironment = await Application.getIosPushNotificationServiceEnvironmentAsync();
      if (notificationServiceEnvironment === 'development') {
        return true;
      }
    } catch (e) {
      // We can't do anything here, we'll fallback to false then.
    }
  }

  return false;
}
