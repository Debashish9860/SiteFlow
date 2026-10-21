import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { CustomInput } from '../components/CustomInput';
import { BigButton } from '../components/BigButton';
import { useAuth } from '../context/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AuthMode = 'signin' | 'signup' | 'forgot';

export const LoginScreen: React.FC = () => {
  const { login, signup, sendOtp, verifyOtpAndReset } = useAuth();

  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimerSeconds, setOtpTimerSeconds] = useState(300); // 5 minutes TTL
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // ==========================================
  // EYE-CATCHING FLUID ANIMATIONS
  // ==========================================
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(35)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.8)).current;

  // Ambient floating orbs animations
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;

  // Pulse ring around the logo
  const pulseRingAnim = useRef(new Animated.Value(0)).current;

  // Live status blinking dot
  const statusDotAnim = useRef(new Animated.Value(0.4)).current;

  // Form mode switch transition
  const modeFadeAnim = useRef(new Animated.Value(1)).current;
  const modeSlideAnim = useRef(new Animated.Value(0)).current;

  // Footer floating shimmer
  const footerFloatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Mount Entrance Animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Ambient Floating Orbs Loop
    const orbLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(orb1Anim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orb1Anim, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    orbLoop.start();

    const orb2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orb2Anim, {
          toValue: 1,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orb2Anim, {
          toValue: 0,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    orb2Loop.start();

    // 3. Glowing Pulse Ring Loop around Logo
    const pulseRingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRingAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseRingAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    pulseRingLoop.start();

    // 4. Live Status Green Dot Pulse Loop
    const dotLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(statusDotAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(statusDotAnim, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    dotLoop.start();

    // 5. Footer Floating Micro-Animation
    const footerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(footerFloatAnim, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(footerFloatAnim, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    footerLoop.start();

    return () => {
      orbLoop.stop();
      orb2Loop.stop();
      pulseRingLoop.stop();
      dotLoop.stop();
      footerLoop.stop();
    };
  }, []);

  // 5-Minute OTP Countdown Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (authMode === 'forgot' && otpSent && otpTimerSeconds > 0) {
      interval = setInterval(() => {
        setOtpTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [authMode, otpSent, otpTimerSeconds]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const switchMode = (mode: AuthMode) => {
    // Smooth transition between form cards
    Animated.sequence([
      Animated.timing(modeFadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(modeSlideAnim, {
        toValue: 12,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAuthMode(mode);
      setErrorMessage('');
      setSuccessMessage('');
      setOtpSent(false);
      setOtpCode('');

      Animated.parallel([
        Animated.timing(modeFadeAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(modeSlideAnim, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleSignIn = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both your Google email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Please enter your Google email address.');
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setErrorMessage('Please enter a valid Google email address (e.g. name@gmail.com).');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-confirm your password.');
      return;
    }

    setSubmitting(true);
    try {
      await signup(name, email, password, confirmPassword);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Registration failed. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendOtp = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your registered Google email address.');
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await sendOtp(email);
      setOtpSent(true);
      setOtpTimerSeconds(res.expiresInSeconds || 300);
      setSuccessMessage(`A 6-digit OTP code has been sent to ${email}. Valid for 5 minutes.`);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Could not send OTP email. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtpAndReset = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code sent to your email.');
      return;
    }
    if (otpTimerSeconds <= 0) {
      setErrorMessage('This OTP has expired. Please tap "Resend OTP" to get a new code.');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('New passwords do not match. Please re-check.');
      return;
    }

    setSubmitting(true);
    try {
      await verifyOtpAndReset(email, otpCode, password, confirmPassword);
      setSuccessMessage('Password reset successfully! Redirecting to Sign In...');
      setPassword('');
      setConfirmPassword('');
      setOtpCode('');
      setTimeout(() => {
        switchMode('signin');
      }, 1500);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Could not reset password. Please check OTP and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const insets = useSafeAreaInsets();
  const topSafePadding = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0
  ) + 12;
  const bottomSafePadding = Math.max(insets.bottom, 16);

  // Interpolations for ambient animated backgrounds
  const orb1TranslateY = orb1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 24],
  });
  const orb1Scale = orb1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const orb2TranslateY = orb2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -28],
  });
  const orb2Scale = orb2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  const pulseRingScale = pulseRingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.48],
  });
  const pulseRingOpacity = pulseRingAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.55, 0.25, 0],
  });

  const footerTranslateY = footerFloatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2C0411" translucent />

      {/* ========================================== */}
      {/* ATMOSPHERIC AMBIENT GLOW ORBS (BACKGROUND) */}
      {/* ========================================== */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Top-Right Glowing Golden Orb */}
        <Animated.View
          style={[
            styles.ambientOrb,
            styles.ambientOrbGold,
            {
              transform: [
                { translateY: orb1TranslateY },
                { scale: orb1Scale },
              ],
            },
          ]}
        />
        {/* Bottom-Left Glowing Deep Wine Orb */}
        <Animated.View
          style={[
            styles.ambientOrb,
            styles.ambientOrbCrimson,
            {
              transform: [
                { translateY: orb2TranslateY },
                { scale: orb2Scale },
              ],
            },
          ]}
        />
        {/* Subtle Decorative Construction Accent Lines */}
        <View style={styles.accentGridLine1} />
        <View style={styles.accentGridLine2} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: topSafePadding, paddingBottom: bottomSafePadding },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ========================================== */}
          {/* HERO BRANDING WITH EYE-CATCHING ANIMATION  */}
          {/* ========================================== */}
          <Animated.View
            style={[
              styles.headerBrandContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: logoScaleAnim }],
              },
            ]}
          >
            {/* Animated Glowing Logo with Radar Pulse Aura */}
            <View style={styles.logoWrapper}>
              <Animated.View
                style={[
                  styles.logoPulseRing,
                  {
                    transform: [{ scale: pulseRingScale }],
                    opacity: pulseRingOpacity,
                  },
                ]}
              />
              <View style={styles.logoBadge}>
                <View style={styles.logoInnerGlow}>
                  <MaterialIcons name="engineering" size={40} color={COLORS.accent} />
                </View>
              </View>
            </View>

            {/* Brand Titles */}
            <View style={styles.titleWrapper}>
              <Text style={styles.brandTitle}>SITEFLOW</Text>
              <View style={styles.brandTitleUnderline} />
            </View>

            <Text style={styles.brandSubtitle}>
              Contractor Billing & Quotation Suite
            </Text>

            {/* Live Security Status Pill */}
            <View style={styles.securePill}>
              <Animated.View
                style={[
                  styles.statusLedDot,
                  { opacity: statusDotAnim },
                ]}
              />
              <Text style={styles.securePillText}>SECURE CONTRACTOR PORTAL</Text>
              <MaterialIcons name="verified" size={13} color={COLORS.accent} />
            </View>
          </Animated.View>

          {/* ========================================== */}
          {/* MAIN FORM CARD (ELEVATED WITH ACCENT TOP)  */}
          {/* ========================================== */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Top Accent Gradient Bar */}
            <View style={styles.cardTopAccentBar} />

            {/* Inner Content with Animated Mode Transition */}
            <Animated.View
              style={{
                opacity: modeFadeAnim,
                transform: [{ translateY: modeSlideAnim }],
              }}
            >
              {/* Header Badge & Title */}
              {authMode === 'signin' && (
                <View style={styles.formHeaderRow}>
                  <View style={styles.formIconBadge}>
                    <MaterialIcons name="login" size={22} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.formTitle}>Sign In</Text>
                    <Text style={styles.formSubtitle}>
                      Enter your Google email & password to access your bills
                    </Text>
                  </View>
                </View>
              )}

              {authMode === 'signup' && (
                <View style={styles.formHeaderRow}>
                  <View style={[styles.formIconBadge, { backgroundColor: 'rgba(245, 166, 35, 0.12)' }]}>
                    <MaterialIcons name="person-add" size={22} color={COLORS.accentDark} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.formTitle}>Create Account</Text>
                    <Text style={styles.formSubtitle}>
                      Register your genuine contractor account in seconds
                    </Text>
                  </View>
                </View>
              )}

              {authMode === 'forgot' && (
                <View style={styles.formHeaderRow}>
                  <View style={[styles.formIconBadge, { backgroundColor: 'rgba(5, 150, 105, 0.12)' }]}>
                    <MaterialIcons name="mark-email-read" size={22} color="#059669" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.formTitle}>
                      {otpSent ? 'Enter 6-Digit OTP' : 'Reset Password'}
                    </Text>
                    <Text style={styles.formSubtitle}>
                      {otpSent
                        ? 'Check your Gmail for the 6-digit verification code'
                        : 'We will send a secure 6-digit OTP code to your Gmail'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Error Alert Box */}
              {errorMessage ? (
                <View style={styles.errorBox}>
                  <MaterialIcons name="error-outline" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Success Alert Box */}
              {successMessage ? (
                <View style={styles.successBox}>
                  <MaterialIcons name="check-circle" size={18} color="#16A34A" />
                  <Text style={styles.successText}>{successMessage}</Text>
                </View>
              ) : null}

              {/* ======================================================== */}
              {/* 1. SIGN IN MODE                                          */}
              {/* ======================================================== */}
              {authMode === 'signin' && (
                <>
                  <CustomInput
                    label="Google Email Address *"
                    placeholder="e.g. yourname@gmail.com"
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      setErrorMessage('');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    iconName="email"
                    required
                  />

                  <View style={{ position: 'relative' }}>
                    <CustomInput
                      label="Password *"
                      placeholder="Enter your password"
                      value={password}
                      onChangeText={(val) => {
                        setPassword(val);
                        setErrorMessage('');
                      }}
                      secureTextEntry={!showPassword}
                      iconName="lock"
                      required
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

                  <TouchableOpacity
                    onPress={() => switchMode('forgot')}
                    style={styles.forgotBtn}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="lock-reset" size={14} color={COLORS.primary} />
                    <Text style={styles.forgotBtnText}>Forgot Password?</Text>
                  </TouchableOpacity>

                  <BigButton
                    title="Sign In to SiteFlow"
                    subtitle="Access your bills and cloud data"
                    iconName="login"
                    variant="primary"
                    loading={submitting}
                    onPress={handleSignIn}
                    style={{ marginTop: 4 }}
                  />
                </>
              )}

              {/* ======================================================== */}
              {/* 2. CREATE ACCOUNT / SIGN UP MODE                         */}
              {/* ======================================================== */}
              {authMode === 'signup' && (
                <>
                  <CustomInput
                    label="Full Name *"
                    placeholder="e.g. Debashish Raut"
                    value={name}
                    onChangeText={(val) => {
                      setName(val);
                      setErrorMessage('');
                    }}
                    iconName="person"
                    required
                  />

                  <CustomInput
                    label="Google Email Address *"
                    placeholder="e.g. yourname@gmail.com"
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      setErrorMessage('');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    iconName="email"
                    required
                  />

                  <View style={{ position: 'relative' }}>
                    <CustomInput
                      label="Password (min 6 characters) *"
                      placeholder="Create password"
                      value={password}
                      onChangeText={(val) => {
                        setPassword(val);
                        setErrorMessage('');
                      }}
                      secureTextEntry={!showPassword}
                      iconName="lock"
                      required
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

                  <View style={{ position: 'relative' }}>
                    <CustomInput
                      label="Confirm Password *"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChangeText={(val) => {
                        setConfirmPassword(val);
                        setErrorMessage('');
                      }}
                      secureTextEntry={!showConfirmPassword}
                      iconName="lock-outline"
                      required
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeBtn}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name={showConfirmPassword ? 'visibility-off' : 'visibility'}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  <BigButton
                    title="Create SiteFlow Account"
                    subtitle="Register & get started immediately"
                    iconName="person-add"
                    variant="primary"
                    loading={submitting}
                    onPress={handleSignUp}
                    style={{ marginTop: SPACING.xs }}
                  />
                </>
              )}

              {/* ======================================================== */}
              {/* 3. FORGOT PASSWORD & OTP VERIFICATION MODE               */}
              {/* ======================================================== */}
              {authMode === 'forgot' && (
                <>
                  {!otpSent ? (
                    /* Step 1: Enter Email to Send OTP */
                    <>
                      <CustomInput
                        label="Registered Google Email *"
                        placeholder="e.g. yourname@gmail.com"
                        value={email}
                        onChangeText={(val) => {
                          setEmail(val);
                          setErrorMessage('');
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        iconName="email"
                        required
                      />

                      <View style={styles.otpNoticeBox}>
                        <MaterialIcons name="mail-outline" size={18} color="#B45309" />
                        <Text style={styles.otpNoticeText}>
                          A secure 6-digit OTP code will be sent to your Gmail from{' '}
                          <Text style={{ fontWeight: '800' }}>debashishrout9860@gmail.com</Text> (Valid for 5 mins).
                        </Text>
                      </View>

                      <BigButton
                        title="Send 6-Digit OTP"
                        subtitle="Deliver verification code to Gmail"
                        iconName="send"
                        variant="primary"
                        loading={submitting}
                        onPress={handleSendOtp}
                        style={{ marginTop: SPACING.sm }}
                      />
                    </>
                  ) : (
                    /* Step 2: Enter OTP & Set New Password */
                    <>
                      <View style={styles.targetEmailRow}>
                        <MaterialIcons name="mark-email-read" size={16} color={COLORS.primary} />
                        <Text style={styles.targetEmailText} numberOfLines={1}>
                          OTP sent to: <Text style={{ fontWeight: '800' }}>{email}</Text>
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setOtpSent(false);
                            setErrorMessage('');
                            setSuccessMessage('');
                          }}
                        >
                          <Text style={styles.changeEmailText}>Change</Text>
                        </TouchableOpacity>
                      </View>

                      {/* 6-Digit OTP Input */}
                      <CustomInput
                        label="Enter 6-Digit OTP Code *"
                        placeholder="• • • • • •"
                        value={otpCode}
                        onChangeText={(val) => {
                          setOtpCode(val.replace(/[^0-9]/g, '').slice(0, 6));
                          setErrorMessage('');
                        }}
                        keyboardType="number-pad"
                        iconName="vpn-key"
                        required
                        style={styles.otpInputStyle}
                      />

                      {/* 5-Min Timer & Resend Button */}
                      <View style={styles.timerRow}>
                        <View
                          style={[
                            styles.timerBadge,
                            otpTimerSeconds <= 0 && styles.timerBadgeExpired,
                          ]}
                        >
                          <MaterialIcons
                            name="timer"
                            size={14}
                            color={otpTimerSeconds > 0 ? '#15803D' : '#DC2626'}
                          />
                          <Text
                            style={[
                              styles.timerText,
                              otpTimerSeconds <= 0 && styles.timerTextExpired,
                            ]}
                          >
                            {otpTimerSeconds > 0
                              ? `Valid: ${formatTimer(otpTimerSeconds)}`
                              : 'Code expired'}
                          </Text>
                        </View>

                        <TouchableOpacity
                          onPress={handleSendOtp}
                          disabled={submitting}
                          style={styles.resendBtn}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons name="refresh" size={14} color={COLORS.primary} />
                          <Text style={styles.resendBtnText}>Resend OTP</Text>
                        </TouchableOpacity>
                      </View>

                      {/* New Password */}
                      <View style={{ position: 'relative', marginTop: 6 }}>
                        <CustomInput
                          label="New Password (min 6 characters) *"
                          placeholder="Enter new password"
                          value={password}
                          onChangeText={(val) => {
                            setPassword(val);
                            setErrorMessage('');
                          }}
                          secureTextEntry={!showPassword}
                          iconName="lock"
                          required
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

                      {/* Confirm New Password */}
                      <View style={{ position: 'relative' }}>
                        <CustomInput
                          label="Confirm New Password *"
                          placeholder="Re-enter new password"
                          value={confirmPassword}
                          onChangeText={(val) => {
                            setConfirmPassword(val);
                            setErrorMessage('');
                          }}
                          secureTextEntry={!showConfirmPassword}
                          iconName="lock-outline"
                          required
                        />
                        <TouchableOpacity
                          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={styles.eyeBtn}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name={showConfirmPassword ? 'visibility-off' : 'visibility'}
                            size={20}
                            color={COLORS.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>

                      <BigButton
                        title="Verify OTP & Update Password"
                        subtitle="Authenticate and update account"
                        iconName="check-circle"
                        variant="primary"
                        loading={submitting}
                        onPress={handleVerifyOtpAndReset}
                        style={{ marginTop: SPACING.xs }}
                      />
                    </>
                  )}
                </>
              )}

              {/* ======================================================== */}
              {/* BOTTOM NAVIGATION LINKS (CLEAN & INTERACTIVE)             */}
              {/* ======================================================== */}
              <View style={styles.bottomSwitchWrap}>
                <View style={styles.bottomDivider} />
                {authMode === 'signin' ? (
                  <TouchableOpacity
                    onPress={() => switchMode('signup')}
                    style={styles.bottomNavCard}
                    activeOpacity={0.75}
                  >
                    <View style={styles.bottomNavLeft}>
                      <Text style={styles.bottomNavSub}>Don't have an account?</Text>
                      <Text style={styles.bottomNavTitle}>Create New Account</Text>
                    </View>
                    <View style={styles.bottomNavArrowCircle}>
                      <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ) : authMode === 'signup' ? (
                  <TouchableOpacity
                    onPress={() => switchMode('signin')}
                    style={styles.bottomNavCard}
                    activeOpacity={0.75}
                  >
                    <View style={styles.bottomNavLeft}>
                      <Text style={styles.bottomNavSub}>Already registered?</Text>
                      <Text style={styles.bottomNavTitle}>Sign In to Account</Text>
                    </View>
                    <View style={styles.bottomNavArrowCircle}>
                      <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => switchMode('signin')}
                    style={styles.bottomNavCard}
                    activeOpacity={0.75}
                  >
                    <View style={styles.bottomNavLeft}>
                      <Text style={styles.bottomNavSub}>Remembered credentials?</Text>
                      <Text style={styles.bottomNavTitle}>Back to Sign In</Text>
                    </View>
                    <View style={styles.bottomNavArrowCircle}>
                      <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </Animated.View>

          {/* ========================================== */}
          {/* PERSISTENT BRANDED FOOTER                  */}
          {/* ========================================== */}
          <Animated.View
            style={[
              styles.loginFooterContainer,
              { transform: [{ translateY: footerTranslateY }] },
            ]}
          >
            <View style={styles.loginFooterPill}>
              <MaterialIcons name="bolt" size={14} color={COLORS.accent} />
              <Text style={styles.loginFooterBrand}>POWERED BY DEBASHISH RAUT</Text>
            </View>
            <Text style={styles.footerNote}>
              SiteFlow 2026 • Real-Time Cloud Sync & Offline Invoicing
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#350616', // Deep Luxury Velvet Maroon
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },

  // Atmospheric Ambient Glow Orbs
  ambientOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  ambientOrbGold: {
    width: 260,
    height: 260,
    top: -40,
    right: -60,
    backgroundColor: '#F5A623',
    opacity: 0.16,
  },
  ambientOrbCrimson: {
    width: 280,
    height: 280,
    bottom: -50,
    left: -70,
    backgroundColor: '#941B42',
    opacity: 0.22,
  },
  accentGridLine1: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  accentGridLine2: {
    position: 'absolute',
    top: 240,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },

  // Header Hero Branding
  headerBrandContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoWrapper: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoPulseRing: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: COLORS.accent,
  },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 2.5,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  logoInnerGlow: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrapper: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2.5,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  brandTitleUnderline: {
    width: 44,
    height: 3,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
    marginTop: 2,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.88)',
    fontWeight: '600',
    textAlign: 'center',
  },
  securePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 20,
    marginTop: 10,
  },
  statusLedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
  },
  securePillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },

  // Elevated Form Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: SPACING.lg,
    paddingTop: SPACING.lg + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'relative',
  },
  cardTopAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: COLORS.primary,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  formIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(124, 16, 52, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  formSubtitle: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },

  // Alerts
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    padding: 10,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  successText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  // Input & Eye Icon
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 36,
    padding: 6,
    zIndex: 10,
  },
  forgotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    marginTop: -2,
    marginBottom: 12,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  forgotBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // OTP Notice & Styling
  otpNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 10,
    borderRadius: 10,
    marginBottom: SPACING.sm,
  },
  otpNoticeText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
    lineHeight: 15,
  },
  targetEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    padding: 9,
    borderRadius: 10,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  targetEmailText: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    flex: 1,
  },
  changeEmailText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.primary,
  },
  otpInputStyle: {
    letterSpacing: 6,
    fontWeight: '900',
    fontSize: 18,
    textAlign: 'center',
    color: COLORS.primary,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerBadgeExpired: {
    backgroundColor: '#FEE2E2',
  },
  timerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  timerTextExpired: {
    color: '#DC2626',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resendBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // Bottom Navigation Card Links
  bottomSwitchWrap: {
    marginTop: 14,
  },
  bottomDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  bottomNavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bottomNavLeft: {
    flex: 1,
  },
  bottomNavSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  bottomNavTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 1,
  },
  bottomNavArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Branded Persistent Footer
  loginFooterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  loginFooterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 6,
  },
  loginFooterBrand: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '500',
  },
});
