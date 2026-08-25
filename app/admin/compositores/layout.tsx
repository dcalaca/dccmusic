import CountryFilterPortal from './CountryFilterPortal'
import AdminComposerPhotoPortal from './AdminComposerPhotoPortal'

const countryFetchPatch = `
(function () {
  if (window.__dccAdminCountryFetchPatched) return;
  window.__dccAdminCountryFetchPatched = true;

  var originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    try {
      var country = new URLSearchParams(window.location.search).get('country');
      if (!country) return originalFetch(input, init);

      var rawUrl = typeof input === 'string' ? input : input && input.url;
      if (!rawUrl || rawUrl.indexOf('/api/admin/composers/list') === -1) {
        return originalFetch(input, init);
      }

      var nextUrl = new URL(rawUrl, window.location.origin);
      nextUrl.searchParams.set('country', country.toUpperCase());

      if (typeof input === 'string') {
        return originalFetch(nextUrl.toString(), init);
      }

      if (input instanceof Request) {
        return originalFetch(new Request(nextUrl.toString(), input), init);
      }
    } catch (error) {
      console.warn('[ADMIN COMPOSERS] Não foi possível aplicar o filtro de país:', error);
    }

    return originalFetch(input, init);
  };
})();
`

declare global {
  interface Window {
    __dccAdminCountryFetchPatched?: boolean
  }
}

export default function AdminComposersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: countryFetchPatch }} />
      {children}
      <CountryFilterPortal />
      <AdminComposerPhotoPortal />
    </>
  )
}
