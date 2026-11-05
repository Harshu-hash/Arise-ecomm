import MediaWorkflowUpload from '../MediaWorkflowUpload';

/** Backwards-compatible product image entry point backed by durable media IDs. */
export default function ImageUpload(props) {
  return <MediaWorkflowUpload {...props} imageOnly kind={props.kind ?? 'PRODUCT_IMAGE'} />;
}
