import { BackgroundAnimation } from '@components/BackgroundAnimation';
import { Typo } from '@components/Typo';
import { CardButton } from '@components/buttons/CardButton';
import * as Application from 'expo-application';
import React from 'react';
import { View, StyleSheet, Image, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoroomState } from 'src/VideoroomContext';

export const InitialScreen = ({ navigation }) => {
  const { isDevMode, setSavedIsDevMode } = useVideoroomState();

  const toggleDevMode = async () => {
    const updatedIsDevMode = !isDevMode;
    Alert.alert(
      'Dev mode is now '.concat(updatedIsDevMode ? 'enabled' : 'disabled')
    );
    setSavedIsDevMode(updatedIsDevMode);
  };

  return (
    <BackgroundAnimation>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable onLongPress={toggleDevMode}>
              <Image
                style={styles.logo}
                source={require('@assets/images/Logo.png')}
              />
            </Pressable>
            <View style={styles.subtitle}>
              <Typo variant="h5">Videoconferencing for everyone</Typo>
            </View>
          </View>

          <View style={styles.createButton}>
            <CardButton
              iconName="edit"
              onPress={() => {
                navigation.push('CreateRoom');
              }}
              testID="create-room"
            >
              Create new meeting
            </CardButton>
          </View>

          <View style={styles.joinButton}>
            <CardButton
              iconName="Users"
              onPress={() => {
                navigation.push('JoinRoom');
              }}
            >
              Join existing meeting
            </CardButton>
          </View>
        </View>
        <Typo variant="body-small" style={styles.versionName}>
          App version: {Application.nativeApplicationVersion}
          {isDevMode ? '_DEV' : ''}
        </Typo>
      </SafeAreaView>
    </BackgroundAnimation>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignSelf: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingLeft: 16,
    paddingRight: 16,
  },
  header: {
    alignItems: 'center',
  },
  subtitle: {
    marginTop: 8,
  },
  createButton: {
    marginTop: 64,
  },
  joinButton: {
    marginTop: 16,
  },
  logo: {
    width: 223,
    height: 49,
    resizeMode: 'contain',
  },
  versionName: {
    marginLeft: 16,
  },
});
