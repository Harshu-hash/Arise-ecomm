import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import {
  useCreateAddressMutation,
  useGetServiceabilityQuery,
  useUpdateAddressMutation,
  useValidateAddressMutation,
} from '../api/address.query';

const LABELS = ['Home', 'Work', 'Other'];

const AddEditAddressScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const existing = route?.params?.address;
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name || '');
  const [phone, setPhone] = useState(existing?.phone || '');
  const [pincode, setPincode] = useState(existing?.pincode || '');
  const [addressLine, setAddressLine] = useState(existing?.line || '');
  const [city, setCity] = useState(existing?.city || '');
  const [state, setState] = useState(existing?.state || '');
  const [label, setLabel] = useState(existing?.label || 'Home');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const { data: serviceability, isFetching: isCheckingPincode } = useGetServiceabilityQuery(
    pincode,
    { skip: !/^[1-9][0-9]{5}$/.test(pincode) },
  );
  const [validateAddress, { isLoading: isValidating }] = useValidateAddressMutation();
  const [createAddress, { isLoading: isCreating }] = useCreateAddressMutation();
  const [updateAddress, { isLoading: isUpdating }] = useUpdateAddressMutation();
  const isSaving = isValidating || isCreating || isUpdating;

  const handleSave = async () => {
    const input = {
      name,
      phone,
      pincode,
      line: addressLine,
      city,
      state,
      label,
      isDefault: existing?.isDefault ?? false,
    };
    setFormError('');
    setFieldErrors({});
    try {
      const validation = await validateAddress(input).unwrap();
      if (isEdit) {
        await updateAddress({ addressId: existing.id, ...validation.normalizedAddress }).unwrap();
      } else {
        await createAddress(validation.normalizedAddress).unwrap();
      }
      navigation?.goBack();
    } catch (mutationError) {
      setFieldErrors(mutationError.fieldErrors || {});
      setFormError(mutationError.message || 'Could not save this address.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Address' : 'Add New Address'}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter recipient name"
            placeholderTextColor={COLORS.textTertiary}
          />
          {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Mobile Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="10-digit mobile number"
            placeholderTextColor={COLORS.textTertiary}
          />
          {fieldErrors.phone ? <Text style={styles.fieldError}>{fieldErrors.phone}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Pincode</Text>
          <TextInput
            style={styles.input}
            value={pincode}
            onChangeText={setPincode}
            keyboardType="number-pad"
            placeholder="6-digit pincode"
            placeholderTextColor={COLORS.textTertiary}
          />
          {fieldErrors.pincode ? (
            <Text style={styles.fieldError}>{fieldErrors.pincode}</Text>
          ) : null}
          {isCheckingPincode ? <Text style={styles.helperText}>Checking delivery...</Text> : null}
          {serviceability ? (
            <Text style={serviceability.serviceable ? styles.successText : styles.fieldError}>
              {serviceability.message}
            </Text>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Address (House No, Building, Street, Area)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={addressLine}
            onChangeText={setAddressLine}
            multiline
            placeholder="Enter complete address"
            placeholderTextColor={COLORS.textTertiary}
          />
          {fieldErrors.line ? <Text style={styles.fieldError}>{fieldErrors.line}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Town / City</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="Enter town or city"
            placeholderTextColor={COLORS.textTertiary}
          />
          {fieldErrors.city ? <Text style={styles.fieldError}>{fieldErrors.city}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>State</Text>
          <TextInput
            style={styles.input}
            value={state}
            onChangeText={setState}
            placeholder="Enter state"
            placeholderTextColor={COLORS.textTertiary}
          />
          {fieldErrors.state ? <Text style={styles.fieldError}>{fieldErrors.state}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Save Address As</Text>
          <View style={styles.chipRow}>
            {LABELS.map(option => (
              <TouchableOpacity
                key={option}
                activeOpacity={0.8}
                onPress={() => setLabel(option)}
                style={[styles.chip, label === option && styles.chipActive]}
              >
                <Text style={[styles.chipText, label === option && styles.chipTextActive]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={isSaving || serviceability?.serviceable === false}
          style={[
            styles.saveBtn,
            (isSaving || serviceability?.serviceable === false) && styles.saveBtnDisabled,
          ]}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>
            {isSaving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Address'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  backBtn: {
    marginRight: SPACING.m,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  fieldGroup: {
    marginBottom: SPACING.l,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    fontSize: 14.5,
    color: COLORS.textPrimary,
  },
  textArea: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  helperText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  successText: {
    color: COLORS.success,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  fieldError: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  formError: {
    color: COLORS.error,
    fontSize: 13,
    marginBottom: SPACING.l,
  },
  chipRow: {
    flexDirection: 'row',
    gap: SPACING.s,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
  },
  chipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.55,
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default AddEditAddressScreen;
