import { renderHook, act } from '@testing-library/react-hooks';

import {
  VideoroomContextProvider,
  useVideoroomState,
} from '../src/VideoroomContext';

const NOOP = () => {};

jest.mock('@sentry/react-native');
jest.mock('../src/model/NotificationsContext', () => {
  return {
    useNotifications: () => {
      return { showNotification: NOOP };
    },
  };
});
jest.mock('../../src/index');

const useCameraStateMock = jest.fn(NOOP);
const useMicrophoneStateMock = jest.fn(NOOP);
const useVideoTrackMetadataMock = jest.fn(NOOP);
const useAudioTrackMetadataMock = jest.fn(NOOP);

const membraneWebRTC = require('../../src/index');

membraneWebRTC.useCameraState = () => {
  return { toggleCamera: useCameraStateMock };
};
membraneWebRTC.useMicrophoneState = () => {
  return { toggleMicrophone: useMicrophoneStateMock };
};
membraneWebRTC.useVideoTrackMetadata = (params) => {
  return { updateVideoTrackMetadata: useVideoTrackMetadataMock };
};
membraneWebRTC.useAudioTrackMetadata = (params) => {
  return { updateAudioTrackMetadata: useAudioTrackMetadataMock };
};

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

    expect(useCameraStateMock).toBeCalledTimes(1);
    expect(useVideoTrackMetadataMock).toBeCalledTimes(1);
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

    expect(useMicrophoneStateMock).toBeCalledTimes(1);
    expect(useAudioTrackMetadataMock).toBeCalledTimes(1);
    expect(result.current.isMicrophoneOn).toBe(false);
  });
});
