package com.reactnativemembrane

import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SimulcastConfig : Record {
  @Field
  val enabled: Boolean = false

  @Field
  val activeEncodings: List<String> = emptyList()
}

class CameraConfig : Record {
  @Field
  val quality: String = "VGA169"

  @Field
  val flipVideo: Boolean = false

  @Field
  val videoTrackMetadata: Map<String, Any> = emptyMap()

  @Field
  val simulcastConfig: SimulcastConfig = SimulcastConfig()

  // expo-modules on Android don't support Either type
  @Field
  val maxBandwidthMap: Map<String, Int> = emptyMap()

  @Field
  val maxBandwidthInt: Int = 0

  @Field
  val cameraEnabled: Boolean = true

  @Field
  val captureDeviceId: String? = null
}

class MicrophoneConfig : Record {
  @Field
  val audioTrackMetadata: Map<String, Any> = emptyMap()

  @Field
  val microphoneEnabled: Boolean = true
}

class ScreencastOptions : Record {
  @Field
  val quality: String = "HD15"

  @Field
  val screencastMetadata: Map<String, Any> = emptyMap()

  @Field
  val simulcastConfig: SimulcastConfig = SimulcastConfig()

  @Field
  val maxBandwidthMap: Map<String, Int> = emptyMap()

  @Field
  val maxBandwidthInt: Int = 0
}

class MembraneWebRTCModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MembraneWebRTC")

    Events(
      "IsCameraOn",
      "IsMicrophoneOn",
      "isSoundDetected",
      "SoundDetectedEvent",
      "SoundVolumeChanged",
      "IsScreencastOn",
      "SimulcastConfigUpdate",
      "EndpointsUpdate",
      "AudioDeviceUpdate",
      "SendMediaEvent",
      "BandwidthEstimation"
    )

    val membraneWebRTC = MembraneWebRTC { name: String, data: Map<String, Any?> ->
      sendEvent(name, data)
    }

    OnCreate {
      membraneWebRTC.appContext = appContext
    }

    AsyncFunction("create") Coroutine ({ ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.create()
      }
    })

    AsyncFunction("receiveMediaEvent") Coroutine { data: String ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.receiveMediaEvent(data)
      }
    }

    AsyncFunction("connect") { endpointMetadata: Map<String, Any>, promise: Promise ->
      CoroutineScope(Dispatchers.Main).launch {
        membraneWebRTC.connect(endpointMetadata, promise)
      }
    }

    AsyncFunction("disconnect") Coroutine { ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.disconnect()
      }
    }

    AsyncFunction("startCamera") Coroutine { config: CameraConfig ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.startCamera(config)
      }
    }

    AsyncFunction("startMicrophone") Coroutine { config: MicrophoneConfig ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.startMicrophone(config)
      }
    }

    Property("isMicrophoneOn") {
      return@Property membraneWebRTC.isMicrophoneOn
    }

    AsyncFunction("startSoundDetection") Coroutine { monitorInterval: Int, samplingRate: Int, volumeThreshold: Int ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.startSoundDetection(monitorInterval, samplingRate, volumeThreshold)
      }
    }

    AsyncFunction("stopSoundDetection") Coroutine { ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.stopSoundDetection()
      }
    }

    Property("isSoundDetectionOn") {
      return@Property membraneWebRTC.isSoundDetectionOn
    }

    AsyncFunction("toggleMicrophone") Coroutine { ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.toggleMicrophone()
      }
    }

    Property("isCameraOn") {
      return@Property membraneWebRTC.isCameraOn
    }

    AsyncFunction("toggleCamera") Coroutine { ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.toggleCamera()
      }
    }

    AsyncFunction("flipCamera") Coroutine { ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.flipCamera()
      }
    }

    AsyncFunction("switchCamera") Coroutine { captureDeviceId: String ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.switchCamera(captureDeviceId)
      }
    }

    AsyncFunction("getCaptureDevices") Coroutine { ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.getCaptureDevices()
      }
    }

    AsyncFunction("toggleScreencast") { screencastOptions: ScreencastOptions, promise: Promise ->
      CoroutineScope(Dispatchers.Main).launch {
        membraneWebRTC.toggleScreencast(screencastOptions, promise)
      }
    }

    Property("isScreencastOn") {
      return@Property membraneWebRTC.isScreencastOn
    }

    AsyncFunction("getEndpoints") Coroutine { ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.getEndpoints()
      }
    }

    AsyncFunction("updateEndpointMetadata") Coroutine { metadata: Map<String, Any> ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.updateEndpointMetadata(metadata)
      }
    }

    AsyncFunction("updateVideoTrackMetadata") Coroutine { metadata: Map<String, Any> ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.updateVideoTrackMetadata(metadata)
      }
    }

    AsyncFunction("updateAudioTrackMetadata") Coroutine { metadata: Map<String, Any> ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.updateAudioTrackMetadata(metadata)
      }
    }

    AsyncFunction("updateScreencastTrackMetadata") Coroutine { metadata: Map<String, Any> ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.updateScreencastTrackMetadata(metadata)
      }
    }

    AsyncFunction("setOutputAudioDevice") { audioDevice: String ->
      membraneWebRTC.setOutputAudioDevice(audioDevice)
    }

    AsyncFunction("startAudioSwitcher") {
      membraneWebRTC.startAudioSwitcher()
    }

    AsyncFunction("stopAudioSwitcher") {
      membraneWebRTC.stopAudioSwitcher()
    }

    AsyncFunction("toggleScreencastTrackEncoding") Coroutine { encoding: String ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.toggleScreencastTrackEncoding(encoding)
      }
    }

    AsyncFunction("setScreencastTrackBandwidth") Coroutine { bandwidth: Int ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.setScreencastTrackBandwidth(bandwidth)
      }
    }

    AsyncFunction("setScreencastTrackEncodingBandwidth") Coroutine { encoding: String, bandwidth: Int ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.setScreencastTrackEncodingBandwidth(encoding, bandwidth)
      }
    }

    AsyncFunction("setTargetTrackEncoding") Coroutine { trackId: String, encoding: String ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.setTargetTrackEncoding(trackId, encoding)
      }
    }

    AsyncFunction("toggleVideoTrackEncoding") Coroutine { encoding: String ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.toggleVideoTrackEncoding(encoding)
      }
    }

    AsyncFunction("setVideoTrackEncodingBandwidth") Coroutine { encoding: String, bandwidth: Int ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.setVideoTrackEncodingBandwidth(encoding, bandwidth)
      }
    }

    AsyncFunction("setVideoTrackBandwidth") Coroutine { bandwidth: Int ->
      withContext(Dispatchers.Main) {
        membraneWebRTC.setVideoTrackBandwidth(bandwidth)
      }
    }

    AsyncFunction("changeWebRTCLoggingSeverity") Coroutine { severity: String ->
      CoroutineScope(Dispatchers.Main).launch {
        membraneWebRTC.changeWebRTCLoggingSeverity(severity)
      }
    }

    AsyncFunction("getStatistics") { ->
      membraneWebRTC.getStatistics()
    }

    OnActivityResult { _, result ->
      membraneWebRTC.onActivityResult(result.requestCode, result.resultCode, result.data)
    }

    OnDestroy {
      membraneWebRTC.onDestroy()
    }
  }
}
