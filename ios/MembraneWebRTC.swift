import AVKit
import ExpoModulesCore
import MembraneRTC
import React
import ReplayKit
import WebRTC

#if os(iOS)
  @available(iOS 12, *)
  extension RPSystemBroadcastPickerView {
    public static func show(
      for preferredExtension: String? = nil, showsMicrophoneButton: Bool = false
    ) {
      let view = RPSystemBroadcastPickerView()
      view.preferredExtension = preferredExtension
      view.showsMicrophoneButton = showsMicrophoneButton
      let selector = NSSelectorFromString("buttonPressed:")
      if view.responds(to: selector) {
        view.perform(selector, with: nil)
      }
    }
  }
#endif

extension [String: Any] {
  public func toMetadata() -> Metadata {
    var res: Metadata = .init()
    self.forEach { entry in
      res[entry.key] = entry.value
    }
    return res
  }
}

extension AnyJson {
  public func toDict() -> [String: Any] {
    var res: [String: Any] = [:]
    self.keys.forEach { key in
      res[key] = self[key]
    }
    return res
  }
}

extension String: Error {}

extension String {
  public func toTrackEncoding() -> TrackEncoding? {
    switch self {
    case "l":
      return TrackEncoding.l
    case "m":
      return TrackEncoding.m
    case "h":
      return TrackEncoding.h
    default:
      return nil
    }
  }
}

class MembraneWebRTC: MembraneRTCDelegate {
  var room: MembraneRTC? = nil

  var localAudioTrack: LocalAudioTrack?
  var localVideoTrack: LocalVideoTrack?
  var localScreencastTrack: LocalScreenBroadcastTrack?
  var localEndpointId: String?

  var isMicEnabled: Bool = true
  var isCameraEnabled: Bool = true
  var isScreensharingEnabled: Bool = false
  var isSoundDetectionOn: Bool = false

  var globalToLocalTrackId: [String: String] = [:]

  var connectPromise: Promise? = nil

  var videoSimulcastConfig: SimulcastConfig = SimulcastConfig()

  var localUserMetadata: Metadata = .init()

  var screenshareSimulcastConfig: SimulcastConfig = SimulcastConfig()
  var screenshareBandwidthLimit: TrackBandwidthLimit = .BandwidthLimit(0)

  var tracksContexts: [String: TrackContext] = [:]

  var errorMessage: String?

  var captureDeviceId: String? = nil

  var audioSessionMode: AVAudioSession.Mode = AVAudioSession.Mode.videoChat
  var soundDetection: SoundDetection? = nil

  let sendEvent: (_ eventName: String, _ data: [String: Any]) -> Void

  init(sendEvent: @escaping (_ eventName: String, _ data: [String: Any]) -> Void) {
    self.sendEvent = sendEvent
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(onRouteChangeNotification),
      name: AVAudioSession.routeChangeNotification,
      object: nil
    )
  }

  private func getGlobalTrackId(localTrackId: String) -> String? {
    return globalToLocalTrackId.filter { $0.value == localTrackId }.first?.key
  }

  private func getSimulcastConfigFrom(simulcastConfig: RNSimulcastConfig) throws -> SimulcastConfig?
  {
    var activeEncodings: [TrackEncoding] = []
    try simulcastConfig.activeEncodings.forEach({ e in
      activeEncodings.append(try validateEncoding(encoding: e))
    })
    return SimulcastConfig(
      enabled: simulcastConfig.enabled,
      activeEncodings: activeEncodings
    )
  }

  private func getBandwidthLimitFrom(maxBandwidth: RNTrackBandwidthLimit) -> TrackBandwidthLimit {
    if let maxBandwidth: Int = maxBandwidth.get() {
      return .BandwidthLimit(maxBandwidth)
    } else if let maxBandwidth: [String: Int] = maxBandwidth.get() {
      return .SimulcastBandwidthLimit(maxBandwidth)
    }
    return .BandwidthLimit(0)
  }

  private func ensureConnected() throws {
    if room == nil {
      throw Exception(
        name: "E_NOT_CONNECTED",
        description: "Client not connected to server yet. Make sure to call connect() first!")
    }
  }

  private func ensureVideoTrack() throws {
    if room == nil {
      throw Exception(
        name: "E_NO_LOCAL_VIDEO_TRACK",
        description: "No local video track. Make sure to call connect() first!")
    }
  }

  private func ensureAudioTrack() throws {
    if room == nil {
      throw Exception(
        name: "E_NO_LOCAL_AUDIO_TRACK",
        description: "No local audio track. Make sure to call connect() first!")
    }
  }

  private func ensureScreencastTrack() throws {
    if room == nil {
      throw Exception(
        name: "E_NO_LOCAL_SCREENCAST_TRACK",
        description: "No local screencast track. Make sure to toggle screencast on first!")
    }
  }

  private func validateEncoding(encoding: String) throws -> TrackEncoding {
    let trackEncoding = encoding.toTrackEncoding()
    guard let trackEncoding = trackEncoding else {
      throw Exception(
        name: "E_INVALID_ENCODING", description: "Invalid track encoding specified: \(encoding)")
    }
    return trackEncoding
  }

  func create() {
    let room = MembraneRTC.create(delegate: self)
    self.room = room

    let localEndpointId = UUID().uuidString
    self.localEndpointId = localEndpointId

    let localEndpoint = RNEndpoint(
      id: localEndpointId,
      metadata: Metadata(),
      type: "webrtc")

    MembraneRoom.sharedInstance.endpoints[localEndpointId] = localEndpoint
  }

  func getVideoParametersFromOptions(connectionOptions: CameraConfig) -> VideoParameters {
    let videoQuality = connectionOptions.quality
    let flipVideo = connectionOptions.flipVideo
    let videoBandwidthLimit = getBandwidthLimitFrom(maxBandwidth: connectionOptions.maxBandwidth)

    let preset: VideoParameters = {
      switch videoQuality {
      case "QVGA169":
        return VideoParameters.presetQVGA169
      case "VGA169":
        return VideoParameters.presetVGA169
      case "VQHD169":
        return VideoParameters.presetQHD169
      case "HD169":
        return VideoParameters.presetHD169
      case "FHD169":
        return VideoParameters.presetFHD169
      case "QVGA43":
        return VideoParameters.presetQVGA43
      case "VGA43":
        return VideoParameters.presetVGA43
      case "VQHD43":
        return VideoParameters.presetQHD43
      case "HD43":
        return VideoParameters.presetHD43
      case "FHD43":
        return VideoParameters.presetFHD43
      default:
        return VideoParameters.presetVGA169
      }
    }()
    let videoParameters = VideoParameters(
      dimensions: flipVideo ? preset.dimensions.flip() : preset.dimensions,
      maxBandwidth: videoBandwidthLimit,
      simulcastConfig: self.videoSimulcastConfig
    )
    return videoParameters
  }

  func connect(metadata: [String: Any], promise: Promise) {
    self.localUserMetadata = metadata.toMetadata()
    if let localEndpointId = localEndpointId {
      MembraneRoom.sharedInstance.endpoints[localEndpointId]?.metadata = metadata.toMetadata()
    }
    connectPromise = promise
    room?.connect(metadata: metadata.toMetadata())
  }

  func disconnect() {
    if isScreensharingEnabled {
      let screencastExtensionBundleId =
        Bundle.main.infoDictionary?["ScreencastExtensionBundleId"] as? String
      DispatchQueue.main.async {
        RPSystemBroadcastPickerView.show(for: screencastExtensionBundleId)
      }
    }
    room?.remove(delegate: self)
    room?.disconnect()
    room = nil
    MembraneRoom.sharedInstance.endpoints = [:]
  }

  func onSoundDetected(sound: Bool) {
    emitEvent(name: "SoundDetectedEvent", data: ["SoundDetectedEvent": sound])
  }

  func onSoundVolumeChanged(volume: Int) {
    emitEvent(name: "SoundVolumeChanged", data: ["SoundVolumeChanged": volume])
  }

  func startSoundDetection(
    monitorInterval: Int = 1,
    samplingRate: Int = 22050, volumeThreshold: Int = -60
  ) throws {
    if soundDetection == nil {
      soundDetection = try SoundDetection()
    }
    if isSoundDetectionOn { return }
    soundDetection?.setOnSoundDetectedListener(listener: self.onSoundDetected)
    soundDetection?.setOnVolumeChangedListener(listener: self.onSoundVolumeChanged)
    try soundDetection?.start(-volumeThreshold)
    if soundDetection?.isRecording == true {
      isSoundDetectionOn = true
    }
  }

  func stopSoundDetection() {
    if !isSoundDetectionOn { return }
    soundDetection?.stop()
    isSoundDetectionOn = false
  }

  func startCamera(config: CameraConfig) throws {
    try ensureConnected()
    let videoTrackMetadata = config.videoTrackMetadata.toMetadata()
    self.isCameraEnabled = config.cameraEnabled
    let captureDeviceId = config.captureDeviceId

    guard
      let videoSimulcastConfig = try getSimulcastConfigFrom(simulcastConfig: config.simulcastConfig)
    else {
      return
    }
    self.videoSimulcastConfig = videoSimulcastConfig
    let videoParameters = getVideoParametersFromOptions(connectionOptions: config)

    localVideoTrack = room?.createVideoTrack(
      videoParameters: videoParameters, metadata: videoTrackMetadata,
      captureDeviceId: captureDeviceId)
    localVideoTrack?.setEnabled(isCameraEnabled)

    if let localVideoTrack = localVideoTrack,
      let localEndpointId = localEndpointId
    {
      MembraneRoom.sharedInstance.endpoints[localEndpointId]?.videoTracks = [
        localVideoTrack.trackId(): localVideoTrack
      ]
      MembraneRoom.sharedInstance.endpoints[localEndpointId]?.tracksMetadata[
        localVideoTrack.trackId()] = videoTrackMetadata
    }
    emitEndpoints()
  }

  func startMicrophone(config: MicrophoneConfig) throws {
    try ensureConnected()
    let audioTrackMetadata = config.audioTrackMetadata.toMetadata()
    self.isMicEnabled = config.microphoneEnabled
    localAudioTrack = room?.createAudioTrack(metadata: audioTrackMetadata)
    localAudioTrack?.setEnabled(isMicEnabled)
    setAudioSessionMode()

    if let localAudioTrack = localAudioTrack,
      let localEndpointId = localEndpointId
    {
      MembraneRoom.sharedInstance.endpoints[localEndpointId]?.audioTracks = [
        localAudioTrack.trackId(): localAudioTrack
      ]
      MembraneRoom.sharedInstance.endpoints[localEndpointId]?.tracksMetadata[
        localAudioTrack.trackId()] = audioTrackMetadata
    }
    emitEndpoints()
  }

  func receiveMediaEvent(data: String) throws {
    try ensureConnected()
    room?.receiveMediaEvent(mediaEvent: data as SerializedMediaEvent)
  }

  func toggleScreencast(screencastOptions: ScreencastOptions) throws {
    let screencastExtensionBundleId =
      Bundle.main.infoDictionary?["ScreencastExtensionBundleId"] as? String
    if screencastExtensionBundleId == nil {
      throw Exception(
        name: "E_NO_BUNDLE_ID_SET",
        description:
          "No screencast extension bundle id set. Please set ScreencastExtensionBundleId in Info.plist"
      )
    }
    let appGroupName = Bundle.main.infoDictionary?["AppGroupName"] as? String
    if appGroupName == nil {
      throw Exception(
        name: "E_NO_APP_GROUP_SET",
        description: "No app group name set. Please set AppGroupName in Info.plist")
    }
    guard let screencastExtensionBundleId = screencastExtensionBundleId,
      let appGroupName = appGroupName
    else {
      return
    }

    // if screensharing is enabled it must be closed by the Broadcast Extension, not by our application
    // the only thing we can do is to display stop recording button, which we already do
    guard isScreensharingEnabled == false else {
      DispatchQueue.main.async {
        RPSystemBroadcastPickerView.show(for: screencastExtensionBundleId)
      }
      return
    }
    try ensureConnected()
    guard let room = room else {
      return
    }

    let preset: VideoParameters = {
      switch screencastOptions.quality {
      case "VGA":
        return VideoParameters.presetScreenShareVGA
      case "HD5":
        return VideoParameters.presetScreenShareHD5
      case "HD15":
        return VideoParameters.presetScreenShareHD15
      case "FHD15":
        return VideoParameters.presetScreenShareFHD15
      case "FHD30":
        return VideoParameters.presetScreenShareFHD30
      default:
        return VideoParameters.presetScreenShareHD15
      }
    }()
    guard
      let screenshareSimulcastConfig = try getSimulcastConfigFrom(
        simulcastConfig: screencastOptions.simulcastConfig)
    else {
      return
    }
    self.screenshareSimulcastConfig = screenshareSimulcastConfig
    screenshareBandwidthLimit = getBandwidthLimitFrom(maxBandwidth: screencastOptions.maxBandwidth)
    let videoParameters = VideoParameters(
      dimensions: preset.dimensions.flip(),
      maxBandwidth: screenshareBandwidthLimit,
      maxFps: preset.maxFps,
      simulcastConfig: screenshareSimulcastConfig
    )

    let screencastMetadata = screencastOptions.screencastMetadata.toMetadata()

    self.localScreencastTrack = room.createScreencastTrack(
      appGroup: appGroupName, videoParameters: videoParameters, metadata: screencastMetadata,
      onStart: { [weak self] screencastTrack in
        guard let self = self else {
          DispatchQueue.main.async {
            RPSystemBroadcastPickerView.show(for: screencastExtensionBundleId)
          }
          return
        }

        guard let localEndpointId = self.localEndpointId,
          let screencastTrackId = self.localScreencastTrack?.trackId()
        else {
          return
        }

        MembraneRoom.sharedInstance.endpoints[localEndpointId]?.videoTracks[screencastTrackId] =
          screencastTrack
        MembraneRoom.sharedInstance.endpoints[localEndpointId]?.tracksMetadata[screencastTrackId] =
          screencastMetadata

        self.isScreensharingEnabled = true
        self.emitEvent(name: "IsScreencastOn", data: ["isScreencastOn": true])
        self.emitEndpoints()
      },
      onStop: { [weak self] in
        guard let self = self else {
          return
        }

        guard let localEndpointId = self.localEndpointId,
          let screencastTrackId = self.localScreencastTrack?.trackId()
        else {
          return
        }

        let localEndpoint = MembraneRoom.sharedInstance.endpoints[localEndpointId]
        MembraneRoom.sharedInstance.endpoints[localEndpointId] = localEndpoint?.removeTrack(
          trackId: screencastTrackId)
        room.removeTrack(trackId: screencastTrackId)
        self.localScreencastTrack = nil

        self.isScreensharingEnabled = false
        self.emitEvent(name: "IsScreencastOn", data: ["isScreencastOn": false])
        self.emitEndpoints()
      })
    DispatchQueue.main.async {
      RPSystemBroadcastPickerView.show(for: screencastExtensionBundleId)
    }
  }

  func getEndpointsForRN() -> [String: [[String: Any]]] {
    return [
      "endpoints": MembraneRoom.sharedInstance.endpoints.values.sorted(by: { $0.order < $1.order })
        .map {
          (p) -> Dictionary in
          let videoTracks = p.videoTracks.keys.map { trackId in
            [
              "id": trackId,
              "type": "Video",
              "metadata": p.tracksMetadata[trackId]?.toDict() ?? [:],
              "encoding": tracksContexts[trackId]?.encoding?.description as Any,
              "encodingReason": tracksContexts[trackId]?.encodingReason?.rawValue as Any,
            ]
          }

          let audioTracks = p.audioTracks.keys.map { trackId in
            [
              "id": trackId,
              "type": "Audio",
              "metadata": p.tracksMetadata[trackId]?.toDict() ?? [:],
              "vadStatus": tracksContexts[trackId]?.vadStatus.rawValue as Any,
            ]
          }

          return [
            "id": p.id,
            "metadata": p.metadata.toDict(),
            "tracks": videoTracks + audioTracks,
            "isLocal": p.id == localEndpointId,
            "type": p.type,
          ]
        }
    ]
  }

  func getSimulcastConfigAsRNMap(simulcastConfig: SimulcastConfig) -> [String: Any] {
    return [
      "enabled": simulcastConfig.enabled,
      "activeEncodings": simulcastConfig.activeEncodings.map { e in e.description },
    ]
  }

  func getEndpoints() -> [String: [[String: Any]]] {
    return getEndpointsForRN()
  }

  func toggleCamera() throws -> Bool {
    try ensureVideoTrack()
    isCameraEnabled = !isCameraEnabled
    localVideoTrack?.setEnabled(isCameraEnabled)
    return isCameraEnabled
  }

  func toggleMicrophone() throws -> Bool {
    try ensureAudioTrack()
    isMicEnabled = !isMicEnabled
    localAudioTrack?.setEnabled(isMicEnabled)
    return isMicEnabled
  }

  func flipCamera() throws {
    try ensureVideoTrack()
    guard let cameraTrack = localVideoTrack as? LocalCameraVideoTrack else {
      return
    }

    cameraTrack.switchCamera()
  }

  func switchCamera(captureDeviceId: String) throws {
    try ensureVideoTrack()
    guard let cameraTrack = localVideoTrack as? LocalCameraVideoTrack else {
      return
    }

    cameraTrack.switchCamera(deviceId: captureDeviceId as String)
  }

  func getCaptureDevices() -> [[String: Any]] {
    let devices = LocalCameraVideoTrack.getCaptureDevices()
    var rnArray: [[String: Any]] = []
    devices.forEach { device in
      rnArray.append([
        "id": device.uniqueID,
        "name": device.localizedName,
        "isFrontFacing": device.position == .front,
        "isBackFacing": device.position == .back,
      ])
    }
    return rnArray
  }

  func updateEndpointMetadata(metadata: [String: Any]) throws {
    try ensureConnected()
    room?.updateEndpointMetadata(metadata: metadata.toMetadata())
  }

  func updateTrackMetadata(trackId: String, metadata: [String: Any]) {
    guard let room = room, let endpointId = localEndpointId else {
      return
    }

    room.updateTrackMetadata(trackId: trackId, trackMetadata: metadata.toMetadata())
    MembraneRoom.sharedInstance.endpoints[endpointId]?.tracksMetadata[trackId] =
      metadata.toMetadata()
    emitEndpoints()
  }

  func updateVideoTrackMetadata(metadata: [String: Any]) throws {
    try ensureVideoTrack()
    guard let trackId = localVideoTrack?.trackId() else {
      return
    }

    updateTrackMetadata(trackId: trackId, metadata: metadata)
  }

  func updateAudioTrackMetadata(metadata: [String: Any]) throws {
    try ensureAudioTrack()
    guard let trackId = localAudioTrack?.trackId() else {
      return
    }

    updateTrackMetadata(trackId: trackId, metadata: metadata)
  }

  func updateScreencastTrackMetadata(metadata: [String: Any]) throws {
    try ensureScreencastTrack()
    guard let trackId = localScreencastTrack?.trackId() else {
      return
    }

    updateTrackMetadata(trackId: trackId, metadata: metadata)
  }

  private func toggleTrackEncoding(
    encoding: TrackEncoding, trackId: String, simulcastConfig: SimulcastConfig
  ) -> SimulcastConfig? {
    guard let room = room else {
      return nil
    }
    if simulcastConfig.activeEncodings.contains(encoding) {
      room.disableTrackEncoding(trackId: trackId, encoding: encoding)
      return SimulcastConfig(
        enabled: true,
        activeEncodings: simulcastConfig.activeEncodings.filter { e in e != encoding }
      )
    } else {
      room.enableTrackEncoding(trackId: trackId, encoding: encoding)
      return SimulcastConfig(
        enabled: true,
        activeEncodings: simulcastConfig.activeEncodings + [encoding]
      )
    }
  }

  func toggleScreencastTrackEncoding(encoding: String) throws -> [String: Any] {
    try ensureScreencastTrack()
    let trackEncoding = try validateEncoding(encoding: encoding as String)
    guard
      let trackId = localScreencastTrack?.trackId(),
      let simulcastConfig = toggleTrackEncoding(
        encoding: trackEncoding, trackId: trackId, simulcastConfig: screenshareSimulcastConfig)
    else {
      throw Exception(
        name: "E_NOT_CONNECTED",
        description: "Client not connected to server yet. Make sure to call connect() first!")
    }
    self.screenshareSimulcastConfig = simulcastConfig
    return getSimulcastConfigAsRNMap(simulcastConfig: simulcastConfig)
  }

  func setScreencastTrackBandwidth(bandwidth: Int) throws {
    try ensureScreencastTrack()
    guard let room = room, let trackId = localScreencastTrack?.trackId() else {
      return
    }
    room.setTrackBandwidth(trackId: trackId, bandwidth: BandwidthLimit(bandwidth))
  }

  func setScreencastTrackEncodingBandwidth(encoding: String, bandwidth: Int) throws {
    try ensureScreencastTrack()
    let trackEncoding = try validateEncoding(encoding: encoding as String)
    guard let room = room, let trackId = localScreencastTrack?.trackId() else {
      return
    }
    room.setEncodingBandwidth(
      trackId: trackId, encoding: trackEncoding.description, bandwidth: BandwidthLimit(bandwidth))
  }

  func setTargetTrackEncoding(trackId: String, encoding: String) throws {
    try ensureConnected()
    guard
      let room = room,
      let videoTrack = MembraneRoom.sharedInstance.getVideoTrackById(trackId: trackId as String),
      let trackId = (videoTrack as? RemoteVideoTrack)?.track.trackId
        ?? (videoTrack as? LocalVideoTrack)?.trackId(),
      let globalTrackId = getGlobalTrackId(localTrackId: trackId as String)
    else {
      throw Exception(
        name: "E_INVALID_TRACK_ID", description: "Remote track with id=\(trackId) not found")
    }
    let trackEncoding = try validateEncoding(encoding: encoding as String)
    room.setTargetTrackEncoding(trackId: globalTrackId, encoding: trackEncoding)
  }

  func toggleVideoTrackEncoding(encoding: String) throws -> [String: Any] {
    try ensureVideoTrack()
    let trackEncoding = try validateEncoding(encoding: encoding as String)
    guard
      let trackId = localVideoTrack?.trackId(),
      let simulcastConfig = toggleTrackEncoding(
        encoding: trackEncoding, trackId: trackId, simulcastConfig: videoSimulcastConfig)
    else {
      throw Exception(
        name: "E_NOT_CONNECTED",
        description: "Client not connected to server yet. Make sure to call connect() first!")
    }
    self.videoSimulcastConfig = simulcastConfig
    emitEvent(
      name: "SimulcastConfigUpdate",
      data: getSimulcastConfigAsRNMap(simulcastConfig: simulcastConfig))
    return getSimulcastConfigAsRNMap(simulcastConfig: simulcastConfig)
  }

  func setVideoTrackEncodingBandwidth(encoding: String, bandwidth: Int) throws {
    try ensureVideoTrack()
    guard let room = room, let trackId = localVideoTrack?.trackId() else {
      return
    }
    room.setEncodingBandwidth(
      trackId: trackId, encoding: encoding as String, bandwidth: BandwidthLimit(bandwidth))
  }

  func setVideoTrackBandwidth(bandwidth: Int) throws {
    try ensureVideoTrack()
    guard let room = room, let trackId = localVideoTrack?.trackId() else {
      return
    }
    room.setTrackBandwidth(trackId: trackId, bandwidth: BandwidthLimit(bandwidth))
  }

  func changeWebRTCLoggingSeverity(severity: String) throws {
    switch severity {
    case "verbose":
      room?.changeWebRTCLoggingSeverity(severity: .verbose)
    case "info":
      room?.changeWebRTCLoggingSeverity(severity: .info)
    case "warning":
      room?.changeWebRTCLoggingSeverity(severity: .warning)
    case "error":
      room?.changeWebRTCLoggingSeverity(severity: .error)
    case "none":
      room?.changeWebRTCLoggingSeverity(severity: .none)
    default:
      throw Exception(
        name: "E_INVALID_SEVERITY_LEVEL", description: "Severity with name=\(severity) not found")
    }
  }

  private func getMapFromStatsObject(obj: RTCInboundStats) -> [String: Any] {
    var res: [String: Any] = [:]
    res["kind"] = obj.kind
    res["jitter"] = obj.jitter
    res["packetsLost"] = obj.packetsLost
    res["packetsReceived"] = obj.packetsReceived
    res["bytesReceived"] = obj.bytesReceived
    res["framesReceived"] = obj.framesReceived
    res["frameWidth"] = obj.frameWidth
    res["frameHeight"] = obj.frameHeight
    res["framesPerSecond"] = obj.framesPerSecond
    res["framesDropped"] = obj.framesDropped

    return res
  }

  private func getMapFromStatsObject(obj: RTCOutboundStats) -> [String: Any] {
    var innerMap: [String: Double] = [:]

    innerMap["bandwidth"] = obj.qualityLimitationDurations?.bandwidth ?? 0.0
    innerMap["cpu"] = obj.qualityLimitationDurations?.cpu ?? 0.0
    innerMap["none"] = obj.qualityLimitationDurations?.none ?? 0.0
    innerMap["other"] = obj.qualityLimitationDurations?.other ?? 0.0

    var res: [String: Any] = [:]
    res["kind"] = obj.kind
    res["rid"] = obj.rid
    res["bytesSent"] = obj.bytesSent
    res["targetBitrate"] = obj.targetBitrate
    res["packetsSent"] = obj.packetsSent
    res["framesEncoded"] = obj.framesEncoded
    res["framesPerSecond"] = obj.framesPerSecond
    res["frameWidth"] = obj.frameWidth
    res["frameHeight"] = obj.frameHeight
    res["qualityLimitationDurations"] = innerMap

    return res
  }

  private func statsToRNMap(stats: [String: RTCStats]?) -> [String: Any] {
    var res: [String: Any] = [:]
    stats?.forEach { pair in
      if let val = pair.value as? RTCOutboundStats {
        res[pair.key] = getMapFromStatsObject(obj: val)
      } else {
        res[pair.key] = getMapFromStatsObject(obj: pair.value as! RTCInboundStats)
      }
    }
    return res
  }

  func getStatistics() -> [String: Any] {
    return statsToRNMap(stats: room?.getStats())
  }

  func setAudioSessionMode() {
    guard let localAudioTrack = localAudioTrack else {
      return
    }

    switch self.audioSessionMode {
    case AVAudioSession.Mode.videoChat:
      localAudioTrack.setVideoChatMode()
      break
    case AVAudioSession.Mode.voiceChat:
      localAudioTrack.setVoiceChatMode()
      break
    default:
      localAudioTrack.setVideoChatMode()
      break
    }
  }

  func selectAudioSessionMode(sessionMode: String) throws {
    switch sessionMode {
    case "videoChat":
      self.audioSessionMode = AVAudioSession.Mode.videoChat
      break
    case "voiceChat":
      self.audioSessionMode = AVAudioSession.Mode.voiceChat
      break
    default:
      throw Exception(
        name: "E_MEMBRANE_AUDIO_SESSION",
        description:
          "Invalid audio session mode: \(sessionMode). Supported modes: videoChat, voiceChat")
    }
    setAudioSessionMode()
  }

  func showAudioRoutePicker() {
    DispatchQueue.main.sync {
      let pickerView = AVRoutePickerView()
      if let button = pickerView.subviews.first(where: { $0 is UIButton }) as? UIButton {
        button.sendActions(for: .touchUpInside)
      }
    }
  }

  func startAudioSwitcher() {
    onRouteChangeNotification()
  }

  func emitEvent(name: String, data: [String: Any]) {
    sendEvent(name, data)
  }

  func emitEndpoints() {
    emitEvent(name: "EndpointsUpdate", data: getEndpointsForRN())
  }

  @objc func onRouteChangeNotification() {
    let currentRoute = AVAudioSession.sharedInstance().currentRoute
    if currentRoute.outputs.count == 0 { return }
    let output = currentRoute.outputs[0]
    let deviceType = output.portType
    var deviceTypeString: String = ""

    switch deviceType {
    case .bluetoothA2DP, .bluetoothLE, .bluetoothHFP:
      deviceTypeString = "bluetooth"
      break
    case .builtInSpeaker:
      deviceTypeString = "speaker"
      break
    case .builtInReceiver:
      deviceTypeString = "earpiece"
      break
    case .headphones:
      deviceTypeString = "headphones"
      break
    default:
      deviceTypeString = deviceType.rawValue
    }
    emitEvent(
      name: "AudioDeviceUpdate",
      data: [
        "selectedDevice": ["name": output.portName, "type": deviceTypeString],
        "availableDevices": [],
      ] as [String: Any])
  }

  func onSendMediaEvent(event: SerializedMediaEvent) {
    emitEvent(name: "SendMediaEvent", data: ["event": event])
  }

  func onConnected(endpointId: String, otherEndpoints: [Endpoint]) {
    otherEndpoints.forEach { endpoint in
      MembraneRoom.sharedInstance.endpoints[endpoint.id] = RNEndpoint(
        id: endpoint.id, metadata: endpoint.metadata, type: endpoint.type)
    }

    emitEndpoints()
    if let connectPromise = connectPromise {
      connectPromise.resolve(nil)
    }
    connectPromise = nil
  }

  func onConnectionError(metadata: Any) {
    if let connectPromise = connectPromise {
      connectPromise.reject("E_MEMBRANE_CONNECT", "Failed to connect: \(metadata)")
    }
    connectPromise = nil
  }

  func updateOrAddTrack(ctx: TrackContext) {
    guard var endpoint = MembraneRoom.sharedInstance.endpoints[ctx.endpoint.id] else {
      return
    }
    if let audioTrack = ctx.track as? RemoteAudioTrack {
      let localTrackId = (ctx.track as? RemoteAudioTrack)?.track.trackId
      globalToLocalTrackId[ctx.trackId] = localTrackId
      endpoint.audioTracks[audioTrack.track.trackId] = audioTrack
      endpoint.tracksMetadata[audioTrack.track.trackId] = ctx.metadata
      if let localTrackId = localTrackId,
        tracksContexts[localTrackId] == nil
      {
        tracksContexts[localTrackId] = ctx
        ctx.setOnVoiceActivityChangedListener { ctx in
          self.emitEndpoints()
        }
      }
    }

    if let videoTrack = ctx.track as? RemoteVideoTrack {
      let localTrackId = (ctx.track as? RemoteVideoTrack)?.track.trackId
      globalToLocalTrackId[ctx.trackId] = localTrackId
      endpoint.videoTracks[videoTrack.track.trackId] = videoTrack
      endpoint.tracksMetadata[videoTrack.track.trackId] = ctx.metadata
      if let localTrackId = localTrackId,
        tracksContexts[localTrackId] == nil
      {
        tracksContexts[localTrackId] = ctx
        ctx.setOnEncodingChangedListener { ctx in
          self.emitEndpoints()
        }
      }
    }
    MembraneRoom.sharedInstance.endpoints[ctx.endpoint.id] = endpoint
    emitEndpoints()
  }

  func onTrackReady(ctx: TrackContext) {
    updateOrAddTrack(ctx: ctx)
  }

  func onTrackAdded(ctx: TrackContext) {

  }

  func onTrackRemoved(ctx: TrackContext) {
    guard var endpoint = MembraneRoom.sharedInstance.endpoints[ctx.endpoint.id] else {
      return
    }
    if let audioTrack = ctx.track as? RemoteAudioTrack {
      endpoint = endpoint.removeTrack(trackId: audioTrack.track.trackId)
    }
    if let videoTrack = ctx.track as? RemoteVideoTrack {
      endpoint = endpoint.removeTrack(trackId: videoTrack.track.trackId)
    }
    globalToLocalTrackId.removeValue(forKey: ctx.trackId)
    MembraneRoom.sharedInstance.endpoints[ctx.endpoint.id] = endpoint
    emitEndpoints()
  }

  func onTrackUpdated(ctx: TrackContext) {
    updateOrAddTrack(ctx: ctx)
  }

  func onEndpointAdded(endpoint: Endpoint) {
    MembraneRoom.sharedInstance.endpoints[endpoint.id] = RNEndpoint(
      id: endpoint.id, metadata: endpoint.metadata, type: endpoint.type)
    emitEndpoints()
  }

  func onEndpointRemoved(endpoint: Endpoint) {
    MembraneRoom.sharedInstance.endpoints.removeValue(forKey: endpoint.id)
    emitEndpoints()
  }

  func onEndpointUpdated(endpoint: Endpoint) {

  }

  func onBandwidthEstimationChanged(estimation: Int) {
    emitEvent(name: "BandwidthEstimation", data: ["estimation": estimation])
  }

}
