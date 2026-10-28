import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS } from '../../constants/spacing';

/** Generic icon + primary/secondary text row used inside ExpandableCard (address, delivery date). */
const DeliveryDetailRow = ({ icon, primaryText, secondaryText, thumbnail, onPress, showChevron, isLast }) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper activeOpacity={0.7} onPress={onPress} style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={styles.iconBox}>
        <Icon name={icon} size={15} color={COLORS.textPrimary} />
      </View>
      <View style={styles.textBox}>
        <Text style={styles.primary} numberOfLines={2}>{primaryText}</Text>
        {secondaryText ? <Text style={styles.secondary}>{secondaryText}</Text> : null}
      </View>
      {thumbnail ? (
        <Image source={typeof thumbnail === 'string' ? { uri: thumbnail } : thumbnail} style={styles.thumb} />
      ) : null}
      {showChevron ? <Icon name="chevron-right" size={16} color={COLORS.textTertiary} /> : null}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.m,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.mutedBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.s,
  },
  textBox: {
    flex: 1,
  },
  primary: {
    fontSize: 13.5,
    color: COLORS.textPrimary,
  },
  secondary: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: SPACING.s,
  },
});

export default DeliveryDetailRow;
