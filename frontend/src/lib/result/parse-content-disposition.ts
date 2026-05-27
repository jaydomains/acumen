/**
 * parse-content-disposition — extract the `filename` parameter from a
 * `Content-Disposition` response header. Used by PdfExportButton's
 * Blob URL pattern (FE-6 §B.7) to honour the backend-supplied filename
 * before falling back to a client-side default.
 *
 * Handles the two common encodings: `filename="foo.pdf"` (quoted) and
 * `filename=foo.pdf` (token). RFC 5987 `filename*=UTF-8''...` is
 * decoded best-effort — `decodeURIComponent` covers the realistic
 * server-set values; an exotic encoding returns the raw value rather
 * than crashing.
 */

export function parseContentDisposition(
  header: string | null | undefined,
): string | null {
  if (!header) return null;
  // Prefer the RFC 5987 encoded form when both are present (per RFC the
  // encoded form is preferred by clients that understand it).
  const encoded = /filename\*\s*=\s*([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    const raw = encoded[1].trim();
    // Format: charset'language'encoded-value
    const m = /^([^']*)'([^']*)'(.+)$/.exec(raw);
    if (m?.[3]) {
      try {
        return decodeURIComponent(m[3]);
      } catch {
        return m[3];
      }
    }
    return raw;
  }
  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1];
  const token = /filename\s*=\s*([^;]+)/i.exec(header);
  if (token?.[1]) return token[1].trim();
  return null;
}
