import React, { useEffect, useState } from 'react';
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
import { useToast } from '../../../contexts/ToastContext';
import { subscribeToUploadProgress, useUploadReviewMediaMutation } from '@features/media';
import {
  useCreateReviewMutation,
  useGetReviewEligibilityQuery,
  useUpdateReviewMutation,
} from '../api/reviews.api';

const WriteReviewScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const review = route?.params?.review;
  const orderItemId = route?.params?.orderItemId;
  const eligibility = useGetReviewEligibilityQuery(orderItemId, { skip: !!review || !orderItemId });
  const [createReview, createState] = useCreateReviewMutation();
  const [updateReview, updateState] = useUpdateReviewMutation();
  const [uploadReviewMedia] = useUploadReviewMediaMutation();
  const [rating, setRating] = useState(review?.rating || 0);
  const [title, setTitle] = useState(review?.title || '');
  const [body, setBody] = useState(review?.text || '');
  const [attachments, setAttachments] = useState(review?.media || []);
  const [mediaError, setMediaError] = useState('');
  useEffect(() => {
    if (eligibility.data && !eligibility.data.eligible && eligibility.data.existingReviewId)
      toast.show('You already reviewed this item.');
  }, [eligibility.data, toast]);
  if (!review && eligibility.isLoading)
    return <FullScreenLoader message="Checking review eligibility..." />;
  if (!review && (eligibility.error || !orderItemId))
    return (
      <ErrorState
        title="Review unavailable"
        message={eligibility.error?.message || 'Open this page from a delivered order.'}
        onRetry={eligibility.refetch}
      />
    );
  if (!review && eligibility.data && !eligibility.data.eligible)
    return <ErrorState title="Review unavailable" message={eligibility.data.reason} />;
  const productName = review?.product || eligibility.data?.productName;
  const isUploading = attachments.some(item => item.status === 'uploading');
  const busy = createState.isLoading || updateState.isLoading || isUploading;
  const valid =
    rating > 0 &&
    body.trim().length >= 10 &&
    body.trim().length <= 2000 &&
    title.trim().length <= 100;
  const submit = async () => {
    try {
      if (review) await updateReview({ reviewId: review.id, rating, title, body }).unwrap();
      else
        await createReview({
          orderItemId,
          productId: eligibility.data.productId,
          rating,
          title,
          body,
          mediaIds: attachments.filter(item => item.id).map(item => item.id),
        }).unwrap();
      toast.show(
        review ? 'Review updated and sent for moderation' : 'Review submitted for moderation',
        { variant: 'success', icon: 'check' },
      );
      navigation.goBack();
    } catch (error) {
      toast.show(error.message || 'Could not save review', { variant: 'error' });
    }
  };
  const pickMedia = async () => {
    setMediaError('');
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 5 - attachments.length,
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8,
        includeBase64: false,
      });
      if (result.didCancel) return;
      if (result.errorCode) {
        setMediaError(
          result.errorCode === 'permission'
            ? 'Photo access was denied. Allow access in device settings.'
            : result.errorMessage || 'Could not select photos.',
        );
        return;
      }
      for (const [index, asset] of (result.assets || []).entries()) {
        if (!asset.uri || !asset.type || !asset.fileName || !asset.fileSize) continue;
        const uploadKey = `${Date.now()}-${index}-${asset.fileName}`;
        setAttachments(current => [
          ...current,
          { uploadKey, uri: asset.uri, status: 'uploading', progress: 0 },
        ]);
        const unsubscribe = subscribeToUploadProgress(uploadKey, progress =>
          setAttachments(current =>
            current.map(item => (item.uploadKey === uploadKey ? { ...item, progress } : item)),
          ),
        );
        try {
          const media = await uploadReviewMedia({ uploadKey, asset }).unwrap();
          setAttachments(current =>
            current.map(item =>
              item.uploadKey === uploadKey
                ? { ...media, uploadKey, uri: media.thumbnailUrl, status: 'ready', progress: 100 }
                : item,
            ),
          );
        } catch (error) {
          setAttachments(current => current.filter(item => item.uploadKey !== uploadKey));
          setMediaError(error.message || 'A photo could not be uploaded.');
        } finally {
          unsubscribe();
        }
      }
    } catch {
      setMediaError('Could not open the photo library.');
    }
  };
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{review ? 'Edit Review' : 'Write a Review'}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.product}>{productName}</Text>
        <Text style={styles.label}>Your rating</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map(value => (
            <TouchableOpacity
              key={value}
              accessibilityLabel={`${value} stars`}
              onPress={() => setRating(value)}
            >
              <Icon
                name="star"
                size={32}
                color={value <= rating ? COLORS.ratingGreen : COLORS.border}
              />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Review title (optional)</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          style={styles.input}
          placeholder="Summarize your experience"
          placeholderTextColor={COLORS.textTertiary}
        />
        <Text style={styles.label}>Your review</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          maxLength={2000}
          multiline
          style={[styles.input, styles.area]}
          placeholder="Share at least 10 characters"
          placeholderTextColor={COLORS.textTertiary}
        />
        <Text style={styles.counter}>{body.length}/2000</Text>
        <View style={styles.mediaHeader}>
          <Text style={styles.label}>Photos (optional)</Text>
          {attachments.length < 5 ? (
            <TouchableOpacity disabled={isUploading} onPress={pickMedia}>
              <Text style={styles.addPhoto}>Add photos</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.mediaRow}>
          {attachments.map((item, index) => (
            <View key={item.uploadKey || item.id} style={styles.mediaItem}>
              <Image source={{ uri: item.uri || item.thumbnailUrl }} style={styles.mediaImage} />
              {item.status === 'uploading' ? (
                <Text style={styles.progress}>{item.progress}%</Text>
              ) : (
                <TouchableOpacity
                  style={styles.remove}
                  onPress={() =>
                    setAttachments(current => current.filter((_, position) => position !== index))
                  }
                >
                  <Icon name="x" size={12} color={COLORS.white} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
        {mediaError ? <Text style={styles.error}>{mediaError}</Text> : null}
        <Text style={styles.note}>Your review will be checked before it is published.</Text>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
        <TouchableOpacity
          disabled={!valid || busy}
          onPress={submit}
          style={[styles.button, (!valid || busy) && styles.disabled]}
        >
          <Text style={styles.buttonText}>
            {busy ? 'Saving...' : review ? 'Update Review' : 'Submit Review'}
          </Text>
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
  content: { flex: 1, padding: SPACING.l },
  product: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xl },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.s,
    marginTop: SPACING.m,
  },
  stars: { flexDirection: 'row', gap: SPACING.s, marginBottom: SPACING.m },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  area: { minHeight: 130, textAlignVertical: 'top' },
  counter: { fontSize: 11, color: COLORS.textTertiary, textAlign: 'right', marginTop: 4 },
  note: { fontSize: 12, color: COLORS.textSecondary, marginTop: SPACING.l },
  mediaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addPhoto: { color: COLORS.primary, fontSize: 13, fontWeight: '700', marginTop: SPACING.m },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s },
  mediaItem: { position: 'relative' },
  mediaImage: { width: 64, height: 64, borderRadius: RADIUS.s, backgroundColor: COLORS.mutedBg },
  remove: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    padding: 3,
  },
  progress: {
    position: 'absolute',
    bottom: 3,
    alignSelf: 'center',
    color: COLORS.white,
    backgroundColor: COLORS.badgeDark,
    fontSize: 10,
    paddingHorizontal: 3,
  },
  error: { color: COLORS.error, fontSize: 12, marginTop: SPACING.s },
  footer: {
    padding: SPACING.l,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    alignItems: 'center',
  },
  disabled: { backgroundColor: COLORS.border },
  buttonText: { color: COLORS.white, fontWeight: '700' },
});
export default WriteReviewScreen;
