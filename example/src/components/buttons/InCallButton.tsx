import { AdditionalColors, BrandColors } from '@colors';
import { Icon } from '@components/Icon';
import React from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  GestureResponderEvent,
} from 'react-native';

const IconSize = 25;

const InCallButtonStyles = StyleSheet.create({
  common: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primary: {
    borderWidth: 1,
    borderColor: BrandColors.darkBlue80,
    borderStyle: 'solid',
    backgroundColor: AdditionalColors.white,
  },
  disconnect: {
    backgroundColor: AdditionalColors.red80,
  },
});

type ButtonTypeName = 'primary' | 'disconnect';

type InCallButtonProps = {
  type?: ButtonTypeName;
  onPress: (event: GestureResponderEvent) => void;
  iconName: string;
  testID?: string;
};

export const InCallButton = ({
  type = 'primary',
  onPress,
  iconName,
  testID,
}: InCallButtonProps) => {
  const GetStylesForButtonType = (type: ButtonTypeName) => {
    return [
      InCallButtonStyles.common,
      type === 'primary'
        ? InCallButtonStyles.primary
        : InCallButtonStyles.disconnect,
    ];
  };

  const GetIconColorForButtonType = (type: ButtonTypeName) => {
    switch (type) {
      case 'primary':
        return BrandColors.darkBlue100;
      case 'disconnect':
        return AdditionalColors.white;
    }
  };

  return (
    <Pressable onPress={onPress} testID={testID}>
      <View style={GetStylesForButtonType(type)}>
        <Icon
          name={iconName}
          size={IconSize}
          color={GetIconColorForButtonType(type)}
        />
      </View>
    </Pressable>
  );
};
