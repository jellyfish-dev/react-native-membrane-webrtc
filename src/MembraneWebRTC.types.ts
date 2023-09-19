import { ViewStyle } from 'react-native';

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

export type Endpoint = {
  /**
   *  id used to identify an endpoint
   */
  id: string;
  /**
   * used to indicate endpoint type.
   */
  type: string;
  /**
   * whether the endpoint is local or remote
   */
  isLocal: boolean;
  /**
   * a map `string -> any` containing endpoint metadata from the server
   */
  metadata: Metadata;
  /**
   * a list of endpoints's video and audio tracks
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
   * a map `string -> any` containing user metadata to be sent to the server. Use it to send for example user display name or other options.
   */
  endpointMetadata: Metadata;

  /**
   *  a map `string -> any` containing connection params passed to the socket.
   */
  connectionParams: SocketConnectionParams;
  /**
   * a map `string -> any` containing params passed to the socket channel.
   */
  socketChannelParams: SocketChannelParams;
};

export type CameraConfig = {
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
   * a map `string -> any` containing video track metadata to be sent to the server.
   */
  videoTrackMetadata: Metadata;
  /**
   *  SimulcastConfig of a video track. By default simulcast is disabled.
   */
  simulcastConfig: SimulcastConfig;
  /**
   *  bandwidth limit of a video track. By default there is no bandwidth limit.
   */
  maxBandwidth: TrackBandwidthLimit;
  /**
   * whether the camera track is initially enabled, you can toggle it on/off later with toggleCamera method
   * @default `true`
   */
  cameraEnabled: boolean;
  /**
   * id of the camera to start capture with. Get available cameras with `getCaptureDevices()`.
   * You can switch the cameras later with `flipCamera`/`switchCamera` functions.
   * @default the first front camera
   */
  captureDeviceId: string;
};

export type MicrophoneConfig = {
  /**
   * a map `string -> any` containing audio track metadata to be sent to the server.
   */
  audioTrackMetadata: Metadata;
  /**
   * whether the microphone is initially enabled, you can toggle it on/off later with toggleMicrophone method
   * @default `true`
   */
  microphoneEnabled: boolean;
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

/**
 * A record of the total time, in seconds,
 * that this stream has spent in each quality limitation state.
 * none: The resolution and/or framerate is not limited.
 * bandwidth: The resolution and/or framerate is primarily limited due to
 * congestion cues during bandwidth estimation.
 * Typical, congestion control algorithms use inter-arrival time,
 * round-trip time, packet or other congestion cues to perform bandwidth estimation.
 * cpu: The resolution and/or framerate is primarily limited due to CPU load.
 * other: The resolution and/or framerate is primarily limited
 * for a reason other than the above.
 */
export type QualityLimitationDurations = {
  bandwidth: number;
  cpu: number;
  none: number;
  other: number;
};

export type RTCOutboundStats = {
  'kind': string;
  'rid': string;
  'bytesSent': number;
  'targetBitrate': number;
  'packetsSent': number;
  'framesEncoded': number;
  'framesPerSecond': number;
  'frameWidth': number;
  'frameHeight': number;
  'qualityLimitationDurations': QualityLimitationDurations;
  'bytesSent/s': number;
  'packetsSent/s': number;
  'framesEncoded/s': number;
};

export type RTCInboundStats = {
  'kind': number;
  'jitter': number;
  'packetsLost': number;
  'packetsReceived': number;
  'bytesReceived': number;
  'framesReceived': number;
  'frameWidth': number;
  'frameHeight': number;
  'framesPerSecond': number;
  'framesDropped': number;
  'packetsLost/s': number;
  'packetsReceived/s': number;
  'bytesReceived/s': number;
  'framesReceived/s': number;
  'framesDropped/s': number;
};

export type RTCTrackStats = RTCOutboundStats | RTCInboundStats;

export type RTCStats = { [key: string]: RTCTrackStats };

export type EndpointsUpdateEvent = {
  endpoints: Endpoint[];
};

export type IsCameraOnEvent = boolean;

export type IsMicrophoneOnEvent = boolean;

export type isSoundDetectedEvent = boolean;

export type soundVolume = number;

export type IsScreencastOnEvent = boolean;

export type SimulcastConfigUpdateEvent = SimulcastConfig;

export type BandwidthEstimationEvent = number;

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
  style?: ViewStyle;
  /**
   * Id of the camera used for preview. Get available cameras with `getCaptureDevices()` function.
   * @default the first front camera
   */
  captureDeviceId?: string;
};

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
  style?: ViewStyle;
};
