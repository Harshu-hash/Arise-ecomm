import React from 'react';
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import {
  useDeleteReviewMutation,
  useGetMyReviewsQuery,
  useGetProductReviewsQuery,
} from '../api/reviews.api';

const Stars = ({ count }) => (
  <View style={styles.stars}>
    {[1, 2, 3, 4, 5].map(value => (
      <Icon
        key={value}
        name="star"
        size={14}
        color={value <= count ? COLORS.ratingGreen : COLORS.border}
      />
    ))}
  </View>
);
const ReviewsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const productId = route?.params?.productId;
  const productName = route?.params?.productName;
  const mine = useGetMyReviewsQuery({ limit: 20 }, { skip: !!productId });
  const product = useGetProductReviewsQuery({ productId, limit: 20 }, { skip: !productId });
  const query = productId ? product : mine;
  const reviews = query.data?.items || [];
  const [deleteReview, { isLoading: isDeleting }] = useDeleteReviewMutation();
  const confirmDelete = review =>
    Alert.alert('Delete review?', 'This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteReview(review) },
    ]);
  if (query.isLoading) return <FullScreenLoader message="Loading reviews..." />;
  if (query.error)
    return (
      <ErrorState
        title="Could not load reviews"
        message={query.error.message}
        onRetry={query.refetch}
      />
    );
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{productId ? 'Customer Reviews' : 'My Reviews'}</Text>
          {productName ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {productName}
            </Text>
          ) : null}
        </View>
      </View>
      {productId && query.data?.summary ? (
        <View style={styles.summary}>
          <Text style={styles.average}>{query.data.summary.average.toFixed(1)} ★</Text>
          <Text style={styles.summaryText}>
            {query.data.summary.count} verified customer reviews
          </Text>
        </View>
      ) : null}
      <FlatList
        data={reviews}
        keyExtractor={item => item.id}
        contentContainerStyle={reviews.length ? styles.list : styles.emptyList}
        refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={query.refetch} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="message-square" size={34} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptyText}>
              {productId
                ? 'Be the first verified buyer to review this product.'
                : 'Reviews you submit will appear here.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.top}>
              <Image source={{ uri: item.image }} style={styles.image} />
              <View style={styles.grow}>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.product}
                </Text>
                <Stars count={item.rating} />
              </View>
            </View>
            {item.title ? <Text style={styles.title}>{item.title}</Text> : null}
            <Text style={styles.body}>{item.text}</Text>
            <View style={styles.meta}>
              <Text style={styles.metaText}>
                {item.authorDisplayName}
                {item.verifiedPurchase ? ' · Verified purchase' : ''}
              </Text>
              <Text style={styles.metaText}>{item.date}</Text>
            </View>
            {item.moderationStatus !== 'PUBLISHED' ? (
              <View style={styles.status}>
                <Text style={styles.statusText}>
                  {item.moderationStatus === 'REJECTED'
                    ? `Rejected: ${item.rejectionReason}`
                    : 'Pending moderation'}
                </Text>
              </View>
            ) : null}
            {!productId && (item.canEdit || item.canDelete) ? (
              <View style={styles.actions}>
                {item.canEdit ? (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('WriteReview', { review: item })}
                  >
                    <Text style={styles.edit}>Edit</Text>
                  </TouchableOpacity>
                ) : null}
                {item.canDelete ? (
                  <TouchableOpacity disabled={isDeleting} onPress={() => confirmDelete(item)}>
                    <Text style={styles.delete}>Delete</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      />
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
  headerTitle: { fontSize: 20, fontWeight: '600', color: COLORS.textPrimary },
  subtitle: { fontSize: 11, color: COLORS.textTertiary, maxWidth: 280 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
    padding: SPACING.l,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  average: { fontSize: 24, fontWeight: '700', color: COLORS.ratingGreen },
  summaryText: { fontSize: 13, color: COLORS.textSecondary },
  list: { padding: SPACING.l, paddingBottom: SPACING.xxxl },
  emptyList: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.m },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.s,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.m,
  },
  top: { flexDirection: 'row', gap: SPACING.m },
  image: { width: 46, height: 46, borderRadius: RADIUS.s },
  grow: { flex: 1 },
  productName: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  stars: { flexDirection: 'row', gap: 2, marginTop: 4 },
  title: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.m },
  body: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginTop: SPACING.s },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.m,
    gap: SPACING.s,
  },
  metaText: { fontSize: 10.5, color: COLORS.textTertiary },
  status: {
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.s,
    borderRadius: RADIUS.s,
    marginTop: SPACING.m,
  },
  statusText: { fontSize: 11, color: COLORS.textSecondary },
  actions: {
    flexDirection: 'row',
    gap: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.m,
    marginTop: SPACING.m,
  },
  edit: { fontWeight: '700', color: COLORS.primary },
  delete: { fontWeight: '700', color: COLORS.error },
});
export default ReviewsScreen;
