import { InCallButton } from '@components/buttons/InCallButton';
import { RootStack } from '@model/NavigationTypes';
import { useVideoroomState } from '@model/VideoroomContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StatsModal } from './StatsModal';

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
  const navigation = useNavigation<StackNavigationProp<RootStack, 'Room'>>();
  const { isDevMode } = useVideoroomState();
  const [isStatsModalVisible, setIsStatsModalVisible] = useState(false);

  const onDisconnectPress = useCallback(async () => {
    await disconnect();
    navigation.navigate('LeaveRoom');
  }, [disconnect]);

  return (
    <View style={styles.iconsContainer}>
      <View style={styles.iconInRow}>
        <InCallButton
          iconName={isCameraOn ? 'Cam' : 'Cam-disabled'}
          onPress={toggleCamera}
        />
      </View>
      <View style={styles.iconInRow}>
        <InCallButton
          iconName={isMicrophoneOn ? 'Microphone' : 'Microphone-off'}
          onPress={toggleMicrophone}
        />
      </View>
      <View style={styles.iconInRow}>
        <InCallButton
          iconName={isScreencastOn ? 'Screenshare' : 'Screen-off'}
          onPress={toggleScreencastAndUpdateMetadata}
        />
      </View>
      {isDevMode ? (
        <>
          <View style={styles.iconInRow}>
            <InCallButton
              iconName="Info"
              onPress={() => {
                setIsStatsModalVisible(true);
              }}
            />
          </View>
          <StatsModal
            visible={isStatsModalVisible}
            onClose={() => {
              setIsStatsModalVisible(false);
            }}
          />
        </>
      ) : null}
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
    marginBottom: 16,
  },
  iconInRow: {
    marginRight: 16,
  },
});
