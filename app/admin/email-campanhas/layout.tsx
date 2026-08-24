import PendingEmailCampaignPortal from './PendingEmailCampaignPortal'

const pendingEmailFetchPatch = `
(function () {
  if (window.__dccPendingEmailCampaignPatched) return;
  window.__dccPendingEmailCampaignPatched = true;
  window.__dccPendingEmailCampaignIds = window.__dccPendingEmailCampaignIds || new Set();

  var originalFetch = window.fetch.bind(window);
  var storageKey = 'dccPendingEmailTarget';

  function isMainCampaignUrl(rawUrl) {
    try {
      var url = new URL(rawUrl, window.location.origin);
      return url.pathname === '/api/admin/email-campaigns';
    } catch (_) {
      return false;
    }
  }

  function parseBody(init) {
    if (!init || typeof init.body !== 'string') return null;
    try { return JSON.parse(init.body); } catch (_) { return null; }
  }

  async function rememberPendingCampaigns(response) {
    try {
      var data = await response.clone().json();
      var campaigns = Array.isArray(data && data.campaigns) ? data.campaigns : [];
      campaigns.forEach(function (campaign) {
        if (String(campaign && campaign.created_by || '').indexOf('pending-email|') === 0) {
          window.__dccPendingEmailCampaignIds.add(String(campaign.id));
        }
      });
    } catch (_) {}
    return response;
  }

  async function continuePendingCampaign(id) {
    try {
      var response = await originalFetch('/api/admin/email-campaigns/pending', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, action: 'continue' })
      });
      var data = await response.clone().json().catch(function () { return {}; });
      var remaining = Number(data && data.result && data.result.remaining || 0);
      window.dispatchEvent(new CustomEvent('dcc-pending-email-progress', { detail: { id: id, remaining: remaining } }));
      if (response.ok && remaining > 0) {
        window.setTimeout(function () { continuePendingCampaign(id); }, 5000);
      }
    } catch (error) {
      console.warn('[PENDING EMAIL CAMPAIGN] Continuação automática interrompida:', error);
    }
  }

  window.fetch = async function (input, init) {
    var rawUrl = typeof input === 'string' ? input : input && input.url;
    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();

    if (rawUrl && isMainCampaignUrl(rawUrl)) {
      if (method === 'GET') {
        return rememberPendingCampaigns(await originalFetch(input, init));
      }

      var body = parseBody(init);

      if (method === 'POST') {
        var targetRaw = window.localStorage.getItem(storageKey);
        if (targetRaw) {
          try {
            var target = JSON.parse(targetRaw);
            if (target && target.from && target.to) {
              var nextBody = Object.assign({}, body || {}, {
                targetFrom: target.from,
                targetTo: target.to,
                status: 'draft',
                scheduledAt: null,
                recurringEnabled: false,
                recurringDay: null
              });
              var response = await originalFetch('/api/admin/email-campaigns/pending', Object.assign({}, init || {}, {
                method: 'POST',
                headers: Object.assign({ 'Content-Type': 'application/json' }, init && init.headers || {}),
                body: JSON.stringify(nextBody)
              }));
              if (response.ok) window.localStorage.removeItem(storageKey);
              return response;
            }
          } catch (_) {}
        }
      }

      if (method === 'PATCH' && body && body.id && window.__dccPendingEmailCampaignIds.has(String(body.id))) {
        var response = await originalFetch('/api/admin/email-campaigns/pending', Object.assign({}, init || {}, {
          method: 'PATCH',
          headers: Object.assign({ 'Content-Type': 'application/json' }, init && init.headers || {}),
          body: JSON.stringify(body)
        }));

        if (response.ok && body.action === 'send') {
          try {
            var data = await response.clone().json();
            var remaining = Number(data && data.result && data.result.remaining || 0);
            if (remaining > 0) {
              window.setTimeout(function () { continuePendingCampaign(String(body.id)); }, 5000);
            }
          } catch (_) {}
        }

        return response;
      }
    }

    return originalFetch(input, init);
  };
})();
`

declare global {
  interface Window {
    __dccPendingEmailCampaignPatched?: boolean
    __dccPendingEmailCampaignIds?: Set<string>
  }
}

export default function EmailCampaignsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: pendingEmailFetchPatch }} />
      {children}
      <PendingEmailCampaignPortal />
    </>
  )
}
