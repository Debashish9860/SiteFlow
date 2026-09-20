import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { CustomInput } from '../components/CustomInput';
import { BigButton } from '../components/BigButton';
import { BusinessProfile } from '../types/bill';
import {
  getBusinessProfile,
  saveBusinessProfile,
  getContractorPresets,
  saveContractorPreset,
  ContractorPreset,
  DEFAULT_CONTRACTOR_PRESETS,
} from '../services/storageService';
import {
  checkCloudConnection,
  syncAllToCloud,
  restoreAllFromCloud,
  getLastCloudSyncTime,
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  getServerEndpoint,
  setServerEndpoint,
  CloudStatusResult,
} from '../services/cloudSyncService';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { SyncSuccessToast } from '../components/SyncSuccessToast';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [presets, setPresets] = useState<ContractorPreset[]>(DEFAULT_CONTRACTOR_PRESETS);
  const [activePresetId, setActivePresetId] = useState<'ramesh' | 'rajeeb' | 'custom'>('ramesh');

  const [businessName, setBusinessName] = useState('RAMESH RAUT');
  const [ownerName, setOwnerName] = useState('Ramesh Raut');
  const [contractorTitle, setContractorTitle] = useState('PLUMBING & CIVIL WORKS CONTRACTOR');
  const [phone, setPhone] = useState('+91 9860980626');
  const [address, setAddress] = useState('Sus, Pune - 411021');
  const [noteFooter, setNoteFooter] = useState('Thank you for your business!');

  // Cloud Sync State
  const [cloudStatus, setCloudStatus] = useState<CloudStatusResult>({ connected: false });
  const [lastSyncText, setLastSyncText] = useState<string>('Never');
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [restoringCloud, setRestoringCloud] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [serverUrl, setServerUrl] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);

  // Sync Success Toast State
  const [showSyncToast, setShowSyncToast] = useState(false);
  const [syncToastTitle, setSyncToastTitle] = useState('Data Sync Done!');
  const [syncToastSubtitle, setSyncToastSubtitle] = useState('All bills & profile safely synced to secure cloud.');
  const [syncToastCount, setSyncToastCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    loadProfile();
    loadCloudSyncState();
  }, []);

  const loadCloudSyncState = async () => {
    try {
      const [status, lastTime, autoEnabled, currentUrl] = await Promise.all([
        checkCloudConnection(),
        getLastCloudSyncTime(),
        isAutoSyncEnabled(),
        getServerEndpoint(),
      ]);
      setCloudStatus(status);
      setAutoSync(autoEnabled);
      setServerUrl(currentUrl);
      if (lastTime) {
        const d = new Date(lastTime);
        setLastSyncText(
          `${d.toLocaleDateString('en-IN')} at ${d.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        );
      }
    } catch (e) {
      console.warn('Error loading cloud status:', e);
    }
  };

  const handleBackupToCloud = async () => {
    setSyncingCloud(true);
    try {
      const result = await syncAllToCloud();
      if (result.success) {
        setSyncToastTitle('Data Sync Done!');
        setSyncToastSubtitle('All bills and company profile safely backed up to secure cloud storage.');
        setSyncToastCount(result.syncedCount);
        setShowSyncToast(true);
        await loadCloudSyncState();
      } else {
        Alert.alert('Cloud Backup Notice', result.message || 'Could not connect to sync server.');
      }
    } catch (e: any) {
      Alert.alert('Backup Error', e?.message || 'Failed to sync with cloud.');
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    Alert.alert(
      'Restore from Cloud Backup?',
      'This will retrieve all bills, quotations, and profile settings from your secure cloud storage. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore Data',
          style: 'default',
          onPress: async () => {
            setRestoringCloud(true);
            try {
              const res = await restoreAllFromCloud();
              if (res.success) {
                setSyncToastTitle('Cloud Restore Done!');
                setSyncToastSubtitle('All company bills & profile successfully recovered from secure cloud storage.');
                setSyncToastCount(res.billsRestored);
                setShowSyncToast(true);
                await loadProfile();
                await loadCloudSyncState();
              } else {
                Alert.alert('Restore Notice', res.message);
              }
            } catch (e: any) {
              Alert.alert('Restore Failed', e?.message || 'Could not restore from cloud.');
            } finally {
              setRestoringCloud(false);
            }
          },
        },
      ]
    );
  };

  const handleTestConnection = async () => {
    if (!serverUrl.trim()) return;
    setTestingConnection(true);
    try {
      await setServerEndpoint(serverUrl.trim());
      const status = await checkCloudConnection();
      setCloudStatus(status);
      if (status.connected) {
        Alert.alert('Connection Successful', 'Successfully connected to the sync server & cloud database!');
      } else {
        Alert.alert('Connection Notice', status.error || 'Server is not reachable at this address.');
      }
    } catch (e: any) {
      Alert.alert('Connection Failed', e?.message || 'Could not reach server.');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleToggleAutoSync = async (val: boolean) => {
    setAutoSync(val);
    await setAutoSyncEnabled(val);
  };

  const loadProfile = async () => {
    try {
      const [profile, loadedPresets] = await Promise.all([
        getBusinessProfile(),
        getContractorPresets(),
      ]);
      setPresets(loadedPresets);
      setNoteFooter(profile.noteFooter || 'Thank you for your business!');

      const isUserRajeeb = Boolean(
        user?.name?.toLowerCase().includes('rajeeb') ||
        user?.email?.toLowerCase().includes('rajeeb')
      );
      const targetPresetId = isUserRajeeb ? 'rajeeb' : 'ramesh';
      setActivePresetId(targetPresetId);

      const activePreset = loadedPresets.find((p) => p.id === targetPresetId);
      if (activePreset) {
        setOwnerName(activePreset.name);
        setBusinessName(activePreset.name.toUpperCase());
        setContractorTitle(activePreset.title);
        setPhone(activePreset.phone);
        setAddress(activePreset.address);
      } else {
        setBusinessName(profile.businessName || 'RAMESH RAUT');
        setOwnerName(profile.ownerName || 'Ramesh Raut');
        setContractorTitle(profile.contractorTitle || 'PLUMBING & CIVIL WORKS CONTRACTOR');
        setPhone(profile.phone || '+91 9860980626');
        setAddress(profile.address || 'Sus, Pune - 411021');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (presetId: 'ramesh' | 'rajeeb') => {
    setActivePresetId(presetId);
    const found = presets.find((p) => p.id === presetId);
    if (found) {
      setOwnerName(found.name);
      setBusinessName(found.name.toUpperCase());
      setContractorTitle(found.title);
      setPhone(found.phone);
      setAddress(found.address);
    }
  };

  const handleSave = async () => {
    if (!ownerName.trim() || !phone.trim()) {
      Alert.alert('Required Fields', 'Please enter Contractor Name and Phone number.');
      return;
    }

    setSaving(true);
    try {
      const updatedProfile: BusinessProfile = {
        businessName: businessName.trim() || ownerName.trim().toUpperCase(),
        ownerName: ownerName.trim(),
        contractorTitle: contractorTitle.trim() || 'PLUMBING & CIVIL WORKS CONTRACTOR',
        phone: phone.trim(),
        address: address.trim() || undefined,
        noteFooter: noteFooter.trim() || undefined,
      };

      await saveBusinessProfile(updatedProfile);

      // Also persist to this contractor's preset
      const presetId = activePresetId === 'rajeeb' ? 'rajeeb' : 'ramesh';
      const updatedPreset: ContractorPreset = {
        id: presetId,
        name: ownerName.trim(),
        title: contractorTitle.trim() || 'PLUMBING & CIVIL WORKS CONTRACTOR',
        phone: phone.trim(),
        address: address.trim() || 'Sus, Pune - 411021',
      };
      await saveContractorPreset(updatedPreset);

      const refreshed = await getContractorPresets();
      setPresets(refreshed);

      Alert.alert('Saved', `${updatedPreset.name}'s details saved successfully!`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Quick Preset Selector */}
          <View style={styles.presetSwitchBox}>
            <Text style={styles.presetLabel}>CHOOSE CONTRACTOR PROFILE TO EDIT:</Text>
            <View style={styles.presetBtnRow}>
              <TouchableOpacity
                onPress={() => applyPreset('ramesh')}
                style={[
                  styles.presetBtn,
                  activePresetId === 'ramesh' && styles.presetBtnActive,
                ]}
              >
                <MaterialIcons
                  name="person"
                  size={18}
                  color={activePresetId === 'ramesh' ? '#FFF' : COLORS.textPrimary}
                />
                <Text
                  style={[
                    styles.presetBtnText,
                    activePresetId === 'ramesh' && styles.presetBtnTextActive,
                  ]}
                >
                  {presets.find((p) => p.id === 'ramesh')?.name || 'Ramesh Raut'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => applyPreset('rajeeb')}
                style={[
                  styles.presetBtn,
                  activePresetId === 'rajeeb' && styles.presetBtnActive,
                ]}
              >
                <MaterialIcons
                  name="person"
                  size={18}
                  color={activePresetId === 'rajeeb' ? '#FFF' : COLORS.textPrimary}
                />
                <Text
                  style={[
                    styles.presetBtnText,
                    activePresetId === 'rajeeb' && styles.presetBtnTextActive,
                  ]}
                >
                  {presets.find((p) => p.id === 'rajeeb')?.name || 'Rajeeb Raut'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Letterhead Preview Header */}
          <View style={styles.bannerBox}>
            <View style={styles.bannerMaroon}>
              <Text style={styles.bannerName}>{businessName || 'RAMESH RAUT'}</Text>
              <Text style={styles.bannerSub}>{contractorTitle}</Text>
            </View>
            <View style={styles.bannerInfo}>
              <Text style={styles.bannerInfoText}>📞 {phone}</Text>
              <Text style={styles.bannerInfoText}>📍 {address}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Contractor & Letterhead Settings</Text>

            <CustomInput
              label="Contractor Name *"
              placeholder="e.g. Ramesh Raut / Rajeeb Raut"
              value={ownerName}
              onChangeText={(val) => {
                setOwnerName(val);
                setBusinessName(val.toUpperCase());
              }}
              required
              iconName="person"
            />

            <CustomInput
              label="Business / Trade Title *"
              placeholder="e.g. PLUMBING & CIVIL WORKS CONTRACTOR"
              value={contractorTitle}
              onChangeText={setContractorTitle}
              required
              iconName="handyman"
            />

            <CustomInput
              label="Phone Number *"
              placeholder="e.g. +91 9860980626"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              required
              iconName="phone"
            />

            <CustomInput
              label="Office / Work Address"
              placeholder="e.g. Sus, Pune - 411021"
              value={address}
              onChangeText={setAddress}
              iconName="location-on"
            />

            <CustomInput
              label="Footer Note / Remarks"
              placeholder="e.g. Thank you for your business!"
              value={noteFooter}
              onChangeText={setNoteFooter}
              iconName="chat"
            />
          </View>

          <View style={styles.saveActionWrap}>
            <BigButton
              title="Save Profile Settings"
              subtitle="Updates letterhead on all new invoices and quotations"
              iconName="save"
              variant="primary"
              loading={saving}
              onPress={handleSave}
            />
          </View>

          {/* Secure Cloud Backup & Sync Card */}
          <View style={styles.cloudCard}>
            <View style={styles.cloudHeader}>
              <View style={styles.cloudIconBadge}>
                <MaterialIcons name="cloud-done" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.cloudTitle}>SECURE CLOUD BACKUP & SYNC</Text>
                <Text style={styles.cloudSub}>
                  Automatic Real-Time Multi-Device Synchronization
                </Text>
              </View>
              <View
                style={[
                  styles.cloudStatusBadge,
                  cloudStatus.connected ? styles.statusOnline : styles.statusOffline,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: cloudStatus.connected ? '#16A34A' : '#F59E0B' },
                  ]}
                />
                <Text style={styles.cloudStatusText}>
                  {cloudStatus.connected ? 'Connected' : 'Sync Ready'}
                </Text>
              </View>
            </View>

            <Text style={styles.cloudDesc}>
              All contractor bills, payment receipts, and business profile details are safely backed up to your secure cloud storage. Even if you switch devices or reset the app, you can retrieve your data anytime.
            </Text>

            <View style={styles.cloudStatsRow}>
              <View style={styles.cloudStatBox}>
                <Text style={styles.cloudStatLabel}>LAST CLOUD BACKUP</Text>
                <Text style={styles.cloudStatValue}>{lastSyncText}</Text>
              </View>
              <View style={styles.cloudStatDivider} />
              <View style={styles.cloudStatBox}>
                <Text style={styles.cloudStatLabel}>STORAGE TYPE</Text>
                <Text style={[styles.cloudStatValue, { color: '#0F172A', fontWeight: '800' }]}>
                  Secure Cloud
                </Text>
              </View>
            </View>

            {/* Server Endpoint Configuration */}
            <View style={{ marginTop: 12, marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4, letterSpacing: 0.5 }}>
                SYNC SERVER URL:
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontSize: 13,
                    color: COLORS.textPrimary,
                  }}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  placeholder="http://10.13.28.162:5050"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={handleTestConnection}
                  disabled={testingConnection}
                  style={{
                    backgroundColor: COLORS.primary,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {testingConnection ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>Test</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Auto-Sync Switch */}
            <View style={styles.autoSyncRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.autoSyncTitle}>Auto-Sync on Bill Changes</Text>
                <Text style={styles.autoSyncSub}>
                  Automatically back up every time a bill or payment is saved
                </Text>
              </View>
              <Switch
                value={autoSync}
                onValueChange={handleToggleAutoSync}
                trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                thumbColor={autoSync ? '#16A34A' : '#94A3B8'}
              />
            </View>

            {/* Action Buttons: Backup Now & Restore */}
            <View style={styles.cloudButtonsRow}>
              <TouchableOpacity
                onPress={handleBackupToCloud}
                disabled={syncingCloud || restoringCloud}
                style={[styles.cloudActionBtn, styles.backupBtn]}
                activeOpacity={0.8}
              >
                {syncingCloud ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="cloud-upload" size={18} color="#FFFFFF" />
                    <Text style={styles.cloudBtnText}>Backup Now to Cloud</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRestoreFromCloud}
                disabled={syncingCloud || restoringCloud}
                style={[styles.cloudActionBtn, styles.restoreBtn]}
                activeOpacity={0.8}
              >
                {restoringCloud ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <MaterialIcons name="cloud-download" size={18} color={COLORS.primary} />
                    <Text style={styles.restoreBtnText}>Restore from Cloud</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Account Details & Logout */}
          <View style={styles.accountCard}>
            <View style={styles.accountHeader}>
              <View style={styles.accountAvatar}>
                <MaterialIcons name="person" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.accountName}>{user?.name || 'SiteFlow User'}</Text>
                <Text style={styles.accountEmail}>{user?.email || 'Logged In'}</Text>
              </View>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>{user?.role?.toUpperCase() || 'USER'}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                Alert.alert('Log Out', 'Are you sure you want to log out of SiteFlow?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                      await logout();
                    },
                  },
                ]);
              }}
              style={styles.logoutBtn}
              activeOpacity={0.8}
            >
              <MaterialIcons name="logout" size={18} color={COLORS.danger} />
              <Text style={styles.logoutBtnText}>Log Out of SiteFlow</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Animated Green Tick Mark Data Sync Toast */}
      <SyncSuccessToast
        visible={showSyncToast}
        onClose={() => setShowSyncToast(false)}
        title={syncToastTitle}
        subtitle={syncToastSubtitle}
        syncedCount={syncToastCount}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  presetSwitchBox: {
    marginBottom: SPACING.md,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  presetBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  presetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceBorder,
    gap: 6,
  },
  presetBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  presetBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  presetBtnTextActive: {
    color: '#FFFFFF',
  },
  bannerBox: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  bannerMaroon: {
    backgroundColor: COLORS.primary,
    padding: 16,
  },
  bannerName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bannerSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F5A623',
    letterSpacing: 1,
    marginTop: 4,
  },
  bannerInfo: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bannerInfoText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  saveActionWrap: {
    marginTop: 4,
  },
  cloudCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderLeftWidth: 5,
    borderLeftColor: '#16A34A',
    elevation: 3,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  cloudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cloudIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.6,
  },
  cloudSub: {
    fontSize: 10.5,
    color: COLORS.textMuted,
    marginTop: 1,
    fontWeight: '600',
  },
  cloudStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusOnline: {
    backgroundColor: '#DCFCE7',
  },
  statusOffline: {
    backgroundColor: '#FEF3C7',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cloudStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  cloudDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  cloudStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  cloudStatBox: {
    flex: 1,
  },
  cloudStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 10,
  },
  cloudStatLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cloudStatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  autoSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: 12,
  },
  autoSyncTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  autoSyncSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  cloudButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cloudActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  backupBtn: {
    backgroundColor: '#16A34A',
    elevation: 2,
  },
  restoreBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cloudBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  restoreBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  accountAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  accountEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  roleTag: {
    backgroundColor: 'rgba(124, 16, 52, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    marginTop: 4,
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.danger,
  },
});
