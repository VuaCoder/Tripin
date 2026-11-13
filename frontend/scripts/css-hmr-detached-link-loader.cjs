/**
 * Temporary compatibility fix for Next 14.2.3's bundled CSS HMR runtime.
 * Upstream: https://github.com/webpack/mini-css-extract-plugin/pull/1016
 * Only configured for the development client. Remove after upgrading Next and
 * verifying that its bundled runtime already guards detached stylesheet links.
 */
module.exports = function guardDetachedStylesheet(source) {
  return source.replace(
    /(\b[A-Za-z_$][\w$]*)\.parentNode\.removeChild\(\1\)/g,
    '$1.parentNode && $1.parentNode.removeChild($1)',
  );
};
