/**
 * BRIX MiniApp - SuperSDK Bridge
 * ================================
 * Web tarafi ile iOS/Android native SuperSDK kabugu arasindaki
 * WebView bridge entegrasyonu.
 *
 * Protokol:
 *   - iOS:  window.webkit.messageHandlers.miniapp.postMessage(...)
 *   - Android: window.miniapp.postMessage(...)
 *
 * Zorunlu Payload:
 *   { "callFunction": { "functionName": "...", "param": {} } }
 *
 * @version 1.0.0
 */

// ============================================================
// 1. PLATFORM TESPITI & BRIDGE HELPER
// ============================================================

const Platform = {
  get isIOS() {
    return !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.miniapp);
  },
  get isAndroid() {
    return !!(window.miniapp && typeof window.miniapp.postMessage === 'function');
  },
  get isSupported() {
    return this.isIOS || this.isAndroid;
  },
  get name() {
    if (this.isIOS) return 'iOS';
    if (this.isAndroid) return 'Android';
    return 'Bilinmiyor';
  }
};

/**
 * Guvenli postMessage helper (iOS + Android)
 * @param {Object} payload - { callFunction: { functionName, param } }
 * @throws {Error} Bridge bulunamazsa hata firlatir
 */
function postToMiniapp(payload) {
  const message = JSON.stringify(payload);

  if (Platform.isIOS) {
    window.webkit.messageHandlers.miniapp.postMessage(message);
    return;
  }

  if (Platform.isAndroid) {
    window.miniapp.postMessage(message);
    return;
  }

  throw new Error('Miniapp bridge bulunamadi (iOS/Android handler yok).');
}

/**
 * Bridge'e istek gonderir ve debug konsoluna log yazar
 * @param {string} functionName
 * @param {Object} param
 */
function callBridge(functionName, param = {}) {
  const payload = {
    callFunction: {
      functionName: functionName,
      param: param
    }
  };

  debugLog('info', `[GONDER] ${functionName}`, payload);

  try {
    postToMiniapp(payload);
    debugLog('success', `[GONDERILDI] ${functionName}`);
  } catch (error) {
    debugLog('error', `[HATA] ${functionName}: ${error.message}`);
    showError(functionName, error.message);
  }
}

// ============================================================
// 2. CALLBACK DISPATCHER
// ============================================================

/**
 * SuperSDK tarafindan cagrilan global callback fonksiyonu.
 * functionName ve result (JSON string) parametrelerini alir.
 *
 * @param {string} functionName - Case-sensitive fonksiyon adi
 * @param {string} result - JSON string response
 */
function functionCallback(functionName, result) {
  let parsed;

  try {
    parsed = JSON.parse(result);
  } catch (e) {
    console.error('Callback parse hatasi', e, result);
    debugLog('error', `[PARSE HATASI] ${functionName}: ${e.message}`);
    return;
  }

  debugLog('info', `[CEVAP] ${functionName}`, parsed);

  switch (functionName) {
    case 'GetIdentity':
      GetIdentityCallback(parsed);
      break;
    case 'GetPhoneNumber':
      GetPhoneNumberCallback(parsed);
      break;
    case 'GetMailAddress':
      GetMailAddressCallback(parsed);
      break;
    case 'GetCustomerNumber':
      GetCustomerNumberCallback(parsed);
      break;
    case 'GetCommercialCustomerNumber':
      GetCommercialCustomerNumberCallback(parsed);
      break;
    case 'GetLocation':
      GetLocationCallback(parsed);
      break;
    case 'sendPayment':
      sendPaymentCallback(parsed);
      break;
    default:
      console.warn('Unhandled callback', functionName, parsed);
      debugLog('warn', `[ISLENMEMIS] ${functionName}: callback handler bulunamadi`);
  }
}

// ============================================================
// 3. CALLBACK HANDLER'LAR (Get* pattern)
// ============================================================
// Get* fonksiyonlari: isSuccess && retVal.isApproved kontrolu ZORUNLU
// Veri: retVal.funcRetVal altinda gelir
// ============================================================

function GetIdentityCallback(result) {
  try {
    if (result.isSuccess && result.retVal && result.retVal.isApproved) {
      const data = result.retVal.funcRetVal || {};
      const display = document.getElementById('identityDisplay');
      display.innerHTML = `
        <div class="data-row"><span class="data-label">Ad:</span> ${escapeHtml(data.Name || '—')}</div>
        <div class="data-row"><span class="data-label">Soyad:</span> ${escapeHtml(data.Surname || '—')}</div>
        <div class="data-row"><span class="data-label">TCKN:</span> ${escapeHtml(data.TCKN || '—')}</div>
      `;
      debugLog('success', 'GetIdentity basarili');
    } else {
      handleGetError('GetIdentity', result);
    }
  } catch (error) {
    console.error('GetIdentity islenirken hata:', error);
    debugLog('error', `GetIdentity islenirken hata: ${error.message}`);
  }
}

function GetPhoneNumberCallback(result) {
  try {
    if (result.isSuccess && result.retVal && result.retVal.isApproved) {
      const data = result.retVal.funcRetVal || {};
      const display = document.getElementById('phoneDisplay');
      display.innerHTML = `
        <div class="data-row"><span class="data-label">Telefon:</span> ${escapeHtml(data.PhoneNumber || '—')}</div>
      `;
      debugLog('success', 'GetPhoneNumber basarili');
    } else {
      handleGetError('GetPhoneNumber', result);
    }
  } catch (error) {
    console.error('GetPhoneNumber islenirken hata:', error);
    debugLog('error', `GetPhoneNumber islenirken hata: ${error.message}`);
  }
}

function GetMailAddressCallback(result) {
  try {
    if (result.isSuccess && result.retVal && result.retVal.isApproved) {
      const data = result.retVal.funcRetVal || {};
      const display = document.getElementById('mailDisplay');
      display.innerHTML = `
        <div class="data-row"><span class="data-label">E-Posta:</span> ${escapeHtml(data.Email || '—')}</div>
      `;
      debugLog('success', 'GetMailAddress basarili');
    } else {
      handleGetError('GetMailAddress', result);
    }
  } catch (error) {
    console.error('GetMailAddress islenirken hata:', error);
    debugLog('error', `GetMailAddress islenirken hata: ${error.message}`);
  }
}

function GetCustomerNumberCallback(result) {
  try {
    if (result.isSuccess && result.retVal && result.retVal.isApproved) {
      const data = result.retVal.funcRetVal || {};
      const display = document.getElementById('customerNumberDisplay');
      display.innerHTML = `
        <div class="data-row"><span class="data-label">Musteri No:</span> ${escapeHtml(data.CustomerNumber || '—')}</div>
      `;
      debugLog('success', 'GetCustomerNumber basarili');
    } else {
      handleGetError('GetCustomerNumber', result);
    }
  } catch (error) {
    console.error('GetCustomerNumber islenirken hata:', error);
    debugLog('error', `GetCustomerNumber islenirken hata: ${error.message}`);
  }
}

function GetCommercialCustomerNumberCallback(result) {
  try {
    if (result.isSuccess && result.retVal && result.retVal.isApproved) {
      const data = result.retVal.funcRetVal || {};
      const display = document.getElementById('commercialCustomerNumberDisplay');
      display.innerHTML = `
        <div class="data-row"><span class="data-label">Ticari Musteri No:</span> ${escapeHtml(data.CommercialCustomerNumber || '—')}</div>
      `;
      debugLog('success', 'GetCommercialCustomerNumber basarili');
    } else {
      handleGetError('GetCommercialCustomerNumber', result);
    }
  } catch (error) {
    console.error('GetCommercialCustomerNumber islenirken hata:', error);
    debugLog('error', `GetCommercialCustomerNumber islenirken hata: ${error.message}`);
  }
}

function GetLocationCallback(result) {
  try {
    if (result.isSuccess && result.retVal && result.retVal.isApproved) {
      const data = result.retVal.funcRetVal || {};
      const coords = data.coords || {};
      const display = document.getElementById('locationDisplay');
      display.innerHTML = `
        <div class="data-row"><span class="data-label">Enlem:</span> ${coords.latitude !== undefined ? coords.latitude : '—'}</div>
        <div class="data-row"><span class="data-label">Boylam:</span> ${coords.longitude !== undefined ? coords.longitude : '—'}</div>
      `;
      debugLog('success', 'GetLocation basarili');
    } else {
      handleGetError('GetLocation', result);
    }
  } catch (error) {
    console.error('GetLocation islenirken hata:', error);
    debugLog('error', `GetLocation islenirken hata: ${error.message}`);
  }
}

// ============================================================
// 4. CALLBACK HANDLER (sendPayment pattern)
// ============================================================
// sendPayment: isSuccess kontrolu YETERLI, isApproved kontrolu YAPILMAZ
// Veri: retVal altinda gelir
// ============================================================

function sendPaymentCallback(result) {
  try {
    if (result.isSuccess) {
      const paymentSection = document.getElementById('paymentSection');
      const paymentResult = document.getElementById('paymentResult');
      const content = paymentResult.querySelector('.result-content');

      if (content) {
        content.innerHTML = `
          <div class="data-row"><span class="data-label">Sonuc:</span> Odeme basarili</div>
          <div class="data-row"><span class="data-label">Detay:</span> ${escapeHtml(JSON.stringify(result.retVal))}</div>
        `;
      }
      paymentSection.style.display = 'block';
      debugLog('success', 'sendPayment basarili');
    } else {
      const errorMsg = result.error ? result.error.message : 'Odeme basarisiz';
      const errorCode = result.error ? result.error.code : '—';
      showError('sendPayment', `${errorMsg} (Kod: ${errorCode})`);
      debugLog('error', `sendPayment basarisiz: ${errorMsg}`);
    }
  } catch (error) {
    console.error('sendPayment islenirken hata:', error);
    debugLog('error', `sendPayment islenirken hata: ${error.message}`);
  }
}

// ============================================================
// 5. PUBLIC API FONKSIYONLARI
// ============================================================

function fetchIdentity() {
  callBridge('GetIdentity');
}

function fetchPhoneNumber() {
  callBridge('GetPhoneNumber');
}

function fetchMailAddress() {
  callBridge('GetMailAddress');
}

function fetchCustomerNumber() {
  callBridge('GetCustomerNumber');
}

function fetchCommercialCustomerNumber() {
  callBridge('GetCommercialCustomerNumber');
}

function fetchLocation() {
  callBridge('GetLocation');
}

/**
 * OpenMap - Fire-and-forget fonksiyonudur.
 * Geri donus cagrilmaz, callback beklenmez.
 */
function openMap() {
  const latitude = 41.0082;
  const longitude = 28.9784;

  callBridge('OpenMap', {
    latitude: latitude,
    longitude: longitude
  });

  debugLog('info', 'OpenMap fire-and-forget olarak gonderildi. Callback beklenmiyor.');
}

/**
 * sendPayment - Native odeme ekranini acar
 * amount (Double) ve orderId (String) ZORUNLUDUR
 */
function sendPayment() {
  callBridge('sendPayment', {
    amount: 249.90,
    orderId: 'ORD-' + Date.now(),
    type: 'creditCard',
    installment: 1
  });
}

// ============================================================
// 6. YARDIMCI FONKSIYONLAR
// ============================================================

/**
 * Get* fonksiyonlari icin ortak hata yonetimi
 */
function handleGetError(functionName, result) {
  if (!result.isSuccess) {
    const errorMsg = result.error ? result.error.message : 'Bilinmeyen hata';
    const errorCode = result.error ? result.error.code : '—';
    showError(functionName, `${errorMsg} (Kod: ${errorCode})`);
    debugLog('error', `${functionName} basarisiz: ${errorMsg}`);
  } else if (result.retVal && !result.retVal.isApproved) {
    showError(functionName, 'Kullanici onay vermedi');
    debugLog('warn', `${functionName}: Kullanici onayi reddedildi`);
  }
}

/**
 * Hata mesajini UI'da goster
 */
function showError(functionName, message) {
  const errorSection = document.getElementById('errorSection');
  const errorDisplay = document.getElementById('errorDisplay');
  const content = errorDisplay.querySelector('.error-content');

  if (content) {
    content.innerHTML = `
      <div class="data-row"><span class="data-label">Fonksiyon:</span> ${escapeHtml(functionName)}</div>
      <div class="data-row"><span class="data-label">Hata:</span> ${escapeHtml(message)}</div>
    `;
  }
  errorSection.style.display = 'block';
}

/**
 * Debug konsoluna log ekle
 */
function debugLog(type, message, data) {
  const console = document.getElementById('debugConsole');
  if (!console) return;

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;

  const timestamp = new Date().toLocaleTimeString('tr-TR', { hour12: false });
  let logText = `<span class="log-time">[${timestamp}]</span> ${escapeHtml(message)}`;

  if (data) {
    logText += `<pre class="log-data">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
  }

  entry.innerHTML = logText;
  console.appendChild(entry);
  console.scrollTop = console.scrollHeight;
}

/**
 * Debug konsolunu temizle
 */
function clearDebug() {
  const console = document.getElementById('debugConsole');
  if (console) {
    console.innerHTML = '<div class="log-entry info">Konsol temizlendi.</div>';
  }
}

/**
 * Bridge baglantisini kontrol et
 */
function checkBridge() {
  if (Platform.isSupported) {
    debugLog('success', `Bridge baglantisi AKTIF (Platform: ${Platform.name})`);
  } else {
    debugLog('error', 'Bridge baglantisi BULUNAMADI. WebView icinde calismiyor olabilir.');
  }
}

/**
 * HTML escape (XSS korumasi)
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// ============================================================
// 7. BASLANGIC
// ============================================================

(function init() {
  // Platform badge
  const badge = document.getElementById('platformBadge');
  if (badge) {
    badge.textContent = Platform.isSupported ? Platform.name : 'Web (Demo)';
  }

  // Connection status
  const status = document.getElementById('connectionStatus');
  if (status) {
    if (Platform.isSupported) {
      status.className = 'connection-status connected';
      status.title = 'Bridge bagli';
    } else {
      status.className = 'connection-status disconnected';
      status.title = 'Bridge bagli degil (Web modu)';
    }
  }

  debugLog('info', `Platform: ${Platform.name} | Bridge: ${Platform.isSupported ? 'AKTIF' : 'PASIF (Web Demo modu)'}`);
  debugLog('info', 'MiniApp hazir. Fonksiyonlari kullanmak icin butonlara tiklayin.');
})();