import { BrandColors, AdditionalColors, TextColors } from '@colors';
import * as Membrane from '@jellyfish-dev/react-native-membrane-webrtc';
import { useVideoroomState } from '@model/VideoroomContext';
import React, { useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';

import { Icon } from './Icon';
import { NoCameraView } from './NoCameraView';
import { Participant } from './NotFocusedParticipants';
import { SimulcastMenu } from './SimulcastMenu';
import { Typo } from './Typo';
import { PinButton } from './buttons/PinButton';
import {
  AudioTrackMetadata,
  ParticipantMetadata,
  VideoTrackMetadata,
} from '../types/MetadataTypes';

type RoomParticipantProps = {
  participant: Membrane.Endpoint<
    ParticipantMetadata,
    VideoTrackMetadata,
    AudioTrackMetadata
  >;
  trackId?: string;
  onPinButtonPressed?: (value: Participant | null) => void;
  focused?: boolean;
  pinButtonHiddden?: boolean;
  tileSmall?: boolean;
};

export const RoomParticipant = ({
  participant,
  trackId,
  onPinButtonPressed = () => {},
  focused = false,
  pinButtonHiddden = false,
  tileSmall = false,
}: RoomParticipantProps) => {
  const { metadata, tracks, isLocal } = participant;

  const [showPinButton, setShowPinButton] = useState(false);
  const isPinButtonShown = useRef(false);
  const { isDevMode, isSoundDetected } = useVideoroomState();

  const videoTrack = trackId ? tracks.find((t) => t.id === trackId) : null;
  const videoTrackType = videoTrack?.metadata.type;
  const audioTrack = tracks.find((t) => t.type === 'Audio');
  const buttonOpacity = useSharedValue(0);

  const participantHasVideo = () => {
    if (videoTrack) {
      return videoTrack.metadata.active;
    }
    return false;
  };

  const getTextForPinButton = () => {
    return focused ? 'Unpin user' : tileSmall ? 'Pin' : 'Pin user';
  };

  const onPinButton = () => {
    if (focused) {
      onPinButtonPressed(null);
      return;
    }
    onPinButtonPressed({ participant, trackId });
  };

  const opacityStyle = useAnimatedStyle(() => {
    return {
      opacity: buttonOpacity.value,
    };
  });

  const setIsPinButtonShown = (val: boolean) => {
    isPinButtonShown.current = val;
  };

  const triggerShowingPinButton = async () => {
    if (pinButtonHiddden || isPinButtonShown.current) {
      return;
    }

    isPinButtonShown.current = true;
    setShowPinButton(true);

    buttonOpacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withDelay(
        1700,
        withTiming(0, { duration: 300 }, () => {
          runOnJS(setShowPinButton)(false);
          runOnJS(setIsPinButtonShown)(false);
        })
      )
    );
  };

  const getStyleForVideoView = () => {
    return videoTrackType === 'camera'
      ? focused
        ? styles.videoTrackFocused
        : styles.videoTrack
      : focused
      ? styles.videoTrackScreencastFocused
      : styles.videoTrack;
  };

  const getAudioIcon = () => {
    if (videoTrackType === 'screensharing') {
      return null;
    }
    if (!audioTrack?.metadata.active) {
      return (
        <View style={styles.audioIcon}>
          {isSoundDetected ? (
            <Text>You're muted</Text>
          ) : (
            <Icon
              name="Microphone-off"
              size={16}
              color={BrandColors.darkBlue100}
            />
          )}
        </View>
      );
    }
    if (audioTrack?.vadStatus === 'speech') {
      return (
        <View style={styles.audioIcon}>
          <Icon name="Sound-big" size={20} color={BrandColors.darkBlue100} />
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.fill}>
      <Pressable onPress={triggerShowingPinButton} style={styles.fill}>
        {participantHasVideo() ? (
          <Membrane.VideoRendererView
            trackId={videoTrack!.id}
            style={getStyleForVideoView()}
            videoLayout={
              videoTrackType === 'camera'
                ? Membrane.VideoLayout.FILL
                : Membrane.VideoLayout.FIT
            }
          />
        ) : (
          <View style={styles.videoTrack}>
            <NoCameraView
              username={metadata.displayName}
              isSmallTile={tileSmall}
            />
          </View>
        )}
        <View style={styles.displayNameContainer}>
          <View
            style={[
              styles.displayName,
              isLocal ? styles.localUser : styles.remoteUser,
            ]}
          >
            <Typo variant="label" color={TextColors.white} numberOfLines={1}>
              {isLocal ? 'You' : metadata.displayName}
            </Typo>
          </View>
        </View>

        {focused ? (
          <View style={styles.displayPinContainer}>
            <Icon name="Pin" size={20} color={BrandColors.darkBlue100} />
          </View>
        ) : null}

        {getAudioIcon()}
      </Pressable>

      {isDevMode ? (
        <View style={styles.simulcastMenu}>
          <SimulcastMenu
            isLocalParticipant={isLocal}
            encoding={videoTrack?.encoding}
          />
        </View>
      ) : null}

      {showPinButton ? (
        <Animated.View style={[styles.pinButton, opacityStyle]}>
          <View style={styles.pinButtonWrapper}>
            <PinButton onPress={onPinButton}>{getTextForPinButton()}</PinButton>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
  },
  displayNameContainer: {
    borderRadius: 60,
    position: 'absolute',
    left: 16,
    bottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  remoteUser: {
    backgroundColor: BrandColors.darkBlue80,
  },
  localUser: {
    backgroundColor: BrandColors.pink100,
  },
  displayName: {
    borderRadius: 60,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 6,
    paddingBottom: 6,
    marginRight: 16,
  },
  videoTrack: {
    flex: 1,
    aspectRatio: 1,
    alignSelf: 'center',
  },
  videoTrackFocused: {
    flex: 1,
    width: '100%',
  },
  videoTrackScreencastFocused: {
    flex: 1,
  },
  audioIcon: {
    position: 'absolute',
    left: 16,
    top: 16,
    backgroundColor: AdditionalColors.white,
    borderRadius: 50,
    padding: 6,
  },
  pinButtonWrapper: {
    borderRadius: 100,
    overflow: 'hidden',
  },
  pinButton: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayPinContainer: {
    borderRadius: 60,
    position: 'absolute',
    top: 16,
    right: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AdditionalColors.white,
    padding: 4,
  },
  simulcastMenu: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
});
