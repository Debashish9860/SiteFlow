import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

interface BigButtonProps {
  title: string;
  subtitle?: string;
  iconName?: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'success' | 'danger' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const BigButton: React.FC<BigButtonProps> = ({
  title,
  subtitle,
  iconName,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return COLORS.surfaceBorder;
    switch (variant) {
      case 'accent':
        return COLORS.accent;
      case 'success':
        return COLORS.success;
      case 'danger':
        return COLORS.danger;
      case 'outline':
        return 'transparent';
      case 'primary':
      default:
        return COLORS.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return COLORS.textMuted;
    if (variant === 'outline') return COLORS.primary;
    if (variant === 'accent') return '#000000';
    return '#FFFFFF';
  };

  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor() },
        isOutline && styles.outlineBorder,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {iconName && (
            <MaterialIcons
              name={iconName}
              size={24}
              color={getTextColor()}
              style={styles.icon}
            />
          )}
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: getTextColor() }, textStyle]}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: isOutline ? COLORS.textSecondary : 'rgba(255,255,255,0.85)' }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  outlineBorder: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    elevation: 0,
    shadowOpacity: 0,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: SPACING.sm,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
    fontWeight: '500',
  },
});
