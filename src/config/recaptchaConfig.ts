/**
 * Google reCAPTCHA Configuration
 * Site Key and Secret Key for bot protection in SiteFlow
 */

export const RECAPTCHA_CONFIG = {
  // Public Site Key used on the client (Web / Native WebView)
  SITE_KEY: '6LfjU8QtAAAAAC8OgX6OJtvJMBns_ZNkpke8-oLe',

  // Secret Key used for verifying tokens with Google's API
  SECRET_KEY: '6LfjU8QtAAAAAMnS2g9G211O8aDmWMjekaG5Eg5O',

  // Google reCAPTCHA endpoints
  API_SCRIPT_URL: 'https://www.google.com/recaptcha/api.js',
  VERIFY_URL: 'https://www.google.com/recaptcha/api/siteverify',

  // Base URL used in WebViews for domain matching
  BASE_URL: 'https://localhost',
};
