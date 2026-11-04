import React, { useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useGetOrderQuery } from '@features/orders';
import { useGetAddressesQuery } from '@features/address';
import { useCreateReturnMutation, useGetReturnEligibilityQuery } from '@features/returns';
import { launchImageLibrary } from 'react-native-image-picker';
import { subscribeToUploadProgress, useUploadReturnEvidenceMutation } from '@features/media';

const MODES = [
  { id: 'refund', label: 'Return for Refund' },
  { id: 'replace', label: 'Replacement' },
];

const ReturnReplaceScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const orderId = route?.params?.orderId || route?.params?.order?.id;
  const {
    data: order,
    error: orderError,
    isLoading: isLoadingOrder,
    refetch,
  } = useGetOrderQuery(orderId, { skip: !orderId });
  const {
    data: eligibility,
    error: eligibilityError,
    isLoading: isLoadingEligibility,
  } = useGetReturnEligibilityQuery(orderId, { skip: !orderId });
  const { data: addressBook, isLoading: isLoadingAddresses } = useGetAddressesQuery();
  const [createReturn, { isLoading: isSubmitting }] = useCreateReturnMutation();
  const [uploadReturnEvidence] = useUploadReturnEvidenceMutation();
  const [mode, setMode] = useState('refund');
  const [reason, setReason] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(route?.params?.selectedAddressId);
  const [submitted, setSubmitted] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [pickerError, setPickerError] = useState('');
  const returnItem = eligibility?.items.find(item => item.eligible);
  const pickupAddress =
    addressBook?.items.find(address => address.id === selectedAddressId) ||
    addressBook?.items.find(address => address.isDefault) ||
    addressBook?.items[0];
  const selectedReason = eligibility?.reasons.find(item => item.code === reason);
  const uploadedMediaIds = attachments
    .filter(attachment => attachment.status === 'ready')
    .map(attachment => attachment.media.id);

  useFocusEffect(
    React.useCallback(() => {
      const selected = route?.params?.selectedAddressId;
      if (selected) {
        setSelectedAddressId(selected);
        navigation.setParams({ selectedAddressId: undefined });
      }
    }, [navigation, route?.params?.selectedAddressId]),
  );

  const handleSubmit = async () => {
    setSubmitError('');
    try {
      const request = await createReturn({
        orderId,
        orderItemId: returnItem.orderItemId,
        resolution: mode === 'refund' ? 'REFUND' : 'REPLACEMENT',
        reasonCode: reason,
        pickupAddressId: pickupAddress.id,
        evidenceMediaIds: uploadedMediaIds,
        refundDestination: 'ORIGINAL_PAYMENT',
      }).unwrap();
      setSubmitted(request);
    } catch (mutationError) {
      setSubmitError(mutationError.message || 'Could not create this return request.');
    }
  };

  const uploadAsset = async attachment => {
    setAttachments(current =>
      current.map(item =>
        item.uploadKey === attachment.uploadKey
          ? { ...item, status: 'uploading', progress: 0, error: null }
          : item,
      ),
    );
    const unsubscribe = subscribeToUploadProgress(attachment.uploadKey, progress => {
      setAttachments(current =>
        current.map(item =>
          item.uploadKey === attachment.uploadKey ? { ...item, progress } : item,
        ),
      );
    });
    try {
      const media = await uploadReturnEvidence({
        uploadKey: attachment.uploadKey,
        asset: attachment.asset,
      }).unwrap();
      setAttachments(current =>
        current.map(item =>
          item.uploadKey === attachment.uploadKey
            ? { ...item, status: 'ready', progress: 100, media }
            : item,
        ),
      );
    } catch (uploadError) {
      setAttachments(current =>
        current.map(item =>
          item.uploadKey === attachment.uploadKey
            ? {
                ...item,
                status: 'failed',
                error: uploadError.message || 'Upload failed. Tap retry.',
              }
            : item,
        ),
      );
    } finally {
      unsubscribe();
    }
  };

  const pickEvidence = async () => {
    setPickerError('');
    const remaining = 3 - attachments.length;
    if (remaining <= 0) return;
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: remaining,
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8,
        includeBase64: false,
      });
      if (result.didCancel) return;
      if (result.errorCode) {
        setPickerError(
          result.errorCode === 'permission'
            ? 'Photo access was denied. Allow access in device settings and try again.'
            : result.errorMessage || 'Could not open the photo library.',
        );
        return;
      }
      const selected = (result.assets || []).filter(
        asset => asset.uri && asset.type && asset.fileName && asset.fileSize,
      );
      const newAttachments = selected.map((asset, index) => ({
        uploadKey: `${Date.now()}-${index}-${asset.fileName}`,
        asset,
        status: 'queued',
        progress: 0,
        media: null,
        error: null,
      }));
      setAttachments(current => [...current, ...newAttachments].slice(0, 3));
      for (const attachment of newAttachments) await uploadAsset(attachment);
    } catch {
      setPickerError('Could not open the photo library. Please try again.');
    }
  };

  if (isLoadingOrder || isLoadingEligibility || isLoadingAddresses) {
    return <FullScreenLoader message="Checking return eligibility..." />;
  }
  if (orderError || eligibilityError || !order || !eligibility) {
    return (
      <ErrorState
        title="Return unavailable"
        message={(orderError || eligibilityError)?.message}
        onRetry={refetch}
      />
    );
  }
  if (!returnItem) {
    return (
      <ErrorState
        title="No returnable items"
        message={
          eligibility.items[0]?.ineligibleReason ||
          'No items in this order are currently eligible for return.'
        }
      />
    );
  }

  if (submitted) {
    return (
      <View style={styles.container}>
        <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
        <View style={styles.successWrap}>
          <View style={styles.successIconCircle}>
            <Icon name="check" size={32} color={COLORS.white} />
          </View>
          <Text style={styles.successTitle}>
            {mode === 'refund' ? 'Return Request Placed' : 'Replacement Requested'}
          </Text>
          <Text style={styles.successSubtitle}>
            Request {submitted.id} is scheduled: {submitted.pickupWindowLabel}.{' '}
            {mode === 'refund'
              ? 'Your refund will be initiated once the item passes quality check.'
              : 'A replacement will be shipped once the returned item is picked up.'}
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryBtn}
            onPress={() => navigation && navigation.navigate('OrderDetail', { orderId })}
          >
            <Text style={styles.primaryBtnText}>Track this Request</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.secondaryBtn}
            onPress={() => navigation && navigation.navigate('HelpCenter')}
          >
            <Text style={styles.secondaryBtnText}>Back to Help Center</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Return / Replace</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {order ? (
          <View style={styles.orderCard}>
            <Image source={{ uri: order.image }} style={styles.image} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.orderName} numberOfLines={2}>
                {order.name}
              </Text>
              <Text style={styles.orderMeta}>
                {order.id} · ₹{order.price}
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>What would you like?</Text>
        <View style={styles.modeRow}>
          {MODES.map(m => (
            <TouchableOpacity
              key={m.id}
              activeOpacity={0.8}
              onPress={() => setMode(m.id)}
              style={[styles.modeChip, mode === m.id && styles.modeChipActive]}
            >
              <Text style={[styles.modeChipText, mode === m.id && styles.modeChipTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Select a reason</Text>
        {eligibility.reasons.map(returnReason => (
          <TouchableOpacity
            key={returnReason.code}
            activeOpacity={0.7}
            style={styles.reasonRow}
            onPress={() => setReason(returnReason.code)}
          >
            <View style={[styles.radio, reason === returnReason.code && styles.radioActive]}>
              {reason === returnReason.code ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={styles.reasonText}>
              {returnReason.label}
              {returnReason.requiresEvidence ? ' (photo required)' : ''}
            </Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle}>Photo Evidence</Text>
        <Text style={styles.evidenceHelp}>
          Add up to 3 clear photos. JPEG, PNG, or WebP; maximum 8 MB each.
        </Text>
        {attachments.map(attachment => (
          <View key={attachment.uploadKey} style={styles.attachmentRow}>
            <Image source={{ uri: attachment.asset.uri }} style={styles.attachmentThumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.attachmentName} numberOfLines={1}>
                {attachment.asset.fileName}
              </Text>
              <Text
                style={
                  attachment.status === 'failed' ? styles.attachmentError : styles.attachmentStatus
                }
              >
                {attachment.status === 'uploading'
                  ? `Uploading ${attachment.progress}%`
                  : attachment.status === 'ready'
                    ? 'Uploaded'
                    : attachment.error || 'Waiting to upload'}
              </Text>
            </View>
            {attachment.status === 'failed' ? (
              <TouchableOpacity onPress={() => uploadAsset(attachment)}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() =>
                setAttachments(current =>
                  current.filter(item => item.uploadKey !== attachment.uploadKey),
                )
              }
            >
              <Icon name="x" size={18} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        ))}
        {attachments.length < 3 ? (
          <TouchableOpacity style={styles.addEvidenceBtn} onPress={pickEvidence}>
            <Icon name="image" size={16} color={COLORS.primary} />
            <Text style={styles.addEvidenceText}>Add Photos</Text>
          </TouchableOpacity>
        ) : null}
        {pickerError ? <Text style={styles.submitError}>{pickerError}</Text> : null}

        <Text style={styles.sectionTitle}>Pickup Address</Text>
        <View style={styles.addressCard}>
          <Icon name="map-pin" size={16} color={COLORS.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressName}>
              {pickupAddress?.label || 'Pickup address required'}
            </Text>
            <Text style={styles.addressText}>
              {pickupAddress?.address || 'Add a pickup address'}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              navigation &&
              navigation.navigate('SavedAddresses', {
                selectMode: true,
                returnScreen: 'ReturnReplace',
              })
            }
          >
            <Text style={styles.changeText}>Change</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {selectedReason?.requiresEvidence && !uploadedMediaIds.length ? (
        <Text style={styles.submitError}>
          At least one uploaded photo is required for this reason.
        </Text>
      ) : null}
      {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={
            !reason ||
            !pickupAddress ||
            isSubmitting ||
            attachments.some(attachment =>
              ['queued', 'uploading', 'failed'].includes(attachment.status),
            ) ||
            (selectedReason?.requiresEvidence && !uploadedMediaIds.length)
          }
          style={[
            styles.submitBtn,
            (!reason ||
              !pickupAddress ||
              isSubmitting ||
              attachments.some(attachment =>
                ['queued', 'uploading', 'failed'].includes(attachment.status),
              ) ||
              (selectedReason?.requiresEvidence && !uploadedMediaIds.length)) &&
              styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
        >
          <Text style={styles.submitBtnText}>
            {isSubmitting
              ? 'Submitting...'
              : mode === 'refund'
                ? 'Schedule Return Pickup'
                : 'Request Replacement'}
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
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    gap: SPACING.m,
    marginBottom: SPACING.xl,
  },
  image: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.white,
  },
  orderName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 16,
    marginBottom: 3,
  },
  orderMeta: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
    marginTop: SPACING.s,
  },
  modeRow: {
    flexDirection: 'row',
    gap: SPACING.s,
    marginBottom: SPACING.l,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
  },
  modeChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modeChipTextActive: {
    color: COLORS.primary,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.s,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.m,
  },
  radioActive: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: COLORS.primary,
  },
  reasonText: {
    fontSize: 13.5,
    color: COLORS.textPrimary,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    gap: SPACING.m,
  },
  addressName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  changeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  footer: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  submitError: {
    color: COLORS.error,
    fontSize: 12,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.s,
  },
  evidenceHelp: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: SPACING.m,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.s,
    marginBottom: SPACING.s,
  },
  attachmentThumb: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.mutedBg,
  },
  attachmentName: {
    color: COLORS.textPrimary,
    fontSize: 12.5,
    fontWeight: '600',
  },
  attachmentStatus: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  attachmentError: {
    color: COLORS.error,
    fontSize: 11,
    marginTop: 2,
  },
  retryText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  addEvidenceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    marginBottom: SPACING.l,
  },
  addEvidenceText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.l,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.s,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: SPACING.xxl,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: SPACING.s,
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: 13.5,
    fontWeight: '600',
  },
});

export default ReturnReplaceScreen;
