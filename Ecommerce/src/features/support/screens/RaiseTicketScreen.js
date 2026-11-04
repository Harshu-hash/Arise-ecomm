import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useGetOrdersQuery } from '@features/orders';
import { useUploadSupportAttachmentMutation } from '@features/media';
import { useCreateTicketMutation, useGetTicketSubjectsQuery } from '../api/support.api';
import { useToast } from '../../../contexts/ToastContext';
const RaiseTicketScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets(),
    toast = useToast(),
    subjects = useGetTicketSubjectsQuery(),
    orders = useGetOrdersQuery({ limit: 20 }),
    [create, { isLoading: isSubmitting }] = useCreateTicketMutation(),
    [upload, { isLoading: isUploading }] = useUploadSupportAttachmentMutation(),
    [subjectCode, setSubjectCode] = useState(route?.params?.subjectId || null),
    [description, setDescription] = useState(''),
    [orderId, setOrderId] = useState(route?.params?.order?.id || route?.params?.orderId || null),
    [attachments, setAttachments] = useState([]);
  if (subjects.isLoading || orders.isLoading)
    return <FullScreenLoader message="Loading support options..." />;
  if (subjects.error || orders.error)
    return (
      <ErrorState
        title="Support form unavailable"
        message={(subjects.error || orders.error)?.message}
        onRetry={() => {
          subjects.refetch();
          orders.refetch();
        }}
      />
    );
  const selected = subjects.data.find(item => item.code === subjectCode);
  const pick = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 3 - attachments.length,
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8,
        includeBase64: false,
      });
      if (result.didCancel) return;
      if (result.errorCode) {
        toast.show(
          result.errorCode === 'permission'
            ? 'Photo access was denied.'
            : result.errorMessage || 'Could not select photos.',
          { variant: 'error' },
        );
        return;
      }
      for (const [index, asset] of (result.assets || []).entries()) {
        if (!asset.uri || !asset.type || !asset.fileName || !asset.fileSize) continue;
        const media = await upload({ uploadKey: `support-${Date.now()}-${index}`, asset }).unwrap();
        setAttachments(current => [...current, media].slice(0, 3));
      }
    } catch (error) {
      toast.show(error.message || 'Could not upload attachment', { variant: 'error' });
    }
  };
  const submit = async () => {
    try {
      const ticket = await create({
        subjectCode,
        description,
        orderId: selected?.requiresOrder ? orderId : null,
        attachmentMediaIds: attachments.map(item => item.id),
      }).unwrap();
      toast.show('Support ticket created', { variant: 'success', icon: 'check' });
      navigation.replace('TicketDetail', { ticketId: ticket.id });
    } catch (error) {
      toast.show(error.message || 'Could not create ticket', { variant: 'error' });
    }
  };
  const valid =
    selected &&
    description.trim().length >= 10 &&
    (!selected.requiresOrder || orderId) &&
    !isUploading;
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Raise a Ticket</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>What is this about?</Text>
        <View style={styles.chips}>
          {subjects.data.map(item => (
            <TouchableOpacity
              key={item.code}
              onPress={() => setSubjectCode(item.code)}
              style={[styles.chip, subjectCode === item.code && styles.chipActive]}
            >
              <Text style={[styles.chipText, subjectCode === item.code && styles.chipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {selected?.requiresOrder ? (
          <>
            <Text style={styles.section}>Choose an order</Text>
            {orders.data.items.map(order => (
              <TouchableOpacity
                key={order.id}
                onPress={() => setOrderId(order.id)}
                style={[styles.order, orderId === order.id && styles.orderActive]}
              >
                <Text style={styles.orderId}>{order.id}</Text>
                <Text style={styles.orderName} numberOfLines={1}>
                  {order.name}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        ) : null}
        <Text style={styles.section}>Describe your issue</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          maxLength={4000}
          multiline
          placeholder="Include at least 10 characters"
          placeholderTextColor={COLORS.textTertiary}
          style={styles.area}
        />
        <View style={styles.attachHeader}>
          <Text style={styles.section}>Photos (optional)</Text>
          {attachments.length < 3 ? (
            <TouchableOpacity disabled={isUploading} onPress={pick}>
              <Text style={styles.add}>{isUploading ? 'Uploading...' : 'Add photos'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.images}>
          {attachments.map((item, index) => (
            <View key={item.id}>
              <Image source={{ uri: item.thumbnailUrl }} style={styles.image} />
              <TouchableOpacity
                style={styles.remove}
                onPress={() =>
                  setAttachments(current => current.filter((_, position) => position !== index))
                }
              >
                <Icon name="x" size={11} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
        <TouchableOpacity
          disabled={!valid || isSubmitting}
          onPress={submit}
          style={[styles.button, (!valid || isSubmitting) && styles.disabled]}
        >
          <Text style={styles.buttonText}>{isSubmitting ? 'Submitting...' : 'Submit Ticket'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
    backgroundColor: COLORS.surface,
  },
  headerTitle: { fontSize: 19, fontWeight: '600', color: COLORS.textPrimary },
  content: { padding: SPACING.l, paddingBottom: SPACING.xxxl },
  section: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.m,
    marginBottom: SPACING.s,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  chipText: { fontSize: 12, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary, fontWeight: '700' },
  order: {
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    marginBottom: SPACING.s,
  },
  orderActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  orderId: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary },
  orderName: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  area: {
    minHeight: 130,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    color: COLORS.textPrimary,
  },
  attachHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  add: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary, marginTop: SPACING.m },
  images: { flexDirection: 'row', gap: SPACING.s },
  image: { width: 66, height: 66, borderRadius: RADIUS.s },
  remove: {
    position: 'absolute',
    right: -5,
    top: -5,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    padding: 3,
  },
  footer: {
    padding: SPACING.l,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.m,
    borderRadius: RADIUS.s,
    alignItems: 'center',
  },
  disabled: { backgroundColor: COLORS.border },
  buttonText: { color: COLORS.white, fontWeight: '700' },
});
export default RaiseTicketScreen;
