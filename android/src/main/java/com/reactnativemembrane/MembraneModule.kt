package com.reactnativemembrane

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat.getSystemService
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import org.membraneframework.rtc.ConnectOptions
import org.membraneframework.rtc.MembraneRTC
import org.membraneframework.rtc.MembraneRTCError
import org.membraneframework.rtc.MembraneRTCListener
import org.membraneframework.rtc.media.*
import org.membraneframework.rtc.models.Peer
import org.membraneframework.rtc.models.TrackContext
import org.membraneframework.rtc.transport.PhoenixTransport
import java.util.*

class MembraneModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext),
  MembraneRTCListener {
  private val TAG = "MEMBRANE"
  private val SCREENCAST_REQUEST = 1
  private var room: MembraneRTC? = null

  var localAudioTrack: LocalAudioTrack? = null
  var localVideoTrack: LocalVideoTrack? = null
  var localScreencastTrack: LocalScreencastTrack? = null

  var isScreenCastOn = false
  private var localScreencastId: String? = null

  var isMicrophoneOn = false
  var isCameraOn = false

  var localDisplayName: String? = null

  private val globalToLocalTrackId = HashMap<String, String>()

  private var connectPromise: Promise? = null
  private var screencastPromise: Promise? = null

  override fun getName(): String {
    return "Membrane"
  }

  private val activityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(
      activity: Activity?,
      requestCode: Int,
      resultCode: Int,
      data: Intent?
    ) {
      if (resultCode != Activity.RESULT_OK) return

      data?.let {
        startScreencast(it)
      }
    }
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  @ReactMethod
  fun connect(url: String, roomName: String, displayName: String, promise: Promise) {
    connectPromise = promise
    room = MembraneRTC.connect(
      appContext = reactApplicationContext,
      options = ConnectOptions(
        transport = PhoenixTransport(url, "room:$roomName", Dispatchers.IO),
        config = mapOf("displayName" to displayName)
      ),
      listener = this@MembraneModule
    )
  }

  @ReactMethod
  fun disconnect(promise: Promise) {
    room?.disconnect()
    room = null
    MembraneRoom.participants.clear();
    promise.resolve(null)
  }

  @ReactMethod
  fun isMicrophoneOn(promise: Promise) {
    promise.resolve(isMicrophoneOn)
  }

  @ReactMethod
  fun toggleMicrophone(promise: Promise) {
    localAudioTrack?.let {
      val enabled = !it.enabled()
      it.setEnabled(enabled)
      isMicrophoneOn = enabled
      promise.resolve(enabled)
    }
  }

  @ReactMethod
  fun isCameraOn(promise: Promise) {
    promise.resolve(isCameraOn)
  }

  @ReactMethod
  fun toggleCamera(promise: Promise) {
    localVideoTrack?.let {
      val enabled = !it.enabled()
      it.setEnabled(enabled)
      isCameraOn = enabled
      promise.resolve(enabled)
    }
  }

  @ReactMethod
  fun flipCamera(promise: Promise) {
    localVideoTrack?.flipCamera()
    promise.resolve(null)
  }

  @ReactMethod
  fun toggleScreencast(promise: Promise) {
    screencastPromise = promise
    if(!isScreenCastOn) {
      val currentActivity = currentActivity
      if (currentActivity == null) {
        promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Activity doesn't exist")
        return
      }

      val mediaProjectionManager =
        reactApplicationContext.getSystemService(AppCompatActivity.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      val intent = mediaProjectionManager.createScreenCaptureIntent()
      currentActivity.startActivityForResult(intent, SCREENCAST_REQUEST)
    } else {
      stopScreencast()
    }
  }

  fun startScreencast(mediaProjectionPermission: Intent) {
    if (localScreencastTrack != null) return

    isScreenCastOn = true

    localScreencastId = UUID.randomUUID().toString()

    var videoParameters = VideoParameters.presetScreenShareHD15
    val dimensions = videoParameters.dimensions.flip()
    videoParameters = videoParameters.copy(dimensions = dimensions)

    localScreencastTrack = room?.createScreencastTrack(mediaProjectionPermission, videoParameters, mapOf(
      "type" to "screensharing",
      "user_id" to (localDisplayName ?: "")
    )) {
      stopScreencast()
    }

    localScreencastTrack?.let {
      MembraneRoom.participants[localScreencastId!!] = Participant(id = localScreencastId!!, displayName = "Me (screen cast)", videoTrack = it)
      emitParticipants()
    }
    screencastPromise?.resolve(isScreenCastOn)
  }

  fun stopScreencast() {
    isScreenCastOn = false

    localScreencastTrack?.let {
      room?.removeTrack(it.id())

      localScreencastId?.let {
        MembraneRoom.participants.remove(it)

        emitParticipants()
      }

      localScreencastTrack = null
    }
    screencastPromise?.resolve(isScreenCastOn)
  }

  private fun emitEvent(eventName: String, data: Any?) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, data)
  }

  private fun emitParticipants() {
    val params = Arguments.createMap();
    val participantsArray = Arguments.createArray();
    MembraneRoom.participants.values.filter { it.videoTrack != null }.forEach {
      val participantMap = Arguments.createMap()
      participantMap.putString("id", it.id)
      participantMap.putString("displayName", it.displayName)
      participantsArray.pushMap(participantMap)
    }
    params.putArray("participants", participantsArray);
    emitEvent("ParticipantsUpdate", params)
  }

  override fun onConnected() {
    Log.d(TAG, "on Connected")
    room?.let {
      localAudioTrack = it.createAudioTrack(
        mapOf(
          "user_id" to (localDisplayName ?: "")
        )
      )

      var videoParameters = VideoParameters.presetVGA169
      videoParameters = videoParameters.copy(dimensions = videoParameters.dimensions.flip())

      localVideoTrack = it.createVideoTrack(
        videoParameters, mapOf(
          "user_id" to (localDisplayName ?: "")
        )
      )

      isCameraOn = localVideoTrack?.enabled() ?: false
      isMicrophoneOn = localAudioTrack?.enabled() ?: false

      emitEvent("IsCameraOn", isCameraOn)
      emitEvent("IsMicrophoneOn", isMicrophoneOn)

      connectPromise?.resolve(null)

      val localPeerId = UUID.randomUUID().toString()
      MembraneRoom.participants[localPeerId] =
        Participant(localPeerId, "Me", localVideoTrack, localAudioTrack)
      emitParticipants()

      it.join()
    }
  }

  override fun onJoinSuccess(peerID: String, peersInRoom: List<Peer>) {
    Log.d(TAG, "on join success")
    peersInRoom.forEach {
      MembraneRoom.participants[it.id] =
        Participant(it.id, it.metadata["displayName"] ?: "UNKNOWN", null, null)
    }
    emitParticipants()
  }

  override fun onJoinError(metadata: Any) {
    Log.d(TAG, "on join error")
  }

  override fun onTrackReady(ctx: TrackContext) {
    val participant = MembraneRoom.participants[ctx.peer.id] ?: return

    val (id, newParticipant) = when (ctx.track) {
      is RemoteVideoTrack -> {
        globalToLocalTrackId[ctx.trackId] = (ctx.track as RemoteVideoTrack).id()

        if (ctx.metadata["type"] == "screensharing") {
          Pair(
            ctx.trackId,
            participant.copy(
              id = ctx.trackId,
              displayName = "${participant.displayName} (screencast)",
              videoTrack = ctx.track as RemoteVideoTrack
            )
          )
        } else {
          Pair(ctx.peer.id, participant.copy(videoTrack = ctx.track as RemoteVideoTrack))
        }
      }
      is RemoteAudioTrack -> {
        globalToLocalTrackId[ctx.trackId] = (ctx.track as RemoteAudioTrack).id()

        Pair(ctx.peer.id, participant.copy(audioTrack = ctx.track as RemoteAudioTrack))
      }
      else ->
        throw IllegalArgumentException("invalid type of incoming remote track")
    }

    MembraneRoom.participants[id] = newParticipant

    emitParticipants()
  }

  override fun onTrackAdded(ctx: TrackContext) {
    Log.d(TAG, "on track added")
  }

  override fun onTrackRemoved(ctx: TrackContext) {
    if (ctx.metadata["type"] == "screensharing") {
      // screencast is a throw-away type of participant so remove it and emit participants once again
      MembraneRoom.participants.remove(ctx.trackId)
      globalToLocalTrackId.remove(ctx.trackId)

      emitParticipants()
    } else {
      val participant = MembraneRoom.participants[ctx.peer.id] ?: return

      val localTrackId = globalToLocalTrackId[ctx.trackId]
      val audioTrackId = participant.audioTrack?.id()
      val videoTrackId = participant.videoTrack?.id()

      val newParticipant = when {
        localTrackId == videoTrackId ->
          participant.copy(videoTrack = null)

        localTrackId == audioTrackId ->
          participant.copy(audioTrack = null)

        else ->
          throw IllegalArgumentException("track has not been found for given peer")
      }

      globalToLocalTrackId.remove(ctx.trackId)

      MembraneRoom.participants[ctx.peer.id] = newParticipant

      emitParticipants()
    }
  }

  override fun onTrackUpdated(ctx: TrackContext) {
  }

  override fun onPeerJoined(peer: Peer) {
    MembraneRoom.participants[peer.id] =
      Participant(id = peer.id, displayName = peer.metadata["displayName"] ?: "UNKNOWN")
    emitParticipants()
  }

  override fun onPeerLeft(peer: Peer) {
    MembraneRoom.participants.remove(peer.id)
    emitParticipants()
  }

  override fun onPeerUpdated(peer: Peer) {
  }

  override fun onError(error: MembraneRTCError) {
  }
}
