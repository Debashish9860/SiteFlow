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
import { getBills, getBusinessProfile } from '../services/storageService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { MaterialIcons } from '@expo/vector-icons';
import { BigButton } from '../components/BigButton';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [bills, setBills] = useState<Bill[]>([]);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'invoice' | 'quotation'>('all');

  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [loadedBills, loadedProfile] = await Promise.all([
        getBills(),
        getBusinessProfile(),
      ]);
      setBills(loadedBills);
      setProfile(loadedProfile);
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
              <Text style={styles.proTagText}>BILLMAKER PRO</Text>
            </View>
            <Text style={styles.phoneSub}>📞 {profile?.phone || '+91 9860980626'}</Text>
          </View>
          <Text style={styles.businessTitle} numberOfLines={1}>
            {profile?.ownerName || 'RAMESH RAUT'}
          </Text>
          <Text style={styles.contractorSub}>
            {profile?.contractorTitle || 'PLUMBING & CIVIL WORKS CONTRACTOR'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={styles.settingsBtn}
          activeOpacity={0.8}
        >
          <MaterialIcons name="tune" size={24} color="#FFF" />
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
            <View>
              {/* Summary Cards */}
              <View style={styles.summaryRow}>
                {/* Total Invoiced Card */}
                <View style={[styles.summaryCard, styles.cardInvoiced]}>
                  <View style={styles.summaryHeader}>
                    <Text style={styles.summaryLabel}>Total Invoiced</Text>
                    <MaterialIcons name="receipt-long" size={18} color={COLORS.primary} />
                  </View>
                  <Text style={styles.summaryAmount}>{formatCurrency(totalInvoiced)}</Text>
                  <Text style={styles.summarySub}>{invoices.length} Invoices issued</Text>
                </View>

                {/* Pending Due Card */}
                <View style={[styles.summaryCard, styles.cardDue]}>
                  <View style={styles.summaryHeader}>
                    <Text style={[styles.summaryLabel, { color: '#B91C1C' }]}>Pending Due</Text>
                    <MaterialIcons name="pending-actions" size={18} color="#DC2626" />
                  </View>
                  <Text style={[styles.summaryAmount, { color: '#DC2626' }]}>
                    {formatCurrency(totalDue)}
                  </Text>
                  <Text style={[styles.summarySub, { color: '#B91C1C' }]}>Balance to collect</Text>
                </View>
              </View>

              {/* Quotations Card */}
              <View style={styles.quotationSummaryCard}>
                <View style={styles.quoteCardLeft}>
                  <View style={styles.quoteIconBadge}>
                    <MaterialIcons name="request-quote" size={20} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={styles.quoteCardTitle}>Quotations</Text>
                    <Text style={styles.quoteCardSub}>
                      {quotations.length} Active • Value: {formatCurrency(totalQuoted)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('CreateBill');
                  }}
                  style={styles.quoteQuickBtn}
                >
                  <Text style={styles.quoteQuickBtnText}>+ Create</Text>
                </TouchableOpacity>
              </View>

              {/* Prominent Action Button */}
              <View style={styles.actionContainer}>
                <BigButton
                  title="+ Create New Bill / Quotation"
                  subtitle="Add particulars, rates, and quantities"
                  iconName="add-circle"
                  variant="primary"
                  onPress={() => navigation.navigate('CreateBill')}
                  style={styles.createBtnGlow}
                />
              </View>

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
            </View>
          }
          renderItem={({ item }) => {
            const isQuote = item.billType === 'quotation';
            const itemTotal = item.subtotal - item.discount;
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.billCard,
                  isQuote ? styles.billCardQuote : styles.billCardInvoice,
                ]}
                onPress={() => navigation.navigate('BillDetail', { billId: item.id })}
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
                    <Text style={styles.clientName}>
                      {item.customerName}
                    </Text>
                    {item.customerPhone ? (
                      <Text style={styles.customerSubPhone}>📞 {item.customerPhone}</Text>
                    ) : null}

                    {/* Below client name, site name on the right side */}
                    <View style={styles.siteRowRight}>
                      <Text style={styles.siteLabelSmall}>Site:</Text>
                      <Text style={styles.siteTextRight}>
                        {item.siteLocation || '—'}{item.siteCity ? `, ${item.siteCity}` : ''}
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
            );
          }}
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
  settingsBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInvoiced: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F1D9DE',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  cardDue: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FED7D7',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  summaryAmount: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginVertical: 4,
  },
  summarySub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  quotationSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accentDark,
    marginBottom: SPACING.sm,
  },
  quoteCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quoteIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteCardTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  quoteCardSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  quoteQuickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  quoteQuickBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
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
