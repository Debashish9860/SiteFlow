import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

interface CustomInputProps extends TextInputProps {
  label: string;
  sublabel?: string;
  iconName?: keyof typeof MaterialIcons.glyphMap;
  containerStyle?: ViewStyle;
  required?: boolean;
}

export const CustomInput: React.FC<CustomInputProps> = ({
  label,
  sublabel,
  iconName,
  containerStyle,
  required,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label} {required ? <Text style={styles.required}>*</Text> : null}
        </Text>
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      </View>
      <View style={styles.inputContainer}>
        {iconName && (
          <MaterialIcons
            name={iconName}
            size={20}
            color={COLORS.textSecondary}
            style={styles.inputIcon}
          />
        )}
        <TextInput
          placeholderTextColor={COLORS.textMuted}
          style={[styles.input, iconName ? { paddingLeft: 0 } : null]}
          {...props}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  required: {
    color: COLORS.danger,
  },
  sublabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceBorder,
    borderRadius: 10,
    minHeight: 52,
    paddingHorizontal: SPACING.md,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    fontWeight: '500',
    paddingVertical: 10,
  },
});
