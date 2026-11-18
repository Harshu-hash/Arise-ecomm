import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { SENSITIVE_SETTINGS_SECTIONS, SETTINGS_SECTIONS } from '../domain/constants/platformSettings.js';
import { SECTION_SCHEMAS } from '../domain/services/settingsRules.js';
import { PlatformSetting } from '../infrastructure/persistence/platformSetting.model.js';

const SECTIONS_BY_ID = new Map(SETTINGS_SECTIONS.map((section) => [section.id, section]));

// Stored values win over defaults, so a field added to the defaults later still shows up.
function serializeSection(section, row) {
  return {
    id: section.id,
    label: section.label,
    values: { ...section.values, ...row?.values },
    version: row?.version ?? 0,
    updatedAt: row?.updatedAt ?? null,
    updatedByName: row?.updatedByName ?? 'System',
  };
}

export async function listSettings() {
  const rows = await PlatformSetting.find({}).lean();
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return SETTINGS_SECTIONS.map((section) => serializeSection(section, byKey.get(section.id)));
}

export async function updateSettingsSection(sectionId, { values, reason }, actor) {
  const section = SECTIONS_BY_ID.get(sectionId);
  if (!section) throw new NotFoundError('That settings section does not exist.');
  if (SENSITIVE_SETTINGS_SECTIONS.has(sectionId) && !reason) {
    throw new ValidationError('Say why this setting is changing.', { reason: ['Say why this setting is changing.'] });
  }

  const before = serializeSection(section, await PlatformSetting.findOne({ key: sectionId }).lean());
  const parsed = SECTION_SCHEMAS[sectionId].safeParse({ ...before.values, ...values });
  if (!parsed.success) {
    const fieldErrors = {};
    for (const issue of parsed.error.issues) (fieldErrors[issue.path.join('.') || '_request'] ??= []).push(issue.message);
    const [first] = parsed.error.issues;
    throw new ValidationError(`${first.path.join('.') || 'Settings'}: ${first.message}`, fieldErrors);
  }

  const saved = await PlatformSetting.findOneAndUpdate(
    { key: sectionId },
    { $set: { values: parsed.data, updatedBy: actor.userId, updatedByName: actor.name ?? null }, $inc: { version: 1 } },
    { upsert: true, new: true },
  ).lean();

  const result = serializeSection(section, saved);
  await recordAudit({
    action: 'admin.settings.edit',
    subjectType: 'settings',
    subjectId: sectionId,
    before: before.values,
    after: result.values,
    reason: reason ?? null,
    actor,
  });
  return result;
}
