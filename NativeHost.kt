package com.brix.miniapp.bridge

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject
import java.util.UUID

// ============================================================
// BRIX MiniApp - Android Native Host (Kotlin)
// ============================================================
// SuperSDK bridge icin native tarafta gelen mesajlari
// isleyen ve WebView'e callback gonderen siniftir.
//
// Kullanim:
//   1. WebView'in JavaScriptInterface'ine bu sinifi ekleyin
//   2. Android'de postMessage yalnizca JSON STRING kabul eder
//   3. Callback'ler WebView'in postMessage'i uzerinden degil,
//      evaluateJavascript ile functionCallback cagrilarak yapilir
// ============================================================

class MiniAppBridge(private val context: Context, private val webView: WebView) {

    companion object {
        const val BRIDGE_NAME = "miniapp"
    }

    // ============================================================
    // JavaScript Interface - Web'den cagrilan giris noktasi
    // ============================================================

    /**
     * Web tarafindan cagrilan ana bridge metodu.
     * window.miniapp.postMessage(message) ile tetiklenir.
     *
     * @param message JSON string - { "callFunction": { "functionName": "...", "param": {} } }
     */
    @JavascriptInterface
    fun postMessage(message: String) {
        try {
            val json = JSONObject(message)
            val callFunction = json.optJSONObject("callFunction")
                ?: run {
                    sendErrorCallback(null, "Gecersiz mesaj formati: callFunction eksik", "78")
                    return
                }

            val functionName = callFunction.optString("functionName", "")
            if (functionName.isEmpty()) {
                sendErrorCallback(null, "Gecersiz mesaj formati: functionName eksik", "78")
                return
            }

            val paramJson = callFunction.optJSONObject("param")
            val param = paramJson?.let { jsonObjectToMap(it) } ?: emptyMap()

            callMethod(functionName, param)
        } catch (e: Exception) {
            sendErrorCallback(null, "Mesaj parse edilemedi: ${e.message}", "78")
        }
    }

    // ============================================================
    // Callback Helpers
    // ============================================================

    /**
     * WebView'deki functionCallback fonksiyonunu cagirir.
     * Android'de evaluateJavascript ana thread'de calistirilmalidir.
     */
    private fun sendCallback(functionName: String?, result: JSONObject) {
        val fnName = functionName ?: ""
        val jsonString = result.toString().replace("'", "\\'")

        val script = "functionCallback('$fnName', '$jsonString')"
        webView.post {
            webView.evaluateJavascript(script, null)
        }
    }

    private fun sendErrorCallback(functionName: String?, message: String, code: String) {
        val errorPayload = JSONObject().apply {
            put("isSuccess", false)
            put("error", JSONObject().apply {
                put("message", message)
                put("code", code)
            })
        }
        sendCallback(functionName, errorPayload)
    }

    private fun buildSuccessPayload(consentName: String, funcRetVal: Map<String, Any>): JSONObject {
        return JSONObject().apply {
            put("isSuccess", true)
            put("retVal", JSONObject().apply {
                put("consentName", consentName)
                put("isApproved", true)
                put("funcRetVal", mapToJsonObject(funcRetVal))
            })
        }
    }

    private fun buildPaymentSuccessPayload(retVal: Any): JSONObject {
        return JSONObject().apply {
            put("isSuccess", true)
            when (retVal) {
                is Map<*, *> -> put("retVal", mapToJsonObject(retVal as Map<String, Any>))
                else -> put("retVal", retVal.toString())
            }
        }
    }

    // ============================================================
    // Method Dispatcher
    // ============================================================

    /**
     * Gelen functionName'e gore native islemi gerceklestirir
     * ve sonucu WebView'e callback olarak gonderir.
     */
    private fun callMethod(functionName: String, param: Map<String, Any>) {
        when (functionName) {

            "GetIdentity" -> {
                val result = buildSuccessPayload("GetIdentity", mapOf(
                    "Name" to "Test",
                    "Surname" to "User",
                    "TCKN" to "11111111111"
                ))
                sendCallback(functionName, result)
            }

            "GetPhoneNumber" -> {
                val result = buildSuccessPayload("GetPhoneNumber", mapOf(
                    "PhoneNumber" to "905551112233"
                ))
                sendCallback(functionName, result)
            }

            "GetMailAddress" -> {
                val result = buildSuccessPayload("GetMailAddress", mapOf(
                    "Email" to "test@example.com"
                ))
                sendCallback(functionName, result)
            }

            "GetCustomerNumber" -> {
                val result = buildSuccessPayload("GetCustomerNumber", mapOf(
                    "CustomerNumber" to "123456"
                ))
                sendCallback(functionName, result)
            }

            "GetCommercialCustomerNumber" -> {
                val result = buildSuccessPayload("GetCommercialCustomerNumber", mapOf(
                    "CommercialCustomerNumber" to "987654"
                ))
                sendCallback(functionName, result)
            }

            "GetLocation" -> {
                val result = buildSuccessPayload("GetLocation", mapOf(
                    "coords" to mapOf(
                        "latitude" to 41.015,
                        "longitude" to 28.979
                    )
                ))
                sendCallback(functionName, result)
            }

            "OpenMap" -> {
                // Fire-and-forget: Callback gonderilmez
                val latitude = (param["latitude"] as? Double) ?: 41.0082
                val longitude = (param["longitude"] as? Double) ?: 28.9784
                openNativeMap(latitude, longitude)
            }

            "sendPayment" -> {
                // amount (Double) ve orderId (String) zorunludur
                val amount = param["amount"] as? Double
                val orderId = param["orderId"] as? String

                if (amount == null || orderId == null) {
                    sendErrorCallback(
                        functionName,
                        "sendPayment: amount ve orderId zorunludur",
                        "70"
                    )
                    return
                }

                val type = param["type"] as? String ?: "creditCard"
                val installment = (param["installment"] as? Int) ?: 1
                val paymentToken = param["paymentToken"] as? String

                // SDK uzerinden native odeme akisi baslatilir
                initiatePayment(
                    amount = amount,
                    orderId = orderId,
                    type = type,
                    installment = installment,
                    paymentToken = paymentToken,
                    onSuccess = { response ->
                        val result = buildPaymentSuccessPayload(response)
                        sendCallback(functionName, result)
                    },
                    onError = { errorMessage ->
                        sendErrorCallback(functionName, errorMessage, "70")
                    }
                )
            }

            else -> {
                sendErrorCallback(
                    functionName,
                    "Desteklenmeyen functionName: $functionName",
                    "70"
                )
            }
        }
    }

    // ============================================================
    // Native Implementations (Stubs)
    // ============================================================

    /**
     * Cihazdaki harita uygulamasini acar (fire-and-forget)
     */
    private fun openNativeMap(latitude: Double, longitude: Double) {
        val uri = Uri.parse("geo:$latitude,$longitude?q=$latitude,$longitude")
        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            // Google Maps yoksa tarayicida ac
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        if (intent.resolveActivity(context.packageManager) != null) {
            context.startActivity(intent)
        } else {
            // Fallback: Google Maps web
            val webUri = Uri.parse("https://maps.google.com/maps?q=$latitude,$longitude")
            context.startActivity(Intent(Intent.ACTION_VIEW, webUri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        }
    }

    /**
     * Native odeme SDK'sini cagirir
     */
    private fun initiatePayment(
        amount: Double,
        orderId: String,
        type: String,
        installment: Int,
        paymentToken: String?,
        onSuccess: (Map<String, Any>) -> Unit,
        onError: (String) -> Unit
    ) {
        // SuperSDK odeme SDK'si entegrasyonu burada yapilir
        // Ornek basarili sonuc:
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            onSuccess(mapOf(
                "transactionId" to "TXN-$orderId",
                "amount" to amount,
                "status" to "approved"
            ))
        }, 1000)
    }

    // ============================================================
    // Utility Helpers
    // ============================================================

    private fun jsonObjectToMap(json: JSONObject): Map<String, Any> {
        val map = mutableMapOf<String, Any>()
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val value = json.get(key)
            when (value) {
                is JSONObject -> map[key] = jsonObjectToMap(value)
                is Number, is String, is Boolean -> map[key] = value
                else -> map[key] = value.toString()
            }
        }
        return map
    }

    private fun mapToJsonObject(map: Map<String, Any>): JSONObject {
        val json = JSONObject()
        for ((key, value) in map) {
            when (value) {
                is Map<*, *> -> json.put(key, mapToJsonObject(value as Map<String, Any>))
                is Number -> json.put(key, value)
                is String -> json.put(key, value)
                is Boolean -> json.put(key, value)
                else -> json.put(key, value.toString())
            }
        }
        return json
    }
}

// ============================================================
// KULLANIM ORNEGI - Activity icinde:
// ============================================================
//
// class MainActivity : AppCompatActivity() {
//     override fun onCreate(savedInstanceState: Bundle?) {
//         super.onCreate(savedInstanceState)
//
//         val webView = WebView(this)
//         setContentView(webView)
//
//         webView.settings.javaScriptEnabled = true
//
//         val bridge = MiniAppBridge(this, webView)
//         webView.addJavascriptInterface(bridge, MiniAppBridge.BRIDGE_NAME)
//
//         // MiniApp HTML'ini yukle
//         webView.loadUrl("file:///android_asset/miniapp/index.html")
//     }
// }
//