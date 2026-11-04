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
import { useUploadProfileImageMutation } from '@features/media';
import { useGetProfileQuery, useUpdateProfileMutation } from '../api/profile.api';

const GENDERS = [
  ['MALE', 'Male'],
  ['FEMALE', 'Female'],
  ['OTHER', 'Other'],
  ['PREFER_NOT_TO_SAY', 'Prefer not to say'],
];
const EditProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets(),
    toast = useToast();
  const query = useGetProfileQuery();
  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation();
  const [uploadImage, { isLoading: isUploading }] = useUploadProfileImageMutation();
  const [name, setName] = useState(''),
    [gender, setGender] = useState('PREFER_NOT_TO_SAY'),
    [newEmail, setNewEmail] = useState(''),
    [newPhone, setNewPhone] = useState(''),
    [avatar, setAvatar] = useState(null),
    [errors, setErrors] = useState({});
  useEffect(() => {
    if (query.data) {
      setName(query.data.name);
      setGender(query.data.gender);
      setAvatar(query.data.avatarUrl);
    }
  }, [query.data]);
  const pickAvatar = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.8,
        includeBase64: false,
      });
      if (result.didCancel) return;
      if (result.errorCode) {
        toast.show(
          result.errorCode === 'permission'
            ? 'Photo access was denied. Allow access in device settings.'
            : result.errorMessage || 'Could not select a photo.',
          { variant: 'error' },
        );
        return;
      }
      const asset = result.assets?.[0];
      if (!asset?.uri || !asset.type || !asset.fileName || !asset.fileSize) return;
      const media = await uploadImage({ uploadKey: `avatar-${Date.now()}`, asset }).unwrap();
      setAvatar(media.url);
      setErrors(current => ({ ...current, avatar: null }));
      await updateProfile({ avatarMediaId: media.id }).unwrap();
      toast.show('Profile photo updated', { variant: 'success', icon: 'check' });
    } catch (error) {
      toast.show(error.message || 'Could not update your photo', { variant: 'error' });
    }
  };
  const save = async () => {
    setErrors({});
    try {
      const profile = await updateProfile({
        name,
        gender,
        newEmail: newEmail.trim() || undefined,
        newPhone: newPhone.trim() || undefined,
      }).unwrap();
      if (profile.pendingVerification)
        toast.show(`Verification sent to ${profile.pendingVerification.destinationMasked}`, {
          variant: 'success',
          icon: 'mail',
        });
      else toast.show('Profile updated', { variant: 'success', icon: 'check' });
      setNewEmail('');
      setNewPhone('');
    } catch (error) {
      setErrors(error.fieldErrors || {});
      toast.show(error.message || 'Could not update profile', { variant: 'error' });
    }
  };
  if (query.isLoading) return <FullScreenLoader message="Loading profile..." />;
  if (query.error || !query.data)
    return (
      <ErrorState
        title="Could not load profile"
        message={query.error?.message}
        onRetry={query.refetch}
      />
    );
  const profile = query.data;
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarSection}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Icon name="user" size={32} color={COLORS.primary} />
            </View>
          )}
          <TouchableOpacity disabled={isUploading} onPress={pickAvatar}>
            <Text style={styles.editPhoto}>{isUploading ? 'Uploading...' : 'Change Photo'}</Text>
          </TouchableOpacity>
        </View>
        <Field label="Full Name" value={name} onChangeText={setName} error={errors.name} />
        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow}>
          {GENDERS.map(([value, label]) => (
            <TouchableOpacity
              key={value}
              onPress={() => setGender(value)}
              style={[styles.chip, gender === value && styles.chipActive]}
            >
              <Text style={[styles.chipText, gender === value && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.contact}>
          <Text style={styles.contactTitle}>Verified contact details</Text>
          <Text style={styles.contactText}>
            Email: {profile.emailMasked || 'Not added'} {profile.emailVerified ? '✓' : ''}
          </Text>
          <Text style={styles.contactText}>
            Phone: {profile.phoneMasked || 'Not added'} {profile.phoneVerified ? '✓' : ''}
          </Text>
          <Text style={styles.contactHint}>
            Sensitive values remain masked. Changing one sends a verification challenge; the current
            contact stays active until verification succeeds.
          </Text>
        </View>
        <Field
          label="New email (optional)"
          value={newEmail}
          onChangeText={setNewEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="name@example.com"
          error={errors.newEmail}
        />
        <Field
          label="New phone (optional)"
          value={newPhone}
          onChangeText={setNewPhone}
          keyboardType="phone-pad"
          placeholder="+919876543210"
          error={errors.newPhone}
        />
        {profile.pendingVerification ? (
          <View style={styles.pending}>
            <Icon name="clock" size={15} color={COLORS.warning} />
            <Text style={styles.pendingText}>
              Verification pending for {profile.pendingVerification.destinationMasked}
            </Text>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
        <TouchableOpacity
          disabled={isSaving || name.trim().length < 2}
          onPress={save}
          style={[styles.save, (isSaving || name.trim().length < 2) && styles.disabled]}
        >
          <Text style={styles.saveText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
const Field = ({ label, error, ...props }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      {...props}
      style={[styles.input, error && styles.inputError]}
      placeholderTextColor={COLORS.textTertiary}
    />
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>
);
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
  content: { padding: SPACING.l, paddingBottom: SPACING.xxxl },
  avatarSection: { alignItems: 'center', marginBottom: SPACING.xl },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPhoto: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: SPACING.s },
  field: { marginBottom: SPACING.l },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.s,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  inputError: { borderColor: COLORS.error },
  error: { fontSize: 11, color: COLORS.error, marginTop: 4 },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s, marginBottom: SPACING.l },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  chipText: { fontSize: 12, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary, fontWeight: '700' },
  contact: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.s,
  },
  contactText: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  contactHint: { fontSize: 11, color: COLORS.textTertiary, lineHeight: 16, marginTop: SPACING.m },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    backgroundColor: COLORS.etaGoldLight,
    padding: SPACING.m,
    borderRadius: RADIUS.s,
  },
  pendingText: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  footer: {
    padding: SPACING.l,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  save: {
    backgroundColor: COLORS.primary,
    padding: SPACING.m,
    borderRadius: RADIUS.s,
    alignItems: 'center',
  },
  disabled: { backgroundColor: COLORS.border },
  saveText: { color: COLORS.white, fontWeight: '700' },
});
export default EditProfileScreen;
