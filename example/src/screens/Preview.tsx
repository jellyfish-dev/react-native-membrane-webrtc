import { BrandColors, TextColors } from '@colors';
import { BackgroundAnimation } from '@components/BackgroundAnimation';
import { NoCameraView } from '@components/NoCameraView';
import { Typo } from '@components/Typo';
import { InCallButton } from '@components/buttons/InCallButton';
import { StandardButton } from '@components/buttons/StandardButton';
import * as Membrane from '@jellyfish-dev/react-native-membrane-webrtc';
import { RootStack } from '@model/NavigationTypes';
import { useNotifications } from '@model/NotificationsContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Sentry from '@sentry/react-native';
import { findIndex } from 'lodash';
import React, { useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoroomState } from 'src/VideoroomContext';

type Props = NativeStackScreenProps<RootStack, 'Preview'>;

export const Preview = ({ navigation, route }: Props) => {
  const {
    roomName,
    username,
    currentCamera,
    setCurrentCamera,
    isCameraOn,
    toggleCamera,
    isMicrophoneOn,
    toggleMicrophone,
    connectAndJoinRoom,
  } = useVideoroomState();
  const { title } = route.params;
  const { width } = Dimensions.get('window');

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
    });
  }, [navigation]);

  const getTitleLabel = () => {
    switch (title) {
      case 'New meeting':
        return 'Create a new room to start the meeting';
      case 'Join meeting':
        return 'Join an existing meeting';
    }
  };

  const availableCameras = useRef<Membrane.CaptureDevice[]>([]);

  useEffect(() => {
    Membrane.getCaptureDevices().then((devices) => {
      availableCameras.current = devices;
      setCurrentCamera(devices.find((device) => device.isFrontFacing) || null);
    });
  }, []);

  const { showNotification } = useNotifications();

  const onConnectPress = useCallback(async () => {
    try {
      await connectAndJoinRoom();
      navigation.navigate('Room');
    } catch (err) {
      console.log('ERR', err);

      showNotification('Error connecting to server', 'error');
      Sentry.captureException(err);
    }
  }, [connectAndJoinRoom]);

  const switchCamera = useCallback(() => {
    const cameras = availableCameras.current;
    setCurrentCamera(
      cameras[(findIndex(cameras, currentCamera) + 1) % cameras.length]
    );
  }, [currentCamera]);

  return (
    <BackgroundAnimation>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
          }}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Typo variant={width > 350 ? 'h4' : 'h5'}>
                Videoconferencing for everyone
              </Typo>
            </View>
            <View style={styles.titleLabel}>
              <Typo variant="chat-regular" color={TextColors.description}>
                {getTitleLabel()}
              </Typo>
            </View>

            <View style={styles.cameraPreview}>
              {isCameraOn ? (
                <Membrane.VideoPreviewView
                  style={styles.membraneVideoPreview}
                  mirrorVideo
                  captureDeviceId={currentCamera?.id}
                />
              ) : (
                <NoCameraView username={username} />
              )}

              <View style={styles.iconsRow}>
                <InCallButton
                  iconName={isCameraOn ? 'Cam' : 'Cam-disabled'}
                  onPress={toggleCamera}
                />

                <View style={styles.microphoneButton}>
                  <InCallButton
                    iconName={isMicrophoneOn ? 'Microphone' : 'Microphone-off'}
                    onPress={toggleMicrophone}
                  />
                </View>
                <InCallButton iconName="Cam-switch" onPress={switchCamera} />
              </View>
            </View>

            <View style={styles.roomNameLabel}>
              <Typo variant="h5">You are joining: {roomName.trimEnd()}</Typo>
            </View>

            <View style={styles.joinButton}>
              <StandardButton onPress={onConnectPress} testID="join-room-btn">
                Join the room
              </StandardButton>
            </View>

            <View style={styles.stepLabel}>
              <Typo variant="label">Step 2/2</Typo>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </BackgroundAnimation>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
  },
  header: {
    alignSelf: 'center',
  },
  titleLabel: {
    marginTop: 8,
    alignSelf: 'center',
  },
  cameraPreview: {
    width: 236,
    height: 320,
    alignSelf: 'center',
    marginTop: 24,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BrandColors.darkBlue60,
    overflow: 'hidden',
  },
  membraneVideoPreview: {
    width: 236,
    height: 320,
  },
  roomNameLabel: {
    marginTop: 32,
    alignSelf: 'center',
  },
  joinButton: {
    marginTop: 32,
    width: '100%',
  },
  stepLabel: {
    marginTop: 16,
    alignSelf: 'center',
  },
  iconsRow: {
    width: '100%',
    flexDirection: 'row',
    position: 'absolute',
    bottom: 16,
    justifyContent: 'center',
  },
  microphoneButton: {
    paddingRight: 16,
    paddingLeft: 16,
  },
});
