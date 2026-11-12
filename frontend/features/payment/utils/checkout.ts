/** Only use checkout URLs returned by a successful API response. */
export function openCheckout(checkoutUrl: string) {
  let url: URL;
  try {
    url = new URL(checkoutUrl);
  } catch {
    throw new Error('Liên kết thanh toán không hợp lệ. Vui lòng thử lại.');
  }
  const isLocalDev =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const isAllowedHttp = isLocalDev && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');

  if (url.protocol !== 'https:' && !isAllowedHttp)
    throw new Error('Liên kết thanh toán không hợp lệ. Vui lòng thử lại.');
  window.location.assign(url.href);
}
