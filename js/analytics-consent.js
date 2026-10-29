/* GA4 basic consent: do not contact Google Analytics until accepted. */
(function () {
  'use strict';
  var id = 'G-LJW60F22LD', key = 'airwarm-analytics-consent-v1';
  if (window.airwarmAnalyticsReady) return;
  window.airwarmAnalyticsReady = true;
  var loaded = false, choice = null;
  try { var saved = JSON.parse(localStorage.getItem(key));
    if (saved && Date.now() - saved.at < 180 * 86400000 && /^(granted|denied)$/.test(saved.value)) choice = saved.value;
  } catch (e) { /* Storage unavailable: ask again on the next page. */ }
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window['ga-disable-' + id] = choice !== 'granted';
  window.gtag('consent', 'default', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
  function enable() {
    if (loaded) return;
    loaded = true;
    window['ga-disable-' + id] = false;
    window.gtag('consent', 'update', {analytics_storage: 'granted'});
    window.gtag('js', new Date());
    // Exclude URL query strings and referrers, and do not collect form values.
    window.gtag('config', id, {send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, cookie_expires: 15552000, cookie_update: false});
    window.gtag('event', 'page_view', {page_location: location.origin + location.pathname, page_title: document.title, page_referrer: ''});
    var tag = document.createElement('script'); tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.appendChild(tag);
  }
  function removeCookies() {
    document.cookie.split(';').forEach(function (entry) {
      var name = entry.split('=')[0].trim();
      if (!/^_ga(?:_|$)/.test(name)) return;
      var domains = ['', location.hostname, '.' + location.hostname, '.airwarm.co.uk'];
      domains.forEach(function (domain) { document.cookie = name + '=; Max-Age=0; path=/' + (domain ? '; domain=' + domain : '') + '; SameSite=Lax'; });
    });
  }
  var panel, settings, previousFocus;
  function decide(value) {
    choice = value;
    try { localStorage.setItem(key, JSON.stringify({value: value, at: Date.now()})); } catch (e) {}
    if (value === 'granted') enable();
    else {
      window['ga-disable-' + id] = true;
      window.gtag('consent', 'update', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
      removeCookies();
    }
    panel.hidden = true;
    if (previousFocus) previousFocus.focus();
  }
  function ui() {
    panel = document.createElement('section'); panel.className = 'aw-cookie-banner';
    panel.setAttribute('aria-label', 'Analytics cookie choices');
    panel.innerHTML = '<div class="aw-wrap"><h2>Optional analytics cookies</h2><p>May we use Google Analytics to understand visits and improve this website? It stays off unless you accept. Your assessment answers are not sent to Analytics. <a href="/cookies/">Cookie policy</a>.</p><div class="aw-btn-row"><button type="button" class="aw-btn aw-btn--outline" data-choice="denied">Reject analytics</button><button type="button" class="aw-btn aw-btn--outline" data-choice="granted">Accept analytics</button></div></div>';
    panel.querySelectorAll('[data-choice]').forEach(function (button) { button.addEventListener('click', function () { decide(button.getAttribute('data-choice')); }); });
    document.body.appendChild(panel); panel.hidden = choice !== null;
    settings = document.createElement('button'); settings.type = 'button'; settings.className = 'aw-cookie-settings'; settings.textContent = 'Cookie settings';
    settings.addEventListener('click', function () { previousFocus = settings; panel.hidden = false; panel.querySelector('button').focus(); });
    var footer = document.querySelector('.aw-footer__base') || document.body; footer.appendChild(settings);
  }
  if (choice === 'granted') enable(); else removeCookies();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ui); else ui();
}());
