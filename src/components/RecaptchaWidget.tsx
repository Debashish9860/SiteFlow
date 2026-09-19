import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { RECAPTCHA_CONFIG } from '../config/recaptchaConfig';

interface RecaptchaWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  isVerified: boolean;
  onReset?: () => void;
  errorMessage?: string;
}

export const RecaptchaWidget: React.FC<RecaptchaWidgetProps> = ({
  onVerify,
  onExpire,
  isVerified,
  onReset,
  errorMessage,
}) => {
  const webViewRef = useRef<WebView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // HTML payload to host Google reCAPTCHA v2 in WebView
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <script src="https://www.google.com/recaptcha/api.js" async defer></script>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #F8FAFC;
          }
          .g-recaptcha {
            transform: scale(0.92);
            transform-origin: 0 0;
            -webkit-transform: scale(0.92);
            -webkit-transform-origin: 0 0;
          }
        </style>
      </head>
      <body>
        <div 
          class="g-recaptcha" 
          data-sitekey="${RECAPTCHA_CONFIG.SITE_KEY}"
          data-callback="onSuccess"
          data-expired-callback="onExpired"
          data-error-callback="onError"
        ></div>

        <script>
          function onSuccess(token) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'verify', token: token }));
            }
          }
          function onExpired() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'expire' }));
            }
          }
          function onError(err) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: err }));
            }
          }
        </script>
      </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'verify' && data.token) {
        onVerify(data.token);
      } else if (data.type === 'expire') {
        onExpire?.();
      } else if (data.type === 'error') {
        console.warn('reCAPTCHA error from webview:', data.error);
      }
    } catch (e) {
      console.warn('Failed to parse webview message:', e);
    }
  };

  const handleReset = () => {
    if (webViewRef.current) {
      webViewRef.current.reload();
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

      {/* Verified State */}
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
      ) : (
        /* Unverified: Embedded WebView */
        <View style={styles.webviewContainer}>
          {loading && (
            <View style={styles.loadingOverlay}>
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

          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{
              html: htmlContent,
              baseUrl: RECAPTCHA_CONFIG.BASE_URL,
            }}
            onMessage={handleMessage}
            onLoadEnd={() => setLoading(false)}
            onError={(e) => {
              setLoadError(e.nativeEvent.description || 'Failed to load reCAPTCHA');
              setLoading(false);
            }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scalesPageToFit={true}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Error or validation message */}
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
  webviewContainer: {
    height: 92,
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webview: {
    width: 295,
    height: 82,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 2,
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
