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
} from 'react-native';
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
import { formatCurrency, formatDate } from '../utils/formatters';
import { MaterialIcons } from '@expo/vector-icons';
import { BigButton } from '../components/BigButton';
import { useAuth } from '../context/AuthContext';

// Animated Item Card for smooth staggered entrance
const AnimatedBillCard: React.FC<{
  item: Bill;
  index: number;
  onPress: () => void;
}> = ({ item, index, onPress }) => {
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
        activeOpacity={0.82}
        style={[
          styles.billCard,
          isQuote ? styles.billCardQuote : styles.billCardInvoice,
        ]}
        onPress={onPress}
      >
        {/* Card Top Row */}
        <View style={styles.billCardTop}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <View style={styles.tagRow}>
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
              <Text style={styles.billedByTag}>👤 {item.billedBy || 'Ramesh Raut'}</Text>
            </View>

            {/* Client Name in BOLD */}
            <Text style={styles.clientName}>{item.customerName}</Text>

            {/* Below client name, site name on the right side */}
            <View style={styles.siteRowRight}>
              <Text style={styles.siteLabelSmall}>Site:</Text>
              <Text style={styles.siteTextRight}>
                {item.siteLocation || '—'}
                {item.siteCity ? `, ${item.siteCity}` : ''}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.billAmount}>₹{itemTotal.toLocaleString('en-IN')}/-</Text>
            <Text style={styles.billDate}>{formatDate(item.date)}</Text>
          </View>
        </View>

        {/* Card Bottom Row */}
        <View style={styles.billCardBottom}>
          <View style={styles.billMeta}>
            <Text style={styles.billMetaText}>
              {item.billNumber} • {item.items.length} particulars
            </Text>
          </View>

          {isQuote ? (
            <View style={styles.quoteStatusBadge}>
              <Text style={styles.quoteStatusText}>Estimate Ready</Text>
            </View>
          ) : (
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
                  : 'Fully Paid ✓'}
              </Text>
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
  const totalDue = invoices.reduce((acc, b) => acc + b.balanceDue, 0);
  const totalQuoted = quotations.reduce((acc, b) => acc + (b.subtotal - b.discount), 0);

  const filteredBills = bills.filter((b) => {
    if (filterType === 'all') return true;
    if (filterType === 'invoice') return b.billType !== 'quotation';
    if (filterType === 'quotation') return b.billType === 'quotation';
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      {/* Royal Maroon Header Banner */}
      <View style={styles.header}>
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
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={styles.settingsBtn}
          activeOpacity={0.8}
        >
          <MaterialIcons name="settings" size={24} color="#FFF" />
        </TouchableOpacity>
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
                {/* 1. Hero Revenue Card */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setFilterType(filterType === 'invoice' ? 'all' : 'invoice')}
                  style={[
                    styles.heroSummaryCard,
                    filterType === 'invoice' && styles.heroCardActive,
                  ]}
                >
                  <View style={styles.heroCardHeader}>
                    <View style={styles.heroLabelRow}>
                      <View style={styles.heroIconBadge}>
                        <MaterialIcons name="account-balance-wallet" size={20} color="#FFFFFF" />
                      </View>
                      <View>
                        <Text style={styles.heroCardLabel}>TOTAL INVOICED REVENUE</Text>
                        <Text style={styles.heroCardSub}>
                          {invoices.length} {invoices.length === 1 ? 'Invoice' : 'Invoices'} issued
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.filterBadgePill,
                        filterType === 'invoice' && styles.filterBadgePillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterBadgeText,
                          filterType === 'invoice' && styles.filterBadgeTextActive,
                        ]}
                      >
                        {filterType === 'invoice' ? 'SHOWING INVOICES' : 'TAP TO FILTER'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.heroAmount}>{formatCurrency(totalInvoiced)}</Text>
                </TouchableOpacity>

                {/* 2. Symmetrical Twin Metric Cards: Pending Due & Quotations */}
                <View style={styles.twinCardsRow}>
                  {/* Left: Pending Due Card */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setFilterType(filterType === 'invoice' ? 'all' : 'invoice')}
                    style={[
                      styles.twinCard,
                      styles.twinCardDue,
                      filterType === 'invoice' && styles.twinCardActive,
                    ]}
                  >
                    <View style={styles.twinCardHeader}>
                      <Text style={[styles.twinCardLabel, { color: '#B91C1C' }]}>PENDING DUE</Text>
                      <View style={styles.dueIconBadge}>
                        <MaterialIcons name="pending-actions" size={16} color="#DC2626" />
                      </View>
                    </View>
                    <Text style={[styles.twinAmount, { color: '#DC2626' }]}>
                      {formatCurrency(totalDue)}
                    </Text>
                    <View style={styles.twinCardFooter}>
                      <Text style={styles.twinSubDue}>
                        {invoices.filter((i) => i.balanceDue > 0).length} unpaid bills
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Right: Quotations Card */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setFilterType(filterType === 'quotation' ? 'all' : 'quotation')}
                    style={[
                      styles.twinCard,
                      styles.twinCardQuote,
                      filterType === 'quotation' && styles.twinCardActive,
                    ]}
                  >
                    <View style={styles.twinCardHeader}>
                      <Text style={[styles.twinCardLabel, { color: '#B45309' }]}>QUOTATIONS</Text>
                      <View style={styles.quoteIconBadge}>
                        <MaterialIcons name="request-quote" size={16} color="#D97706" />
                      </View>
                    </View>
                    <Text style={[styles.twinAmount, { color: '#B45309' }]}>
                      {formatCurrency(totalQuoted)}
                    </Text>
                    <View style={styles.twinCardFooter}>
                      <Text style={styles.twinSubQuote}>
                        {quotations.length} {quotations.length === 1 ? 'estimate' : 'estimates'} active
                      </Text>
                    </View>
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
            />
          )}
        />
      </Animated.View>
    </SafeAreaView>
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
    paddingTop: SPACING.lg,
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
  heroSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#F1D9DE',
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
    marginBottom: 10,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  heroCardActive: {
    backgroundColor: '#FCF5F7',
    borderColor: COLORS.primary,
  },
  heroCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  heroCardSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  filterBadgePill: {
    backgroundColor: 'rgba(124, 16, 52, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  filterBadgePillActive: {
    backgroundColor: COLORS.primary,
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  filterBadgeTextActive: {
    color: '#FFFFFF',
  },
  heroAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  twinCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  twinCard: {
    flex: 1,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    justifyContent: 'space-between',
    minHeight: 106,
  },
  twinCardDue: {
    backgroundColor: '#FFF8F8',
    borderColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  twinCardQuote: {
    backgroundColor: '#FFFDF5',
    borderColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  twinCardActive: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  twinCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  twinCardLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  dueIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  twinAmount: {
    fontSize: 17,
    fontWeight: '900',
    marginVertical: 4,
  },
  twinCardFooter: {
    marginTop: 2,
  },
  twinSubDue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  twinSubQuote: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
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
    shadowRadius: 3,
    elevation: 1,
  },
  billCardInvoice: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  billCardQuote: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accentDark,
  },
  billCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  docTypeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docTypeTagInvoice: {
    backgroundColor: COLORS.primarySubtle,
  },
  docTypeTagQuote: {
    backgroundColor: '#FEF3C7',
  },
  docTypeTagText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  docTypeTagTextInvoice: {
    color: COLORS.primary,
  },
  docTypeTagTextQuote: {
    color: COLORS.accentDark,
  },
  billedByTag: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  clientName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  customerSubPhone: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  siteRowRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  siteLabelSmall: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  siteTextRight: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  billAmount: {
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  billDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  billCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
  },
  billMeta: {
    flex: 1,
  },
  billMetaText: {
    fontSize: 11,
    color: COLORS.textSecondary,
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
