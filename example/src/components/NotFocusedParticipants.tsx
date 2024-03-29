import { AdditionalColors, BrandColors } from '@colors';
import * as Membrane from '@jellyfish-dev/react-native-membrane-webrtc';
import { isEmpty } from 'lodash';
import React from 'react';
import { View, StyleSheet } from 'react-native';

import { OtherParticipants } from './OtherParticipants';
import { RoomParticipant } from './RoomParticipant';
import {
  AudioTrackMetadata,
  ParticipantMetadata,
  VideoTrackMetadata,
} from '../types/MetadataTypes';

export type Participant = {
  participant: Membrane.Endpoint<
    ParticipantMetadata,
    VideoTrackMetadata,
    AudioTrackMetadata
  >;
  trackId?: string;
};

type NotFocusedParticipantsProp = { participants: Participant[] };

export const NotFocusedParticipants = ({
  participants,
}: NotFocusedParticipantsProp) => {
  if (isEmpty(participants)) {
    return null;
  }

  return (
    <View style={styles.container}>
      {participants.length === 1 ? (
        <View style={[styles.otherParticipantContainer, styles.participant]}>
          <RoomParticipant
            participant={participants[0].participant}
            trackId={participants[0].trackId}
            pinButtonHiddden
            tileSmall
          />
        </View>
      ) : (
        <View
          style={[
            styles.otherParticipantsContainer,
            styles.otherParticipantContainer,
          ]}
        >
          <View style={styles.participant}>
            <RoomParticipant
              participant={participants[0].participant}
              trackId={participants[0].trackId}
              pinButtonHiddden
              tileSmall
            />
          </View>
          <View style={styles.middleLine} />
          <View style={styles.participant}>
            {participants.length === 2 ? (
              <RoomParticipant
                participant={participants[1].participant}
                trackId={participants[1].trackId}
                pinButtonHiddden
                tileSmall
              />
            ) : (
              <OtherParticipants
                p1={participants[1].participant}
                p2={participants[2].participant}
                numOfOtherParticipants={participants.length - 1}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 128,
  },
  otherParticipantContainer: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BrandColors.darkBlue60,
    backgroundColor: AdditionalColors.grey140,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otherParticipantsContainer: {
    flex: 1,
    aspectRatio: 2,
    flexDirection: 'row',
    marginLeft: 32,
    marginRight: 32,
  },
  participant: {
    width: 128,
    height: 128,
    overflow: 'hidden',
  },
  middleLine: {
    height: '100%',
    width: 2,
    backgroundColor: BrandColors.darkBlue60,
  },
});
