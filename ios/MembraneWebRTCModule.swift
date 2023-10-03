import ExpoModulesCore

struct RNSimulcastConfig: Record {
  @Field
  var enabled: Bool = false

  @Field
  var activeEncodings: [String] = []
}

struct CameraConfig: Record {
  @Field
  var quality: String = "VGA169"

  @Field
  var flipVideo: Bool = false

  @Field
  var videoTrackMetadata: [String: Any] = [:]

  @Field
  var simulcastConfig: RNSimulcastConfig = RNSimulcastConfig()

  @Field
  var maxBandwidth: RNTrackBandwidthLimit = RNTrackBandwidthLimit(0)

  @Field
  var cameraEnabled: Bool = true

  @Field
  var captureDeviceId: String? = nil
}

struct MicrophoneConfig: Record {
  @Field
  var audioTrackMetadata: [String: Any] = [:]

  @Field
  var microphoneEnabled: Bool = true
}

struct ScreencastOptions: Record {
  @Field
  var quality: String = "HD15"

  @Field
  var screencastMetadata: [String: Any] = [:]

  @Field
  var simulcastConfig: RNSimulcastConfig = RNSimulcastConfig()

  @Field
  var maxBandwidth: RNTrackBandwidthLimit = RNTrackBandwidthLimit(0)
}

typealias RNTrackBandwidthLimit = Either<Int, [String: Int]>

public class MembraneWebRTCModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MembraneWebRTC")

    Events(
      "IsCameraOn",
      "IsMicrophoneOn",
      "SoundDetectedEvent",
      "SoundVolumeChanged",
      "IsScreencastOn",
      "SimulcastConfigUpdate",
      "EndpointsUpdate",
      "AudioDeviceUpdate",
      "SendMediaEvent",
      "BandwidthEstimation")

    let membraneWebRTC: MembraneWebRTC = MembraneWebRTC {
      (eventName: String, data: [String: Any]) in
      self.sendEvent(eventName, data)
    }

    AsyncFunction("create") {
      membraneWebRTC.create()
    }

    AsyncFunction("connect") { (endpointMetadata: [String: Any], promise: Promise) in
      membraneWebRTC.connect(metadata: endpointMetadata, promise: promise)
    }

    AsyncFunction("disconnect") {
      membraneWebRTC.disconnect()
    }

    AsyncFunction("receiveMediaEvent") { (data: String) in
      try membraneWebRTC.receiveMediaEvent(data: data)
    }

    AsyncFunction("startCamera") { (config: CameraConfig) in
      try membraneWebRTC.startCamera(config: config)
    }

    AsyncFunction("startMicrophone") { (config: MicrophoneConfig) in
      try membraneWebRTC.startMicrophone(config: config)
    }

    Property("isMicrophoneOn") {
      return membraneWebRTC.isMicEnabled
    }

    AsyncFunction("startSoundDetection") {
      (
        monitorInterval: Int,
        samplingRate: Int, volumeThreshold: Int
      ) in
      try membraneWebRTC.startSoundDetection(volumeThreshold: volumeThreshold)
    }

    AsyncFunction("stopSoundDetection") {
      try membraneWebRTC.stopSoundDetection()
    }

    Property("isSoundDetectionOn") {
      return membraneWebRTC.isSoundDetectionOn
    }

    AsyncFunction("toggleMicrophone") {
      try membraneWebRTC.toggleMicrophone()
    }

    Property("IsCameraOn") {
      return membraneWebRTC.isCameraEnabled
    }

    AsyncFunction("toggleCamera") {
      try membraneWebRTC.toggleCamera()
    }

    AsyncFunction("flipCamera") {
      try membraneWebRTC.flipCamera()
    }

    AsyncFunction("switchCamera") { (captureDeviceId: String) in
      try membraneWebRTC.switchCamera(captureDeviceId: captureDeviceId)
    }

    AsyncFunction("getCaptureDevices") {
      membraneWebRTC.getCaptureDevices()
    }

    AsyncFunction("toggleScreencast") { (screencastOptions: ScreencastOptions) in
      try membraneWebRTC.toggleScreencast(screencastOptions: screencastOptions)
    }

    AsyncFunction("getEndpoints") {
      membraneWebRTC.getEndpoints()
    }

    AsyncFunction("updateEndpointsMetadata") { (metadata: [String: Any]) in
      try membraneWebRTC.updateEndpointMetadata(metadata: metadata)
    }

    AsyncFunction("updateVideoTrackMetadata") { (metadata: [String: Any]) in
      try membraneWebRTC.updateVideoTrackMetadata(metadata: metadata)
    }

    AsyncFunction("updateAudioTrackMetadata") { (metadata: [String: Any]) in
      try membraneWebRTC.updateAudioTrackMetadata(metadata: metadata)
    }

    AsyncFunction("updateScreencastTrackMetadata") { (metadata: [String: Any]) in
      try membraneWebRTC.updateScreencastTrackMetadata(metadata: metadata)
    }

    AsyncFunction("toggleScreencastTrackEncoding") { (encoding: String) in
      try membraneWebRTC.toggleScreencastTrackEncoding(encoding: encoding)
    }

    AsyncFunction("setScreencastTrackBandwidth") { (bandwidth: Int) in
      try membraneWebRTC.setScreencastTrackBandwidth(bandwidth: bandwidth)
    }

    AsyncFunction("setTargetTrackEncoding") { (trackId: String, encoding: String) in
      try membraneWebRTC.setTargetTrackEncoding(trackId: trackId, encoding: encoding)
    }

    AsyncFunction("toggleVideoTrackEncoding") { (encoding: String) in
      try membraneWebRTC.toggleVideoTrackEncoding(encoding: encoding)
    }

    AsyncFunction("setVideoTrackEncodingBandwidth") { (encoding: String, bandwidth: Int) in
      try membraneWebRTC.setVideoTrackEncodingBandwidth(encoding: encoding, bandwidth: bandwidth)
    }

    AsyncFunction("setVideoTrackBandwidth") { (bandwidth: Int) in
      try membraneWebRTC.setVideoTrackBandwidth(bandwidth: bandwidth)
    }

    AsyncFunction("changeWebRTCLoggingSeverity") { (severity: String) in
      try membraneWebRTC.changeWebRTCLoggingSeverity(severity: severity)
    }

    AsyncFunction("getStatistics") {
      membraneWebRTC.getStatistics()
    }

    AsyncFunction("selectAudioSessionMode") { (sessionMode: String) in
      try membraneWebRTC.selectAudioSessionMode(sessionMode: sessionMode)
    }

    AsyncFunction("showAudioRoutePicker") { () in
      membraneWebRTC.showAudioRoutePicker()
    }

    AsyncFunction("startAudioSwitcher") {
      membraneWebRTC.startAudioSwitcher()
    }
  }
}
