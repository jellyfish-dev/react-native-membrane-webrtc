import { InCallButton } from '@components/buttons/InCallButton';
import { RootStack } from '@model/NavigationTypes';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoroomState } from 'src/VideoroomContext';

const BOTTOM_MARGIN = 34;

export const CallControls = () => {
  const {
    isCameraOn,
    toggleCamera,
    isMicrophoneOn,
    toggleMicrophone,
    isScreencastOn,
    toggleScreencastAndUpdateMetadata,
    disconnect,
  } = useVideoroomState();
  const bottomOffset = useSafeAreaInsets().bottom;

  const navigation = useNavigation<StackNavigationProp<RootStack, 'Room'>>();

  const onDisconnectPress = useCallback(async () => {
    await disconnect();
    navigation.navigate('LeaveRoom');
  }, [disconnect]);

  return (
    <View
      style={[
        styles.iconsContainer,
        { marginBottom: BOTTOM_MARGIN - bottomOffset },
      ]}
    >
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
