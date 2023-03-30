import { InCallButton } from '@components/buttons/InCallButton';
import * as Membrane from '@jellyfish-dev/react-native-membrane-webrtc';
import { RootStack } from '@model/NavigationTypes';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoroomState } from 'src/VideoroomContext';

type CallControlsProp = {
  bottomOffset: number;
};

export const CallControls = ({ bottomOffset }: CallControlsProp) => {
  const { isScreencastOn, toggleScreencast } = Membrane.useScreencast();
  const {
    isCameraOn,
    toggleCamera,
    isMicrophoneOn,
    toggleMicrophone,
    disconnect,
  } = useVideoroomState();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStack, 'Room'>>();

  const toggleScreencastAndUpdateMetadata = () => {
    toggleScreencast({
      screencastMetadata: {
        displayName: 'presenting',
        type: 'screensharing',
        active: 'true',
      },
      quality: Membrane.ScreencastQuality.FHD30,
    });
  };

  const onDisconnectPress = useCallback(() => {
    disconnect();
    navigation.navigate('LeaveRoom');
  }, []);

  return (
    <View style={[styles.iconsContainer, { marginBottom: 34 - bottomOffset }]}>
      <View style={styles.iconInRow}>
        <InCallButton
          iconName={!isCameraOn ? 'Cam-disabled' : 'Cam'}
          onPress={toggleCamera}
        />
      </View>
      <View style={styles.iconInRow}>
        <InCallButton
          iconName={!isMicrophoneOn ? 'Microphone-off' : 'Microphone'}
          onPress={toggleMicrophone}
        />
      </View>
      <View style={styles.iconInRow}>
        <InCallButton
          iconName={!isScreencastOn ? 'Screenshare' : 'Screen-off'}
          onPress={toggleScreencastAndUpdateMetadata}
        />
      </View>
      <InCallButton
        type="disconnect"
        iconName="Hangup"
        onPress={onDisconnectPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  iconsContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  iconInRow: {
    marginRight: 16,
  },
});
