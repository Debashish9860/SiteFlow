import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';

interface SyncSuccessToastProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  syncedCount?: number;
}

export const SyncSuccessToast: React.FC<SyncSuccessToastProps> = ({
  visible,
  onClose,
  title = 'Data Sync Done!',
  subtitle = 'All bills & payments are synchronized with MongoDB Atlas.',
  syncedCount,
}) => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const checkScaleAnim = useRef(new Animated.Value(0)).current;
  const ringScaleAnim = useRef(new Animated.Value(0.7)).current;
  const ringOpacityAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      // Reset values
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      checkScaleAnim.setValue(0);
      ringScaleAnim.setValue(0.6);
      ringOpacityAnim.setValue(0.9);

      // 1. Entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();

      // 2. Pop and bounce the green tick mark
      Animated.sequence([
        Animated.delay(100),
        Animated.spring(checkScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();

      // 3. Ripple pulse ring animation
      Animated.sequence([
        Animated.delay(120),
        Animated.parallel([
          Animated.timing(ringScaleAnim, {
            toValue: 1.35,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacityAnim, {
            toValue: 0,
            duration: 650,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Auto-dismiss after 2.3 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 2300);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* Animated Ripple Ring behind Tick Mark */}
              <View style={styles.iconContainer}>
                <Animated.View
                  style={[
                    styles.rippleRing,
                    {
                      transform: [{ scale: ringScaleAnim }],
                      opacity: ringOpacityAnim,
                    },
                  ]}
                />

                {/* Green Circle with White Checkmark */}
                <Animated.View
                  style={[
                    styles.checkBadge,
                    {
                      transform: [{ scale: checkScaleAnim }],
                    },
                  ]}
                >
                  <MaterialIcons name="check" size={38} color="#FFFFFF" />
                </Animated.View>
              </View>

              {/* Success Title */}
              <Text style={styles.titleText}>{title}</Text>

              {/* Subtitle / Details */}
              <Text style={styles.subText}>
                {syncedCount !== undefined && syncedCount >= 0
                  ? `${syncedCount} bills & records up-to-date across all team devices.`
                  : subtitle}
              </Text>

              {/* Database Cluster Tag */}
              <View style={styles.clusterPill}>
                <View style={styles.greenDot} />
                <Text style={styles.clusterPillText}>MongoDB Atlas • Cluster0 Connected</Text>
              </View>

              {/* Quick Dismiss Button */}
              <TouchableOpacity
                onPress={handleDismiss}
                style={styles.doneBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.doneBtnText}>Great, Done</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
  },
  iconContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  rippleRing: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#86EFAC',
  },
  checkBadge: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  subText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  clusterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 18,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16A34A',
  },
  clusterPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.3,
  },
  doneBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
