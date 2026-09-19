import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { CustomInput } from '../components/CustomInput';
import { BigButton } from '../components/BigButton';
import { ItemQuickPickerModal } from '../components/ItemQuickPickerModal';
import { Bill, BillItem, BillType } from '../types/bill';
import { formatCurrency, getTodayDateString } from '../utils/formatters';
import { numberToWordsIndian } from '../utils/numberToWords';
import {
  saveBill,
  getBills,
  getContractorPresets,
  saveContractorPreset,
  ContractorPreset,
  DEFAULT_CONTRACTOR_PRESETS,
} from '../services/storageService';
import { STANDARD_UNITS } from '../data/presets';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const POPULAR_PARTICULARS = [
  { name: '1" Elbow', unit: 'pcs', rate: 100 },
  { name: '3/4" Elbow', unit: 'pcs', rate: 45 },
  { name: '1" CPVC Pipe', unit: 'ft', rate: 70 },
  { name: 'Tank Fitting Work', unit: 'lump-sum', rate: 5000 },
  { name: 'Plumber Daily Labor', unit: 'days', rate: 850 },
];

export const CreateBillScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { editBillId } = route.params || {};

  const isUserRajeeb = Boolean(
    user?.name?.toLowerCase().includes('rajeeb') ||
    user?.email?.toLowerCase().includes('rajeeb')
  );
  const initialPreset =
    DEFAULT_CONTRACTOR_PRESETS.find((p) => p.id === (isUserRajeeb ? 'rajeeb' : 'ramesh')) ||
    DEFAULT_CONTRACTOR_PRESETS[0];

  // Bill Type
  const [billType, setBillType] = useState<BillType>('invoice');

  // Issuer State & Presets
  const [contractorPresets, setContractorPresets] = useState<ContractorPreset[]>(DEFAULT_CONTRACTOR_PRESETS);
  const [showContractorEdit, setShowContractorEdit] = useState(false);
  const [selectedIssuerId, setSelectedIssuerId] = useState<'ramesh' | 'rajeeb' | 'other'>(
    isUserRajeeb ? 'rajeeb' : 'ramesh'
  );
  const [billedByName, setBilledByName] = useState(initialPreset.name);
  const [billedByTitle, setBilledByTitle] = useState(initialPreset.title);
  const [billedByPhone, setBilledByPhone] = useState(initialPreset.phone);
  const [billedByAddress, setBilledByAddress] = useState(initialPreset.address);

  // Client & Site State
  const [siteLocation, setSiteLocation] = useState('Nigdi Site');
  const [siteCity, setSiteCity] = useState('Pune, Maharashtra');
  const [customerName, setCustomerName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [editingCreatedAt, setEditingCreatedAt] = useState<number | null>(null);

  // Particular Entry State (Inline fast entry)
  const [particularName, setParticularName] = useState('');
  const [particularSub, setParticularSub] = useState('');
  const [particularQty, setParticularQty] = useState('1');
  const [particularRate, setParticularRate] = useState('');
  const [particularUnit, setParticularUnit] = useState('pcs');

  // Items List
  const [items, setItems] = useState<BillItem[]>([]);
  const [discount, setDiscount] = useState('');
  const [advancePaid, setAdvancePaid] = useState('');
  const [notes, setNotes] = useState('');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const totalPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Load existing bill data if editing
  useEffect(() => {
    if (editBillId) {
      loadBillToEdit(editBillId);
    }
  }, [editBillId]);

  const loadBillToEdit = async (id: string) => {
    try {
      const bills = await getBills();
      const existing = bills.find((b) => b.id === id);
      if (existing) {
        setBillType(existing.billType || 'invoice');
        setCustomerName(existing.customerName || '');
        setSiteLocation(existing.siteLocation || '');
        setSiteCity(existing.siteCity || 'Pune, Maharashtra');
        setBillNumber(existing.billNumber || '');
        setItems(existing.items || []);
        setDiscount(existing.discount ? existing.discount.toString() : '');
        setAdvancePaid(existing.advancePaid ? existing.advancePaid.toString() : '');
        setNotes(existing.notes || '');
        setEditingCreatedAt(existing.createdAt || Date.now());

        if (existing.billedBy?.toLowerCase().includes('ramesh')) {
          setSelectedIssuerId('ramesh');
        } else if (existing.billedBy?.toLowerCase().includes('rajeeb')) {
          setSelectedIssuerId('rajeeb');
        } else {
          setSelectedIssuerId('other');
        }
        setBilledByName(existing.billedBy || 'RAMESH RAUT');
        setBilledByTitle(existing.billedByTitle || 'PLUMBING & CIVIL WORKS CONTRACTOR');
        setBilledByPhone(existing.billedByPhone || '+91 9860980626');
        setBilledByAddress(existing.billedByAddress || 'Sus, Pune - 411021');
      }
    } catch (err) {
      console.error('Failed to load bill for editing:', err);
    }
  };

  useEffect(() => {
    if (!editBillId) {
      const initialNo = billType === 'quotation' ? 'QT-' + Math.floor(1000 + Math.random() * 9000) : '—';
      setBillNumber(initialNo);
    }
  }, [billType, editBillId]);

  // Pulse total when quantity or rate changes
  const qtyVal = parseFloat(particularQty) || 0;
  const rateVal = parseFloat(particularRate) || 0;
  const inlineCalculatedTotal = qtyVal * rateVal;

  useEffect(() => {
    if (inlineCalculatedTotal > 0) {
      Animated.sequence([
        Animated.timing(totalPulseAnim, {
          toValue: 1.08,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(totalPulseAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [particularQty, particularRate]);

  // Load presets on launch
  useEffect(() => {
    const initPresets = async () => {
      try {
        const presets = await getContractorPresets();
        setContractorPresets(presets);
        if (!editBillId) {
          const isRajeeb = Boolean(
            user?.name?.toLowerCase().includes('rajeeb') ||
            user?.email?.toLowerCase().includes('rajeeb')
          );
          const targetId = isRajeeb ? 'rajeeb' : 'ramesh';
          const matched =
            presets.find((p) => p.id === targetId) ||
            presets.find((p) => p.id === 'ramesh') ||
            presets[0];

          if (matched) {
            setSelectedIssuerId(targetId);
            setBilledByName(matched.name);
            setBilledByTitle(matched.title);
            setBilledByPhone(matched.phone);
            setBilledByAddress(matched.address);
          }
        }
      } catch (err) {
        console.error('Failed to load presets:', err);
      }
    };
    initPresets();
  }, [editBillId, user]);

  const handleSelectIssuer = (id: 'ramesh' | 'rajeeb' | 'other') => {
    setSelectedIssuerId(id);
    if (id === 'other') {
      setShowContractorEdit(true);
      setBilledByName('');
      setBilledByPhone('');
      setBilledByAddress('Pune, Maharashtra');
    } else {
      const found = contractorPresets.find((p) => p.id === id);
      if (found) {
        setBilledByName(found.name);
        setBilledByPhone(found.phone);
        setBilledByAddress(found.address);
        setBilledByTitle(found.title);
      }
    }
  };

  const handleSaveAsDefaultContractor = async () => {
    if (!billedByName.trim()) {
      Alert.alert('Missing Name', 'Please enter contractor name.');
      return;
    }
    const presetId =
      selectedIssuerId === 'rajeeb'
        ? 'rajeeb'
        : selectedIssuerId === 'ramesh'
        ? 'ramesh'
        : 'other';
    const updated: ContractorPreset = {
      id: presetId,
      name: billedByName.trim().toUpperCase(),
      title: billedByTitle.trim() || 'PLUMBING & CIVIL WORKS CONTRACTOR',
      phone: billedByPhone.trim(),
      address: billedByAddress.trim() || 'Sus, Pune - 411021',
    };
    await saveContractorPreset(updated);
    const refreshed = await getContractorPresets();
    setContractorPresets(refreshed);
    Alert.alert(
      'Default Saved',
      `Saved default details for ${updated.name}! Future bills will automatically use this info.`
    );
  };

  const handleAddInlineParticular = () => {
    if (!particularName.trim()) {
      Alert.alert('Missing Particular', 'Please enter particular name (e.g. 1" Elbow).');
      return;
    }

    const qty = parseFloat(particularQty) || 1;
    const rate = parseFloat(particularRate) || 0;
    const total = qty * rate;

    const newItem: BillItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
      name: particularName.trim(),
      subDescription: particularSub.trim() || undefined,
      category: 'plumbing',
      quantity: qty,
      unit: particularUnit.trim() || 'pcs',
      rate: rate,
      amount: total,
    };

    setItems((prev) => [...prev, newItem]);
    // Reset inline inputs
    setParticularName('');
    setParticularSub('');
    setParticularQty('1');
    setParticularRate('');
    setParticularUnit('pcs');
  };

  const handleSelectPopular = (item: { name: string; unit: string; rate: number }) => {
    setParticularName(item.name);
    setParticularUnit(item.unit);
    setParticularRate(item.rate.toString());
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Calculations
  const subtotal = items.reduce((acc, item) => acc + item.amount, 0);
  const discountNum = parseFloat(discount) || 0;
  const advanceNum = parseFloat(advancePaid) || 0;
  const grandTotal = Math.max(0, subtotal - discountNum);
  const balanceDue = Math.max(0, grandTotal - advanceNum);
  const inWords = numberToWordsIndian(grandTotal);

  const handleSaveAndGenerate = async () => {
    if (!customerName.trim()) {
      Alert.alert(
        'Missing Client Name',
        'Please enter Customer / Client Name (to display in bold on the bill).'
      );
      return;
    }

    if (!siteLocation.trim()) {
      Alert.alert(
        'Missing Site Location',
        'Please enter Site / Project Location (e.g. Nigdi Site).'
      );
      return;
    }

    if (!billedByName.trim()) {
      Alert.alert('Missing Issuer Name', 'Please select or enter contractor name.');
      return;
    }

    if (items.length === 0) {
      Alert.alert('No Items', 'Please add at least one particular (enter rate and quantity).');
      return;
    }

    setIsSaving(true);
    try {
      const newBill: Bill = {
        id: editBillId || Date.now().toString(),
        billNumber: billNumber.trim() || (billType === 'quotation' ? 'QT-' + Date.now().toString().slice(-4) : '—'),
        billType: billType,
        billedBy: billedByName.trim(),
        billedByTitle: billedByTitle.trim(),
        billedByPhone: billedByPhone.trim(),
        billedByAddress: billedByAddress.trim(),
        date: getTodayDateString(),
        customerName: customerName.trim(),
        siteLocation: siteLocation.trim() || undefined,
        siteCity: siteCity.trim() || undefined,
        items: items,
        subtotal: subtotal,
        discount: discountNum,
        advancePaid: advanceNum,
        balanceDue: balanceDue,
        notes: notes.trim() || undefined,
        createdAt: editingCreatedAt || Date.now(),
      };

      await saveBill(newBill);
      navigation.replace('BillDetail', { billId: newBill.id });
    } catch (error) {
      Alert.alert('Error', 'Failed to save bill. Please try again.');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const isQuotation = billType === 'quotation';

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
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* Top Document Type Switcher */}
            <View style={styles.typeSelectorWrap}>
              <Text style={styles.selectorHeading}>SELECT DOCUMENT TYPE</Text>
              <View style={styles.pillToggleContainer}>
                <TouchableOpacity
                  onPress={() => setBillType('invoice')}
                  style={[
                    styles.pillButton,
                    !isQuotation && styles.pillInvoiceActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="receipt-long"
                    size={20}
                    color={!isQuotation ? '#FFF' : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.pillText,
                      !isQuotation && styles.pillTextActive,
                    ]}
                  >
                    INVOICE
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setBillType('quotation')}
                  style={[
                    styles.pillButton,
                    isQuotation && styles.pillQuotationActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="request-quote"
                    size={20}
                    color={isQuotation ? '#FFF' : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.pillText,
                      isQuotation && styles.pillTextActive,
                    ]}
                  >
                    QUOTATION
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Billed In Name Of (Issuer) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <MaterialIcons name="verified" size={20} color={COLORS.primary} />
                  <Text style={styles.cardTitle}>Billed In Name Of</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowContractorEdit(!showContractorEdit)}
                  style={styles.editContractorToggleBtn}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={showContractorEdit ? 'check' : 'edit'}
                    size={15}
                    color={COLORS.primary}
                  />
                  <Text style={styles.editContractorToggleText}>
                    {showContractorEdit ? 'Close' : 'Edit Details'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.issuerChipsRow}>
                <TouchableOpacity
                  onPress={() => handleSelectIssuer('ramesh')}
                  style={[
                    styles.issuerChip,
                    selectedIssuerId === 'ramesh' && styles.issuerChipActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="person"
                    size={18}
                    color={selectedIssuerId === 'ramesh' ? '#FFF' : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.issuerChipText,
                      selectedIssuerId === 'ramesh' && styles.issuerChipTextActive,
                    ]}
                  >
                    {contractorPresets.find((p) => p.id === 'ramesh')?.name || 'Ramesh Raut'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleSelectIssuer('rajeeb')}
                  style={[
                    styles.issuerChip,
                    selectedIssuerId === 'rajeeb' && styles.issuerChipActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="person"
                    size={18}
                    color={selectedIssuerId === 'rajeeb' ? '#FFF' : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.issuerChipText,
                      selectedIssuerId === 'rajeeb' && styles.issuerChipTextActive,
                    ]}
                  >
                    {contractorPresets.find((p) => p.id === 'rajeeb')?.name || 'Rajeeb Raut'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleSelectIssuer('other')}
                  style={[
                    styles.issuerChip,
                    selectedIssuerId === 'other' && styles.issuerChipActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="edit"
                    size={16}
                    color={selectedIssuerId === 'other' ? '#FFF' : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.issuerChipText,
                      selectedIssuerId === 'other' && styles.issuerChipTextActive,
                    ]}
                  >
                    + Custom
                  </Text>
                </TouchableOpacity>
              </View>

              {showContractorEdit || selectedIssuerId === 'other' ? (
                <View style={styles.contractorEditBox}>
                  <Text style={styles.contractorEditSectionTitle}>
                    EDIT CONTRACTOR LETTERHEAD DETAILS:
                  </Text>
                  <CustomInput
                    label="Contractor Name *"
                    placeholder="e.g. Ramesh Raut / Rajeeb Raut"
                    value={billedByName}
                    onChangeText={setBilledByName}
                    iconName="business"
                  />
                  <CustomInput
                    label="Business / Trade Title *"
                    placeholder="e.g. PLUMBING & CIVIL WORKS CONTRACTOR"
                    value={billedByTitle}
                    onChangeText={setBilledByTitle}
                    iconName="handyman"
                  />
                  <CustomInput
                    label="Phone Number *"
                    placeholder="e.g. +91 9860980626"
                    value={billedByPhone}
                    onChangeText={setBilledByPhone}
                    keyboardType="phone-pad"
                    iconName="phone"
                  />
                  <CustomInput
                    label="Office / Work Address"
                    placeholder="e.g. Sus, Pune - 411021"
                    value={billedByAddress}
                    onChangeText={setBilledByAddress}
                    iconName="location-on"
                  />

                  <View style={styles.saveDefaultRow}>
                    <TouchableOpacity
                      onPress={handleSaveAsDefaultContractor}
                      style={styles.saveDefaultBtn}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="save" size={16} color={COLORS.primary} />
                      <Text style={styles.saveDefaultBtnText}>
                        Save as Default for {selectedIssuerId === 'rajeeb' ? 'Rajeeb' : 'Ramesh'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowContractorEdit(false)}
                      style={styles.doneEditBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.doneEditBtnText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.issuerPreviewBox}>
                  <View style={styles.issuerPreviewRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.issuerPreviewName}>{billedByName}</Text>
                      <Text style={styles.issuerPreviewSub}>{billedByTitle}</Text>
                      <Text style={styles.issuerPreviewSub}>📞 {billedByPhone}</Text>
                      <Text style={styles.issuerPreviewSub}>📍 {billedByAddress}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowContractorEdit(true)}
                      style={styles.inlineEditBtn}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="edit" size={15} color={COLORS.primary} />
                      <Text style={styles.inlineEditText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Site & Client Details */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="person-pin" size={20} color={COLORS.primary} />
                <Text style={styles.cardTitle}>Client & Site Details</Text>
              </View>

              <CustomInput
                label="Customer / Client Name *"
                placeholder="e.g. Mr. Kulkarni / Sunita Sharma"
                value={customerName}
                onChangeText={setCustomerName}
                required
                iconName="person"
              />

              <CustomInput
                label="Site / Project Location *"
                placeholder="e.g. Nigdi Site, Flat 402, Green Acres"
                value={siteLocation}
                onChangeText={setSiteLocation}
                required
                iconName="home-work"
              />

              <CustomInput
                label="City / Location"
                placeholder="e.g. Pune, Maharashtra"
                value={siteCity}
                onChangeText={setSiteCity}
                iconName="location-city"
              />

              <CustomInput
                label={isQuotation ? 'Quotation No' : 'Bill No'}
                placeholder="e.g. —"
                value={billNumber}
                onChangeText={setBillNumber}
                iconName="tag"
              />
            </View>

            {/* SECTION: ADD PARTICULAR (Rate & Quantity) */}
            <View style={styles.particularCard}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="add-shopping-cart" size={20} color={COLORS.primary} />
                <Text style={styles.cardTitle}>Add Particular (Rate & Quantity)</Text>
              </View>

              {/* Particular Name */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Particular Description *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 1&quot; Elbow, CPVC Pipe, Tank Fitting"
                  value={particularName}
                  onChangeText={setParticularName}
                />
              </View>

              {/* Quick Popular Suggestions */}
              <View style={styles.quickChipsWrap}>
                <Text style={styles.quickChipsLabel}>Quick picks:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {POPULAR_PARTICULARS.map((pop) => (
                    <TouchableOpacity
                      key={pop.name}
                      onPress={() => handleSelectPopular(pop)}
                      style={styles.popularChip}
                    >
                      <Text style={styles.popularChipText}>{pop.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Subtext / Work Type (Optional) */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Subtitle / Work Subtext (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Labour charges, Material supply"
                  value={particularSub}
                  onChangeText={setParticularSub}
                />
              </View>

              {/* Quantity, Rate and Unit Row */}
              <View style={styles.calcRow}>
                <View style={[styles.calcBlock, { flex: 1.1 }]}>
                  <Text style={styles.fieldLabel}>Quantity *</Text>
                  <TextInput
                    style={styles.calcInput}
                    keyboardType="numeric"
                    placeholder="100"
                    value={particularQty}
                    onChangeText={setParticularQty}
                  />
                </View>

                <View style={[styles.calcBlock, { flex: 1.3 }]}>
                  <Text style={styles.fieldLabel}>Rate (₹) *</Text>
                  <TextInput
                    style={styles.calcInput}
                    keyboardType="numeric"
                    placeholder="100"
                    value={particularRate}
                    onChangeText={setParticularRate}
                  />
                </View>

                <View style={[styles.calcBlock, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <TextInput
                    style={styles.unitInput}
                    placeholder="pcs"
                    value={particularUnit}
                    onChangeText={setParticularUnit}
                  />
                </View>
              </View>

              {/* Dynamic Animated Total Box: e.g. 100 qty x 100 rate = 10,000/- */}
              <Animated.View
                style={[
                  styles.calcFormulaBox,
                  { transform: [{ scale: totalPulseAnim }] },
                ]}
              >
                <View>
                  <Text style={styles.calcFormulaText}>
                    {particularQty || '0'} {particularUnit} × ₹{particularRate || '0'}
                  </Text>
                  <Text style={styles.calcFormulaSub}>Calculated Amount</Text>
                </View>
                <Text style={styles.calcFormulaAmount}>
                  ₹ {inlineCalculatedTotal.toLocaleString('en-IN')}/-
                </Text>
              </Animated.View>

              {/* Add Button */}
              <TouchableOpacity
                onPress={handleAddInlineParticular}
                style={styles.addInlineBtn}
                activeOpacity={0.8}
              >
                <MaterialIcons name="add-circle" size={22} color="#FFF" />
                <Text style={styles.addInlineBtnText}>
                  + Add Particular (₹{inlineCalculatedTotal.toLocaleString('en-IN')}/-)
                </Text>
              </TouchableOpacity>

              {/* Or browse catalog button */}
              <TouchableOpacity
                onPress={() => setModalVisible(true)}
                style={styles.browseCatalogBtn}
              >
                <MaterialIcons name="menu-book" size={18} color={COLORS.primary} />
                <Text style={styles.browseCatalogText}>Browse Full Preset Catalog</Text>
              </TouchableOpacity>
            </View>

            {/* Added Particulars List */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="format-list-numbered" size={20} color={COLORS.primary} />
                <Text style={styles.cardTitle}>Particulars in this Bill</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{items.length} added</Text>
                </View>
              </View>

              {items.length === 0 ? (
                <View style={styles.emptyItemsBox}>
                  <MaterialIcons name="receipt-long" size={36} color={COLORS.textMuted} />
                  <Text style={styles.emptyItemsText}>
                    No particulars added yet. Enter description, rate, and quantity above!
                  </Text>
                </View>
              ) : (
                <View style={styles.itemsList}>
                  {items.map((item, index) => (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={styles.itemIndexBox}>
                        <Text style={styles.itemIndex}>{index + 1}</Text>
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        {item.subDescription ? (
                          <Text style={styles.itemSubDesc}>{item.subDescription}</Text>
                        ) : null}
                        <Text style={styles.itemSubQty}>
                          {item.quantity} {item.unit} × ₹{item.rate.toLocaleString('en-IN')}
                        </Text>
                      </View>
                      <View style={styles.itemAmountBox}>
                        <Text style={styles.itemAmount}>
                          ₹{item.amount.toLocaleString('en-IN')}/-
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveItem(item.id)}
                          style={styles.removeBtn}
                        >
                          <MaterialIcons name="close" size={18} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Summary & Amount In Words */}
            <View style={styles.letterheadPreviewBox}>
              <View style={styles.inWordsBox}>
                <Text style={styles.inWordsLabel}>TOTAL AMOUNT IN WORDS</Text>
                <Text style={styles.inWordsVal}>{inWords}</Text>
              </View>

              <View style={styles.grandTotalBanner}>
                <View style={styles.grandTotalLabelBox}>
                  <Text style={styles.grandTotalLabelText}>GRAND TOTAL</Text>
                </View>
                <View style={styles.grandTotalValueBox}>
                  <Text style={styles.grandTotalValueText}>
                    ₹ {grandTotal.toLocaleString('en-IN')}/-
                  </Text>
                </View>
              </View>
            </View>

            {/* Discount & Advance (For Invoices) */}
            {!isQuotation && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Payment Details</Text>
                <View style={styles.rowInputs}>
                  <View style={{ flex: 1 }}>
                    <CustomInput
                      label="Discount (₹)"
                      placeholder="0"
                      value={discount}
                      onChangeText={setDiscount}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <CustomInput
                      label="Advance Paid (₹)"
                      placeholder="0"
                      value={advancePaid}
                      onChangeText={setAdvancePaid}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.balanceDueRow}>
                  <Text style={styles.balanceDueLabel}>Balance Due:</Text>
                  <Text
                    style={[
                      styles.balanceDueVal,
                      balanceDue > 0 ? { color: COLORS.danger } : { color: COLORS.success },
                    ]}
                  >
                    {formatCurrency(balanceDue)}
                  </Text>
                </View>
              </View>
            )}

            {/* Remarks / Notes */}
            <View style={styles.card}>
              <CustomInput
                label="Remarks / Note (Optional)"
                placeholder="e.g. Work completed satisfactorily / Material extra"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Submit Action Button */}
            <View style={styles.submitWrap}>
              <BigButton
                title={
                  editBillId
                    ? (isQuotation ? `Update Quotation for ${billedByName}` : `Update Bill for ${billedByName}`)
                    : (isQuotation ? `Generate Quotation for ${billedByName}` : `Save & View Bill for ${billedByName}`)
                }
                subtitle={
                  editBillId
                    ? 'Saves your edits to the existing document'
                    : 'Creates letterhead matching DOC-20260905-WA0005.pdf'
                }
                iconName="check-circle"
                variant="primary"
                loading={isSaving}
                onPress={handleSaveAndGenerate}
              />
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Catalog Modal */}
      <ItemQuickPickerModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAddItem={(item) => setItems((prev) => [...prev, item])}
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
  typeSelectorWrap: {
    marginBottom: SPACING.md,
  },
  selectorHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 6,
    marginLeft: 2,
  },
  pillToggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceBorder,
    gap: 6,
  },
  pillButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  pillInvoiceActive: {
    backgroundColor: COLORS.primary,
  },
  pillQuotationActive: {
    backgroundColor: COLORS.primary,
  },
  pillText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  particularCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  issuerChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  issuerChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceBorder,
    gap: 4,
  },
  issuerChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  issuerChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  issuerChipTextActive: {
    color: '#FFFFFF',
  },
  editContractorToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FDF2F4',
    borderWidth: 1,
    borderColor: '#F1D9DE',
  },
  editContractorToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  contractorEditBox: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  contractorEditSectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  saveDefaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
  },
  saveDefaultBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FDF2F4',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  saveDefaultBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  doneEditBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneEditBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  issuerPreviewBox: {
    backgroundColor: COLORS.inputBg,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  issuerPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  inlineEditText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  issuerPreviewName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  issuerPreviewSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldBlock: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  quickChipsWrap: {
    marginBottom: 10,
  },
  quickChipsLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
    marginBottom: 4,
  },
  popularChip: {
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    marginRight: 6,
  },
  popularChipText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  calcRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  calcBlock: {},
  calcInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    fontWeight: '800',
    textAlign: 'center',
  },
  unitInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  calcFormulaBox: {
    backgroundColor: '#FFFDF5',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calcFormulaText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  calcFormulaSub: {
    fontSize: 10,
    color: COLORS.accentDark,
    fontWeight: '700',
    marginTop: 2,
  },
  calcFormulaAmount: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '900',
    color: COLORS.primary,
  },
  addInlineBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  addInlineBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  browseCatalogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  browseCatalogText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyItemsBox: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceBorder,
    borderStyle: 'dashed',
  },
  emptyItemsText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  itemsList: {},
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBg,
  },
  itemIndexBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  itemIndex: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  itemSubDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 1,
  },
  itemSubQty: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  itemAmountBox: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  itemAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  removeBtn: {
    padding: 2,
  },
  letterheadPreviewBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  inWordsBox: {
    backgroundColor: '#FFFDF5',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
    padding: 10,
    borderRadius: 4,
    marginBottom: 12,
  },
  inWordsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.accentDark,
    letterSpacing: 0.8,
  },
  inWordsVal: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  grandTotalBanner: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 8,
    overflow: 'hidden',
  },
  grandTotalLabelBox: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grandTotalLabelText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
  grandTotalValueBox: {
    flex: 1,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderLeftWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  grandTotalValueText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  balanceDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.inputBg,
  },
  balanceDueLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  balanceDueVal: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
  },
  submitWrap: {
    marginTop: 4,
    marginBottom: SPACING.xl,
  },
});
