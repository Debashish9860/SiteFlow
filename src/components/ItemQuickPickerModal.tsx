import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
} from 'react-native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { PRESET_CATALOG, STANDARD_UNITS, COMMON_SUB_DESCRIPTIONS } from '../data/presets';
import { BillItem, ItemCategory, PresetCatalogItem } from '../types/bill';
import { MaterialIcons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/formatters';

interface ItemQuickPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onAddItem: (item: BillItem) => void;
}

export const ItemQuickPickerModal: React.FC<ItemQuickPickerModalProps> = ({
  visible,
  onClose,
  onAddItem,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected item configuration form
  const [selectedItemName, setSelectedItemName] = useState('');
  const [subDescription, setSubDescription] = useState('Labour charges');
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory>('plumbing');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [rate, setRate] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);

  const filterPresets = () => {
    return PRESET_CATALOG.filter((item) => {
      const matchCat =
        activeCategory === 'all' ||
        (activeCategory === 'plumbing' && item.category === 'plumbing') ||
        (activeCategory === 'material' && (item.category === 'material' || item.category === 'civil')) ||
        (activeCategory === 'labor' && item.category === 'labor');

      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.subDescription && item.subDescription.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  };

  const handleSelectPreset = (preset: PresetCatalogItem) => {
    setSelectedItemName(preset.name);
    setSubDescription(preset.subDescription || 'Labour charges');
    setSelectedCategory(preset.category);
    setUnit(preset.defaultUnit);
    setRate(preset.suggestedRate ? preset.suggestedRate.toString() : '');
    setQuantity('1');
    setIsConfiguring(true);
  };

  const handleCreateCustom = () => {
    setSelectedItemName(searchQuery.trim() || '');
    setSubDescription('Material supply');
    setSelectedCategory('other');
    setUnit('pcs');
    setRate('');
    setQuantity('1');
    setIsConfiguring(true);
  };

  const handleSaveItem = () => {
    if (!selectedItemName.trim()) return;

    const qtyNum = parseFloat(quantity) || 1;
    const rateNum = parseFloat(rate) || 0;
    const amount = qtyNum * rateNum;

    const newItem: BillItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
      name: selectedItemName.trim(),
      subDescription: subDescription.trim() || undefined,
      category: selectedCategory,
      quantity: qtyNum,
      unit: unit,
      rate: rateNum,
      amount: amount,
    };

    onAddItem(newItem);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setIsConfiguring(false);
    setSelectedItemName('');
    setSubDescription('Labour charges');
    setQuantity('1');
    setRate('');
    setSearchQuery('');
  };

  const qtyNum = parseFloat(quantity) || 0;
  const rateNum = parseFloat(rate) || 0;
  const computedTotal = qtyNum * rateNum;

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {isConfiguring ? 'Configure Particular' : 'Select Particular / Work'}
              </Text>
              <Text style={styles.modalSub}>
                {isConfiguring
                  ? 'Enter rate and quantity'
                  : 'Tap common items or type custom description'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                onClose();
              }}
              style={styles.closeBtn}
            >
              <MaterialIcons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          {isConfiguring ? (
            <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
              {/* Item Name Input */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Particular Description *</Text>
                <TextInput
                  style={styles.textInput}
                  value={selectedItemName}
                  onChangeText={setSelectedItemName}
                  placeholder="e.g. 1 inch Elbow"
                />
              </View>

              {/* Sub-Description Input with quick chips */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Subtitle / Note (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={subDescription}
                  onChangeText={setSubDescription}
                  placeholder="e.g. Labour charges, Fitting"
                />
                <View style={styles.quickChipsRow}>
                  {COMMON_SUB_DESCRIPTIONS.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => setSubDescription(tag)}
                      style={[
                        styles.quickTagChip,
                        subDescription === tag && styles.quickTagChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickTagText,
                          subDescription === tag && styles.quickTagTextActive,
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Quantity and Rate Row */}
              <View style={styles.rowInputs}>
                <View style={[styles.inputBlock, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Quantity *</Text>
                  <TextInput
                    style={styles.numInput}
                    keyboardType="numeric"
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="1"
                  />
                </View>

                <View style={[styles.inputBlock, { flex: 1.2 }]}>
                  <Text style={styles.fieldLabel}>Rate (₹) *</Text>
                  <TextInput
                    style={styles.numInput}
                    keyboardType="numeric"
                    value={rate}
                    onChangeText={setRate}
                    placeholder="0"
                  />
                </View>

                <View style={[styles.inputBlock, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <TextInput
                    style={styles.unitInput}
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="pcs"
                  />
                </View>
              </View>

              {/* Quick Unit Selector */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.unitScroll}
              >
                {STANDARD_UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    onPress={() => setUnit(u)}
                    style={[
                      styles.unitChip,
                      unit === u && styles.activeUnitChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.unitText,
                        unit === u && styles.activeUnitText,
                      ]}
                    >
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Dynamic Live Calculation Card */}
              <View style={styles.totalPreviewBox}>
                <View>
                  <Text style={styles.calculationFormula}>
                    {quantity || '0'} {unit} × ₹{rate || '0'}
                  </Text>
                  <Text style={styles.totalPreviewLabel}>Total Item Amount</Text>
                </View>
                <Text style={styles.totalPreviewAmount}>
                  ₹ {computedTotal.toLocaleString('en-IN')}/-
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => setIsConfiguring(false)}
                  style={styles.backBtn}
                >
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveItem}
                  style={styles.addDoneBtn}
                >
                  <MaterialIcons name="check" size={22} color="#FFF" />
                  <Text style={styles.addDoneBtnText}>Add to Bill</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>
              {/* Search Bar */}
              <View style={styles.searchBar}>
                <MaterialIcons name="search" size={22} color={COLORS.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search particular e.g. Elbow, Pipe, Tank..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <MaterialIcons name="clear" size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Custom Add Trigger */}
              {searchQuery.trim().length > 0 && (
                <TouchableOpacity
                  onPress={handleCreateCustom}
                  style={styles.customAddBar}
                >
                  <MaterialIcons name="add-circle" size={24} color={COLORS.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.customAddTitle}>
                      Use "{searchQuery.trim()}"
                    </Text>
                    <Text style={styles.customAddSub}>
                      Set quantity & rate for this custom particular
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={COLORS.primary} />
                </TouchableOpacity>
              )}

              {/* Category Filter Tabs */}
              <View style={styles.categoryTabs}>
                {[
                  { key: 'all', label: 'All Items' },
                  { key: 'plumbing', label: 'Plumbing' },
                  { key: 'labor', label: 'Labor' },
                  { key: 'material', label: 'Civil Works' },
                ].map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => setActiveCategory(cat.key)}
                    style={[
                      styles.categoryTab,
                      activeCategory === cat.key && styles.activeCategoryTab,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryTabText,
                        activeCategory === cat.key && styles.activeCategoryTabText,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Presets List */}
              <FlatList
                data={filterPresets()}
                keyExtractor={(item, index) => item.name + index}
                contentContainerStyle={styles.presetsList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.presetItem}
                    onPress={() => handleSelectPreset(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.presetItemName}>{item.name}</Text>
                      {item.subDescription ? (
                        <Text style={styles.presetSubDesc}>{item.subDescription}</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                      <Text style={styles.presetRate}>
                        {item.suggestedRate ? `₹${item.suggestedRate.toLocaleString('en-IN')}` : 'Enter Rate'}
                      </Text>
                      <Text style={styles.presetUnit}>per {item.defaultUnit}</Text>
                    </View>
                    <MaterialIcons name="add" size={22} color={COLORS.primary} style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '88%',
    padding: SPACING.md,
  },
  modalHeader: {
    backgroundColor: COLORS.primary,
    marginHorizontal: -SPACING.md,
    marginTop: -SPACING.md,
    padding: SPACING.md,
    paddingTop: SPACING.lg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSub: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  formContainer: {
    paddingTop: SPACING.md,
  },
  fieldBlock: {
    marginBottom: SPACING.sm,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.xs,
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
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickTagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceBorder,
  },
  quickTagChipActive: {
    backgroundColor: COLORS.primary,
  },
  quickTagText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  quickTagTextActive: {
    color: '#FFFFFF',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: SPACING.sm,
  },
  inputBlock: {},
  numInput: {
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
  unitScroll: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    marginTop: 2,
  },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    marginRight: 6,
  },
  activeUnitChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  unitText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  activeUnitText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  totalPreviewBox: {
    backgroundColor: '#FFFDF5',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
    borderRadius: 8,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  calculationFormula: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  totalPreviewLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.accentDark,
    marginTop: 2,
  },
  totalPreviewAmount: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '900',
    color: COLORS.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  backBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceBorder,
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  addDoneBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  addDoneBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceBorder,
    marginVertical: SPACING.sm,
    height: 46,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  customAddBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySubtle,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  customAddTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  customAddSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  categoryTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  categoryTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  activeCategoryTab: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryTabText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  activeCategoryTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  presetsList: {
    paddingBottom: SPACING.xl,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    marginBottom: 6,
  },
  presetItemName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  presetSubDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  presetRate: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.primary,
  },
  presetUnit: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
});
