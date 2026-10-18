/** Only use checkout URLs returned by a successful API response. */
export function openCheckout(checkoutUrl: string) {
  let url: URL;
  try {
    url = new URL(checkoutUrl);
  } catch {
    throw new Error('Liên kết thanh toán không hợp lệ. Vui lòng thử lại.');
  }
  if (url.protocol !== 'https:')
    throw new Error('Liên kết thanh toán không hợp lệ. Vui lòng thử lại.');
  window.location.assign(url.href);
}
