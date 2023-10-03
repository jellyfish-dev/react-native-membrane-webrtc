import { renderHook, act } from '@testing-library/react-hooks';

import {
  VideoroomContextProvider,
  useVideoroomState,
} from '../src/model/VideoroomContext';

const NOOP = () => {};
const voidPromise = (callback) => async (): Promise<void> => {
  return new Promise<void>((resolve) => {
    callback();
    resolve();
  });
};

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('@sentry/react-native');
jest.mock('../src/model/NotificationsContext', () => {
  return {
    useNotifications: () => {
      return { showNotification: NOOP };
    },
  };
});
jest.mock('../../src/index');

const setExtra = jest.fn(NOOP);

const sentry = require('@sentry/react-native');
sentry.setExtra = setExtra;

const useCameraMock = jest.fn(NOOP);
const startCameraMock = jest.fn(NOOP);
const useMicrophoneMock = jest.fn(NOOP);
const startSoundDetectionMock = jest.fn(NOOP);
const stopSoundDetectionMock = jest.fn(NOOP);
const startMicrophoneMock = jest.fn(NOOP);
const updateVideoTrackMetadataMock = jest.fn(NOOP);
const updateAudioTrackMetadataMock = jest.fn(NOOP);
const connectCallback = jest.fn(NOOP);
const disconnectCallback = jest.fn(NOOP);

const membraneWebRTC = require('../../src/index');
membraneWebRTC.useWebRTC = () => {
  return {
    connect: voidPromise(connectCallback),
    disconnect: voidPromise(disconnectCallback),
    error: null,
  };
};
membraneWebRTC.useCamera = () => {
  return { toggleCamera: useCameraMock, startCamera: startCameraMock };
};
membraneWebRTC.useMicrophone = () => {
  return {
    toggleMicrophone: useMicrophoneMock,
    startMicrophone: startMicrophoneMock,
  };
};
membraneWebRTC.useSoundDetection = () => {
  return {
    isSoundDetected: false,
    startSoundDetection: startSoundDetectionMock,
    stopSoundDetection: stopSoundDetectionMock,
  };
};
membraneWebRTC.updateVideoTrackMetadata = updateVideoTrackMetadataMock;
membraneWebRTC.updateAudioTrackMetadata = updateAudioTrackMetadataMock;

describe('Videoroom context', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Navigating back to main screen', async () => {
    const { result } = renderHook(() => useVideoroomState(), {
      wrapper: VideoroomContextProvider,
    });

    await act(async () => {
      result.current.setRoomName('testRoom');
      result.current.setUsername('testUser');
      await result.current.connectAndJoinRoom();
      await result.current.disconnect();
      result.current.goToMainScreen();
    });

    expect(result.current.roomName).toBe('');
    expect(result.current.username).toBe('');
    expect(result.current.videoroomState).toBe('BeforeMeeting');
  });

  test('Toggle camera', async () => {
    const { result } = renderHook(() => useVideoroomState(), {
      wrapper: VideoroomContextProvider,
    });

    act(() => {
      result.current.toggleCamera();
    });
    expect(result.current.isCameraOn).toBe(false);
    act(() => {
      result.current.toggleCamera();
    });
    expect(result.current.isCameraOn).toBe(true);

    await act(async () => {
      // Change videoroomState to InMeeting
      await result.current.connectAndJoinRoom();
      result.current.toggleCamera();
    });

    expect(useCameraMock).toBeCalledTimes(1);
    expect(updateVideoTrackMetadataMock).toBeCalledTimes(1);
    expect(result.current.isCameraOn).toBe(false);
  });

  test('Toggle microphone', async () => {
    const { result } = renderHook(() => useVideoroomState(), {
      wrapper: VideoroomContextProvider,
    });

    act(() => {
      result.current.toggleMicrophone();
    });
    expect(result.current.isMicrophoneOn).toBe(false);
    act(() => {
      result.current.toggleMicrophone();
    });
    expect(result.current.isMicrophoneOn).toBe(true);

    await act(async () => {
      // Change videoroomState to InMeeting
      await result.current.connectAndJoinRoom();
      result.current.toggleMicrophone();
    });

    expect(useMicrophoneMock).toBeCalledTimes(1);
    expect(updateAudioTrackMetadataMock).toBeCalledTimes(1);
    expect(result.current.isMicrophoneOn).toBe(false);
  });

  test('Connecting to room', async () => {
    const { result } = renderHook(() => useVideoroomState(), {
      wrapper: VideoroomContextProvider,
    });

    act(() => {
      result.current.setRoomName('test room     ');
      result.current.setUsername('test user   ');
    });
    await act(async () => {
      await result.current.connectAndJoinRoom();
    });

    expect(result.current.roomName).toBe('test room');
    expect(result.current.username).toBe('test user');
    expect(setExtra).toBeCalledTimes(2);
    expect(setExtra).toHaveBeenNthCalledWith(1, 'room name', 'test room');
    expect(setExtra).toHaveBeenNthCalledWith(2, 'user name', 'test user');
    expect(connectCallback).toBeCalledTimes(1);
    expect(startCameraMock).toBeCalledTimes(1);
    expect(startMicrophoneMock).toBeCalledTimes(1);
    expect(result.current.videoroomState).toBe('InMeeting');
  });

  test('Disconnect from room', async () => {
    const { result } = renderHook(() => useVideoroomState(), {
      wrapper: VideoroomContextProvider,
    });

    await act(async () => {
      await result.current.connectAndJoinRoom();
      await result.current.disconnect();
    });

    expect(disconnectCallback).toBeCalledTimes(1);
    expect(result.current.videoroomState).toBe('AfterMeeting');

    await act(async () => {
      await result.current.connectAndJoinRoom();
    });

    expect(connectCallback).toBeCalledTimes(2);
    expect(result.current.videoroomState).toBe('InMeeting');
  });

  test('Toggle screencast', async () => {
    let isScreencastOn = false;
    const useScreencastMock = jest.fn(() => {
      isScreencastOn = !isScreencastOn;
    });

    membraneWebRTC.useScreencast = () => {
      return { isScreencastOn: false, toggleScreencast: useScreencastMock };
    };

    const { result } = renderHook(() => useVideoroomState(), {
      wrapper: VideoroomContextProvider,
    });

    await act(async () => {
      result.current.toggleScreencastAndUpdateMetadata();
    });

    expect(useScreencastMock).toBeCalledTimes(1);
    expect(isScreencastOn).toBe(true);

    await act(async () => {
      result.current.toggleScreencastAndUpdateMetadata();
    });

    expect(useScreencastMock).toBeCalledTimes(2);
    expect(isScreencastOn).toBe(false);
  });
});
