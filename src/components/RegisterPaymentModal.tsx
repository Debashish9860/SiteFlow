import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { Bill } from '../types/bill';
import { formatCurrency } from '../utils/formatters';
import { registerBillPayment } from '../services/storageService';

interface RegisterPaymentModalProps {
  visible: boolean;
  bill: Bill | null;
  onClose: () => void;
  onPaymentSuccess: (updatedBill: Bill) => void;
}

const PAYMENT_MODES = [
  { id: 'Cash', label: 'Cash', icon: 'payments' as const },
  { id: 'UPI', label: 'UPI / GPay', icon: 'qr-code-2' as const },
  { id: 'Bank Transfer', label: 'Bank Transfer', icon: 'account-balance' as const },
  { id: 'Cheque', label: 'Cheque', icon: 'receipt' as const },
];

export const RegisterPaymentModal: React.FC<RegisterPaymentModalProps> = ({
  visible,
  bill,
  onClose,
  onPaymentSuccess,
}) => {
  if (!bill) return null;

  const netTotal = Math.max(0, bill.subtotal - (bill.discount || 0));
  const currentPaid = bill.advancePaid || 0;
  const currentDue = bill.balanceDue !== undefined ? bill.balanceDue : Math.max(0, netTotal - currentPaid);

  const [amountStr, setAmountStr] = useState('');
  const [selectedMode, setSelectedMode] = useState<string>('Cash');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize or reset amount when modal opens
  useEffect(() => {
    if (visible && currentDue > 0) {
      setAmountStr(currentDue.toString());
      setNote('');
      setSelectedMode('Cash');
    }
  }, [visible, bill?.id, currentDue]);

  const numericAmount = parseFloat(amountStr) || 0;
  const remainingAfterPayment = Math.max(0, currentDue - numericAmount);
  const isFullPayment = numericAmount >= currentDue && currentDue > 0;

  const handleApplyPreset = (presetAmount: number) => {
    setAmountStr(Math.round(presetAmount).toString());
  };

  const handleSubmit = async () => {
    if (numericAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount greater than zero.');
      return;
    }

    if (numericAmount > currentDue) {
      Alert.alert(
        'Overpayment Warning',
        `The amount entered (₹${numericAmount.toLocaleString('en-IN')}) is greater than the outstanding balance (₹${currentDue.toLocaleString('en-IN')}). Do you want to proceed and mark the bill as fully paid?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Proceed',
            onPress: () => processPayment(numericAmount),
          },
        ]
      );
      return;
    }

    await processPayment(numericAmount);
  };

  const processPayment = async (amount: number) => {
    setIsSaving(true);
    try {
      const updated = await registerBillPayment(bill.id, amount, selectedMode, note);
      onPaymentSuccess(updated);
      onClose();
      Alert.alert(
        'Payment Recorded! ✓',
        `₹${amount.toLocaleString('en-IN')} received via ${selectedMode}.\nNew Balance Due: ₹${updated.balanceDue.toLocaleString('en-IN')}`
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to record payment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <MaterialIcons name="account-balance-wallet" size={22} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Register Payment Received</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {bill.customerName} • {bill.billNumber || 'Bill'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <MaterialIcons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Financial Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>TOTAL BILL</Text>
                <Text style={styles.summaryValue}>{formatCurrency(netTotal)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>ALREADY PAID</Text>
                <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                  {formatCurrency(currentPaid)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>BALANCE DUE</Text>
                <Text style={[styles.summaryValue, { color: COLORS.primary, fontWeight: '900' }]}>
                  {formatCurrency(currentDue)}
                </Text>
              </View>
            </View>

            {/* Quick Balance Presets */}
            {currentDue > 0 ? (
              <View style={styles.presetsSection}>
                <Text style={styles.sectionLabel}>QUICK AMOUNT PRESETS:</Text>
                <View style={styles.presetsRow}>
                  <TouchableOpacity
                    onPress={() => handleApplyPreset(currentDue)}
                    style={[styles.presetChip, numericAmount === currentDue && styles.presetChipActive]}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name="check-circle"
                      size={15}
                      color={numericAmount === currentDue ? '#FFF' : COLORS.primary}
                    />
                    <Text
                      style={[
                        styles.presetChipText,
                        numericAmount === currentDue && styles.presetChipTextActive,
                      ]}
                    >
                      Full Due ({formatCurrency(currentDue)})
                    </Text>
                  </TouchableOpacity>

                  {currentDue > 500 && (
                    <TouchableOpacity
                      onPress={() => handleApplyPreset(Math.round(currentDue / 2))}
                      style={styles.presetChip}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.presetChipText}>
                        50% ({formatCurrency(Math.round(currentDue / 2))})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : null}

            {/* Amount Received Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AMOUNT RECEIVED NOW (₹) *</Text>
              <View style={styles.amountInputWrapper}>
                <Text style={styles.rupeeSymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amountStr}
                  onChangeText={setAmountStr}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textMuted}
                  autoFocus={true}
                />
              </View>

              {/* Dynamic Feedback Banner */}
              {numericAmount > 0 ? (
                <View
                  style={[
                    styles.feedbackBanner,
                    isFullPayment ? styles.feedbackBannerSuccess : styles.feedbackBannerPartial,
                  ]}
                >
                  <MaterialIcons
                    name={isFullPayment ? 'task-alt' : 'hourglass-bottom'}
                    size={16}
                    color={isFullPayment ? '#15803D' : '#B45309'}
                  />
                  <Text
                    style={[
                      styles.feedbackText,
                      { color: isFullPayment ? '#15803D' : '#B45309' },
                    ]}
                  >
                    {isFullPayment
                      ? 'This bill will be Fully Paid ✓'
                      : `Remaining Balance will be ${formatCurrency(remainingAfterPayment)}`}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Payment Method Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PAYMENT METHOD / MODE</Text>
              <View style={styles.modesRow}>
                {PAYMENT_MODES.map((mode) => {
                  const isSelected = selectedMode === mode.id;
                  return (
                    <TouchableOpacity
                      key={mode.id}
                      onPress={() => setSelectedMode(mode.id)}
                      style={[styles.modeChip, isSelected && styles.modeChipActive]}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons
                        name={mode.icon}
                        size={16}
                        color={isSelected ? '#FFFFFF' : COLORS.textSecondary}
                      />
                      <Text style={[styles.modeChipText, isSelected && styles.modeChipTextActive]}>
                        {mode.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Reference Note (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>REFERENCE / NOTE (OPTIONAL)</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Google Pay from client, Cheque #49201"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            {/* Submit Actions */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSaving || numericAmount <= 0}
              style={[
                styles.submitBtn,
                (isSaving || numericAmount <= 0) && styles.submitBtnDisabled,
              ]}
              activeOpacity={0.85}
            >
              <MaterialIcons name="check" size={20} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>
                {isSaving
                  ? 'Recording Payment...'
                  : `Confirm & Record ₹${numericAmount > 0 ? numericAmount.toLocaleString('en-IN') : '0'}`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.cancelBtn} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FDF2F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    padding: SPACING.md,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#CBD5E1',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  presetsSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FDF2F4',
    borderWidth: 1,
    borderColor: '#F1D9DE',
  },
  presetChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  rupeeSymbol: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.primary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  feedbackBannerSuccess: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  feedbackBannerPartial: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modeChipTextActive: {
    color: '#FFFFFF',
  },
  noteInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  submitBtnDisabled: {
    backgroundColor: '#CBD5E1',
    elevation: 0,
    shadowOpacity: 0,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
});
