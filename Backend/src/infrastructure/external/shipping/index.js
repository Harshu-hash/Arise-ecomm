// Single switch point for the ShippingGateway port; modules import this, never a provider file.
export { shiprocketGateway as shippingGateway } from './shiprocket.gateway.js';
