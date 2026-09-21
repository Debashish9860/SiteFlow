import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Animated,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { Bill, BusinessProfile } from '../types/bill';
import {
  getBills,
  getBusinessProfile,
  getContractorPresets,
  ContractorPreset,
  DEFAULT_CONTRACTOR_PRESETS,
} from '../services/storageService';
import {
  pullAndSyncTeamBills,
  syncAllToCloud,
  triggerBackgroundCloudSync,
} from '../services/cloudSyncService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { MaterialIcons } from '@expo/vector-icons';
import { BigButton } from '../components/BigButton';
import { useAuth } from '../context/AuthContext';
import { RegisterPaymentModal } from '../components/RegisterPaymentModal';
import { SyncSuccessToast } from '../components/SyncSuccessToast';

// Animated Item Card for smooth staggered entrance
const AnimatedBillCard: React.FC<{
  item: Bill;
  index: number;
  onPress: () => void;
  onReceivePayment?: () => void;
}> = ({ item, index, onPress, onReceivePayment }) => {
  const isQuote = item.billType === 'quotation';
  const itemTotal = item.subtotal - item.discount;
  const itemAnim = useRef(new Animated.Value(0)).current;
  const itemTranslateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(itemAnim, {
        toValue: 1,
        duration: 320,
        delay: Math.min(index * 45, 260),
        useNativeDriver: true,
      }),
      Animated.spring(itemTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 50,
        delay: Math.min(index * 45, 260),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: itemAnim,
        transform: [{ translateY: itemTranslateY }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        style={[
          styles.billCard,
          isQuote ? styles.billCardQuote : styles.billCardInvoice,
        ]}
        onPress={onPress}
      >
        {/* Top Header: Doc Type Tag, Issuer Badge & Date */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View
              style={[
                styles.docTypeTag,
                isQuote ? styles.docTypeTagQuote : styles.docTypeTagInvoice,
              ]}
            >
              <Text
                style={[
                  styles.docTypeTagText,
                  isQuote ? styles.docTypeTagTextQuote : styles.docTypeTagTextInvoice,
                ]}
              >
                {isQuote ? 'QUOTATION' : 'INVOICE'}
              </Text>
            </View>
            <View style={styles.billedByBadge}>
              <MaterialIcons name="person" size={12} color="#64748B" />
              <Text style={styles.billedByText}>
                {item.billedBy || 'Ramesh Raut'}
              </Text>
            </View>
          </View>

          <View style={styles.cardDateBadge}>
            <MaterialIcons name="event" size={12} color="#94A3B8" />
            <Text style={styles.cardDateText}>{formatDate(item.date)}</Text>
          </View>
        </View>

        {/* Main Body: Customer & Site on Left, Total Amount on Right */}
        <View style={styles.cardBodyRow}>
          <View style={styles.cardClientInfo}>
            <Text style={styles.clientName} numberOfLines={1}>
              {item.customerName}
            </Text>
            <View style={styles.siteRow}>
              <MaterialIcons name="location-on" size={13} color={COLORS.primary} style={styles.siteIcon} />
              <Text style={styles.siteText} numberOfLines={1}>
                <Text style={styles.sitePrefix}>SITE: </Text>
                {item.siteLocation || 'General Site'}
                {item.siteCity ? `, ${item.siteCity}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.cardAmountCol}>
            <Text style={styles.billAmount}>
              ₹{itemTotal.toLocaleString('en-IN')}/-
            </Text>
          </View>
        </View>

        {/* Bottom Footer: Document # & Particulars Count, Status / Quick Pay */}
        <View style={styles.cardFooterRow}>
          <View style={styles.cardMetaWrap}>
            {item.billNumber && item.billNumber.trim() !== '' && item.billNumber !== '—' ? (
              <Text style={styles.billNumberPill}>
                #{item.billNumber.replace(/^[—\-\s]+/, '')}
              </Text>
            ) : null}
            <Text style={styles.particularsCount}>
              {item.items.length} {item.items.length === 1 ? 'particular' : 'particulars'}
            </Text>
          </View>

          {isQuote ? (
            <View style={styles.quoteStatusBadge}>
              <Text style={styles.quoteStatusText}>Estimate Ready</Text>
            </View>
          ) : (
            <View style={styles.statusActionRow}>
              <View
                style={[
                  styles.statusBadge,
                  item.balanceDue > 0 ? styles.statusDue : styles.statusPaid,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    item.balanceDue > 0 ? styles.statusDueText : styles.statusPaidText,
                  ]}
                >
                  {item.balanceDue > 0
                    ? `Due: ${formatCurrency(item.balanceDue)}`
                    : item.taxDeducted
                    ? 'Settled (Tax) ✓'
                    : 'Fully Paid ✓'}
                </Text>
              </View>
              {item.balanceDue > 0 && onReceivePayment && (
                <TouchableOpacity
                  onPress={onReceivePayment}
                  style={styles.quickPayChip}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="add-circle" size={13} color="#FFFFFF" />
                  <Text style={styles.quickPayChipText}>Receive</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [presets, setPresets] = useState<ContractorPreset[]>(DEFAULT_CONTRACTOR_PRESETS);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'invoice' | 'quotation'>('all');
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<Bill | null>(null);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [syncCount, setSyncCount] = useState<number | undefined>(undefined);

  const handleQuickCloudSync = async () => {
    setSyncingCloud(true);
    try {
      const res = await pullAndSyncTeamBills();
      if (res.success) {
        const refreshed = await getBills();
        setBills(refreshed);
        setSyncCount(res.billsCount);
        setShowSyncSuccess(true);
      } else {
        Alert.alert('Cloud Sync Notice', res.message);
      }
    } catch (e: any) {
      Alert.alert('Sync Error', e?.message || 'Could not sync to cloud.');
    } finally {
      setSyncingCloud(false);
    }
  };

  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(24)).current;
  const statsScaleAnim = useRef(new Animated.Value(0.96)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for create button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Screen entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.spring(slideUpAnim, {
        toValue: 0,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.spring(statsScaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Instant local load from compressed storage
      const [loadedBills, loadedProfile, loadedPresets] = await Promise.all([
        getBills(),
        getBusinessProfile(),
        getContractorPresets(),
      ]);
      setBills(loadedBills);
      setProfile(loadedProfile);
      if (loadedPresets && loadedPresets.length > 0) {
        setPresets(loadedPresets);
      }

      // 2. Background cross-device sync: fetch bills created by brother on another phone
      pullAndSyncTeamBills()
        .then(async (res) => {
          if (res.success) {
            const updated = await getBills();
            setBills(updated);
          }
        })
        .catch(() => {});
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Dynamic contractor determination based on logged-in user
  const isRajeeb = Boolean(
    user?.name?.toLowerCase().includes('rajeeb') ||
    user?.email?.toLowerCase().includes('rajeeb')
  );

  const isRamesh = Boolean(
    user?.name?.toLowerCase().includes('ramesh') ||
    user?.email?.toLowerCase().includes('ramesh')
  );

  const currentPreset = isRajeeb
    ? presets.find((p) => p.id === 'rajeeb')
    : isRamesh
    ? presets.find((p) => p.id === 'ramesh')
    : null;

  const displayContractorName =
    currentPreset?.name ||
    (isRajeeb
      ? 'RAJEEB RAUT'
      : isRamesh
      ? 'RAMESH RAUT'
      : (user?.name ? user.name.toUpperCase() : (profile?.ownerName?.toUpperCase() || 'RAMESH RAUT')));

  const displayContractorTitle =
    currentPreset?.title ||
    profile?.contractorTitle ||
    'PLUMBING & CIVIL WORKS CONTRACTOR';

  const displayContractorPhone =
    currentPreset?.phone ||
    profile?.phone ||
    '+91 9860980626';

  const invoices = bills.filter((b) => b.billType !== 'quotation');
  const quotations = bills.filter((b) => b.billType === 'quotation');

  const totalInvoiced = invoices.reduce((acc, b) => acc + (b.subtotal - b.discount), 0);
  const totalReceived = invoices.reduce((acc, b) => acc + (b.advancePaid || 0), 0);
  const totalDue = invoices.reduce((acc, b) => acc + b.balanceDue, 0);
  const totalTaxDeducted = invoices.reduce((acc, b) => acc + (b.taxDeducted || 0), 0);
  const totalQuoted = quotations.reduce((acc, b) => acc + (b.subtotal - b.discount), 0);

  const filteredBills = bills.filter((b) => {
    if (filterType === 'all') return true;
    if (filterType === 'invoice') return b.billType !== 'quotation';
    if (filterType === 'quotation') return b.billType === 'quotation';
    return true;
  });

  const insets = useSafeAreaInsets();
  const topSafePadding = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0
  ) + 10;
  const bottomSafePadding = Math.max(insets.bottom, 8);

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} translucent />

      {/* Royal Maroon Header Banner with Notch/Camera-Cutout Safe Inset */}
      <View style={[styles.header, { paddingTop: topSafePadding }]}>
        <View style={styles.headerContent}>
          <View style={styles.badgeRow}>
            <View style={styles.proTag}>
              <Text style={styles.proTagText}>SITEFLOW PRO</Text>
            </View>
            <Text style={styles.phoneSub}>
              📞 {displayContractorPhone}
            </Text>
          </View>
          <Text style={styles.businessTitle} numberOfLines={1}>
            {displayContractorName}
          </Text>
          <Text style={styles.contractorSub}>
            {displayContractorTitle}
          </Text>
          {user?.email ? (
            <View style={styles.accountPill}>
              <MaterialIcons name="account-circle" size={13} color="rgba(255,255,255,0.9)" />
              <Text style={styles.accountPillText} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={handleQuickCloudSync}
            style={styles.settingsBtn}
            activeOpacity={0.8}
            disabled={syncingCloud}
          >
            {syncingCloud ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <MaterialIcons name="cloud-sync" size={22} color="#FFF" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.settingsBtn}
            activeOpacity={0.8}
          >
            <MaterialIcons name="settings" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          data={filteredBills}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadData} colors={[COLORS.primary]} />
          }
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Animated.View
              style={{
                transform: [{ translateY: slideUpAnim }, { scale: statsScaleAnim }],
              }}
            >
              {/* Financial Stats Overview */}
              <View style={styles.statsContainer}>
                {/* 1. HERO CARD: ACTUAL AMOUNT RECEIVED (CASH IN HAND / BANK) */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => setFilterType(filterType === 'invoice' ? 'all' : 'invoice')}
                  style={styles.heroReceivedCard}
                >
                  <View style={styles.heroReceivedHeader}>
                    {/* Top Row: Icon + Label on Left, % Tag Pill on Right */}
                    <View style={styles.heroTopRow}>
                      <View style={styles.heroLabelGroup}>
                        <View style={styles.heroReceivedIconBadge}>
                          <MaterialIcons name="payments" size={18} color="#FFFFFF" />
                        </View>
                        <Text
                          style={styles.heroReceivedLabel}
                          numberOfLines={1}
                          maxFontSizeMultiplier={1.15}
                        >
                          ACTUAL RECEIVED
                        </Text>
                      </View>
                      <View style={styles.receivedTagPill}>
                        <Text
                          style={styles.receivedTagText}
                          maxFontSizeMultiplier={1.15}
                        >
                          {Math.min(100, Math.round((totalReceived / (totalInvoiced || 1)) * 100))}% COLLECTED
                        </Text>
                      </View>
                    </View>

                    {/* Subtitle on its own full-width line */}
                    <Text
                      style={styles.heroReceivedSub}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.2}
                    >
                      Collected Cash & Bank • {invoices.filter((i) => (i.advancePaid || 0) > 0).length} receipts
                    </Text>
                  </View>

                  <Text style={styles.heroReceivedAmount}>{formatCurrency(totalReceived)}</Text>

                  {/* Progress Track showing Received vs Invoiced */}
                  <View style={styles.receivedProgressTrack}>
                    <View
                      style={[
                        styles.receivedProgressFill,
                        {
                          width: `${Math.min(100, Math.round((totalReceived / (totalInvoiced || 1)) * 100))}%`,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.receivedProgressLegend}>
                    <Text style={styles.legendBilledText}>
                      Total Billed: {formatCurrency(totalInvoiced)}
                    </Text>
                    <Text style={styles.legendDueText}>
                      {totalTaxDeducted > 0
                        ? `Due: ${formatCurrency(totalDue)} • Tax/TDS: ${formatCurrency(totalTaxDeducted)}`
                        : `Pending: ${formatCurrency(totalDue)}`}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 2. Tri-Card Metric Grid: Total Billed | Pending/Tax | Quotations */}
                <View style={styles.triCardsRow}>
                  {/* Total Billed Card */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setFilterType(filterType === 'invoice' ? 'all' : 'invoice')}
                    style={[
                      styles.metricCard,
                      filterType === 'invoice' && styles.metricCardActive,
                    ]}
                  >
                    <View style={styles.metricCardTop}>
                      <Text style={styles.metricCardLabel}>TOTAL BILLED</Text>
                      <MaterialIcons name="receipt-long" size={15} color={COLORS.primary} />
                    </View>
                    <Text style={styles.metricCardAmount} numberOfLines={1}>
                      {formatCurrency(totalInvoiced)}
                    </Text>
                    <Text style={styles.metricCardSub} numberOfLines={1}>
                      {invoices.length} {invoices.length === 1 ? 'Invoice' : 'Invoices'}
                    </Text>
                  </TouchableOpacity>

                  {/* Pending / Tax Deductions Card */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setFilterType(filterType === 'invoice' ? 'all' : 'invoice')}
                    style={[
                      styles.metricCard,
                      styles.metricCardDue,
                      filterType === 'invoice' && styles.metricCardActive,
                    ]}
                  >
                    <View style={styles.metricCardTop}>
                      <Text style={[styles.metricCardLabel, { color: '#B91C1C' }]}>
                        {totalTaxDeducted > 0 ? 'DUE / TAX' : 'PENDING DUE'}
                      </Text>
                      <MaterialIcons name="pending-actions" size={15} color="#DC2626" />
                    </View>
                    <Text style={[styles.metricCardAmount, { color: '#DC2626' }]} numberOfLines={1}>
                      {formatCurrency(totalDue)}
                    </Text>
                    <Text style={styles.metricCardSub} numberOfLines={1}>
                      {totalTaxDeducted > 0
                        ? `+${formatCurrency(totalTaxDeducted)} Tax`
                        : `${invoices.filter((i) => i.balanceDue > 0).length} Unpaid`}
                    </Text>
                  </TouchableOpacity>

                  {/* Quotations Card */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setFilterType(filterType === 'quotation' ? 'all' : 'quotation')}
                    style={[
                      styles.metricCard,
                      styles.metricCardQuote,
                      filterType === 'quotation' && styles.metricCardActive,
                    ]}
                  >
                    <View style={styles.metricCardTop}>
                      <Text style={[styles.metricCardLabel, { color: '#B45309' }]}>QUOTATIONS</Text>
                      <MaterialIcons name="request-quote" size={15} color="#D97706" />
                    </View>
                    <Text style={[styles.metricCardAmount, { color: '#B45309' }]} numberOfLines={1}>
                      {formatCurrency(totalQuoted)}
                    </Text>
                    <Text style={styles.metricCardSub} numberOfLines={1}>
                      {quotations.length} {quotations.length === 1 ? 'Estimate' : 'Estimates'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Prominent Action Button with Gentle Pulse Animation */}
              <Animated.View
                style={[
                  styles.actionContainer,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                <BigButton
                  title="+ Create New Bill / Quotation"
                  subtitle="Add particulars, rates, and quantities"
                  iconName="add-circle"
                  variant="primary"
                  onPress={() => navigation.navigate('CreateBill')}
                  style={styles.createBtnGlow}
                />
              </Animated.View>

              {/* Filter Tabs */}
              <View style={styles.filterTabsRow}>
                {[
                  { key: 'all', label: `All (${bills.length})` },
                  { key: 'invoice', label: `Invoices (${invoices.length})` },
                  { key: 'quotation', label: `Quotations (${quotations.length})` },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setFilterType(tab.key as any)}
                    style={[
                      styles.filterTab,
                      filterType === tab.key && styles.filterTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterTabText,
                        filterType === tab.key && styles.filterTabTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Section Header */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {filterType === 'all'
                    ? 'All Documents'
                    : filterType === 'invoice'
                    ? 'Invoices'
                    : 'Quotations'}
                </Text>
                <Text style={styles.sectionCount}>{filteredBills.length}</Text>
              </View>

              {filteredBills.length === 0 && !loading && (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="receipt-long" size={60} color={COLORS.textMuted} />
                  <Text style={styles.emptyTitle}>No Documents Found</Text>
                  <Text style={styles.emptySub}>
                    Tap "+ Create New Bill / Quotation" to generate your first invoice or quotation.
                  </Text>
                </View>
              )}
            </Animated.View>
          }
          renderItem={({ item, index }) => (
            <AnimatedBillCard
              item={item}
              index={index}
              onPress={() => navigation.navigate('BillDetail', { billId: item.id })}
              onReceivePayment={() => setSelectedBillForPayment(item)}
            />
          )}
        />
      </Animated.View>

      {/* Persistent Fixed Screen Bottom Footer with Safe Inset */}
      <View style={[styles.fixedScreenFooter, { paddingBottom: bottomSafePadding }]}>
        <View style={styles.footerBrandRow}>
          <MaterialIcons name="bolt" size={14} color={COLORS.accent} />
          <Text style={styles.footerBrandName}>POWERED BY DEBASHISH RAUT</Text>
        </View>
        <Text style={styles.footerBrandSub}>SiteFlow • Fast Contractor Invoicing & Cloud Sync</Text>
      </View>

      {/* Interactive Quick Payment Modal */}
      <RegisterPaymentModal
        visible={selectedBillForPayment !== null}
        bill={selectedBillForPayment}
        onClose={() => setSelectedBillForPayment(null)}
        onPaymentSuccess={() => {
          loadData();
        }}
      />

      {/* Animated Green Tick Mark Data Sync Toast */}
      <SyncSuccessToast
        visible={showSyncSuccess}
        onClose={() => setShowSyncSuccess(false)}
        title="Data Sync Done!"
        subtitle="All bills & payments are synchronized with your secure cloud storage."
        syncedCount={syncCount}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  headerContent: {
    flex: 1,
    marginRight: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  proTag: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proTagText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  phoneSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  businessTitle: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.xl,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  contractorSub: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  accountPillText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '600',
  },
  settingsBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  statsContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  heroReceivedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderLeftWidth: 5,
    borderLeftColor: '#16A34A',
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  heroReceivedHeader: {
    marginBottom: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
    gap: 8,
  },
  heroLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  heroReceivedIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroReceivedLabel: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  heroReceivedSub: {
    fontSize: 10.5,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 1,
  },
  receivedTagPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  receivedTagText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.3,
  },
  heroReceivedAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
    marginTop: 2,
    marginBottom: 8,
  },
  receivedProgressTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  receivedProgressFill: {
    height: '100%',
    backgroundColor: '#16A34A',
    borderRadius: 3,
  },
  receivedProgressLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  legendBilledText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  legendDueText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
  },
  triCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    elevation: 1,
    justifyContent: 'space-between',
    minHeight: 88,
  },
  metricCardActive: {
    borderColor: COLORS.primary,
  },
  metricCardDue: {
    backgroundColor: '#FFF8F8',
    borderColor: '#FEE2E2',
  },
  metricCardQuote: {
    backgroundColor: '#FFFDF5',
    borderColor: '#FEF3C7',
  },
  metricCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricCardLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  metricCardAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  metricCardSub: {
    fontSize: 9.5,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  actionContainer: {
    marginVertical: 6,
  },
  createBtnGlow: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sectionCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
    backgroundColor: COLORS.surfaceBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  billCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  billCardInvoice: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  billCardQuote: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accentDark,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  docTypeTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docTypeTagInvoice: {
    backgroundColor: 'rgba(124, 16, 52, 0.1)',
  },
  docTypeTagQuote: {
    backgroundColor: '#FEF3C7',
  },
  docTypeTagText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  docTypeTagTextInvoice: {
    color: COLORS.primary,
  },
  docTypeTagTextQuote: {
    color: COLORS.accentDark,
  },
  billedByBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  billedByText: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '700',
  },
  cardDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardDateText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  cardBodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardClientInfo: {
    flex: 1,
    marginRight: 10,
  },
  clientName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  siteIcon: {
    marginTop: 1,
  },
  sitePrefix: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
  },
  siteText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
    flexShrink: 1,
  },
  cardAmountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  billAmount: {
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardMetaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  billNumberPill: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.primary,
    backgroundColor: 'rgba(124, 16, 52, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  particularsCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  quoteStatusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  quoteStatusText: {
    color: COLORS.accentDark,
    fontSize: 11,
    fontWeight: '800',
  },
  statusActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusDue: {
    backgroundColor: '#FEE2E2',
  },
  statusDueText: {
    color: '#DC2626',
  },
  statusPaid: {
    backgroundColor: '#D1FAE5',
  },
  statusPaidText: {
    color: '#059669',
  },
  quickPayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    elevation: 1,
  },
  quickPayChipText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  fixedScreenFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 7,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 4,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerBrandName: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  footerBrandSub: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
