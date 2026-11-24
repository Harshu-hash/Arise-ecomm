import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { launchImageLibrary } from 'react-native-image-picker';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import {
  useGetChatByIdQuery,
  useGetChatQuery,
  useGetSupportChannelsQuery,
  useMarkChatReadMutation,
  useSendChatMessageMutation,
} from '../api/support.api';
import { useUploadSupportAttachmentMutation } from '@features/media';
import { emitCustomerTyping, onSupportTyping } from '@core/realtime/orderUpdates';
import { useToast } from '../../../contexts/ToastContext';

const MAX_PHOTOS = 3;
const TYPING_SHOW_MS = 4000;
const TYPING_SEND_MS = 2000;

// Live chat with the support team. New messages arrive through the socket hint (core/realtime/orderUpdates), which refetches the chat.
// With a chatId it is a read-only transcript of a past chat.
const ChatScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets(),
    toast = useToast(),
    listRef = useRef(null),
    lastTypingSent = useRef(0),
    typingTimer = useRef(null),
    { orderId, chatId } = route?.params || {},
    current = useGetChatQuery(undefined, { skip: Boolean(chatId) }),
    past = useGetChatByIdQuery(chatId, { skip: !chatId }),
    chat = chatId ? past : current,
    channels = useGetSupportChannelsQuery(),
    [markRead] = useMarkChatReadMutation(),
    [send, { isLoading: sending }] = useSendChatMessageMutation(),
    [uploadPhoto] = useUploadSupportAttachmentMutation(),
    [body, setBody] = useState(''),
    [photos, setPhotos] = useState([]), // { key, uri, status: 'uploading' | 'done' | 'failed', id }
    [agentTyping, setAgentTyping] = useState(false);

  // opening the chat (or a new reply landing while it is open) clears the unread badge
  const unread = chatId ? 0 : current.data?.unreadCount || 0;
  useEffect(() => {
    if (unread > 0) markRead();
  }, [unread, markRead]);

  useEffect(
    () =>
      onSupportTyping(() => {
        setAgentTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setAgentTyping(false), TYPING_SHOW_MS);
      }),
    [],
  );
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const messageCount = chat.data?.messages.length || 0;
  useEffect(() => {
    if (messageCount) setAgentTyping(false); // a message arriving replaces the "typing" line
  }, [messageCount]);

  if (chat.isLoading) return <FullScreenLoader message="Opening chat..." />;
  if (chat.error)
    return <ErrorState title="Chat unavailable" message={chat.error.message} onRetry={chat.refetch} />;

  const messages = chat.data?.messages || [],
    readOnly = Boolean(chatId),
    uploading = photos.some(photo => photo.status === 'uploading'),
    ready = photos.filter(photo => photo.status === 'done'),
    canSend = (body.trim() || ready.length) && !uploading && !sending,
    onType = text => {
      setBody(text);
      const now = Date.now();
      if (text && now - lastTypingSent.current > TYPING_SEND_MS) {
        lastTypingSent.current = now;
        emitCustomerTyping();
      }
    },
    patchPhoto = (key, patch) =>
      setPhotos(list => list.map(photo => (photo.key === key ? { ...photo, ...patch } : photo))),
    upload = async photo => {
      patchPhoto(photo.key, { status: 'uploading' });
      try {
        const media = await uploadPhoto({ uploadKey: photo.key, asset: photo.asset }).unwrap();
        patchPhoto(photo.key, { status: 'done', id: media.id });
      } catch {
        patchPhoto(photo.key, { status: 'failed' });
        toast.show('Could not upload the photo. Tap it to retry.', { variant: 'error' });
      }
    },
    pickPhotos = async () => {
      const remaining = MAX_PHOTOS - photos.length;
      if (remaining <= 0) return;
      try {
        const result = await launchImageLibrary({
          mediaType: 'photo',
          selectionLimit: remaining,
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.8,
        });
        if (result.didCancel) return;
        if (result.errorCode) {
          toast.show(
            result.errorCode === 'permission'
              ? 'Photo access was denied. Allow access in device settings.'
              : result.errorMessage || 'Could not open the photo library.',
            { variant: 'error' },
          );
          return;
        }
        const added = (result.assets || [])
          .filter(asset => asset.uri && asset.type && asset.fileName && asset.fileSize)
          .map((asset, index) => ({ key: `${Date.now()}-${index}`, uri: asset.uri, asset, status: 'uploading' }));
        setPhotos(list => [...list, ...added].slice(0, MAX_PHOTOS));
        added.forEach(upload);
      } catch {
        toast.show('Could not open the photo library.', { variant: 'error' });
      }
    },
    submit = async () => {
      if (!canSend) return;
      try {
        // orderId only matters for the message that opens a new chat; the server ignores it afterwards
        await send({
          body: body.trim(),
          attachments: ready.map(photo => photo.id),
          ...(orderId && !chat.data ? { orderId } : {}),
        }).unwrap();
        setBody('');
        setPhotos([]);
      } catch (error) {
        toast.show(error.message || 'Could not send message', { variant: 'error' });
      }
    };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.grow}>
          <Text style={styles.headerTitle}>{readOnly ? 'Past chat' : 'Chat with Arise Support'}</Text>
          <Text style={styles.subtitle}>
            {readOnly
              ? new Date(chat.data?.createdAt).toLocaleDateString('en-IN')
              : orderId
                ? `About order ${orderId}`
                : 'We usually reply within minutes'}
          </Text>
        </View>
        {!readOnly && (
          <TouchableOpacity
            onPress={() => navigation.navigate('ChatHistory')}
            accessibilityLabel="Past chats"
            style={styles.headerIcon}
          >
            <Icon name="clock" size={19} color={COLORS.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => navigation.navigate('ContactUs')} accessibilityLabel="Call or email us">
          <Icon name="phone" size={19} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          readOnly ? null : (
            <View style={styles.intro}>
              <Text style={styles.introTitle}>Hi! How can we help?</Text>
              <Text style={styles.introText}>
                {channels.data?.availabilityLabel || 'Send us a message and we will reply here.'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={agentTyping ? <Text style={styles.typing}>Arise Support is typing...</Text> : null}
        renderItem={({ item }) => {
          const mine = item.authorType === 'CUSTOMER';
          return (
            <View style={[styles.messageRow, mine && styles.customerRow]}>
              <View style={[styles.bubble, mine ? styles.customerBubble : styles.agentBubble]}>
                {!mine && <Text style={styles.author}>{item.authorDisplayName}</Text>}
                {item.attachments.map(photo => (
                  <TouchableOpacity key={photo.id} onPress={() => Linking.openURL(photo.url)}>
                    <Image source={{ uri: photo.url }} style={styles.photo} />
                  </TouchableOpacity>
                ))}
                {!!item.body && <Text style={[styles.message, mine && styles.customerText]}>{item.body}</Text>}
                <Text style={[styles.date, mine && styles.customerDate]}>{item.date}</Text>
              </View>
            </View>
          );
        }}
      />
      {readOnly ? (
        <View style={styles.ended}>
          <Text style={styles.endedText}>This chat has ended.</Text>
          <TouchableOpacity onPress={() => navigation.replace('Chat', {})}>
            <Text style={styles.endedLink}>Start a new chat</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.footerWrap, { paddingBottom: Math.max(insets.bottom, SPACING.m) }]}>
          {photos.length > 0 && (
            <View style={styles.thumbs}>
              {photos.map(photo => (
                <View key={photo.key} style={styles.thumbBox}>
                  <TouchableOpacity disabled={photo.status !== 'failed'} onPress={() => upload(photo)}>
                    <Image source={{ uri: photo.uri }} style={[styles.thumb, photo.status !== 'done' && styles.thumbDim]} />
                    {photo.status === 'uploading' && <ActivityIndicator style={styles.thumbOverlay} color={COLORS.white} />}
                    {photo.status === 'failed' && <Icon name="refresh-cw" size={16} color={COLORS.white} style={styles.thumbOverlay} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel="Remove photo"
                    style={styles.thumbRemove}
                    onPress={() => setPhotos(list => list.filter(item => item.key !== photo.key))}
                  >
                    <Icon name="x" size={12} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <View style={styles.footer}>
            <TouchableOpacity
              accessibilityLabel="Attach photo"
              disabled={photos.length >= MAX_PHOTOS}
              onPress={pickPhotos}
              style={styles.attach}
            >
              <Icon name="image" size={20} color={photos.length >= MAX_PHOTOS ? COLORS.border : COLORS.primary} />
            </TouchableOpacity>
            <TextInput
              value={body}
              onChangeText={onType}
              maxLength={2000}
              multiline
              placeholder="Type a message..."
              placeholderTextColor={COLORS.textTertiary}
              style={styles.input}
            />
            <TouchableOpacity
              accessibilityLabel="Send message"
              disabled={!canSend}
              onPress={submit}
              style={[styles.send, !canSend && styles.disabled]}
            >
              <Icon name="send" size={17} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
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
  grow: { flex: 1 },
  headerIcon: { marginRight: SPACING.s },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 11.5, color: COLORS.textSecondary },
  list: { padding: SPACING.l },
  intro: {
    padding: SPACING.m,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.s,
    marginBottom: SPACING.l,
  },
  introTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.textPrimary },
  introText: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 3 },
  typing: { fontSize: 11.5, fontStyle: 'italic', color: COLORS.textSecondary },
  messageRow: { alignItems: 'flex-start', marginBottom: SPACING.m },
  customerRow: { alignItems: 'flex-end' },
  bubble: { maxWidth: '85%', padding: SPACING.m, borderRadius: RADIUS.m },
  agentBubble: { backgroundColor: COLORS.mutedBg },
  customerBubble: { backgroundColor: COLORS.primary },
  author: { fontSize: 10.5, fontWeight: '700', color: COLORS.textSecondary },
  photo: { width: 180, height: 180, borderRadius: RADIUS.s, marginTop: 4, backgroundColor: COLORS.border },
  message: { fontSize: 13.5, color: COLORS.textPrimary, lineHeight: 19, marginTop: 2 },
  date: { fontSize: 9.5, color: COLORS.textTertiary, marginTop: 4 },
  customerText: { color: COLORS.white },
  customerDate: { color: 'rgba(255,255,255,0.7)' },
  footerWrap: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  thumbs: { flexDirection: 'row', gap: SPACING.s, marginBottom: SPACING.s },
  thumbBox: { width: 56, height: 56 },
  thumb: { width: 56, height: 56, borderRadius: RADIUS.s },
  thumbDim: { opacity: 0.5 },
  thumbOverlay: { position: 'absolute', top: 18, left: 18 },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.s },
  attach: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    paddingHorizontal: SPACING.l,
    color: COLORS.textPrimary,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { backgroundColor: COLORS.border },
  ended: { padding: SPACING.l, backgroundColor: COLORS.surface, alignItems: 'center', gap: SPACING.s },
  endedText: { fontSize: 12, color: COLORS.textSecondary },
  endedLink: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});
export default ChatScreen;
