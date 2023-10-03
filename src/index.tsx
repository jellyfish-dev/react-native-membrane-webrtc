import { NativeModulesProxy, EventEmitter } from 'expo-modules-core';
import { takeRight } from 'lodash';
import { Channel, Socket, MessageRef } from 'phoenix';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';

import {
  AudioOutputDevice,
  AudioOutputDeviceType,
  AudioSessionMode,
  BandwidthEstimationEvent,
  BandwidthLimit,
  CameraConfig,
  CaptureDevice,
  ConnectionOptions,
  Endpoint,
  EndpointsUpdateEvent,
  IsCameraOnEvent,
  IsMicrophoneOnEvent,
  isSoundDetectedEvent,
  soundVolume,
  IsScreencastOnEvent,
  LoggingSeverity,
  Metadata,
  MicrophoneConfig,
  RTCInboundStats,
  RTCOutboundStats,
  RTCStats,
  ScreencastOptions,
  SimulcastConfig,
  SimulcastConfigUpdateEvent,
  TrackEncoding,
} from './MembraneWebRTC.types';
import MembraneWebRTCModule from './MembraneWebRTCModule';
import VideoPreviewView from './VideoPreviewView';
import VideoRendererView from './VideoRendererView';

const eventEmitter = new EventEmitter(
  MembraneWebRTCModule ?? NativeModulesProxy.MembraneWebRTC
);

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
export function useWebRTC() {
  const [error, setError] = useState<string | null>(null);
  // prevent user from calling connect methods multiple times
  const lock = useRef(false);
  const socket = useRef<Socket | null>(null);
  const webrtcChannel = useRef<Channel | null>(null);
  const onSocketError = useRef<MessageRef | null>(null);
  const onSocketClose = useRef<MessageRef | null>(null);

  useEffect(() => {
    const eventListener = eventEmitter.addListener(
      'SendMediaEvent',
      sendMediaEvent
    );
    return () => eventListener.remove();
  }, []);

  const sendMediaEvent = ({ event }: { event: string }) => {
    if (webrtcChannel.current) {
      webrtcChannel.current.push('mediaEvent', { data: event });
    }
  };

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
   * Connects to a server.
   * @returns A promise that resolves on success or rejects in case of an error.
   */
  const connect: <ConnectionOptionsMetadataType extends Metadata>(
    /**
     * server url
     */
    url: string,
    roomName: string,
    connectionOptions?: Partial<
      ConnectionOptions<ConnectionOptionsMetadataType>
    >
  ) => Promise<void> = useCallback(
    withLock(
      async <ConnectionOptionsMetadataType extends Metadata>(
        url: string,
        roomName: string,
        connectionOptions: Partial<
          ConnectionOptions<ConnectionOptionsMetadataType>
        > = {}
      ) => {
        setError(null);
        const _socket = new Socket(url, {
          params: connectionOptions.connectionParams,
        });
        _socket.connect();

        onSocketClose.current = _socket.onClose(cleanUp);
        onSocketError.current = _socket.onError(() => {
          setError(`Socket error occured.`);
          cleanUp();
        });

        const _webrtcChannel = _socket.channel(
          `room:${roomName}`,
          connectionOptions.socketChannelParams
        );

        _webrtcChannel.on('mediaEvent', (event) => {
          MembraneWebRTCModule.receiveMediaEvent(event.data);
        });

        _webrtcChannel.on('error', (error) => {
          console.error(error);
          setError(
            `Received error report from the server: ${error.message ?? ''}`
          );
          cleanUp();
        });

        _webrtcChannel.onError((reason) => {
          console.error(reason);
          setError(`Webrtc channel error occurred: ${reason}.`);
          cleanUp();
        });

        socket.current = _socket;
        webrtcChannel.current = _webrtcChannel;

        await MembraneWebRTCModule.create();

        await new Promise<void>((resolve, reject) => {
          _webrtcChannel
            .join()
            .receive('ok', () => {
              resolve();
            })
            .receive('error', (_response) => {
              console.error(_response);
              reject(_response);
            });
        });

        await MembraneWebRTCModule.connect(
          connectionOptions.endpointMetadata || {}
        );
      }
    ),
    []
  );

  /**
   * Call this to gracefully disconnect from the server. After that you can connect again.
   * @returns A promise that resolves on success or rejects in case of an error.
   */
  const disconnect: () => Promise<void> = useCallback(
    withLock((): Promise<void> => {
      setError(null);
      return cleanUp();
    }),
    []
  );

  const cleanUp = (): Promise<void> => {
    webrtcChannel.current?.leave();
    const refs: MessageRef[] = [];
    if (onSocketClose.current) refs.push(onSocketClose.current);
    if (onSocketError.current) refs.push(onSocketError.current);
    socket.current?.off(refs);
    return MembraneWebRTCModule.disconnect();
  };

  return {
    connect,
    disconnect,
    error,
  };
}

/**
 * This hook provides live updates of room endpoints.
 * @returns An array of room endpoints.
 */
export function useEndpoints<
  EndpointMetadataType extends Metadata,
  VideoTrackMetadataType extends Metadata,
  AudioTrackMetadataType extends Metadata
>() {
  const [endpoints, setEndpoints] = useState<
    Endpoint<
      EndpointMetadataType,
      VideoTrackMetadataType,
      AudioTrackMetadataType
    >[]
  >([]);

  useEffect(() => {
    const eventListener = eventEmitter.addListener<
      EndpointsUpdateEvent<
        EndpointMetadataType,
        VideoTrackMetadataType,
        AudioTrackMetadataType
      >
    >('EndpointsUpdate', ({ endpoints }) => {
      setEndpoints(endpoints);
    });
    MembraneWebRTCModule.getEndpoints().then(
      ({
        endpoints,
      }: {
        endpoints: Endpoint<
          EndpointMetadataType,
          VideoTrackMetadataType,
          AudioTrackMetadataType
        >[];
      }) => {
        setEndpoints(endpoints);
      }
    );
    return () => eventListener.remove();
  }, []);

  return endpoints;
}

/**
 * sets track encoding that server should send to the client library.
 * The encoding will be sent whenever it is available. If choosen encoding is
 * temporarily unavailable, some other encoding will be sent until choosen encoding
 *  becomes active again.
 *
 * @param trackId id of a track which encoding you want to select
 * @param encoding encoding to select
 */
export async function setTargetTrackEncoding(
  trackId: string,
  encoding: TrackEncoding
) {
  await MembraneWebRTCModule.setTargetTrackEncoding(trackId, encoding);
}

/**
 * This hook can toggle camera on/off and provides current camera state.
 */
export function useCamera() {
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false);

  const [simulcastConfig, setSimulcastConfig] =
    useState<SimulcastConfig>(videoSimulcastConfig);

  useEffect(() => {
    const eventListener = eventEmitter.addListener<SimulcastConfigUpdateEvent>(
      'SimulcastConfigUpdate',
      (event) => {
        setSimulcastConfig(event);
      }
    );
    return () => eventListener.remove();
  }, []);

  useEffect(() => {
    const eventListener = eventEmitter.addListener<IsCameraOnEvent>(
      'IsCameraOn',
      (event) => setIsCameraOn(event)
    );
    setIsCameraOn(MembraneWebRTCModule.isCameraOn);
    return () => eventListener.remove();
  }, []);

  /**
   * toggles encoding of a video track on/off
   * @param encoding encoding to toggle
   */
  const toggleVideoTrackEncoding = useCallback(
    async (encoding: TrackEncoding) => {
      videoSimulcastConfig =
        await MembraneWebRTCModule.toggleVideoTrackEncoding(encoding);
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
      await MembraneWebRTCModule.setVideoTrackEndodingEncodingBandwidth(
        encoding,
        bandwidth
      );
    },
    []
  );

  /**
   * Function to toggle camera on/off
   */
  const toggleCamera = useCallback(async () => {
    const state = await MembraneWebRTCModule.toggleCamera();
    setIsCameraOn(state);
  }, []);

  /**
   * Starts local camera capture.
   * @param config configuration of the camera capture
   * @returns A promise that resolves when camera is started.
   */
  const startCamera = useCallback(
    async <CameraConfigMetadataType extends Metadata>(
      config: Partial<CameraConfig<CameraConfigMetadataType>> = {}
    ) => {
      videoSimulcastConfig = config.simulcastConfig || defaultSimulcastConfig();
      // expo-modules on Android don't support Either type, so we workaround it
      if (Platform.OS === 'android') {
        if (typeof config.maxBandwidth === 'object') {
          //@ts-ignore
          config.maxBandwidthMap = config.maxBandwidth;
        } else {
          //@ts-ignore
          config.maxBandwidthInt = config.maxBandwidth;
        }
        delete config.maxBandwidth;
      }
      await MembraneWebRTCModule.startCamera(config);
    },
    []
  );

  /**
   * Function that toggles between front and back camera. By default the front camera is used.
   * @returns A promise that resolves when camera is toggled.
   */
  const flipCamera = useCallback(async () => {
    return MembraneWebRTCModule.flipCamera();
  }, []);

  /**
   * Function that switches to the specified camera. By default the front camera is used.
   * @returns A promise that resolves when camera is switched.
   */
  const switchCamera = useCallback(async (captureDeviceId: string) => {
    return MembraneWebRTCModule.switchCamera(captureDeviceId);
  }, []);

  /** Function that queries available cameras.
   * @returns A promise that resolves to the list of available cameras.
   */
  const getCaptureDevices = useCallback(async () => {
    return MembraneWebRTCModule.getCaptureDevices() as Promise<CaptureDevice[]>;
  }, []);

  /**
   * updates maximum bandwidth for the video track. This value directly translates
   * to quality of the stream and the amount of RTP packets being sent. In case simulcast
   * is enabled bandwidth is split between all of the variant streams proportionally to
   * their resolution.
   * @param BandwidthLimit to set
   */
  const setVideoTrackBandwidth = async (bandwidth: BandwidthLimit) => {
    await MembraneWebRTCModule.setVideoTrackBandwidth(bandwidth);
  };

  return {
    isCameraOn,
    simulcastConfig,
    toggleCamera,
    startCamera,
    flipCamera,
    switchCamera,
    getCaptureDevices,
    toggleVideoTrackEncoding,
    setVideoTrackEncodingBandwidth,
    setVideoTrackBandwidth,
  };
}

/**
 * This hook can toggle microphone on/off and provides current microphone state.
 */
export function useMicrophone() {
  const [isMicrophoneOn, setIsMicrophoneOn] = useState<boolean>(false);

  useEffect(() => {
    const eventListener = eventEmitter.addListener<IsMicrophoneOnEvent>(
      'IsMicrophoneOn',
      (event) => setIsMicrophoneOn(event)
    );
    setIsMicrophoneOn(MembraneWebRTCModule.isMicrophoneOn);
    return () => eventListener.remove();
  }, []);

  /**
   * Function to toggle microphone on/off
   */
  const toggleMicrophone = useCallback(async () => {
    const state = await MembraneWebRTCModule.toggleMicrophone();
    setIsMicrophoneOn(state);
  }, []);

  /**
   * Starts local microphone capturing.
   * @param config configuration of the microphone capture
   * @returns A promise that resolves when microphone capturing is started.
   */
  const startMicrophone = useCallback(
    async <MicrophoneConfigMetadataType extends Metadata>(
      config: Partial<MicrophoneConfig<MicrophoneConfigMetadataType>> = {}
    ) => {
      await MembraneWebRTCModule.startMicrophone(config);
    },
    []
  );

  return {
    isMicrophoneOn,
    toggleMicrophone,
    startMicrophone,
  };
}
export function useSoundDetection() {
  const [isSoundDetected, setIsSoundDetected] = useState<boolean>(false);
  const [soundVolume, setIsSoundVolumeChanged] = useState<number>(0);

  useEffect(() => {
    const eventListener = eventEmitter.addListener<isSoundDetectedEvent>(
      'SoundDetectedEvent',
      (event) => {
        const { SoundDetectedEvent } = event;
        if (typeof SoundDetectedEvent === 'boolean') {
          setIsSoundDetected(SoundDetectedEvent);
        }
      }
    );
    setIsSoundDetected(MembraneWebRTCModule.isSoundDetected);
    return () => eventListener.remove();
  }, []);

  useEffect(() => {
    const eventListener = eventEmitter.addListener<soundVolume>(
      'SoundVolumeChanged',
      (event) => {
        const { SoundVolumeChanged } = event;
        if (typeof SoundVolumeChanged === 'number') {
          setIsSoundVolumeChanged(SoundVolumeChanged);
        }
      }
    );
    setIsSoundVolumeChanged(MembraneWebRTCModule.soundVolume);
    return () => eventListener.remove();
  }, []);

  /**
   * Starts local sound detection.
   * @param monitorInterval (Android only) the time (in milliseconds) between consecutive executions of the task
   * @param samplingRate (Android only) it specifies how many audio samples are taken per second to digitize the analog audio signal
   * @param volumeThreshold is a threshold value specified in decibels (dB) that acts as a reference level
   * @returns A promise that resolves when sound detection is started.
   */
  const startSoundDetection = useCallback(
    async (
      monitorInterval = 1,
      samplingRate = 22050,
      volumeThreshold = -60
    ) => {
      await MembraneWebRTCModule.startSoundDetection(
        monitorInterval,
        samplingRate,
        volumeThreshold
      );
    },
    []
  );

  /**
   * Stops sound detection.
   * @returns A promise that resolves when sound detection is stopped.
   */
  const stopSoundDetection = useCallback(async () => {
    await MembraneWebRTCModule.stopSoundDetection();
  }, []);

  return {
    isSoundDetected,
    soundVolume,
    startSoundDetection,
    stopSoundDetection,
  };
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
    const eventListener = eventEmitter.addListener<IsScreencastOnEvent>(
      'IsScreencastOn',
      (event) => {
        setIsScreencastOn(MembraneWebRTCModule.isScreencastOn);
      }
    );
    return () => eventListener.remove();
  }, []);

  /**
   * Toggles the screencast on/off
   */
  const toggleScreencast = useCallback(
    async <ScreencastOptionsMetadataType extends Metadata>(
      screencastOptions: Partial<
        ScreencastOptions<ScreencastOptionsMetadataType>
      > = {}
    ) => {
      await MembraneWebRTCModule.toggleScreencast(screencastOptions);
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
    async <ScreencastMetadataType extends Metadata>(
      metadata: ScreencastMetadataType
    ) => {
      await MembraneWebRTCModule.updateScreencastTrackMetadata(metadata);
    },
    []
  );

  /**
   * Toggles simulcast encoding of a screencast track on/off
   * @param encoding encoding to toggle
   */
  const toggleScreencastTrackEncoding = useCallback(
    async (encoding: TrackEncoding) => {
      screencastSimulcastConfig =
        await MembraneWebRTCModule.toggleScreencastTrackEncoding(encoding);
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
      await MembraneWebRTCModule.setScreencastTrackEncodingBandwidth(
        encoding,
        bandwidth
      );
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
      await MembraneWebRTCModule.setScreencastTrackBandwidth(bandwidth);
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
 * a function that updates endpoints's metadata on the server
 * @param metadata a map `string -> any` containing user's track metadata to be sent to the server
 */
export async function updateEndpointMetadata<
  EndpointMetadataType extends Metadata
>(metadata: EndpointMetadataType) {
  await MembraneWebRTCModule.updateEndpointMetadata(metadata);
}

/**
 * a function that updates video metadata on the server.
 * @param metadata a map string -> any containing video track metadata to be sent to the server
 */
export async function updateVideoTrackMetadata<
  VideoTrackMetadataType extends Metadata
>(metadata: VideoTrackMetadataType) {
  await MembraneWebRTCModule.updateVideoTrackMetadata(metadata);
}
/**
 * a function that updates audio metadata on the server
 * @param metadata a map `string -> any` containing audio track metadata to be sent to the server
 */
export async function updateAudioTrackMetadata<
  AudioTrackMetadataType extends Metadata
>(metadata: AudioTrackMetadataType) {
  await MembraneWebRTCModule.updateAudioTrackMetadata(metadata);
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

  type onAudioDeviceEvent = {
    selectedDevice: AudioOutputDevice;
    availableDevices: AudioOutputDevice[];
  };

  const onAudioDevice = useCallback((event: onAudioDeviceEvent) => {
    setSelectedAudioOutputDevice(event.selectedDevice);
    setAvailableDevices(event.availableDevices);
  }, []);

  useEffect(() => {
    const eventListener = eventEmitter.addListener(
      'AudioDeviceUpdate',
      onAudioDevice
    );
    MembraneWebRTCModule.startAudioSwitcher();
    return () => {
      eventListener.remove();
      if (Platform.OS === 'android') {
        MembraneWebRTCModule.stopAudioSwitcher();
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
      await MembraneWebRTCModule.setOutputAudioDevice(device);
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
      await MembraneWebRTCModule.selectAudioSessionMode(audioSessionMode);
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
    await MembraneWebRTCModule.showAudioRoutePicker();
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
 * Function that changes level of debugging logs in WebRTC.
 * @param severity to use when displaying logs
 * @returns a promise that is resolved when debug severity is changed
 */
export function changeWebRTCLoggingSeverity(
  severity: LoggingSeverity
): Promise<void> {
  return MembraneWebRTCModule.changeWebRTCLoggingSeverity(severity);
}

/**
 * This hook provides current bandwidth estimation
 * estimation - client's available incoming bitrate estimated
 * by the server. It's measured in bits per second.
 */
export function useBandwidthEstimation() {
  const [estimation, setEstimation] = useState<number | null>(null);

  useEffect(() => {
    const eventListener = eventEmitter.addListener<BandwidthEstimationEvent>(
      'BandwidthEstimation',
      (estimation) => setEstimation(estimation)
    );
    return () => eventListener.remove();
  }, []);

  return { estimation };
}

/**
 * This hook provides access to current rtc statistics data.
 */
export function useRTCStatistics(refreshInterval: number) {
  const MAX_SIZE = 120;
  const [statistics, setStatistics] = useState<RTCStats[]>([]);

  useEffect(() => {
    const intervalId = setInterval(getStatistics, refreshInterval);
    return () => {
      clearInterval(intervalId);
      setStatistics([]);
    };
  }, []);

  // Gets stats from the native libraries.
  const getStatistics = useCallback(async () => {
    const stats = await MembraneWebRTCModule.getStatistics();
    setStatistics((prev) => {
      const newStats = [...prev, processIncomingStats(prev, stats)];
      takeRight(newStats, MAX_SIZE);
      return newStats;
    });
  }, []);

  // Calculates diff between pervious and current stats,
  // providing end users with a per second metric.
  const processIncomingStats = useCallback(
    (statistics: RTCStats[], stats: RTCStats) => {
      Object.keys(stats).forEach((obj) => {
        if (obj.includes('Inbound')) {
          const rtcStats = stats[obj] as RTCInboundStats;

          if (
            statistics.length > 0 &&
            Object.keys(statistics[statistics.length - 1]).includes(obj)
          ) {
            const prevRtcStats = statistics[statistics.length - 1][
              obj
            ] as RTCInboundStats;

            rtcStats['packetsLost/s'] =
              rtcStats['packetsLost'] - prevRtcStats['packetsLost'];
            rtcStats['packetsReceived/s'] =
              rtcStats['packetsReceived'] - prevRtcStats['packetsReceived'];
            rtcStats['bytesReceived/s'] =
              rtcStats['bytesReceived'] - prevRtcStats['bytesReceived'];
            rtcStats['framesReceived/s'] =
              rtcStats['framesReceived'] - prevRtcStats['framesReceived'];
            rtcStats['framesDropped/s'] =
              rtcStats['framesDropped'] - prevRtcStats['framesDropped'];
          } else {
            rtcStats['packetsLost/s'] = 0;
            rtcStats['packetsReceived/s'] = 0;
            rtcStats['bytesReceived/s'] = 0;
            rtcStats['framesReceived/s'] = 0;
            rtcStats['framesDropped/s'] = 0;
          }
          return stats;
        }
        // Outbound
        const rtcStats = stats[obj] as RTCOutboundStats;

        if (
          statistics.length > 0 &&
          Object.keys(statistics[statistics.length - 1]).includes(obj)
        ) {
          const prevRtcStats = statistics[statistics.length - 1][
            obj
          ] as RTCOutboundStats;

          rtcStats['bytesSent/s'] =
            rtcStats['bytesSent'] - prevRtcStats['bytesSent'];
          rtcStats['packetsSent/s'] =
            rtcStats['packetsSent'] - prevRtcStats['packetsSent'];
          rtcStats['framesEncoded/s'] =
            rtcStats['framesEncoded'] - prevRtcStats['framesEncoded'];
        } else {
          rtcStats['bytesSent/s'] = 0;
          rtcStats['packetsSent/s'] = 0;
          rtcStats['framesEncoded/s'] = 0;
        }
        return stats;
      });
      return stats;
    },
    []
  );

  return { statistics };
}

export { VideoPreviewView, VideoRendererView };
export * from './MembraneWebRTC.types';
