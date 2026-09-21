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
  ActivityIndicator,
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
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

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

  useEffect(() => {
    loadProfile();
  }, []);

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
