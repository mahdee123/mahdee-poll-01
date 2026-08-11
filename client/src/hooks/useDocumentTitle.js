import { useEffect } from 'react';

/**
 * Sets the browser tab title, scoped to the product name.
 * Pass the screen name only, e.g. useDocumentTitle('Bills') -> "Bills · Raya Pool".
 */
export default function useDocumentTitle(pageTitle) {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · Raya Pool` : 'Raya Pool';
  }, [pageTitle]);
}
