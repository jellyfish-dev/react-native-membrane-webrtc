import { TextColors } from '@colors';
import { BackgroundAnimation } from '@components/BackgroundAnimation';
import { DiscardModal } from '@components/DiscardModal';
import { TextInput } from '@components/TextInput';
import { Typo } from '@components/Typo';
import { StandardButton } from '@components/buttons/StandardButton';
import { RootStack } from '@model/NavigationTypes';
import { useHeaderHeight } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCardAnimation } from '@react-navigation/stack';
import { isEmptyStringOrWhitespaces } from '@utils';
import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoroomState } from 'src/VideoroomContext';
import { handlePermissions } from 'src/shared/handlePermissions';

type Props = NativeStackScreenProps<RootStack, 'CreateRoom'>;

export const CreateRoom = ({ navigation, route }: Props) => {
  const { width } = Dimensions.get('window');
  const height = useHeaderHeight();
  const {
    isDevMode,
    devServerUrl,
    setDevServerUrl,
    roomName,
    setRoomName,
    username,
    setUsername,
  } = useVideoroomState();
  const { next, current } = useCardAnimation();

  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        //@ts-ignore
        opacity: next
          ? 0
          : current.progress.interpolate({
              inputRange: [0, 0.99, 1],
              outputRange: [0, 0, 1],
            }),
      },
    });
  }, []);

  const openPreview = () => {
    navigation.push('Preview', { title: 'New meeting' });
  };

  const handleBeforeRemoveEvent = (e, setIsModalVisible) => {
    if (!roomName && !username) {
      // If we don't have unsaved changes, then we don't need to do anything
      return;
    }
    e.preventDefault();
    setIsModalVisible(true);
  };

  return (
    <BackgroundAnimation>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={{
            flex: 1,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{
              flex: 1,
            }}
            enabled
            keyboardVerticalOffset={height}
          >
            <DiscardModal
              headline="Discard meeting"
              body="Are you sure you want to discard creation of this meeting?"
              buttonText="Yes, discard meeting"
              handleBeforeRemoveEvent={handleBeforeRemoveEvent}
            />
            <View style={styles.inner}>
              <View>
                <Typo variant={width > 350 ? 'h4' : 'h5'}>
                  Videoconferencing for everyone
                </Typo>
              </View>

              <View style={styles.smallTitle}>
                <Typo variant="chat-regular" color={TextColors.description}>
                  Create a new room to start the meeting
                </Typo>
              </View>
              <View style={styles.roomInputLabel}>
                <Typo variant="body-small">Room name</Typo>
              </View>

              <View style={styles.roomInput}>
                <TextInput
                  placeholder="Room name"
                  value={roomName}
                  onChangeText={setRoomName}
                  testID="room-name"
                />
              </View>
              <View style={styles.usernameInputLabel}>
                <Typo variant="body-small">Your name</Typo>
              </View>
              <View style={styles.usernameInput}>
                <TextInput
                  placeholder="Your name"
                  value={username}
                  onChangeText={setUsername}
                  testID="user-name"
                />
              </View>

              {isDevMode ? (
                <>
                  <View style={styles.usernameInputLabel}>
                    <Typo variant="body-small">Server url</Typo>
                  </View>
                  <View style={styles.usernameInput}>
                    <TextInput
                      placeholder="Server url"
                      value={devServerUrl}
                      onChangeText={setDevServerUrl}
                    />
                  </View>
                </>
              ) : null}

              <View style={styles.createRoomButton} testID="create-room-btn">
                <StandardButton
                  onPress={() => handlePermissions(openPreview)}
                  isEnabled={
                    !isEmptyStringOrWhitespaces(username) &&
                    !isEmptyStringOrWhitespaces(roomName)
                  }
                >
                  Create a room
                </StandardButton>
              </View>

              <View style={styles.stepLabel}>
                <Typo variant="label">Step 1/2</Typo>
              </View>
            </View>
          </KeyboardAvoidingView>
        </ScrollView>
      </SafeAreaView>
    </BackgroundAnimation>
  );
};

const styles = StyleSheet.create({
  smallTitle: {
    marginTop: 8,
  },
  roomInputLabel: {
    marginTop: 43,
    alignSelf: 'flex-start',
  },
  roomInput: {
    marginTop: 3,
    width: '100%',
  },
  usernameInputLabel: {
    marginTop: 19,
    alignSelf: 'flex-start',
  },
  usernameInput: {
    marginTop: 3,
    width: '100%',
  },
  createRoomButton: {
    marginTop: 32,
    width: '100%',
  },
  stepLabel: {
    marginTop: 16,
  },
  inner: {
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    flex: 1,
    justifyContent: 'center',
  },
});
