import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Image, StyleSheet, FlatList, Dimensions } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - SPACING.l * 2;
const AUTO_ADVANCE_MS = 3200;

/**
 * White rounded sheet overlapping the hero carousel — drag handle + a smooth,
 * auto-advancing, infinitely-looping ad banner carousel.
 *
 * Infinite loop technique: pad the data with a clone of the last banner at the start
 * and a clone of the first banner at the end, start positioned on the real first item
 * (padded index 1), and whenever a scroll lands on either clone, silently (no
 * animation) snap to the matching real index on the other side — the swap is
 * imperceptible since the clone looks identical to the real slide it stands in for.
 */
const AdSheetCard = ({ banners }) => {
  const realLength = banners?.length || 0;
  const isLoopable = realLength > 1;
  const paddedBanners = isLoopable
    ? [
        { ...banners[realLength - 1], id: `${banners[realLength - 1].id}-clone-start` },
        ...banners,
        { ...banners[0], id: `${banners[0].id}-clone-end` },
      ]
    : banners || [];

  const [displayIndex, setDisplayIndex] = useState(0);
  const listRef = useRef(null);
  const paddedIndexRef = useRef(isLoopable ? 1 : 0);

  /**
   * Scrolls to `index` and updates our own position tracking immediately, rather than
   * waiting for onMomentumScrollEnd to report it back. scrollToIndex()-driven scrolls
   * (as opposed to a user's finger) don't reliably fire that callback on every RN
   * version/platform — relying on it left the auto-advance timer reading a stale
   * position after the very first tick, so every tick after that re-targeted the same
   * index it was already sitting on and nothing visibly moved.
   */
  const goToPaddedIndex = (index, animated) => {
    paddedIndexRef.current = index;
    listRef.current?.scrollToIndex({ index, animated });

    if (isLoopable) {
      if (index === 0) {
        setDisplayIndex(realLength - 1);
      } else if (index === paddedBanners.length - 1) {
        setDisplayIndex(0);
      } else {
        setDisplayIndex(index - 1);
      }

      // Landed on a clone — once the scroll settles, silently (no animation) snap to
      // the real slide it stands in for, so the loop can keep advancing forever.
      if (index === 0 || index === paddedBanners.length - 1) {
        const realTarget = index === 0 ? realLength : 1;
        setTimeout(() => {
          paddedIndexRef.current = realTarget;
          listRef.current?.scrollToIndex({ index: realTarget, animated: false });
        }, animated ? 380 : 0);
      }
    } else {
      setDisplayIndex(index);
    }
  };

  useEffect(() => {
    if (!isLoopable) return undefined;

    const interval = setInterval(() => {
      goToPaddedIndex(paddedIndexRef.current + 1, true);
    }, AUTO_ADVANCE_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoopable, realLength]);

  const handleMomentumScrollEnd = (e) => {
    const paddedIndex = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    goToPaddedIndex(paddedIndex, false);
  };

  if (!banners || banners.length === 0) return null;

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.card}>
        <FlatList
          ref={listRef}
          data={paddedBanners}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          initialScrollIndex={isLoopable ? 1 : 0}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          getItemLayout={(data, index) => ({ length: CARD_WIDTH, offset: CARD_WIDTH * index, index })}
          renderItem={({ item }) => (
            <Image
              source={typeof item.image === 'string' ? { uri: item.image } : item.image}
              style={styles.image}
              resizeMode="cover"
            />
          )}
        />
        <View style={styles.adTag}>
          <Text style={styles.adTagText}>AD</Text>
        </View>
      </View>
      {banners.length > 1 ? (
        <View style={styles.dotsRow}>
          {banners.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === displayIndex && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    marginTop: -20,
    paddingTop: SPACING.s,
    paddingBottom: SPACING.l,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.m,
  },
  card: {
    width: '100%',
    paddingHorizontal: SPACING.l,
    position: 'relative',
  },
  image: {
    width: CARD_WIDTH,
    height: 140,
    borderRadius: RADIUS.m,
    backgroundColor: COLORS.mutedBg,
  },
  adTag: {
    position: 'absolute',
    right: SPACING.l + 8,
    top: SPACING.s + 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  adTagText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '700',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.s,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#B7C5E8',
    marginHorizontal: 3,
  },
  dotActive: {
    width: 14,
    backgroundColor: '#0F1F4B',
  },
});

export default AdSheetCard;
