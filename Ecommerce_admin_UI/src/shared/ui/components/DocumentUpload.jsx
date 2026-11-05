import MediaWorkflowUpload from './MediaWorkflowUpload';

export default function DocumentUpload({ value, onChange, maxCount = 5, label = 'Document', ...props }) {
  return (
    <MediaWorkflowUpload
      {...props}
      value={value}
      onChange={onChange}
      maxCount={maxCount}
      label={label}
      kind={props.kind ?? 'DOCUMENT'}
      imageOnly={false}
      accept={props.accept ?? ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']}
      maxSizeBytes={props.maxSizeBytes ?? 20 * 1024 * 1024}
    />
  );
}
