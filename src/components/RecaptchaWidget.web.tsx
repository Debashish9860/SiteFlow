import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { RECAPTCHA_CONFIG } from '../config/recaptchaConfig';

interface RecaptchaWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  isVerified: boolean;
  onReset?: () => void;
  errorMessage?: string;
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      render: (
        container: string | HTMLElement,
        parameters: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark';
          size?: 'normal' | 'compact';
        }
      ) => number;
      reset: (widgetId?: number) => void;
      getResponse: (widgetId?: number) => string;
    };
    onSiteFlowRecaptchaLoaded?: () => void;
  }
}

export const RecaptchaWidget: React.FC<RecaptchaWidgetProps> = ({
  onVerify,
  onExpire,
  isVerified,
  onReset,
  errorMessage,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const renderWidget = () => {
      if (!isMounted || !containerRef.current || !window.grecaptcha) return;
      try {
        window.grecaptcha.ready(() => {
          if (!isMounted || !containerRef.current) return;
          // Clear any previous child nodes in container
          containerRef.current.innerHTML = '';

          try {
            const id = window.grecaptcha!.render(containerRef.current, {
              sitekey: RECAPTCHA_CONFIG.SITE_KEY,
              theme: 'light',
              size: 'normal',
              callback: (token: string) => {
                if (isMounted) {
                  onVerify(token);
                }
              },
              'expired-callback': () => {
                if (isMounted) {
                  onExpire?.();
                }
              },
              'error-callback': () => {
                console.warn('reCAPTCHA client encountered an error');
              },
            });
            widgetIdRef.current = id;
            setLoading(false);
          } catch (renderErr: any) {
            console.warn('reCAPTCHA render error:', renderErr);
            setLoading(false);
          }
        });
      } catch (err: any) {
        if (isMounted) {
          setLoadError(err?.message || 'Failed to initialize Google reCAPTCHA');
          setLoading(false);
        }
      }
    };

    // Check if script is already present
    const existingScript = document.getElementById('google-recaptcha-script');

    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-recaptcha-script';
      script.src = `${RECAPTCHA_CONFIG.API_SCRIPT_URL}?onload=onSiteFlowRecaptchaLoaded&render=explicit`;
      script.async = true;
      script.defer = true;

      window.onSiteFlowRecaptchaLoaded = () => {
        renderWidget();
      };

      script.onerror = () => {
        if (isMounted) {
          setLoadError('Failed to load Google reCAPTCHA script.');
          setLoading(false);
        }
      };

      document.head.appendChild(script);
    } else {
      if (typeof window.grecaptcha?.render === 'function') {
        renderWidget();
      } else {
        window.onSiteFlowRecaptchaLoaded = () => {
          renderWidget();
        };
      }
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const handleReset = () => {
    if (widgetIdRef.current !== null && window.grecaptcha) {
      try {
        window.grecaptcha.reset(widgetIdRef.current);
      } catch (e) {
        console.warn('Failed to reset widget:', e);
      }
    }
    onReset?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <MaterialIcons name="security" size={16} color={COLORS.primary} />
          <Text style={styles.titleText}>SECURITY VERIFICATION</Text>
        </View>
        <Text style={styles.googleBadge}>Google reCAPTCHA</Text>
      </View>

      {/* Verified Pill */}
      {isVerified ? (
        <View style={styles.verifiedBox}>
          <View style={styles.verifiedLeft}>
            <View style={styles.checkCircle}>
              <MaterialIcons name="check" size={16} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.verifiedTitle}>reCAPTCHA Verified</Text>
              <Text style={styles.verifiedSub}>Bot protection check passed</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleReset} style={styles.resetBtn} activeOpacity={0.7}>
            <MaterialIcons name="refresh" size={14} color={COLORS.textSecondary} />
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Web DOM Container for Google reCAPTCHA */}
      <View
        style={[
          styles.widgetWrap,
          isVerified && { display: 'none' }, // Hide raw box when verified
        ]}
      >
        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading Google reCAPTCHA...</Text>
          </View>
        )}

        {loadError ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="warning" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : null}

        {/* The Native HTML div mounted by React Native Web */}
        <div
          ref={containerRef}
          style={{
            display: loading ? 'none' : 'flex',
            justifyContent: 'center',
            minHeight: '78px',
          }}
        />
      </View>

      {/* Guidance / Error Note */}
      {errorMessage && !isVerified ? (
        <View style={styles.fieldErrorRow}>
          <MaterialIcons name="info-outline" size={14} color="#DC2626" />
          <Text style={styles.fieldErrorText}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 0.6,
  },
  googleBadge: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  widgetWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  verifiedBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  verifiedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },
  verifiedSub: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  resetText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  errorText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  fieldErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  fieldErrorText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
  },
});
