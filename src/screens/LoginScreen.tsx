import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { CustomInput } from '../components/CustomInput';
import { BigButton } from '../components/BigButton';
import { useAuth } from '../context/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { RecaptchaWidget } from '../components/RecaptchaWidget';
import { verifyRecaptchaToken } from '../services/recaptchaService';

export const LoginScreen: React.FC = () => {
  const { login, signup } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaError, setRecaptchaError] = useState<string>('');

  // Entrance Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSubmit = async () => {
    setErrorMessage('');
    setRecaptchaError('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }
    if (isSignUp && !name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!recaptchaToken) {
      setRecaptchaError('Please complete the Google reCAPTCHA verification.');
      setErrorMessage('Security verification required. Please tick "I\'m not a robot".');
      return;
    }

    setSubmitting(true);
    try {
      // Validate token with Google verification service
      const verifyResult = await verifyRecaptchaToken(recaptchaToken);
      if (!verifyResult.success) {
        setRecaptchaToken(null);
        setRecaptchaError(verifyResult.error || 'reCAPTCHA expired or invalid.');
        setErrorMessage(verifyResult.error || 'Security verification failed. Please try again.');
        setSubmitting(false);
        return;
      }

      if (isSignUp) {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Authentication failed. Please check details.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillQuickDemo = async (demoEmail: string, demoPass: string, demoName?: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    if (demoName) setName(demoName);
    setRecaptchaToken('demo-verified-token');
    setRecaptchaError('');
    setErrorMessage('');
    setSubmitting(true);
    try {
      await login(demoEmail, demoPass);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Quick login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Branding */}
          <Animated.View
            style={[
              styles.headerBrandContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: logoScaleAnim }],
              },
            ]}
          >
            <View style={styles.logoBadge}>
              <MaterialIcons name="engineering" size={42} color={COLORS.accent} />
            </View>
            <Text style={styles.brandTitle}>SITEFLOW</Text>
            <Text style={styles.brandSubtitle}>
              Contractor Billing & Quotation Suite
            </Text>
            <View style={styles.proPill}>
              <Text style={styles.proPillText}>PROFESSIONAL EDITION</Text>
            </View>
          </Animated.View>

          {/* Form Card */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Mode Switch Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                onPress={() => {
                  setIsSignUp(false);
                  setErrorMessage('');
                }}
                style={[styles.tabBtn, !isSignUp && styles.tabBtnActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, !isSignUp && styles.tabTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setIsSignUp(true);
                  setErrorMessage('');
                }}
                style={[styles.tabBtn, isSignUp && styles.tabBtnActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, isSignUp && styles.tabTextActive]}>
                  Create Account
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error Message Box */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={18} color="#DC2626" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Form Inputs */}
            {isSignUp ? (
              <CustomInput
                label="Full Name *"
                placeholder="e.g. Ramesh Raut"
                value={name}
                onChangeText={setName}
                iconName="person"
              />
            ) : null}

            <CustomInput
              label="Email Address *"
              placeholder="e.g. rajeebraut@gmail.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              iconName="email"
            />

            <View style={styles.passwordWrapper}>
              <CustomInput
                label="Password *"
                placeholder="Enter password (min 6 characters)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                iconName="lock"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Google reCAPTCHA Verification Widget */}
            <RecaptchaWidget
              isVerified={!!recaptchaToken}
              onVerify={(token) => {
                setRecaptchaToken(token);
                setRecaptchaError('');
                setErrorMessage('');
              }}
              onExpire={() => {
                setRecaptchaToken(null);
              }}
              onReset={() => {
                setRecaptchaToken(null);
                setRecaptchaError('');
              }}
              errorMessage={recaptchaError}
            />

            {/* Submit Action Button */}
            <BigButton
              title={isSignUp ? 'Create SiteFlow Account' : 'Sign In to SiteFlow'}
              subtitle={isSignUp ? 'Start managing contractor bills' : 'Access your bills and quotations'}
              iconName={isSignUp ? 'person-add' : 'login'}
              variant="primary"
              loading={submitting}
              onPress={handleSubmit}
              style={{ marginTop: SPACING.sm }}
            />

            {/* 1-Tap Demo Logins */}
            {!isSignUp ? (
              <View style={styles.demoSection}>
                <View style={styles.demoDividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR 1-TAP REAL GMAIL DEMO</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.demoChipsRow}>
                  <TouchableOpacity
                    onPress={() => fillQuickDemo('rajeebraut@gmail.com', 'pass123', 'Rajeeb Raut')}
                    style={styles.demoChip}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="verified-user" size={15} color={COLORS.primary} />
                    <Text style={styles.demoChipText}>Rajeeb Raut</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => fillQuickDemo('rameshraut@gmail.com', 'pass123', 'Ramesh Raut')}
                    style={styles.demoChip}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="verified-user" size={15} color={COLORS.primary} />
                    <Text style={styles.demoChipText}>Ramesh Raut</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => fillQuickDemo('admin.siteflow@gmail.com', 'siteflow2026', 'SiteFlow Admin')}
                    style={styles.demoChip}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="security" size={15} color={COLORS.primary} />
                    <Text style={styles.demoChipText}>Admin</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </Animated.View>

          {/* Footer Note */}
          <Text style={styles.footerNote}>
            SiteFlow 2026 • Secure Offline-First Mobile Invoicing
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  headerBrandContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  proPill: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 10,
  },
  proPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    padding: 4,
    marginBottom: SPACING.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
  passwordWrapper: {
    position: 'relative',
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 36,
    padding: 6,
  },
  demoSection: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.xs,
  },
  demoDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginHorizontal: 10,
    letterSpacing: 0.8,
  },
  demoChipsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  demoChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  demoChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: SPACING.lg,
    fontWeight: '500',
  },
});
