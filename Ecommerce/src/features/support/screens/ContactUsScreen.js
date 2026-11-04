import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useGetSupportChannelsQuery } from '@features/support';

const channelIcons = { PHONE: 'phone', EMAIL: 'mail', CHAT: 'message-circle', URL: 'external-link' };

const ContactUsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { data, error, isLoading, refetch } = useGetSupportChannelsQuery();

  if (isLoading) return <FullScreenLoader message="Loading support options..." />;
  if (error || !data) return <ErrorState message={error?.message} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Us</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hoursCard}>
          <Icon name="clock" size={18} color={COLORS.primary} />
          <Text style={styles.hoursText}>{data.availabilityLabel}</Text>
        </View>

        {data.channels.filter(channel => channel.enabled).map(channel => (
          <TouchableOpacity
            key={channel.id}
            activeOpacity={0.8}
            style={styles.optionRow}
            onPress={() => Linking.openURL(channel.href)}>
            <View style={styles.optionIconBox}>
              <Icon name={channelIcons[channel.type]} size={19} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>{channel.label}</Text>
              <Text style={styles.optionSubtitle}>{channel.description}</Text>
            </View>
            <Icon name="chevron-right" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.optionRow}
          onPress={() => navigation && navigation.navigate('RaiseTicket', {})}
        >
          <View style={styles.optionIconBox}>
            <Icon name="file-text" size={19} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Raise a Ticket</Text>
            <Text style={styles.optionSubtitle}>For detailed issues that need investigation</Text>
          </View>
          <Icon name="chevron-right" size={16} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.optionRow}
          onPress={() => navigation && navigation.navigate('MyTickets')}
        >
          <View style={styles.optionIconBox}>
            <Icon name="clipboard" size={19} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>My Support Tickets</Text>
            <Text style={styles.optionSubtitle}>Track existing complaints and requests</Text>
          </View>
          <Icon name="chevron-right" size={16} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.optionRow}
          onPress={() => navigation && navigation.navigate('HelpCenter')}
        >
          <View style={styles.optionIconBox}>
            <Icon name="help-circle" size={19} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Browse Help Center</Text>
            <Text style={styles.optionSubtitle}>Find answers to common questions</Text>
          </View>
          <Icon name="chevron-right" size={16} color={COLORS.textTertiary} />
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
    fontSize: 19,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  hoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    gap: SPACING.s,
    marginBottom: SPACING.xl,
  },
  hoursText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.m,
  },
  optionIconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
  },
});

export default ContactUsScreen;
