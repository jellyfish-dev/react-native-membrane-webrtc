import { useCallback, useEffect, useState, useRef } from 'react';
import {
  NativeModules,
  Platform,
  requireNativeComponent,
  UIManager,
  NativeEventEmitter,
  ViewProps,
} from 'react-native';

function isJest() {
  // @ts-ignore
  return process.env.NODE_ENV === 'test';
}

const LINKING_ERROR =
  `The package 'react-native-membrane' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo managed workflow\n';

const Membrane = NativeModules.Membrane
  ? NativeModules.Membrane
  : isJest()
  ? {
      addListener: () => {},
      removeListeners: () => {},
    }
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );
const eventEmitter = new NativeEventEmitter(Membrane);

export enum ParticipantType {
  Remote = 'Remote',
  Local = 'Local',
}

export enum TrackType {
  Audio = 'Audio',
  Video = 'Video',
}
/**
 * Type describing Voice Activity Detection statuses.
 *
 * SPEECH - voice activity has been detected
 * SILENCE - lack of voice activity has been detected
 */
export enum VadStatus {
  Silence = 'silence',
  Speech = 'speech',
}

/**
 * Type describing possible reasons of currently selected encoding.
 *
 * - OTHER - the exact reason couldn't be determined
 * - ENCODING_INACTIVE - previously selected encoding became inactive
 * - LOW_BANDWIDTH - there is no longer enough bandwidth to maintain previously selected encoding
 */
export enum EncodingReason {
  Other = 'other',
  EncodingInactive = 'encodingInactive',
  LowBandwidth = 'lowBandwidth',
}

export type Track = {
  id: string;
  type: TrackType;
  metadata: Metadata;
  vadStatus: VadStatus;
  // Encoding that is currently received. Only present for remote tracks.
  encoding: TrackEncoding | null;
  // The reason of currently selected encoding. Only present for remote tracks.
  encodingReason: EncodingReason | null;
};

export type Metadata = { [key: string]: any };
export type SocketConnectionParams = { [key: string]: any };
export type SocketChannelParams = { [key: string]: any };

export type Participant = {
  /**
   *  id used to identify a participant
   */
  id: string;
  /**
   * used to indicate participant type.
   */
  type: ParticipantType;
  /**
   * a map `string -> any` containing participant metadata from the server
   */
  metadata: Metadata;
  /**
   * a list of participant's video and audio tracks
   */
  tracks: Track[];
};

export enum VideoLayout {
  FILL = 'FILL',
  FIT = 'FIT',
}

export enum VideoQuality {
  QVGA_169 = 'QVGA169',
  VGA_169 = 'VGA169',
  QHD_169 = 'QHD169',
  HD_169 = 'HD169',
  FHD_169 = 'FHD169',
  QVGA_43 = 'QVGA43',
  VGA_43 = 'VGA43',
  QHD_43 = 'QHD43',
  HD_43 = 'HD43',
  FHD_43 = 'FHD43',
}

export enum ScreencastQuality {
  VGA = 'VGA',
  HD5 = 'HD5',
  HD15 = 'HD15',
  FHD15 = 'FHD15',
  FHD30 = 'FHD30',
}

export type TrackEncoding = 'l' | 'm' | 'h';

export enum AudioOutputDeviceType {
  Bluetooth = 'bluetooth',
  Headset = 'headset',
  Speaker = 'speaker',
  Earpiece = 'earpiece',
}

export enum AudioSessionMode {
  VoiceChat = 'voiceChat',
  VideoChat = 'videoChat',
}

export type AudioOutputDevice = {
  type: AudioOutputDeviceType;
  name: string;
};

/**
 * A type describing simulcast configuration.
 *
 * At the moment, simulcast track is initialized in three versions - low, medium and high.
 * High resolution is the original track resolution, while medium and low resolutions are
 * the original track resolution scaled down by 2 and 4 respectively.
 */
export type SimulcastConfig = {
  /**
   * whether to simulcast track or not. By default simulcast is disabled.
   */
  enabled: boolean;
  /**
   *  list of active encodings. Encoding can be one of `"h"` (original encoding), `"m"` (scaled down x2), `"l"` (scaled down x4).
   */
  activeEncodings: TrackEncoding[];
};

/**
 * Type describing maximal bandwidth that can be used, in kbps. 0 is interpreted as unlimited bandwidth.
 */
export type BandwidthLimit = number;

/**
 * Type describing bandwidth limit for simulcast track. It is a mapping `encoding -> BandwidthLimit`. If encoding isn't present in this mapping,
 * it will be assumed that this particular encoding shouldn't have any bandwidth limit.
 */
export type SimulcastBandwidthLimit = Record<TrackEncoding, BandwidthLimit>;

/**
 * A type describing bandwidth limitation of a track, including simulcast and non-simulcast tracks. Can be `BandwidthLimit` or `SimulcastBandwidthLimit`.
 */
export type TrackBandwidthLimit = BandwidthLimit | SimulcastBandwidthLimit;

export type ConnectionOptions = {
  /**
   * resolution + aspect ratio of local video track, one of: `QVGA_169`, `VGA_169`, `QHD_169`, `HD_169`,
   * `FHD_169`, `QVGA_43`, `VGA_43`, `QHD_43`, `HD_43`, `FHD_43`. Note that quality might be worse than
   * specified due to device capabilities, internet connection etc.
   * @default `VGA_169`
   */
  quality: VideoQuality;
  /**
   * whether to flip the dimensions of the video, that is whether to film in vertical orientation.
   * @default `true`
   */
  flipVideo: boolean;
  /**
   * a map `string -> any` containing user metadata to be sent to the server. Use it to send for example user display name or other options.
   */
  userMetadata: Metadata;
  /**
   * a map `string -> any` containing video track metadata to be sent to the server.
   */
  videoTrackMetadata: Metadata;
  /**
   * a map `string -> any` containing audio track metadata to be sent to the server.
   */
  audioTrackMetadata: Metadata;
  /**
   *  SimulcastConfig of a video track. By default simulcast is disabled.
   */
  simulcastConfig: SimulcastConfig;
  /**
   *  bandwidth limit of a video track. By default there is no bandwidth limit.
   */
  maxBandwidth: TrackBandwidthLimit;
  /**
   *  a map `string -> any` containing connection params passed to the socket.
   */
  connectionParams: SocketConnectionParams;
  /**
   * a map `string -> any` containing params passed to the socket channel.
   */
  socketChannelParams: SocketChannelParams;
  /**
   * whether the video track is initially enabled
   * @default `true`
   */
  videoTrackEnabled: boolean;
  /**
   * whether the audio track is initially enabled
   * @default `true`
   */
  audioTrackEnabled: boolean;
  /**
   * id of the camera to start capture with. Get available cameras with `getCaptureDevices()`.
   * You can switch the cameras later with `flipCamera`/`switchCamera` functions.
   * @default the first front camera
   */
  captureDeviceId: string;
};

export type ScreencastOptions = {
  /**
   * Resolution + fps of screencast track, one of: `VGA`, `HD5`, `HD15`, `FHD15`, `FHD30`.
   * Note that quality might be worse than specified due to device capabilities, internet
   * connection etc.
   * @default `HD15``
   */
  quality: ScreencastQuality;
  /**
   * a map `string -> any` containing screencast track metadata to be sent to the server
   */
  screencastMetadata: Metadata;
  /**
   * SimulcastConfig of a screencast track. By default simulcast is disabled.
   */
  simulcastConfig: SimulcastConfig;
  /**
   *  bandwidth limit of a screencast track. By default there is no bandwidth limit.
   */
  maxBandwidth: TrackBandwidthLimit;
};

export type CaptureDevice = {
  id: string;
  name: string;
  isFrontFacing: boolean;
  isBackFacing: boolean;
};

export enum LoggingSeverity {
  Verbose = 'verbose',
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  None = 'none',
}

const defaultSimulcastConfig = () => ({
  enabled: false,
  activeEncodings: [],
});

let videoSimulcastConfig: SimulcastConfig = defaultSimulcastConfig();
let screencastSimulcastConfig: SimulcastConfig = defaultSimulcastConfig();

/**
 * The hook used to manage a connection with membrane server.
 * @returns An object with functions to manage membrane server connection and `error` if connection failed.
 */
export function useMembraneServer() {
  const [error, setError] = useState<string | null>(null);
  // prevent user from calling connect methods multiple times
  const lock = useRef(false);

  useEffect(() => {
    const eventListener = eventEmitter.addListener('MembraneError', setError);
    return () => eventListener.remove();
  }, []);

  const withLock =
    (f: any) =>
    async (...args: any) => {
      if (lock.current) return Promise.resolve();
      lock.current = true;
      try {
        await f(...args);
      } catch (e) {
        throw e;
      } finally {
        lock.current = false;
      }
    };

  /**
   * Connects to a room.
   * @returns A promise that resolves on success or rejects in case of an error.
   */
  const connect: (
    /**
     * server url
     */
    url: string,
    roomName: string,
    connectionOptions?: Partial<ConnectionOptions>
  ) => Promise<void> = useCallback(
    withLock(
      (
        url: string,
        roomName: string,
        connectionOptions: Partial<ConnectionOptions> = {}
      ): Promise<void> => {
        setError(null);
        videoSimulcastConfig =
          connectionOptions.simulcastConfig || defaultSimulcastConfig();
        return Membrane.connect(url, roomName, connectionOptions);
      }
    ),
    []
  );

  /**
   * Call this after successfully connecting with the server to join the room. Other participants' tracks will be sent and the user will be visible to other room participants.
   * @returns A promise that resolves on success or rejects in case of an error.
   */
  const joinRoom: () => Promise<void> = useCallback(
    withLock((): Promise<void> => {
      setError(null);
      return Membrane.join();
    }),
    []
  );

  /**
   * Call this to gracefully disconnect from the server. After that you can connect again.
   * @returns A promise that resolves on success or rejects in case of an error.
   */
  const disconnect: () => Promise<void> = useCallback(
    withLock((): Promise<void> => {
      setError(null);
      return Membrane.disconnect();
    }),
    []
  );
  return {
    connect,
    disconnect,
    joinRoom,
    error,
  };
}

/**
 * This hook provides live updates of room participants.
 * @returns An array of room participants.
 */
export function useRoomParticipants() {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    const eventListener = eventEmitter.addListener(
      'ParticipantsUpdate',
      ({ participants }) => {
        setParticipants(participants);
      }
    );
    Membrane.getParticipants().then(
      ({ participants }: { participants: Participant[] }) => {
        setParticipants(participants);
      }
    );
    return () => eventListener.remove();
  }, []);

  return participants;
}

/**
 * This hook can toggle camera on/off and provides current camera state.
 */
export function useCameraState() {
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false);

  useEffect(() => {
    const eventListener = eventEmitter.addListener('IsCameraOn', (event) =>
      setIsCameraOn(event)
    );
    Membrane.isCameraOn().then(setIsCameraOn);
    return () => eventListener.remove();
  }, []);

  /**
   * Function to toggle camera on/off
   */
  const toggleCamera = useCallback(async () => {
    const state = await Membrane.toggleCamera();
    setIsCameraOn(state);
  }, []);

  return { isCameraOn, toggleCamera };
}

/**
 * This hook can toggle microphone on/off and provides current microphone state.
 */
export function useMicrophoneState() {
  const [isMicrophoneOn, setIsMicrophoneOn] = useState<boolean>(false);

  useEffect(() => {
    const eventListener = eventEmitter.addListener('IsMicrophoneOn', (event) =>
      setIsMicrophoneOn(event)
    );
    Membrane.isMicrophoneOn().then(setIsMicrophoneOn);
    return () => eventListener.remove();
  }, []);

  /**
   * Function to toggle microphone on/off
   */
  const toggleMicrophone = useCallback(async () => {
    const state = await Membrane.toggleMicrophone();
    setIsMicrophoneOn(state);
  }, []);

  return { isMicrophoneOn, toggleMicrophone };
}

/**
 * Function that toggles between front and back camera. By default the front camera is used.
 * @returns A promise that resolves when camera is toggled.
 */
export function flipCamera(): Promise<void> {
  return Membrane.flipCamera();
}

/**
 * Function that switches to the specified camera. By default the front camera is used.
 * @returns A promise that resolves when camera is switched.
 */
export function switchCamera(captureDeviceId: string): Promise<void> {
  return Membrane.switchCamera(captureDeviceId);
}

/** Function that queries available cameras.
 * @returns A promise that resolves to the list of available cameras.
 */
export function getCaptureDevices(): Promise<CaptureDevice[]> {
  return Membrane.getCaptureDevices();
}

/**
 * This hook can toggle screen sharing on/off and provides current screencast state.
 * @returns An object with functions to manage screencast.
 */
export function useScreencast() {
  const [isScreencastOn, setIsScreencastOn] = useState<boolean>(false);
  const [simulcastConfig, setSimulcastConfig] = useState<SimulcastConfig>(
    screencastSimulcastConfig
  );

  useEffect(() => {
    if (Platform.OS === 'ios') {
      const eventListener = eventEmitter.addListener(
        'IsScreencastOn',
        (event) => setIsScreencastOn(event)
      );
      return () => eventListener.remove();
    }
    return () => {};
  }, []);

  /**
   * Toggles the screencast on/off
   *
   * Under the hood the screencast is just given participant's another video track.
   * However for convenience the library creates a fake screencasting participant.
   * The library recognizes a screencast track by `type: "screencasting"` metadata in
   * screencasting video track.
   */
  const toggleScreencast = useCallback(
    async (screencastOptions: Partial<ScreencastOptions> = {}) => {
      const state = await Membrane.toggleScreencast(screencastOptions);
      if (Platform.OS === 'android') {
        setIsScreencastOn(state);
      }
      screencastSimulcastConfig =
        screencastOptions.simulcastConfig || defaultSimulcastConfig();
      setSimulcastConfig(screencastSimulcastConfig);
    },
    []
  );

  /**
   * a function that updates screencast track metadata on the server
   * @param metadata a map `string -> any` containing screencast track metadata to be sent to the server
   */
  const updateScreencastTrackMetadata = useCallback(
    async (metadata: Metadata) => {
      await Membrane.updateScreencastTrackMetadata(metadata);
    },
    []
  );

  /**
   * Toggles simulcast encoding of a screencast track on/off
   * @param encoding encoding to toggle
   */
  const toggleScreencastTrackEncoding = useCallback(
    async (encoding: TrackEncoding) => {
      screencastSimulcastConfig = await Membrane.toggleScreencastTrackEncoding(
        encoding
      );
      setSimulcastConfig(screencastSimulcastConfig);
    },
    []
  );

  /**
   * updates maximum bandwidth for the given simulcast encoding of the screencast track
   * @param encoding encoding to update
   * @param bandwidth BandwidthLimit to set
   */
  const setScreencastTrackEncodingBandwidth = useCallback(
    async (encoding: TrackEncoding, bandwidth: BandwidthLimit) => {
      await Membrane.setScreencastTrackEncodingBandwidth(encoding, bandwidth);
    },
    []
  );

  /**
   * updates maximum bandwidth for the screencast track. This value directly translates
   * to quality of the stream and the amount of RTP packets being sent. In case simulcast
   * is enabled bandwidth is split between all of the variant streams proportionally to
   * their resolution
   * @param bandwidth BandwidthLimit to set
   */
  const setScreencastTrackBandwidth = useCallback(
    async (bandwidth: BandwidthLimit) => {
      await Membrane.setScreencastTrackBandwidth(bandwidth);
    },
    []
  );

  return {
    isScreencastOn,
    toggleScreencast,
    updateScreencastTrackMetadata,
    toggleScreencastTrackEncoding,
    simulcastConfig,
    setScreencastTrackEncodingBandwidth,
    setScreencastTrackBandwidth,
  };
}

/**
 * This hook manages user's metadata. Use it to for example update when user is muted etc.
 */
export function usePeerMetadata() {
  /**
   * a function that updates user's metadata on the server
   * @param metadata a map `string -> any` containing user's track metadata to be sent to the server
   */
  const updatePeerMetadata = useCallback(async (metadata: Metadata) => {
    await Membrane.updatePeerMetadata(metadata);
  }, []);
  return { updatePeerMetadata };
}

/**
 * This hook manages video track metadata.
 */
export function useVideoTrackMetadata() {
  /**
   * a function that updates video metadata on the server.
   * @param metadata a map string -> any containing video track metadata to be sent to the server
   */
  const updateVideoTrackMetadata = useCallback(async (metadata: Metadata) => {
    await Membrane.updateVideoTrackMetadata(metadata);
  }, []);
  return { updateVideoTrackMetadata };
}

/**
 * This hook manages audio track metadata.
 */
export function useAudioTrackMetadata() {
  /**
   * a function that updates audio metadata on the server
   * @param metadata a map `string -> any` containing audio track metadata to be sent to the server
   */
  const updateAudioTrackMetadata = useCallback(async (metadata: Metadata) => {
    await Membrane.updateAudioTrackMetadata(metadata);
  }, []);
  return { updateAudioTrackMetadata };
}

/**
 * This hook manages audio settings.
 */
export function useAudioSettings() {
  const [selectedAudioOutputDevice, setSelectedAudioOutputDevice] =
    useState<AudioOutputDevice | null>(null);
  const [availableDevices, setAvailableDevices] = useState<AudioOutputDevice[]>(
    []
  );

  const onAudioDevice = useCallback((event) => {
    setSelectedAudioOutputDevice(event.selectedDevice);
    setAvailableDevices(event.availableDevices);
  }, []);

  useEffect(() => {
    const eventListener = eventEmitter.addListener(
      'AudioDeviceUpdate',
      onAudioDevice
    );
    Membrane.startAudioSwitcher();
    return () => {
      eventListener.remove();
      if (Platform.OS === 'android') {
        Membrane.stopAudioSwitcher();
      }
    };
  }, []);

  /**
   * [Android only] selects output audio device.
   * For detecting and selecting bluettoth devices make sure you have the BLUETOOTH_CONNECT permission.
   */
  const selectOutputAudioDevice = useCallback(
    async (device: AudioOutputDeviceType) => {
      if (Platform.OS === 'ios') {
        throw Error(
          'selectOutputAudioDevice function is supported only on Android. ' +
            'To select an output audio device on iOS use selectAudioSessionMode or showAudioRoutePicker functions'
        );
      }
      await Membrane.setOutputAudioDevice(device);
    },
    []
  );

  /**
   * [iOS only] selects audio session mode. For more information refer to Apple's documentation:
   *  https://developer.apple.com/documentation/avfaudio/avaudiosession/mode/
   *
   */
  const selectAudioSessionMode = useCallback(
    async (audioSessionMode: AudioSessionMode) => {
      if (Platform.OS === 'android') {
        throw Error('selectAudioSessionMode function is supported only on iOS');
      }
      await Membrane.selectAudioSessionMode(audioSessionMode);
    },
    []
  );

  /**
   * [iOS only] Shows a picker modal that allows user to select output audio device. For more
   * information refer to Apple's documentation: https://developer.apple.com/documentation/avkit/avroutepickerview
   */
  const showAudioRoutePicker = useCallback(async () => {
    if (Platform.OS === 'android') {
      throw Error(
        'showAudioRoutePicker function is supported only on iOS. ' +
          'To select an output audio device on Android use selectOutputAudioDevice function'
      );
    }
    await Membrane.showAudioRoutePicker();
  }, []);

  return {
    /**
     * currently selected output audio device
     */
    selectedAudioOutputDevice,
    /**
     * [Android only] available audio output devices to be set
     */
    availableDevices,
    selectOutputAudioDevice,
    selectAudioSessionMode,
    showAudioRoutePicker,
  };
}

/**
 * This hook manages the simulcast configuration of a video track.
 * @returns An object with functions and data to manage simulcast configuration.
 */
export function useSimulcast() {
  const [simulcastConfig, setSimulcastConfig] =
    useState<SimulcastConfig>(videoSimulcastConfig);

  useEffect(() => {
    const eventListener = eventEmitter.addListener(
      'SimulcastConfigUpdate',
      (event) => {
        setSimulcastConfig(event);
      }
    );
    return () => eventListener.remove();
  }, []);

  /**
   * sets track encoding that server should send to the client library.
   * The encoding will be sent whenever it is available. If choosen encoding is
   * temporarily unavailable, some other encoding will be sent until choosen encoding
   *  becomes active again.
   *
   * @param trackId id of a track which encoding you want to select
   * @param encoding encoding to select
   */
  const setTargetTrackEncoding = useCallback(
    async (trackId: string, encoding: TrackEncoding) => {
      await Membrane.setTargetTrackEncoding(trackId, encoding);
    },
    []
  );

  /**
   * toggles encoding of a video track on/off
   * @param encoding encoding to toggle
   */
  const toggleVideoTrackEncoding = useCallback(
    async (encoding: TrackEncoding) => {
      videoSimulcastConfig = await Membrane.toggleVideoTrackEncoding(encoding);
      setSimulcastConfig(videoSimulcastConfig);
    },
    []
  );

  /**
   * updates maximum bandwidth for the given simulcast encoding of the video track
   * @param encoding  encoding to update
   * @param bandwidth BandwidthLimit to set
   */
  const setVideoTrackEncodingBandwidth = useCallback(
    async (encoding: TrackEncoding, bandwidth: BandwidthLimit) => {
      await Membrane.setVideoTrackEndodingEncodingBandwidth(
        encoding,
        bandwidth
      );
    },
    []
  );

  return {
    simulcastConfig,
    setTargetTrackEncoding,
    toggleVideoTrackEncoding,
    setVideoTrackEncodingBandwidth,
  };
}

/**
 * This hook manages the bandwidth limit of a video track.
 */
export function useBandwidthLimit() {
  /**
   * updates maximum bandwidth for the video track. This value directly translates
   * to quality of the stream and the amount of RTP packets being sent. In case simulcast
   * is enabled bandwidth is split between all of the variant streams proportionally to
   * their resolution.
   * @param BandwidthLimit to set
   */
  const setVideoTrackBandwidth = useCallback(
    async (bandwidth: BandwidthLimit) => {
      await Membrane.setVideoTrackBandwidth(bandwidth);
    },
    []
  );

  return { setVideoTrackBandwidth };
}

/**
 * Function that changes level of debugging logs in WebRTC.
 * @param severity to use when displaying logs
 * @returns a promise that is resolved when debug severity is changed
 */
export function changeWebRTCLoggingSeverity(
  severity: LoggingSeverity
): Promise<void> {
  return Membrane.changeWebRTCLoggingSeverity(severity);
}

/**
 * This hook provides current bandwidth estimation
 * estimation - client's available incoming bitrate estimated
 * by the server. It's measured in bits per second.
 */
export function useBandwidthEstimation() {
  const [estimation, setEstimation] = useState<number | null>(null);

  useEffect(() => {
    const eventListener = eventEmitter.addListener(
      'BandwidthEstimation',
      (estimation) => setEstimation(estimation)
    );
    return () => eventListener.remove();
  }, []);

  return { estimation };
}

export type VideoRendererProps = {
  /**
   * id of the video track which you want to render.
   */
  trackId: string;
  /**
   * `FILL` or `FIT` - it works just like RN Image component. `FILL` fills the whole view
   * with video and it may cut some parts of the video. `FIT` scales the video so the whole
   * video is visible, but it may leave some empty space in the view.
   * @default `FILL`
   */
  videoLayout?: VideoLayout;
  /**
   * whether to mirror video
   * @default false
   */
  mirrorVideo?: boolean;
} & ViewProps;

const VideoRendererViewComponentName = 'VideoRendererView';

/**
 * A component used for rendering participant's video and audio. You can add some basic View styling.
 */
export const VideoRendererView =
  UIManager.getViewManagerConfig(VideoRendererViewComponentName) != null
    ? requireNativeComponent<VideoRendererProps>(VideoRendererViewComponentName)
    : () => {
        throw new Error(LINKING_ERROR);
      };

const VideoPreviewViewName = 'VideoPreviewView';

export type VideoPreviewViewProps = {
  /**
   * `FILL` or `FIT` - it works just like RN Image component. `FILL` fills the whole view
   * with video and it may cut some parts of the video. `FIT` scales the video so the whole
   * video is visible, but it may leave some empty space in the view.
   * @default `FILL`
   */
  videoLayout?: VideoLayout;
  /**
   * whether to mirror video
   * @default false
   */
  mirrorVideo?: boolean;
  /**
   * Id of the camera used for preview. Get available cameras with `getCaptureDevices()` function.
   * @default the first front camera
   */
  captureDeviceId?: string;
} & ViewProps;

/**
 * A component used for preview of the user's video.
 */
export const VideoPreviewView =
  UIManager.getViewManagerConfig(VideoPreviewViewName) != null
    ? requireNativeComponent<VideoPreviewViewProps>(VideoPreviewViewName)
    : () => {
        throw new Error(LINKING_ERROR);
      };
