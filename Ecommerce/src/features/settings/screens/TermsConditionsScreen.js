import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { useGetStaticPageQuery } from '../api/staticPage.api';

const TermsConditionsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { data: page, isLoading, isError } = useGetStaticPageQuery('terms');

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={COLORS.textPrimary} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {page?.publishedAt && (
            <Text style={styles.updatedText}>Last updated: {new Date(page.publishedAt).toLocaleDateString()}</Text>
          )}
          <Text style={styles.sectionBody}>
            {isError ? 'Could not load the terms & conditions. Please try again later.' : page?.body || 'This page has not been published yet.'}
          </Text>
        </ScrollView>
      )}
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
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  loader: {
    marginTop: SPACING.xxxl,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  updatedText: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginBottom: SPACING.l,
  },
  sectionBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
});

export default TermsConditionsScreen;
