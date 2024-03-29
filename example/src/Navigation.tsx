import { VIDEOROOM_URL } from '@env';
import { RootStack } from '@model/NavigationTypes';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { CreateRoom } from '@screens/CreateRoom';
import { InitialScreen } from '@screens/InitialScreen';
import { JoinRoom } from '@screens/JoinRoom';
import { LeaveRoomScreen } from '@screens/LeaveRoomScreen';
import { Preview } from '@screens/Preview';
import { Room } from '@screens/Room';
import React from 'react';

const linking = {
  prefixes: [VIDEOROOM_URL],
  config: {
    initialRouteName: 'InitialScreen' as const,
    screens: {
      InitialScreen: {},
      JoinRoom: {
        path: ':roomName',
        parse: {
          roomName: decodeURIComponent,
        },
      },
    },
  },
  // a hack - reset the stack instead of navigating
  getActionFromState: () => {
    return undefined;
  },
};

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
  },
};

const Stack = createStackNavigator<RootStack>();

export const Navigation = () => {
  return (
    <NavigationContainer linking={linking} theme={navTheme}>
      <Stack.Navigator
        initialRouteName="InitialScreen"
        screenOptions={{
          headerBackTitle: 'Back',
          headerMode: 'float',
          //@ts-ignore
          isHeaderAbsolutelyPositioned: true,
          cardStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen
          name="Room"
          component={Room}
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="LeaveRoom"
          component={LeaveRoomScreen}
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="InitialScreen"
          component={InitialScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="CreateRoom"
          component={CreateRoom}
          options={{
            title: 'New meeting',
          }}
        />
        <Stack.Screen
          name="JoinRoom"
          component={JoinRoom}
          options={{
            title: 'Join meeting',
          }}
        />
        <Stack.Screen name="Preview" component={Preview} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
