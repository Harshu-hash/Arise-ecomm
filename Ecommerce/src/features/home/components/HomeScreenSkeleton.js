import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Skeleton from '@shared/skeletons/Skeleton';
import { COLORS } from '@constants/colors';
import { RADIUS, SPACING } from '@constants/spacing';

const HomeScreenSkeleton = () => (
  <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <Skeleton height={52} borderRadius={RADIUS.m} />
    <Skeleton height={190} borderRadius={0} style={styles.hero} />
    <Skeleton height={140} borderRadius={RADIUS.m} style={styles.section} />
    <View style={styles.row}>
      <Skeleton height={120} style={styles.card} />
      <Skeleton height={120} style={styles.card} />
      <Skeleton height={120} style={styles.card} />
    </View>
    <Skeleton height={180} borderRadius={RADIUS.m} style={styles.section} />
    <View style={styles.row}>
      <Skeleton height={260} style={styles.product} />
      <Skeleton height={260} style={styles.product} />
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.l, paddingBottom: SPACING.xxl },
  hero: { marginHorizontal: -SPACING.l, marginTop: SPACING.l },
  section: { marginTop: SPACING.l },
  row: { flexDirection: 'row', gap: SPACING.s, marginTop: SPACING.l },
  card: { flex: 1 },
  product: { flex: 1 },
});

export default HomeScreenSkeleton;
