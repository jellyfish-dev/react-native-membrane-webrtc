package com.reactnativemembrane

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.media.projection.MediaProjectionManager
import androidx.appcompat.app.AppCompatActivity
import com.twilio.audioswitch.AudioDevice
import expo.modules.kotlin.Promise
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.exception.CodedException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.membraneframework.rtc.MembraneRTC
import org.membraneframework.rtc.MembraneRTCListener
import org.membraneframework.rtc.SimulcastConfig
import org.membraneframework.rtc.media.LocalAudioTrack
import org.membraneframework.rtc.media.LocalScreencastTrack
import org.membraneframework.rtc.media.LocalVideoTrack
import org.membraneframework.rtc.media.OnSoundDetectedListener
import org.membraneframework.rtc.media.RemoteAudioTrack
import org.membraneframework.rtc.media.RemoteVideoTrack
import org.membraneframework.rtc.media.TrackBandwidthLimit
import org.membraneframework.rtc.media.VideoParameters
import org.membraneframework.rtc.models.Endpoint
import org.membraneframework.rtc.models.RTCInboundStats
import org.membraneframework.rtc.models.RTCOutboundStats
import org.membraneframework.rtc.models.TrackContext
import org.membraneframework.rtc.utils.Metadata
import org.membraneframework.rtc.media.SoundDetection
import org.membraneframework.rtc.utils.SerializedMediaEvent
import org.webrtc.Logging
import java.util.UUID

class MembraneWebRTC(val sendEvent: (name: String, data: Map<String, Any?>) -> Unit) :
  MembraneRTCListener, OnSoundDetectedListener {
  private val SCREENCAST_REQUEST = 1
  private var room: MembraneRTC? = null

  var localAudioTrack: LocalAudioTrack? = null
  var localVideoTrack: LocalVideoTrack? = null
  var localScreencastTrack: LocalScreencastTrack? = null
  var localEndpointId: String? = null

  private var localScreencastId: String? = null

  var isMicrophoneOn = true
  var isCameraOn = true
  var isScreencastOn = false
  var isSoundDetectionOn = false

  private val globalToLocalTrackId = HashMap<String, String>()

  private var connectPromise: Promise? = null
  private var screencastPromise: Promise? = null

  var videoSimulcastConfig: SimulcastConfig = SimulcastConfig()

  private var localUserMetadata: Metadata = mutableMapOf()

  var screencastQuality: String? = null
  var screencastSimulcastConfig: SimulcastConfig = SimulcastConfig()
  var screencastMaxBandwidth: TrackBandwidthLimit = TrackBandwidthLimit.BandwidthLimit(0)

  var screencastMetadata: Map<String, Any> = mutableMapOf()

  var trackContexts: MutableMap<String, TrackContext> = mutableMapOf()

  var audioSwitchManager: AudioSwitchManager? = null
  var soundDetection: SoundDetection? = null

  var appContext: AppContext? = null

  interface OnTrackUpdateListener {
    fun onTracksUpdate()
  }

  companion object {
    val endpoints = LinkedHashMap<String, RNEndpoint>()
    var onTracksUpdateListeners: MutableList<OnTrackUpdateListener> = mutableListOf()
  }

  fun onDestroy() {
    audioSwitchManager?.stop()
    stopSoundDetection()
  }

  fun onActivityResult(
    requestCode: Int, resultCode: Int, data: Intent?
  ) {
    if (requestCode != SCREENCAST_REQUEST) return
    if (resultCode != Activity.RESULT_OK) {
      screencastPromise?.resolve(false)
      screencastPromise = null
      return
    }

    data?.let {
      startScreencast(it)
    }
  }

  private fun getSimulcastConfigFromOptions(simulcastConfigMap: com.reactnativemembrane.SimulcastConfig): SimulcastConfig {
    val simulcastEnabled = simulcastConfigMap.enabled
    val activeEncodings = simulcastConfigMap.activeEncodings.map { e -> e.toTrackEncoding() }
    return SimulcastConfig(
      enabled = simulcastEnabled, activeEncodings = activeEncodings
    )
  }

  private fun getMaxBandwidthFromOptions(
    maxBandwidthMap: Map<String, Int>?, maxBandwidthInt: Int
  ): TrackBandwidthLimit {
    if (maxBandwidthMap != null) {
      val maxBandwidthSimulcast = mutableMapOf<String, TrackBandwidthLimit.BandwidthLimit>()
      maxBandwidthMap.forEach {
        maxBandwidthSimulcast[it.key] = TrackBandwidthLimit.BandwidthLimit(it.value)
      }
      return TrackBandwidthLimit.SimulcastBandwidthLimit(maxBandwidthSimulcast)
    }
    return TrackBandwidthLimit.BandwidthLimit(maxBandwidthInt)
  }

  private fun getGlobalTrackId(localTrackId: String): String? {
    return globalToLocalTrackId.filterValues { it == localTrackId }.keys.firstOrNull()
  }

  fun create() {
    this.audioSwitchManager = AudioSwitchManager(appContext?.reactContext!!)

    val room = MembraneRTC.create(
      appContext = appContext?.reactContext!!, listener = this
    )
    this.room = room

    localEndpointId = UUID.randomUUID().toString()
    val endpoint = RNEndpoint(
      id = localEndpointId!!,
      metadata = localUserMetadata,
      type = "webrtc",
    )

    endpoints[localEndpointId!!] = endpoint

    emitEndpoints()
  }

  private fun getVideoParametersFromOptions(createOptions: CameraConfig): VideoParameters {
    val videoMaxBandwidth =
      getMaxBandwidthFromOptions(createOptions.maxBandwidthMap, createOptions.maxBandwidthInt)

    var videoParameters = when (createOptions.quality) {
      "QVGA169" -> VideoParameters.presetQVGA169
      "VGA169" -> VideoParameters.presetVGA169
      "QHD169" -> VideoParameters.presetQHD169
      "HD169" -> VideoParameters.presetHD169
      "FHD169" -> VideoParameters.presetFHD169
      "QVGA43" -> VideoParameters.presetQVGA43
      "VGA43" -> VideoParameters.presetVGA43
      "QHD43" -> VideoParameters.presetQHD43
      "HD43" -> VideoParameters.presetHD43
      "FHD43" -> VideoParameters.presetFHD43
      else -> VideoParameters.presetVGA169
    }
    videoParameters = videoParameters.copy(
      dimensions = if (createOptions.flipVideo) videoParameters.dimensions.flip() else videoParameters.dimensions,
      simulcastConfig = videoSimulcastConfig,
      maxBitrate = videoMaxBandwidth
    )

    return videoParameters
  }

  private fun ensureConnected() {
    if (room == null) {
      throw CodedException("Client not connected to server yet. Make sure to call connect() first!")
    }
  }

  private fun ensureVideoTrack() {
    if (localVideoTrack == null) {
      throw CodedException("No local video track. Make sure to call connect() first!")
    }
  }

  private fun ensureAudioTrack() {
    if (localAudioTrack == null) {
      throw CodedException("No local audio track. Make sure to call connect() first!")
    }
  }

  private fun ensureScreencastTrack() {
    if (localScreencastTrack == null) {
      throw CodedException("No local screencast track. Make sure to toggle screencast on first!")
    }
  }

  private fun ensureSoundDetectionOn() {
    if (!isSoundDetectionOn) {
      throw CodedException("Sound Detection not in use. Make sure to start sound detection first!")
    }
  }

  private fun ensureSoundDetectionOff() {
    if (isSoundDetectionOn) {
      throw CodedException("Sound Detection in use. Make sure to stop sound detection first!")
    }
  }

  fun receiveMediaEvent(data: String) {
    ensureConnected()
    room?.receiveMediaEvent(data)
  }

  fun connect(endpointMetadata: Metadata, promise: Promise) {
    ensureConnected()
    connectPromise = promise
    localUserMetadata = endpointMetadata
    val id = localEndpointId ?: return
    val endpoint = endpoints[id] ?: return
    endpoints[id] = endpoint.copy(metadata = localUserMetadata)
    room?.connect(localUserMetadata)
  }

  fun disconnect() {
    if (isScreencastOn) {
      stopScreencast()
    }
    room?.disconnect()
    room = null
    endpoints.clear()
  }

  override fun onSoundDetected(sound: Boolean) {
    emitEvent("SoundDetectedEvent", mapOf("SoundDetectedEvent" to sound))
  }

  override fun onSoundVolumeChanged(volume: Int) {
    emitEvent("SoundVolumeChanged", mapOf("SoundVolumeChanged" to volume))
  }

  fun startSoundDetection(
    monitorInterval: Int = 1, samplingRate: Int = 22050, volumeThreshold: Int = -60
  ) {
    if (this.soundDetection == null) {
      this.soundDetection = SoundDetection()
    }
    ensureSoundDetectionOff()
    this.soundDetection?.setSoundDetectionListener(this)
    this.soundDetection?.start(monitorInterval, samplingRate, volumeThreshold)
    if (this.soundDetection?.isRecording == true) {
      isSoundDetectionOn = true
    }
  }

  fun stopSoundDetection() {
    ensureSoundDetectionOn()
    this.soundDetection?.stop()
    isSoundDetectionOn = false
  }

  fun startCamera(config: CameraConfig) {
    ensureConnected()
    val videoParameters = getVideoParametersFromOptions(config)
    this.videoSimulcastConfig = getSimulcastConfigFromOptions(config.simulcastConfig)
    this.isCameraOn = config.cameraEnabled

    localVideoTrack = room?.createVideoTrack(
      videoParameters, config.videoTrackMetadata, config.captureDeviceId
    )
    localVideoTrack?.setEnabled(isCameraOn)

    isCameraOn = localVideoTrack?.enabled() ?: false

    if (localVideoTrack != null) {
      val localEndpoint = endpoints[localEndpointId]
      localEndpoint?.addOrUpdateTrack(localVideoTrack!!, config.videoTrackMetadata)
    }

    emitEvent("IsCameraOn", mapOf("isCameraOn" to isCameraOn))
    emitEndpoints()
  }

  fun startMicrophone(config: MicrophoneConfig) {
    ensureConnected()
    val audioTrackMetadata = config.audioTrackMetadata
    this@MembraneWebRTC.isMicrophoneOn = config.microphoneEnabled

    localAudioTrack = room?.createAudioTrack(audioTrackMetadata)
    localAudioTrack?.setEnabled(isMicrophoneOn)

    isMicrophoneOn = localAudioTrack?.enabled() ?: false

    if (localAudioTrack != null) {
      val localEndpoint = endpoints[localEndpointId]
      localEndpoint?.addOrUpdateTrack(localAudioTrack!!, audioTrackMetadata)
    }

    emitEvent("IsMicrophoneOn", mapOf("isMicrophoneOn" to isMicrophoneOn))
    emitEndpoints()
  }

  fun toggleMicrophone(): Boolean {
    ensureAudioTrack()
    localAudioTrack?.let {
      val enabled = !it.enabled()
      it.setEnabled(enabled)
      isMicrophoneOn = enabled
      return enabled
    }
    return false
  }

  fun toggleCamera(): Boolean {
    ensureVideoTrack()
    localVideoTrack?.let {
      val enabled = !it.enabled()
      it.setEnabled(enabled)
      isCameraOn = enabled
      return enabled
    }
    return false
  }

  fun flipCamera() {
    ensureVideoTrack()
    localVideoTrack?.flipCamera()
  }

  fun switchCamera(captureDeviceId: String) {
    ensureVideoTrack()
    localVideoTrack?.switchCamera(captureDeviceId)
  }

  fun getCaptureDevices(): List<Map<String, Any>> {
    val devices = LocalVideoTrack.getCaptureDevices(appContext?.reactContext!!)
    return devices.map { device ->
      mapOf<String, Any>(
        "id" to device.deviceName,
        "name" to device.deviceName,
        "isFrontFacing" to device.isFrontFacing,
        "isBackFacing" to device.isBackFacing
      )
    }
  }

  fun toggleScreencast(screencastOptions: ScreencastOptions, promise: Promise) {
    this@MembraneWebRTC.screencastMetadata = screencastOptions.screencastMetadata
    this@MembraneWebRTC.screencastQuality = screencastOptions.quality
    this@MembraneWebRTC.screencastSimulcastConfig =
      getSimulcastConfigFromOptions(screencastOptions.simulcastConfig)
    this@MembraneWebRTC.screencastMaxBandwidth = getMaxBandwidthFromOptions(
      screencastOptions.maxBandwidthMap, screencastOptions.maxBandwidthInt
    )
    screencastPromise = promise
    if (!isScreencastOn) {
      ensureConnected()
      val currentActivity = appContext?.currentActivity ?: throw ActivityNotFoundException()

      val mediaProjectionManager =
        appContext?.reactContext!!.getSystemService(AppCompatActivity.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      val intent = mediaProjectionManager.createScreenCaptureIntent()
      currentActivity.startActivityForResult(intent, SCREENCAST_REQUEST)
    } else {
      stopScreencast()
    }
  }

  fun getEndpoints(): Map<String, Any> {
    return getEndpointsAsRNMap()
  }

  fun updateEndpointMetadata(metadata: Metadata) {
    ensureConnected()
    room?.updateEndpointMetadata(metadata)
  }

  private fun updateTrackMetadata(trackId: String, metadata: Metadata) {
    room?.updateTrackMetadata(trackId, metadata)
    val id = localEndpointId ?: return
    val endpoint = endpoints[id] ?: return
    endpoint.tracksMetadata[trackId] = metadata
    emitEndpoints()
  }

  fun updateVideoTrackMetadata(metadata: Metadata) {
    ensureVideoTrack()
    val trackId = localVideoTrack?.rtcTrack()?.id() ?: return
    updateTrackMetadata(trackId, metadata)
  }

  fun updateAudioTrackMetadata(metadata: Metadata) {
    ensureAudioTrack()
    val trackId = localAudioTrack?.rtcTrack()?.id() ?: return
    updateTrackMetadata(trackId, metadata)
  }

  fun updateScreencastTrackMetadata(metadata: Metadata) {
    ensureScreencastTrack()
    val trackId = localScreencastTrack?.rtcTrack()?.id() ?: return
    updateTrackMetadata(trackId, metadata)
  }

  fun setOutputAudioDevice(audioDevice: String) {
    audioSwitchManager?.selectAudioOutput(AudioDeviceKind.fromTypeName(audioDevice))
  }

  fun startAudioSwitcher() {
    audioSwitchManager?.start(this::emitAudioDeviceEvent)
    emitAudioDeviceEvent(
      audioSwitchManager?.availableAudioDevices() ?: emptyList(),
      audioSwitchManager?.selectedAudioDevice()
    )
  }

  fun stopAudioSwitcher() {
    audioSwitchManager?.stop()
  }

  private fun toggleTrackEncoding(
    encoding: String, trackId: String, simulcastConfig: SimulcastConfig
  ): SimulcastConfig {
    val trackEncoding = encoding.toTrackEncoding()
    if (simulcastConfig.activeEncodings.contains(trackEncoding)) {
      room?.disableTrackEncoding(trackId, trackEncoding)
      return SimulcastConfig(enabled = true,
        activeEncodings = simulcastConfig.activeEncodings.filter { e -> e != trackEncoding })
    } else {
      room?.enableTrackEncoding(trackId, trackEncoding)
      return SimulcastConfig(
        enabled = true, activeEncodings = simulcastConfig.activeEncodings + listOf(trackEncoding)
      )
    }
  }

  fun toggleScreencastTrackEncoding(encoding: String): Map<String, Any> {
    ensureScreencastTrack()
    val trackId = localScreencastTrack?.id() ?: return emptyMap()
    screencastSimulcastConfig = toggleTrackEncoding(encoding, trackId, screencastSimulcastConfig)
    return getSimulcastConfigAsRNMap(screencastSimulcastConfig)
  }

  fun setScreencastTrackBandwidth(bandwidth: Int) {
    ensureScreencastTrack()
    val trackId = localScreencastTrack?.id() ?: return
    room?.setTrackBandwidth(trackId, TrackBandwidthLimit.BandwidthLimit(bandwidth))
  }

  fun setScreencastTrackEncodingBandwidth(encoding: String, bandwidth: Int) {
    ensureScreencastTrack()
    val trackId = localScreencastTrack?.id() ?: return
    room?.setEncodingBandwidth(trackId, encoding, TrackBandwidthLimit.BandwidthLimit(bandwidth))
  }

  fun setTargetTrackEncoding(trackId: String, encoding: String) {
    ensureConnected()
    val globalTrackId =
      getGlobalTrackId(trackId) ?: throw CodedException("Remote track with id=${trackId} not found")
    room?.setTargetTrackEncoding(globalTrackId, encoding.toTrackEncoding())
  }

  fun toggleVideoTrackEncoding(encoding: String): Map<String, Any> {
    ensureVideoTrack()
    val trackId = localVideoTrack?.id() ?: return emptyMap()
    videoSimulcastConfig = toggleTrackEncoding(encoding, trackId, videoSimulcastConfig)
    emitEvent("SimulcastConfigUpdate", getSimulcastConfigAsRNMap(videoSimulcastConfig))
    return getSimulcastConfigAsRNMap(videoSimulcastConfig)
  }

  fun setVideoTrackEncodingBandwidth(encoding: String, bandwidth: Int) {
    ensureVideoTrack()
    val trackId = localVideoTrack?.id() ?: return
    room?.setEncodingBandwidth(trackId, encoding, TrackBandwidthLimit.BandwidthLimit(bandwidth))
  }

  fun setVideoTrackBandwidth(bandwidth: Int) {
    ensureVideoTrack()
    val trackId = localVideoTrack?.id() ?: return
    room?.setTrackBandwidth(trackId, TrackBandwidthLimit.BandwidthLimit(bandwidth))
  }

  fun changeWebRTCLoggingSeverity(severity: String) {
    when (severity) {
      "verbose" -> room?.changeWebRTCLoggingSeverity(Logging.Severity.LS_VERBOSE)
      "info" -> room?.changeWebRTCLoggingSeverity(Logging.Severity.LS_INFO)
      "error" -> room?.changeWebRTCLoggingSeverity(Logging.Severity.LS_ERROR)
      "warning" -> room?.changeWebRTCLoggingSeverity(Logging.Severity.LS_WARNING)
      "none" -> room?.changeWebRTCLoggingSeverity(Logging.Severity.LS_NONE)
      else -> {
        throw CodedException("Severity with name=$severity not found")
      }
    }
  }

  private fun rtcOutboundStatsToRNMap(stats: RTCOutboundStats): Map<String, Any?> {
    val innerMap = mutableMapOf<String, Double>()
    innerMap["bandwidth"] = stats.qualityLimitationDurations?.bandwidth ?: 0.0
    innerMap["cpu"] = stats.qualityLimitationDurations?.cpu ?: 0.0
    innerMap["none"] = stats.qualityLimitationDurations?.none ?: 0.0
    innerMap["other"] = stats.qualityLimitationDurations?.other ?: 0.0

    val res = mutableMapOf<String, Any?>()
    res["kind"] = stats.kind
    res["rid"] = stats.rid
    res["bytesSent"] = stats.bytesSent?.toInt() ?: 0
    res["targetBitrate"] = stats.targetBitrate ?: 0.0
    res["packetsSent"] = stats.packetsSent?.toInt() ?: 0
    res["framesEncoded"] = stats.framesEncoded?.toInt() ?: 0
    res["framesPerSecond"] = stats.framesPerSecond ?: 0.0
    res["frameWidth"] = stats.frameWidth?.toInt() ?: 0
    res["frameHeight"] = stats.frameHeight?.toInt() ?: 0
    res["qualityLimitationDurations"] = innerMap

    return res
  }

  private fun rtcInboundStatsToRNMap(stats: RTCInboundStats): Map<String, Any?> {
    val res = mutableMapOf<String, Any?>()
    res["kind"] = stats.kind
    res["jitter"] = stats.jitter ?: 0.0
    res["packetsLost"] = stats.packetsLost ?: 0
    res["packetsReceived"] = stats.packetsReceived?.toInt() ?: 0
    res["bytesReceived"] = stats.bytesReceived?.toInt() ?: 0
    res["framesReceived"] = stats.framesReceived ?: 0
    res["frameWidth"] = stats.frameWidth?.toInt() ?: 0
    res["frameHeight"] = stats.frameHeight?.toInt() ?: 0
    res["framesPerSecond"] = stats.framesPerSecond ?: 0.0
    res["framesDropped"] = stats.framesDropped?.toInt() ?: 0

    return res
  }

  fun getStatistics(): MutableMap<String, Map<String, Any?>> {
    val newMap = mutableMapOf<String, Map<String, Any?>>()
    room?.getStats()?.forEach { entry ->
      newMap[entry.key] = if (entry.value is RTCInboundStats) rtcInboundStatsToRNMap(
        entry.value as RTCInboundStats
      ) else rtcOutboundStatsToRNMap(entry.value as RTCOutboundStats)
    }
    return newMap
  }

  private fun startScreencast(mediaProjectionPermission: Intent) {
    if (localScreencastTrack != null) return

    isScreencastOn = true

    localScreencastId = UUID.randomUUID().toString()

    var videoParameters = when (screencastQuality) {
      "VGA" -> VideoParameters.presetScreenShareVGA
      "HD5" -> VideoParameters.presetScreenShareHD5
      "HD15" -> VideoParameters.presetScreenShareHD15
      "FHD15" -> VideoParameters.presetScreenShareFHD15
      "FHD30" -> VideoParameters.presetScreenShareFHD30
      else -> VideoParameters.presetScreenShareHD15
    }
    val dimensions = videoParameters.dimensions.flip()
    videoParameters = videoParameters.copy(
      dimensions = dimensions,
      simulcastConfig = screencastSimulcastConfig,
      maxBitrate = screencastMaxBandwidth,
    )

    localScreencastTrack = room?.createScreencastTrack(
      mediaProjectionPermission, videoParameters, screencastMetadata
    )

    localScreencastTrack?.let {
      val endpoint = endpoints[localEndpointId]
      endpoint!!.addOrUpdateTrack(it, screencastMetadata)
      emitEndpoints()
    }
    emitEvent("IsScreencastOn", mapOf("isScreencastOn" to isScreencastOn))
    screencastPromise?.resolve(isScreencastOn)
  }

  private fun stopScreencast() {
    isScreencastOn = false

    localScreencastTrack?.let {
      endpoints[localEndpointId]?.removeTrack(it)
      room?.removeTrack(it.id())
      emitEndpoints()
      localScreencastTrack = null
    }
    emitEndpoints()
    emitEvent("IsScreencastOn", mapOf("isScreencastOn" to isScreencastOn))
    screencastPromise?.resolve(isScreencastOn)
    screencastPromise = null
  }

  private fun emitEvent(eventName: String, data: Map<String, Any?>) {
    sendEvent(eventName, data)
  }

  private fun getEndpointsAsRNMap(): Map<String, Any> {
    return mapOf("endpoints" to endpoints.values.map { endpoint ->
      mapOf("id" to endpoint.id,
        "isLocal" to (endpoint.id == localEndpointId),
        "type" to endpoint.type,
        "metadata" to endpoint.metadata,
        "tracks" to endpoint.videoTracks.values.map { video ->
          mapOf(
            "id" to video.id(),
            "type" to "Video",
            "metadata" to (endpoint.tracksMetadata[video.id()] ?: emptyMap()),
            "encoding" to trackContexts[video.id()]?.encoding?.rid,
            "encodingReason" to trackContexts[video.id()]?.encodingReason?.value
          )
        } + endpoint.audioTracks.values.map { audio ->
          mapOf(
            "id" to audio.id(),
            "type" to "Audio",
            "metadata" to (endpoint.tracksMetadata[audio.id()] ?: emptyMap()),
            "vadStatus" to trackContexts[audio.id()]?.vadStatus?.value
          )
        })
    })
  }

  private fun emitEndpoints() {
    emitEvent("EndpointsUpdate", getEndpointsAsRNMap())
  }

  private fun audioDeviceAsRNMap(audioDevice: AudioDevice): Map<String, String?> {
    return mapOf(
      "name" to audioDevice.name, "type" to AudioDeviceKind.fromAudioDevice(audioDevice)?.typeName
    )
  }

  private fun emitAudioDeviceEvent(
    audioDevices: List<AudioDevice>, selectedDevice: AudioDevice?
  ) {
    val map =
      mapOf("selectedDevice" to (if (selectedDevice != null) audioDeviceAsRNMap(selectedDevice) else null),
        "availableDevices" to audioDevices.map { audioDevice -> audioDeviceAsRNMap(audioDevice) })
    emitEvent("AudioDeviceUpdate", map)
  }

  private fun getSimulcastConfigAsRNMap(simulcastConfig: SimulcastConfig): Map<String, Any> {
    return mapOf("enabled" to simulcastConfig.enabled,
      "activeEncodings" to simulcastConfig.activeEncodings.map {
        it.rid
      })
  }

  override fun onConnected(endpointID: String, otherEndpoints: List<Endpoint>) {
    CoroutineScope(Dispatchers.Main).launch {
      endpoints.remove(endpointID)
      otherEndpoints.forEach {
        endpoints[it.id] = RNEndpoint(it.id, it.metadata, it.type)
      }
      connectPromise?.resolve(null)
      connectPromise = null
      emitEndpoints()
    }
  }

  override fun onConnectError(metadata: Any) {
    CoroutineScope(Dispatchers.Main).launch {
      connectPromise?.reject(CodedException("Connection error: $metadata"))
      connectPromise = null
    }
  }

  private fun addOrUpdateTrack(ctx: TrackContext) {
    val endpoint = endpoints[ctx.endpoint.id]
      ?: throw IllegalArgumentException("endpoint with id ${ctx.endpoint.id} not found")

    when (ctx.track) {
      is RemoteVideoTrack -> {
        val localTrackId = (ctx.track as RemoteVideoTrack).id()
        globalToLocalTrackId[ctx.trackId] = localTrackId
        endpoint.addOrUpdateTrack(ctx.track as RemoteVideoTrack, ctx.metadata)
        if (trackContexts[localTrackId] == null) {
          trackContexts[localTrackId] = ctx
          ctx.setOnEncodingChangedListener {
            emitEndpoints()
          }
        }
      }

      is RemoteAudioTrack -> {
        val localTrackId = (ctx.track as RemoteAudioTrack).id()
        globalToLocalTrackId[ctx.trackId] = localTrackId
        endpoint.addOrUpdateTrack(ctx.track as RemoteAudioTrack, ctx.metadata)
        if (trackContexts[localTrackId] == null) {
          trackContexts[localTrackId] = ctx
          ctx.setOnVoiceActivityChangedListener {
            emitEndpoints()
          }
        }
      }

      else -> throw IllegalArgumentException("invalid type of incoming remote track")
    }

    emitEndpoints()
    onTracksUpdateListeners.forEach { it.onTracksUpdate() }
  }

  override fun onTrackReady(ctx: TrackContext) {
    CoroutineScope(Dispatchers.Main).launch {
      addOrUpdateTrack(ctx)
    }
  }

  override fun onTrackAdded(ctx: TrackContext) {
  }

  override fun onTrackRemoved(ctx: TrackContext) {
    CoroutineScope(Dispatchers.Main).launch {
      val endpoint = endpoints[ctx.endpoint.id]
        ?: throw IllegalArgumentException("endpoint with id ${ctx.endpoint.id} not found")

      when (ctx.track) {
        is RemoteVideoTrack -> endpoint.removeTrack(ctx.track as RemoteVideoTrack)
        is RemoteAudioTrack -> endpoint.removeTrack(ctx.track as RemoteAudioTrack)
        else -> throw IllegalArgumentException("invalid type of incoming remote track")
      }

      globalToLocalTrackId.remove(ctx.trackId)
      ctx.setOnEncodingChangedListener(null)
      ctx.setOnVoiceActivityChangedListener(null)
      trackContexts.remove(ctx.trackId)
      emitEndpoints()
      onTracksUpdateListeners.forEach { it.onTracksUpdate() }
    }
  }

  override fun onTrackUpdated(ctx: TrackContext) {
    CoroutineScope(Dispatchers.Main).launch {
      addOrUpdateTrack(ctx)
    }
  }

  override fun onEndpointAdded(endpoint: Endpoint) {
    CoroutineScope(Dispatchers.Main).launch {
      endpoints[endpoint.id] =
        RNEndpoint(id = endpoint.id, metadata = endpoint.metadata, type = endpoint.type)
      emitEndpoints()
    }
  }

  override fun onEndpointRemoved(endpoint: Endpoint) {
    CoroutineScope(Dispatchers.Main).launch {
      endpoints.remove(endpoint.id)
      emitEndpoints()
    }
  }

  override fun onEndpointUpdated(endpoint: Endpoint) {}

  override fun onSendMediaEvent(event: SerializedMediaEvent) {
    emitEvent("SendMediaEvent", mapOf("event" to event))
  }

  override fun onBandwidthEstimationChanged(estimation: Long) {
    emitEvent("BandwidthEstimation", mapOf("estimation" to estimation.toFloat()))
  }

  override fun onDisconnected() {}


}
