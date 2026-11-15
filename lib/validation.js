export const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(value);
export const validId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function paymentsReady() {
  return process.env.RAFFLE_LIVE_ENABLED === 'true' && process.env.PAYMENT_DETAILS_CONFIRMED === 'true' && validEmail(process.env.INTERAC_EMAIL);
}
