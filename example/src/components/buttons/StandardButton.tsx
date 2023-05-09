import { AdditionalColors, BrandColors, TextColors } from '@colors';
import { Typo } from '@components/Typo';
import React, { ReactNode } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useDebounce } from 'src/shared/debouncer';

const StandardButtonStyles = StyleSheet.create({
  common: {
    width: '100%',
    height: 56,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  primary: {
    backgroundColor: BrandColors.darkBlue100,
  },
  danger: {
    backgroundColor: AdditionalColors.red100,
  },
  secondary: {
    backgroundColor: AdditionalColors.white,
  },
  disabled: {
    backgroundColor: AdditionalColors.grey60,
  },
});

type StandardButtonTypeName = 'primary' | 'danger' | 'secondary';

type StandardButtonProps = {
  type?: StandardButtonTypeName;
  isEnabled?: boolean;
  onPress: () => void;
  children: ReactNode;
  testID?: string;
};

export const StandardButton = ({
  type = 'primary',
  isEnabled = true,
  onPress,
  children,
  testID,
}: StandardButtonProps) => {
  const debouncedOnPress = useDebounce(onPress);

  const GetBackgroundColorStyle = (
    type: StandardButtonTypeName,
    isEnabled: boolean
  ) => {
    if (!isEnabled) {
      return StandardButtonStyles.disabled;
    }
    switch (type) {
      case 'primary':
        return StandardButtonStyles.primary;
      case 'danger':
        return StandardButtonStyles.danger;
      case 'secondary':
        return StandardButtonStyles.secondary;
    }
  };

  const GetStylesForButtonType = (type: StandardButtonTypeName) => {
    return [
      StandardButtonStyles.common,
      GetBackgroundColorStyle(type, isEnabled),
    ];
  };

  const GetTextColorForButtonType = (
    type: StandardButtonTypeName,
    isEnabled: boolean
  ) => {
    if (!isEnabled) {
      return TextColors.white;
    }
    switch (type) {
      case 'primary':
        return TextColors.white;
      case 'danger':
        return TextColors.white;
      case 'secondary':
        return TextColors.darkText;
    }
  };

  return (
    <TouchableOpacity
      onPress={debouncedOnPress}
      disabled={!isEnabled}
      testID={testID}
    >
      <View style={GetStylesForButtonType(type)}>
        <Typo
          variant="button"
          color={GetTextColorForButtonType(type, isEnabled)}
        >
          {children}
        </Typo>
      </View>
    </TouchableOpacity>
  );
};
