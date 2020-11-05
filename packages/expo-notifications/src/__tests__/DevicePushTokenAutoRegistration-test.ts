import * as DevicePushTokenAutoRegistration from '../DevicePushTokenAutoRegistration.fx';
import generateRetries from '../utils/generateRetries';
import makeInterruptible from '../utils/makeInterruptible';

const VALID_REGISTRATION: DevicePushTokenAutoRegistration.Registration = {
  url: 'https://example.com/',
  body: {},
};

describe('initial persisted registration handling', () => {
  it(`doesn't fail if persisted value is empty`, () => {
    expect(async () => {
      // It looks like console.warn has to be mocked
      // in the same scope as the function call.
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      try {
        await DevicePushTokenAutoRegistration.__handlePersistedRegistrationInfoAsync(null);
        await DevicePushTokenAutoRegistration.__handlePersistedRegistrationInfoAsync(undefined);
        await DevicePushTokenAutoRegistration.__handlePersistedRegistrationInfoAsync(
          '{i-am-invalid-json'
        );
      } catch (e) {
        throw e;
      } finally {
        spy.mockRestore();
      }
    }).not.toThrow();
  });

  it(`doesn't try to update registration if no pending token is present`, async () => {
    const updatePushTokenAsyncSpy = jest
      .spyOn(require('../utils/updatePushTokenAsync'), 'updatePushTokenAsync')
      .mockImplementation();
    expect(async () => {
      await DevicePushTokenAutoRegistration.__handlePersistedRegistrationInfoAsync(
        JSON.stringify(VALID_REGISTRATION)
      );
    }).not.toThrow();
    expect(updatePushTokenAsyncSpy).not.toBeCalled();
    updatePushTokenAsyncSpy.mockRestore();
  });

  it(`does try to update registration if pending token is present`, async () => {
    const updatePushTokenAsyncSpy = jest
      .spyOn(require('../utils/updatePushTokenAsync'), 'updatePushTokenAsync')
      .mockImplementation();
    const mockPendingDevicePushToken = 'i-want-to-be-sent-to-server';
    expect(async () => {
      await DevicePushTokenAutoRegistration.__handlePersistedRegistrationInfoAsync(
        JSON.stringify({
          ...VALID_REGISTRATION,
          pendingDevicePushToken: mockPendingDevicePushToken,
        })
      );
    }).not.toThrow();
    expect(updatePushTokenAsyncSpy).toBeCalledWith(mockPendingDevicePushToken);
    updatePushTokenAsyncSpy.mockRestore();
  });
});

describe('setAutoServerRegistrationAsync', () => {
  it('ensures that the registration will be persisted even if other calls modifying storage are in progress', async () => {
    // Prepare spy that we will be able to check
    // for last call arguments.
    const setSpy = jest
      .spyOn(require('../ServerRegistrationModule').default, 'setLastRegistrationInfoAsync')
      .mockImplementation(async () => {});
    // An ever-repeating "nasty" meddler which, if aborting wouldn't
    // work properly, would overwrite `lastRegistrationInfo` *after*
    // `setAutoServerRegistrationAsync` sets it.
    const [startMeddler, , stopMeddler] = makeInterruptible(async function*() {
      const retriesIterator = generateRetries(
        async retry => {
          // Nasty call - erasing last registration information
          await require('../ServerRegistrationModule').default.setLastRegistrationInfoAsync(null);
          // Always repeat
          retry();
        },
        {
          // By not delaying any duration of time
          // we ensure we try to meddle as much as possible.
          initialDelay: 0,
        }
      );
      // Yield to makeInterruptible on every retry so it can interrupt.
      // This is how generateRetries is supposed to be used.
      let result = (yield retriesIterator.next()) as IteratorResult<void, void>;
      while (!result.done) {
        result = (yield retriesIterator.next()) as IteratorResult<void, void>;
      }
    });
    // Prepare `abortSpy` which we will be able to check for calls
    // and where we can mock implementation with our meddler stopper
    const abortSpy = jest
      .spyOn(require('../utils/updatePushTokenAsync'), 'abortUpdatingPushToken')
      .mockImplementation(stopMeddler);

    // Start test scenario
    startMeddler();
    await new Promise(resolve => setTimeout(resolve, 100));

    await DevicePushTokenAutoRegistration.setAutoServerRegistrationAsync(VALID_REGISTRATION);

    // Free the event loop so that if meddler would be able to run
    // it would run
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that last registration info has been set,
    // as per user's request.
    expect(setSpy).toHaveBeenLastCalledWith(JSON.stringify(VALID_REGISTRATION));

    setSpy.mockRestore();
    abortSpy.mockRestore();
  });
});

describe('removeAutoServerRegistrationAsync', () => {
  it('ensures that the registration will be erased even if other calls modifying storage are in progress', async () => {
    // Prepare spy that we will be able to check
    // for last call arguments.
    const setSpy = jest
      .spyOn(require('../ServerRegistrationModule').default, 'setLastRegistrationInfoAsync')
      .mockImplementation(async () => {});
    // An ever-repeating "nasty" meddler which, if aborting wouldn't
    // work properly, would overwrite `lastRegistrationInfo` *after*
    // `setAutoServerRegistrationAsync` sets it.
    const [startMeddler, , stopMeddler] = makeInterruptible(async function*() {
      const retriesIterator = generateRetries(
        async retry => {
          // Nasty call - erasing last registration information
          await require('../ServerRegistrationModule').default.setLastRegistrationInfoAsync('{}');
          // Always repeat
          retry();
        },
        {
          // By not delaying any duration of time
          // we ensure we try to meddle as much as possible.
          initialDelay: 0,
        }
      );
      // Yield to makeInterruptible on every retry so it can interrupt.
      // This is how generateRetries is supposed to be used.
      let result = (yield retriesIterator.next()) as IteratorResult<void, void>;
      while (!result.done) {
        result = (yield retriesIterator.next()) as IteratorResult<void, void>;
      }
    });
    // Prepare `abortSpy` which we will be able to check for calls
    // and where we can mock implementation with our meddler stopper
    const abortSpy = jest
      .spyOn(require('../utils/updatePushTokenAsync'), 'abortUpdatingPushToken')
      .mockImplementation(stopMeddler);

    // Start test scenario
    startMeddler();
    await new Promise(resolve => setTimeout(resolve, 100));

    await DevicePushTokenAutoRegistration.removeAutoServerRegistrationAsync();

    // Free the event loop so that if meddler would be able to run
    // it would run
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that last registration info has been cleared,
    // as per user's request.
    expect(setSpy).toHaveBeenLastCalledWith(null);

    setSpy.mockRestore();
    abortSpy.mockRestore();
  });
});
