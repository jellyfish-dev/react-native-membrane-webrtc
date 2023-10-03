import { SERVER_URL } from '@env';
import {
  useWebRTC,
  useAudioSettings,
  VideoQuality,
  CaptureDevice,
  updateVideoTrackMetadata,
  updateAudioTrackMetadata,
  useCamera,
  useMicrophone,
  useScreencast,
  ScreencastQuality,
  useSoundDetection,
} from '@jellyfish-dev/react-native-membrane-webrtc';
import { useNotifications } from '@model/NotificationsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import React, { useState, useCallback, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';

type VideoroomState = 'BeforeMeeting' | 'InMeeting' | 'AfterMeeting';

const VideoroomContext = React.createContext<
  | {
      roomName: string;
      setRoomName: (roomName: string) => void;
      username: string;
      setUsername: (username: string) => void;
      isCameraOn: boolean;
      toggleCamera: () => void;
      isMicrophoneOn: boolean;
      toggleMicrophone: () => void;
      isScreencastOn: boolean;
      isSoundDetected: boolean;
      toggleScreencastAndUpdateMetadata: () => void;
      currentCamera: CaptureDevice | null;
      setCurrentCamera: (camera: CaptureDevice | null) => void;
      isDevMode: boolean;
      setIsDevMode: (isDevMode: boolean) => void;
      devServerUrl: string;
      setDevServerUrl: (devServerUrl: string) => void;
      setSavedIsDevMode: (updatedIsDevMode: boolean) => Promise<void>;
      connectAndJoinRoom: () => Promise<void>;
      disconnect: () => Promise<void>;
      videoroomState: VideoroomState;
      goToMainScreen: () => void;
      flipCamera: () => void;
      getCaptureDevices: () => Promise<CaptureDevice[]>;
    }
  | undefined
>(undefined);

type VideoroomContextProps = {
  children: ReactNode;
};

const VideoroomContextProvider = ({ children }: VideoroomContextProps) => {
  const [roomName, setRoomName] = useState('');
  const [username, setUsername] = useState('');
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicrophoneOn, setIsMicrophoneOn] = useState(true);
  const [currentCamera, setCurrentCamera] = useState<CaptureDevice | null>(
    null
  );
  const [isDevMode, setIsDevMode] = useState(false);
  const [devServerUrl, setDevServerUrl] = useState(SERVER_URL);
  const {
    toggleCamera: membraneToggleCamera,
    startCamera,
    flipCamera,
    getCaptureDevices,
  } = useCamera();
  const { toggleMicrophone: membraneToggleMicrophone, startMicrophone } =
    useMicrophone();
  const { isSoundDetected, startSoundDetection, stopSoundDetection } =
    useSoundDetection();
  const { isScreencastOn, toggleScreencast: membraneToggleScreencast } =
    useScreencast();

  const { connect, error, disconnect: membraneDisconnect } = useWebRTC();
  useAudioSettings();

  const [videoroomState, setVideoroomState] =
    useState<VideoroomState>('BeforeMeeting');

  const setSavedIsDevMode = async (updatedIsDevMode: boolean) => {
    setIsDevMode(updatedIsDevMode);
    try {
      const jsonValue = JSON.stringify(updatedIsDevMode);
      await AsyncStorage.setItem('isDevMode', jsonValue);
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  const getSavedIsDevMode = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('isDevMode');
      return jsonValue != null ? JSON.parse(jsonValue) : false;
    } catch (err) {
      Sentry.captureException(err);
      return false;
    }
  };

  useEffect(() => {
    getSavedIsDevMode().then((val) => setIsDevMode(val));
  }, []);

  const connectAndJoinRoom = useCallback(async () => {
    const trimmedRoomName = roomName.trimEnd();
    const trimmedUserName = username.trimEnd();

    setRoomName(trimmedRoomName);
    setUsername(trimmedUserName);

    Sentry.setExtra('room name', trimmedRoomName);
    Sentry.setExtra('user name', trimmedUserName);

    await connect(getServerUrl(), trimmedRoomName, {
      socketChannelParams: {
        isSimulcastOn: true,
      },
      endpointMetadata: { displayName: trimmedUserName },
    });

    await startCamera({
      simulcastConfig: {
        enabled: true,
        // a temporary fix for broken screencast on iOS
        // ios devices have a limit on hardware encoders (https://github.com/twilio/twilio-video-ios/issues/17)
        // 3 encoders on the simulcast video track + 1 encoder on the screencast track exceeds the limit
        // so we're using just two layers for now
        // we're going to toggle one layer when turning on screencast but there is a webrtc issue
        // with that that needs to be fixed first
        activeEncodings:
          Platform.OS === 'android' ? ['l', 'm', 'h'] : ['l', 'h'],
      },
      quality: VideoQuality.HD_169,
      maxBandwidth: { l: 150, m: 500, h: 1500 },
      videoTrackMetadata: { active: isCameraOn, type: 'camera' },
      captureDeviceId: currentCamera?.id,
      cameraEnabled: isCameraOn,
    });
    await startMicrophone({
      audioTrackMetadata: { active: isMicrophoneOn, type: 'audio' },
      microphoneEnabled: isMicrophoneOn,
    });
    setVideoroomState('InMeeting');
  }, [roomName, username, isCameraOn, isMicrophoneOn, currentCamera]);

  const disconnect = useCallback(async () => {
    await membraneDisconnect();
    setVideoroomState('AfterMeeting');
  }, []);

  const goToMainScreen = useCallback(() => {
    setRoomName('');
    setUsername('');
    setVideoroomState('BeforeMeeting');
  }, []);

  const { showNotification } = useNotifications();

  useEffect(() => {
    if (!isMicrophoneOn) {
      startSoundDetection();
    } else {
      stopSoundDetection();
    }
  }, [isMicrophoneOn]);

  useEffect(() => {
    if (error) {
      showNotification('Error connecting to server', 'error');
    }
  }, [error]);

  const toggleCamera = useCallback(async () => {
    if (videoroomState === 'InMeeting') {
      await membraneToggleCamera();
      await updateVideoTrackMetadata({ active: !isCameraOn, type: 'camera' });
    }
    setIsCameraOn(!isCameraOn);
  }, [isCameraOn, videoroomState]);

  const toggleMicrophone = useCallback(async () => {
    if (videoroomState === 'InMeeting') {
      await membraneToggleMicrophone();
      await updateAudioTrackMetadata({
        active: !isMicrophoneOn,
        type: 'audio',
      });
    }
    setIsMicrophoneOn(!isMicrophoneOn);
  }, [isMicrophoneOn, videoroomState]);

  const toggleScreencastAndUpdateMetadata = useCallback(() => {
    membraneToggleScreencast({
      screencastMetadata: {
        displayName: 'presenting',
        type: 'screensharing',
        active: 'true',
      },
      quality: ScreencastQuality.HD15,
    });
  }, []);

  const getServerUrl = useCallback(() => {
    return isDevMode ? devServerUrl : SERVER_URL;
  }, [isDevMode, devServerUrl]);

  const value = {
    roomName,
    setRoomName,
    username,
    setUsername,
    connectAndJoinRoom,
    isCameraOn,
    toggleCamera,
    isMicrophoneOn,
    isSoundDetected,
    toggleMicrophone,
    isScreencastOn,
    toggleScreencastAndUpdateMetadata,
    currentCamera,
    setCurrentCamera,
    isDevMode,
    setIsDevMode,
    devServerUrl,
    setDevServerUrl,
    setSavedIsDevMode,
    disconnect,
    videoroomState,
    goToMainScreen,
    flipCamera,
    getCaptureDevices,
  };

  return (
    <VideoroomContext.Provider value={value}>
      {children}
    </VideoroomContext.Provider>
  );
};

function useVideoroomState() {
  const context = React.useContext(VideoroomContext);
  if (context === undefined) {
    throw new Error('useVideoroomState must be used within a VideoroomContext');
  }
  return context;
}

export { VideoroomContextProvider, useVideoroomState };
