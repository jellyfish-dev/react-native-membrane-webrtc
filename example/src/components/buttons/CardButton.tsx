import { BrandColors, TextColors } from '@colors';
import { Icon } from '@components/Icon';
import { Typo } from '@components/Typo';
import React, { ReactNode } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { useDebounce } from 'src/shared/debouncer';

const CardButtonStyles = StyleSheet.create({
  wrapper: {
    height: 179,
    width: '100%',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BrandColors.darkBlue100,
  },
  animatedView: {
    height: 179,
    borderRadius: 16,
  },
});

type CardButtonProps = {
  iconName: string;
  onPress: () => void;
  children: ReactNode;
  testID?: string;
};

export const CardButton = ({
  iconName,
  onPress,
  children,
  testID,
}: CardButtonProps) => {
  const progress = useSharedValue(0);
  const debouncedOnPress = useDebounce(onPress);

  const backgroundColorStyle = useAnimatedStyle(
    () => ({
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        [BrandColors.seaBlue40, BrandColors.seaBlue60]
      ),
    }),
    [progress]
  );

  return (
    <View style={CardButtonStyles.wrapper}>
      <Pressable
        onPressIn={() => {
          progress.value = withTiming(1);
        }}
        onPressOut={() => (progress.value = 0)}
        onPress={debouncedOnPress}
        testID={testID}
      >
        <Animated.View
          style={[CardButtonStyles.animatedView, backgroundColorStyle]}
        >
          <View style={CardButtonStyles.content}>
            <Icon name={iconName} size={32} color={TextColors.darkText} />
            <Typo variant="h4">{children}</Typo>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
};
