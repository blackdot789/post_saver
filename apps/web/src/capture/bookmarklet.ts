/** The small window the bookmark opens; /save/ closes it again once the post is saved. */
export const POPUP = { width: 420, height: 560 } as const;

/**
 * The address of the "Save to …" bookmark (CLAUDE.md §6.1): a `javascript:` link that opens
 * /save/ for the page being looked at, in a small window, or in the same tab where the site
 * being saved from doesn't allow new windows.
 */
export function bookmarkletHref(appOrigin: string): string {
  const target = `${appOrigin}/save/?src=bookmarklet&url=`;
  const code =
    `(function(){var u=${JSON.stringify(target)}+encodeURIComponent(location.href);` +
    `var w=window.open(u,'ps_save','width=${POPUP.width},height=${POPUP.height}');if(!w)location.href=u})()`;
  return `javascript:${encodeURIComponent(code)}`;
}
