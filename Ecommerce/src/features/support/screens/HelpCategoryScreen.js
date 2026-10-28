import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { HELP_CATEGORIES } from '../constants/helpData';

const HelpCategoryScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const categoryId = route?.params?.categoryId;
  const category = HELP_CATEGORIES.find((c) => c.id === categoryId) || HELP_CATEGORIES[0];

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{category.title}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconBanner}>
          <View style={styles.iconCircle}>
            <Icon name={category.icon} size={22} color={COLORS.primary} />
          </View>
          <Text style={styles.bannerSubtitle}>{category.subtitle}</Text>
        </View>

        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

        {category.articles.map((article) => (
          <TouchableOpacity
            key={article.id}
            activeOpacity={0.7}
            style={styles.row}
            onPress={() => navigation && navigation.navigate('HelpArticle', { articleId: article.id, categoryId: category.id })}>
            <Icon name="help-circle" size={16} color={COLORS.primary} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>{article.question}</Text>
            <Icon name="chevron-right" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.ticketBtn}
          onPress={() => navigation && navigation.navigate('RaiseTicket', {})}>
          <Icon name="file-text" size={15} color={COLORS.primary} />
          <Text style={styles.ticketBtnText}>Didn't find your answer? Raise a Ticket</Text>
        </TouchableOpacity>
      </ScrollView>
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
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  iconBanner: {
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.xl,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.s,
  },
  bannerSubtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.s,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.s,
  },
  rowIcon: {
    marginTop: 1,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13.5,
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  ticketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    marginTop: SPACING.xl,
    gap: SPACING.s,
  },
  ticketBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
});

export default HelpCategoryScreen;
