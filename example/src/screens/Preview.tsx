import { BrandColors } from '@colors';
import { BackgroundWrapper } from '@components/BackgroundWrapper';
import { Typo } from '@components/Typo';
import { InCallButton } from '@components/buttons/InCallButton';
import { StandardButton } from '@components/buttons/StandardButton';
import { SERVER_URL } from '@env';
import * as Membrane from '@jellyfish-dev/react-native-membrane-webrtc';
import { RootStack } from '@model/NavigationTypes';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, {
  useEffect,
  useCallback,
  useLayoutEffect,
  useState,
} from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useVideoroomState } from 'src/VideoroomContext';

type Props = NativeStackScreenProps<RootStack, 'Preview'>;

export const Preview = ({ navigation, route }: Props) => {
  const { roomName, setRoomName, username, setUsername } = useVideoroomState();
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicrophoneOn, setIsMicrophoneOn] = useState(true);
  const isSimulcastOn = true;

  const { prevScreen } = route.params;
  const headerTitle =
    prevScreen === 'CreateRoom' ? 'New meeting' : 'Join meeting';
  const titleLabel =
    prevScreen === 'CreateRoom'
      ? 'Create a new room to start the meeting'
      : 'Join an existing meeting';

  const { connect: mbConnect, joinRoom, error } = Membrane.useMembraneServer();

  const params = {
    token: 'NOW_YOU_CAN_SEND_PARAMS',
  };

  useEffect(() => {
    if (error) {
      console.log(error);
      Alert.alert('Error when connecting to server:', error);
    }
  }, [error]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: headerTitle,
    });
  }, [navigation]);

  const requestPermissions = useCallback(async () => {
    if (Platform.OS === 'ios') return;
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      if (
        granted[PermissionsAndroid.PERMISSIONS.CAMERA] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
          PermissionsAndroid.RESULTS.GRANTED
      ) {
        console.log('You can use the camera');
      } else {
        console.log('Camera permission denied');
      }
    } catch (err) {
      console.warn(err);
    }
  }, []);

  const getShortUsername = () => {
    return username
      .split(' ')
      .map((i) => i.charAt(0))
      .join('')
      .toUpperCase();
  };

  const connect = useCallback(
    async (isCameraOn, isMicrophoneOn) => {
      const validRoomName = roomName.trimEnd();
      const validUserName = username.trimEnd();

      setRoomName(validRoomName);
      setUsername(validUserName);

      await requestPermissions();
      try {
        await mbConnect(SERVER_URL, validRoomName, {
          userMetadata: { displayName: validUserName },
          connectionParams: params,
          socketChannelParams: {
            isSimulcastOn,
          },
          simulcastConfig: {
            enabled: isSimulcastOn,
            activeEncodings: ['l', 'm', 'h'],
          },
          quality: Membrane.VideoQuality.HD_169,
          maxBandwidth: { l: 150, m: 500, h: 1500 },
          videoTrackMetadata: { active: true, type: 'camera' },
          audioTrackMetadata: { active: true, type: 'audio' },
          isSpeakerphoneOn: false,
          videoTrackEnabled: isCameraOn,
          audioTrackEnabled: isMicrophoneOn,
        });
        await joinRoom();
        navigation.navigate('Room');
      } catch (err) {
        console.warn(err);
      }
    },
    [
      requestPermissions,
      mbConnect,
      joinRoom,
      roomName,
      isSimulcastOn,
      username,
      SERVER_URL,
    ]
  );

  return (
    <BackgroundWrapper hasHeader>
      <View style={styles.content}>
        <View style={styles.header}>
          <Typo variant="h4">Videoconferencing for everyone</Typo>
        </View>
        <View style={styles.titleLabel}>
          <Typo variant="chat-regular">{titleLabel}</Typo>
        </View>

        <View style={styles.cameraPreview}>
          <View style={styles.iconsRow}>
            <InCallButton
              iconName={isCameraOn ? 'Cam' : 'Cam-disabled'}
              onPress={() => {
                setIsCameraOn(!isCameraOn);
              }}
            />

            <View style={styles.microphoneButton}>
              <InCallButton
                iconName={isMicrophoneOn ? 'Microphone' : 'Microphone-off'}
                onPress={() => {
                  setIsMicrophoneOn(!isMicrophoneOn);
                }}
              />
            </View>
            <InCallButton iconName="Cam-switch" onPress={() => {}} />
          </View>
          {isCameraOn ? (
            <Membrane.VideoPreviewView style={styles.membraneVideoPreview} />
          ) : (
            <View style={styles.noCameraBackground}>
              <View style={styles.noCameraContent}>
                <Typo variant="h5" color={BrandColors.darkBlue80}>
                  {getShortUsername()}
                </Typo>
              </View>
            </View>
          )}
        </View>

        <View style={styles.roomNameLabel}>
          <Typo variant="h5">You are joining: {roomName.trimEnd()}</Typo>
        </View>

        <View style={styles.joinButton}>
          <StandardButton onPress={() => connect(isCameraOn, isMicrophoneOn)}>
            Join the room
          </StandardButton>
        </View>

        <View style={styles.stepLabel}>
          <Typo variant="label">Step 2/2</Typo>
        </View>
      </View>
    </BackgroundWrapper>
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
    zIndex: 3,
  },
  microphoneButton: {
    paddingRight: 16,
    paddingLeft: 16,
  },
  noCameraBackground: {
    backgroundColor: BrandColors.seaBlue20,
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCameraContent: {
    borderRadius: 5000,
    borderColor: BrandColors.darkBlue60,
    borderWidth: 1,
    width: 132,
    height: 132,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
