import { DevicePushToken } from '../../Tokens.types';
import { abortUpdatingPushToken, updatePushTokenAsync } from '../updatePushTokenAsync';

const TOKEN: DevicePushToken = { type: 'ios', data: 'i-am-token' };

declare const global: any;
function mockServerRegistrationModule(
  getter: () => Promise<string | null | undefined> = async () => null,
  setter: () => Promise<void> = async () => {}
) {
  let getSpy;
  let setSpy;
  beforeAll(() => {
    getSpy = jest
      .spyOn(require('../../ServerRegistrationModule').default, 'getLastRegistrationInfoAsync')
      .mockImplementation(getter);
    setSpy = jest
      .spyOn(require('../../ServerRegistrationModule').default, 'setLastRegistrationInfoAsync')
      .mockImplementation(setter);
  });
  afterAll(() => {
    getSpy?.mockRestore();
    setSpy?.mockRestore();
  });
  return { getSpy, setSpy };
}

describe('given empty last registration info', () => {
  mockServerRegistrationModule();

  it(`doesn't throw`, () => {
    expect(async () => {
      await Promise.race([
        updatePushTokenAsync(TOKEN),
        new Promise((_, reject) => setTimeout(reject, 100)),
      ]);
    }).not.toThrow();
  });
});

describe('given invalid last registration info', () => {
  mockServerRegistrationModule(async () => '{i-am-invalid-json');

  it(`doesn't throw`, () => {
    expect(async () => {
      await Promise.race([
        updatePushTokenAsync(TOKEN),
        new Promise((_, reject) => setTimeout(reject, 100)),
      ]);
    }).not.toThrow();
  });
});

describe('given valid last registration info', () => {
  const mockUrl = 'https://example.com/';
  const mockBody = {
    customArgument: '@tester',
  };
  const setMock = jest.fn();
  mockServerRegistrationModule(
    async () =>
      JSON.stringify({
        url: mockUrl,
        body: mockBody,
      }),
    setMock
  );
  const successResponse = {
    status: 200,
    ok: true,
  } as Response;
  const failureResponse = {
    status: 500,
    ok: false,
    text: async () => 'Server error',
  } as Response;

  let originalFetch: typeof fetch | undefined;

  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('submits the request with custom body to proper URL', async () => {
    global.fetch.mockResolvedValue(successResponse);
    await updatePushTokenAsync(TOKEN);
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(global.fetch).toHaveBeenCalledWith(
      mockUrl,
      expect.objectContaining({
        body:
          '{"customArgument":"@tester","development":false,"deviceToken":"i-am-token","type":"apns"}',
      })
    );
  });

  it('ensures that if registration fails and is killed, the pending token is persisted for future resume', async () => {
    global.fetch.mockImplementation(async () => {
      abortUpdatingPushToken();
      return successResponse;
    });
    try {
      await updatePushTokenAsync(TOKEN);
    } catch (e) {}

    expect(JSON.parse(setMock.mock.calls[setMock.mock.calls.length - 1])).toEqual(
      expect.objectContaining({ pendingDevicePushToken: TOKEN })
    );
  });

  describe('when server responds with an ok status', () => {
    it('submits the request only once', async () => {
      global.fetch.mockResolvedValue(successResponse);
      await updatePushTokenAsync(TOKEN);
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('ensures that if registration succeeds, the pending token is cleared', async () => {
      global.fetch.mockResolvedValue(successResponse);
      try {
        await updatePushTokenAsync(TOKEN);
      } catch (e) {}

      expect(JSON.parse(setMock.mock.calls[setMock.mock.calls.length - 1])).toEqual(
        expect.objectContaining({ pendingDevicePushToken: null })
      );
    });
  });

  describe('when server responds with an error status', () => {
    it('retries until it succeeds', async () => {
      const spy = jest.spyOn(console, 'debug').mockImplementation();
      global.fetch
        .mockResolvedValueOnce(failureResponse)
        .mockResolvedValueOnce(failureResponse)
        .mockResolvedValueOnce(successResponse);
      await updatePushTokenAsync(TOKEN);
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(global.fetch).toHaveBeenCalledTimes(3);
      spy.mockRestore();
    });
  });

  describe('when fetch throws', () => {
    it('retries until it succeeds', async () => {
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      global.fetch.mockRejectedValueOnce(new TypeError()).mockResolvedValueOnce(successResponse);
      await updatePushTokenAsync(TOKEN);
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(global.fetch).toHaveBeenCalledTimes(2);
      warnSpy.mockRestore();
      debugSpy.mockRestore();
    });
  });
});

// it('sends a request to URL provided in the last registration info', async () => {
//   updatePushTokenAsync();
// });
