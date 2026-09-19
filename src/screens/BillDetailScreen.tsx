import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { Bill, BusinessProfile } from '../types/bill';
import { getBills, getBusinessProfile, deleteBill } from '../services/storageService';
import { sharePdf, printDirectly } from '../services/pdfService';
import { exportBillToExcel } from '../services/excelService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { numberToWordsIndian } from '../utils/numberToWords';
import { BigButton } from '../components/BigButton';
import { MaterialIcons } from '@expo/vector-icons';

export const BillDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { billId } = route.params || {};

  const [bill, setBill] = useState<Bill | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  useEffect(() => {
    loadBillDetails();
  }, [billId]);

  const loadBillDetails = async () => {
    try {
      const [bills, prof] = await Promise.all([getBills(), getBusinessProfile()]);
      const found = bills.find((b) => b.id === billId);
      if (found) {
        setBill(found);
      }
      setProfile(prof);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!bill || !profile) return;
    setIsSharing(true);
    try {
      await sharePdf(bill, profile);
    } catch (error: any) {
      Alert.alert('Sharing Failed', error?.message || 'Could not share PDF');
    } finally {
      setIsSharing(false);
    }
  };

  const handlePrint = async () => {
    if (!bill || !profile) return;
    setIsPrinting(true);
    try {
      await printDirectly(bill, profile);
    } catch (error: any) {
      Alert.alert('Print Failed', error?.message || 'Could not print PDF');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!bill || !profile) return;
    setIsExportingExcel(true);
    try {
      await exportBillToExcel(bill, profile);
    } catch (error: any) {
      Alert.alert('Excel Export Failed', error?.message || 'Could not export to Excel');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to permanently delete this record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (bill) {
              await deleteBill(bill.id);
              navigation.navigate('Home');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!bill) {
    return (
      <View style={styles.centerLoading}>
        <Text style={styles.notFoundText}>Bill Not Found</Text>
      </View>
    );
  }

  const isQuotation = bill.billType === 'quotation';
  const totalAmount = bill.subtotal - (bill.discount || 0);
  const inWords = numberToWordsIndian(totalAmount);
  const billedName = (bill.billedBy || 'RAMESH RAUT').toUpperCase();
  const billedTitle = (bill.billedByTitle || 'PLUMBING & CIVIL WORKS CONTRACTOR').toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Action Buttons */}
        <View style={styles.topActionsCard}>
          <BigButton
            title="Print / Save A4 PDF"
            subtitle="Standard A4 contractor letterhead"
            iconName="picture-as-pdf"
            variant="primary"
            loading={isPrinting}
            onPress={handlePrint}
            style={{ marginBottom: 10 }}
          />

          <BigButton
            title="Export to Excel (.xlsx)"
            subtitle="Contractor letterhead spreadsheet format"
            iconName="table-view"
            variant="success"
            loading={isExportingExcel}
            onPress={handleExportExcel}
            style={{ marginBottom: 4 }}
          />

          <View style={styles.secondaryActionRow}>
            <TouchableOpacity
              onPress={handleShare}
              disabled={isSharing}
              style={styles.outlineActionBtn}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <MaterialIcons name="share" size={18} color={COLORS.primary} />
                  <Text style={styles.outlineActionText}>Share PDF</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('CreateBill', { editBillId: bill.id })}
              style={styles.editActionBtn}
            >
              <MaterialIcons name="edit" size={18} color={COLORS.primary} />
              <Text style={styles.editActionText}>Edit Bill</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleDelete} style={styles.deleteActionBtn}>
              <MaterialIcons name="delete-outline" size={18} color={COLORS.danger} />
              <Text style={styles.deleteActionText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Notification Banner */}
        <View style={styles.previewNotice}>
          <MaterialIcons name="visibility" size={18} color={COLORS.primary} />
          <Text style={styles.previewNoticeText}>
            EXACT LETTERHEAD PREVIEW (DOC-20260905-WA0005.pdf)
          </Text>
        </View>

        {/* Live Letterhead Card (Identical to PDF) */}
        <View style={styles.letterheadCard}>
          {/* Header Banner */}
          <View style={styles.letterheadBanner}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.bannerContractorName}>{billedName}</Text>
              <Text style={styles.bannerContractorSub}>{billedTitle}</Text>
            </View>
            <Text style={styles.bannerDocType}>{isQuotation ? 'QUOTATION' : 'INVOICE'}</Text>
          </View>

          {/* Two-Column Site / Invoice Details */}
          <View style={styles.metaRow}>
            {/* Left: Client & Site Location */}
            <View style={styles.siteColumn}>
              <View style={styles.metaHeadingUnderline}>
                <Text style={styles.metaHeadingText}>BILLED TO (CLIENT)</Text>
              </View>
              {/* Client Name in BOLD */}
              <Text style={styles.clientNameBold}>{bill.customerName}</Text>

              {/* Below client name, site name on the right side */}
              <View style={styles.siteRowBelow}>
                <Text style={styles.siteLabelSmall}>SITE / PROJECT:</Text>
                <View style={styles.siteValueRight}>
                  <Text style={styles.siteNameBelowText}>{bill.siteLocation || '—'}</Text>
                  {bill.siteCity ? (
                    <Text style={styles.siteCityBelowText}>{bill.siteCity}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Right: Invoice / Quotation Details */}
            <View style={styles.detailsColumn}>
              <Text style={styles.metaHeadingText}>
                {isQuotation ? 'QUOTATION DETAILS' : 'INVOICE DETAILS'}
              </Text>
              <Text style={styles.detailItemText}>
                <Text style={styles.boldLabel}>Date: </Text>
                {formatDate(bill.date)}
              </Text>
              <Text style={styles.detailItemText}>
                <Text style={styles.boldLabel}>
                  {isQuotation ? 'Quotation No: ' : 'Bill No: '}
                </Text>
                {bill.billNumber || '—'}
              </Text>
              <Text style={styles.detailItemText}>
                <Text style={styles.boldLabel}>Contact: </Text>
                {bill.billedByPhone || '+91 9860980626'}
              </Text>
              <Text style={styles.detailItemText}>
                <Text style={styles.boldLabel}>Address: </Text>
                {bill.billedByAddress || 'Sus, Pune - 411021'}
              </Text>
            </View>
          </View>

          {/* Works Table */}
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderText, { width: 32, textAlign: 'center' }]}>
                SR.
              </Text>
              <Text style={[styles.tableHeaderText, { flex: 1, paddingLeft: 8 }]}>
                DESCRIPTION OF WORK / PARTICULAR
              </Text>
              <Text style={[styles.tableHeaderText, { width: 100, textAlign: 'right' }]}>
                AMOUNT (₹)
              </Text>
            </View>

            {/* Table Rows */}
            {bill.items.map((item, index) => {
              const qtyRateText =
                item.quantity > 0 && item.rate > 0
                  ? `${item.quantity} ${item.unit} × ₹${item.rate.toLocaleString('en-IN')}`
                  : '';
              return (
                <View
                  key={item.id || index}
                  style={[
                    styles.tableDataRow,
                    { backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F9FBFC' },
                  ]}
                >
                  <Text style={[styles.tableCellIndex, { width: 32, textAlign: 'center' }]}>
                    {index + 1}
                  </Text>
                  <View style={{ flex: 1, paddingLeft: 8 }}>
                    <Text style={styles.tableCellTitle}>{item.name}</Text>
                    {qtyRateText ? (
                      <Text style={styles.tableCellFormula}>{qtyRateText}</Text>
                    ) : null}
                    {item.subDescription ? (
                      <Text style={styles.tableCellSub}>{item.subDescription}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.tableCellAmount, { width: 100, textAlign: 'right' }]}>
                    {item.amount.toLocaleString('en-IN')}/-
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Amount In Words & Grand Total Section */}
          <View style={styles.summaryWrap}>
            <View style={styles.wordsBox}>
              <Text style={styles.wordsHeading}>TOTAL AMOUNT IN WORDS</Text>
              <Text style={styles.wordsContent}>{inWords}</Text>
            </View>

            <View style={styles.grandTotalWrap}>
              <View style={styles.grandTotalTag}>
                <Text style={styles.grandTotalTagText}>GRAND TOTAL</Text>
              </View>
              <View style={styles.grandTotalValue}>
                <Text style={styles.grandTotalValueText}>
                  ₹ {totalAmount.toLocaleString('en-IN')}/-
                </Text>
              </View>
            </View>
          </View>

          {/* Signatory Footer */}
          <View style={styles.footerWrap}>
            <Text style={styles.thankYouText}>Thank you for your business!</Text>
            <View style={styles.signatureBox}>
              <Text style={styles.forContractorText}>For {billedName}</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.authSignText}>Authorized Signatory</Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  topActionsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  outlineActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    gap: 6,
  },
  outlineActionText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    color: COLORS.primary,
  },
  editActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FDF2F4',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    gap: 6,
  },
  editActionText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    color: COLORS.primary,
  },
  deleteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.dangerBg,
    gap: 6,
  },
  deleteActionText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    color: COLORS.danger,
  },
  previewNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  previewNoticeText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  letterheadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  letterheadBanner: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerContractorName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bannerContractorSub: {
    color: '#F5A623',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 3,
  },
  bannerDocType: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 16,
    gap: 16,
  },
  siteColumn: {
    flex: 1,
  },
  detailsColumn: {
    flex: 1,
    paddingLeft: 8,
  },
  metaHeadingUnderline: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: 2,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  metaHeadingText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  clientNameBold: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
  },
  clientPhoneText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  siteRowBelow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  siteLabelSmall: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  siteValueRight: {
    alignItems: 'flex-end',
    flex: 1,
    marginLeft: 6,
  },
  siteNameBelowText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  siteCityBelowText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginTop: 1,
  },
  detailItemText: {
    fontSize: 11,
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  boldLabel: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#283747',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tableDataRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'flex-start',
  },
  tableCellIndex: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  tableCellTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 16,
  },
  tableCellFormula: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  tableCellSub: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 1,
  },
  tableCellAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  summaryWrap: {
    marginTop: 16,
    gap: 12,
  },
  wordsBox: {
    backgroundColor: '#FFFDF5',
    borderLeftWidth: 4,
    borderLeftColor: '#F5A623',
    padding: 10,
    borderRadius: 2,
  },
  wordsHeading: {
    fontSize: 9,
    fontWeight: '900',
    color: '#D97706',
    letterSpacing: 0.8,
  },
  wordsContent: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 3,
    lineHeight: 15,
  },
  grandTotalWrap: {
    flexDirection: 'row',
    height: 42,
  },
  grandTotalTag: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  grandTotalTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  grandTotalValue: {
    flex: 1,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderLeftWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  grandTotalValueText: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  footerWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  thankYouText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  signatureBox: {
    alignItems: 'center',
  },
  forContractorText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 24,
  },
  signatureLine: {
    width: 140,
    borderTopWidth: 1,
    borderTopColor: '#94A3B8',
  },
  authSignText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});
