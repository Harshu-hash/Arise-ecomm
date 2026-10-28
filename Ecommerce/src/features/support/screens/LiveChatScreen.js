import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const QUICK_REPLIES = [
  'Track my order',
  'Cancel an order',
  'Return / Refund status',
  'Talk to a human agent',
];

const BOT_RESPONSES = {
  'track my order': 'You can track your order anytime from Account > Orders > Track Order. Would you like me to open that for you?',
  'cancel an order': 'To cancel an order, go to My Orders, select the item and tap Cancel. Refunds (if any) are processed within 5-7 business days.',
  'return / refund status': 'Return and refund status can be checked from My Orders. Refunds typically take 24 hours to 7 days depending on your payment method.',
  'talk to a human agent': 'Connecting you to a support agent... An agent will join this chat shortly. Average wait time is 2 minutes.',
};

let idCounter = 100;
const nextId = () => `m${idCounter++}`;

const LiveChatScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const [messages, setMessages] = useState([
    {
      id: nextId(),
      author: 'bot',
      text: "Hi! I'm FlipBot 👋 How can I help you today?",
    },
  ]);
  const [input, setInput] = useState('');

  const appendMessage = (msg) => {
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const sendMessage = (text) => {
    if (!text.trim()) return;
    appendMessage({ id: nextId(), author: 'user', text: text.trim() });
    setInput('');

    setTimeout(() => {
      const key = text.trim().toLowerCase();
      const reply = BOT_RESPONSES[key] || "Got it! I've noted your query. Our support team will follow up shortly, or you can raise a formal ticket for detailed tracking.";
      appendMessage({ id: nextId(), author: 'bot', text: reply });
    }, 700);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.botAvatar}>
          <Icon name="headphones" size={16} color={COLORS.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>FlipBot Support</Text>
          <Text style={styles.headerSubtitle}>Typically replies instantly</Text>
        </View>
        <TouchableOpacity onPress={() => navigation && navigation.navigate('RaiseTicket', {})}>
          <Icon name="file-text" size={19} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContent}
        renderItem={({ item }) => (
          <View style={[styles.messageRow, item.author === 'user' && styles.messageRowUser]}>
            {item.author === 'bot' ? (
              <View style={styles.smallAvatar}>
                <Icon name="headphones" size={11} color={COLORS.white} />
              </View>
            ) : null}
            <View style={[styles.bubble, item.author === 'user' ? styles.userBubble : styles.botBubble]}>
              <Text style={[styles.bubbleText, item.author === 'user' && styles.bubbleTextUser]}>
                {item.text}
              </Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          messages.length <= 1 ? (
            <View style={styles.quickReplyWrap}>
              {QUICK_REPLIES.map((reply) => (
                <TouchableOpacity
                  key={reply}
                  activeOpacity={0.8}
                  style={styles.quickReplyChip}
                  onPress={() => sendMessage(reply)}>
                  <Text style={styles.quickReplyText}>{reply}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null
        }
      />

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, SPACING.m) }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type your message..."
          placeholderTextColor={COLORS.textTertiary}
          onSubmitEditing={() => sendMessage(input)}
        />
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!input.trim()}
          onPress={() => sendMessage(input)}
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}>
          <Icon name="send" size={17} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    gap: SPACING.s,
  },
  backBtn: {
    marginRight: SPACING.xs,
  },
  botAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.ratingGreen,
    marginTop: 1,
  },
  messagesContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.l,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: SPACING.m,
    gap: SPACING.s,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  smallAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: RADIUS.m,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  botBubble: {
    backgroundColor: COLORS.mutedBg,
    borderBottomLeftRadius: 2,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 2,
  },
  bubbleText: {
    fontSize: 13.5,
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  bubbleTextUser: {
    color: COLORS.white,
  },
  quickReplyWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.s,
    marginTop: SPACING.s,
    paddingLeft: 30,
  },
  quickReplyChip: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  quickReplyText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: SPACING.s,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    fontSize: 13.5,
    color: COLORS.textPrimary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.border,
  },
});

export default LiveChatScreen;
