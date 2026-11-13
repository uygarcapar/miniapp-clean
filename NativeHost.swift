import Foundation
import WebKit

// ============================================================
// BRIX MiniApp - iOS Native Host (Swift)
// ============================================================
// SuperSDK bridge icin native tarafta gelen mesajlari
// isleyen ve WebView'e callback gonderendir.
//
// Kullanim:
//   1. WKUserContentController'a handler olarak ekleyin
//   2. WKScriptMessageHandler protokolunu uygulayin
//   3. Gelen mesaji JSON olarak parse edip callMethod'a iletin
// ============================================================

final class MiniAppBridgeHandler: NSObject, WKScriptMessageHandler {

    // MARK: - WKScriptMessageHandler

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard message.name == "miniapp",
              let body = message.body as? String,
              let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let callFunction = json["callFunction"] as? [String: Any],
              let functionName = callFunction["functionName"] as? String else {

            let errorPayload = buildErrorPayload(
                message: "Gecersiz mesaj formati: callFunction.functionName eksik",
                code: "78"
            )
            sendCallback(to: message.webView, functionName: nil, result: errorPayload)
            return
        }

        let param = callFunction["param"] as? [String: Any] ?? [:]

        callMethod(
            functionName: functionName,
            param: param,
            webView: message.webView
        )
    }

    // MARK: - Callback Helper

    /// WebView'e JavaScript `functionCallback` cagrisi gonderir
    private func sendCallback(to webView: WKWebView?,
                              functionName: String?,
                              result: [String: Any]) {
        guard let webView = webView else { return }

        let jsonData = (try? JSONSerialization.data(withJSONObject: result)) ?? Data()
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
        let fnName = functionName ?? ""

        let script = "functionCallback('\(fnName)', '\(jsonString)')"
        DispatchQueue.main.async {
            webView.evaluateJavaScript(script) { _, error in
                if let error = error {
                    print("[MiniAppBridge] Callback gonderilemedi: \(error.localizedDescription)")
                }
            }
        }
    }

    // MARK: - Error Payload Builder

    private func buildErrorPayload(message: String, code: String) -> [String: Any] {
        return [
            "isSuccess": false,
            "error": [
                "message": message,
                "code": code
            ]
        ]
    }

    private func buildSuccessPayload(consentName: String,
                                     funcRetVal: [String: Any]) -> [String: Any] {
        return [
            "isSuccess": true,
            "retVal": [
                "consentName": consentName,
                "isApproved": true,
                "funcRetVal": funcRetVal
            ]
        ]
    }

    private func buildPaymentSuccessPayload(retVal: Any) -> [String: Any] {
        return [
            "isSuccess": true,
            "retVal": retVal
        ]
    }

    // MARK: - Method Dispatcher

    /// Gelen functionName'e gore native islemi gerceklestirir
    /// ve sonucu WebView'e callback olarak gonderir.
    func callMethod(functionName: String,
                    param: [String: Any],
                    webView: WKWebView?) {

        switch functionName {

        case "GetIdentity":
            let result = buildSuccessPayload(
                consentName: "GetIdentity",
                funcRetVal: [
                    "Name": "Test",
                    "Surname": "User",
                    "TCKN": "11111111111"
                ]
            )
            sendCallback(to: webView, functionName: functionName, result: result)

        case "GetPhoneNumber":
            let result = buildSuccessPayload(
                consentName: "GetPhoneNumber",
                funcRetVal: [
                    "PhoneNumber": "905551112233"
                ]
            )
            sendCallback(to: webView, functionName: functionName, result: result)

        case "GetMailAddress":
            let result = buildSuccessPayload(
                consentName: "GetMailAddress",
                funcRetVal: [
                    "Email": "test@example.com"
                ]
            )
            sendCallback(to: webView, functionName: functionName, result: result)

        case "GetCustomerNumber":
            let result = buildSuccessPayload(
                consentName: "GetCustomerNumber",
                funcRetVal: [
                    "CustomerNumber": "123456"
                ]
            )
            sendCallback(to: webView, functionName: functionName, result: result)

        case "GetCommercialCustomerNumber":
            let result = buildSuccessPayload(
                consentName: "GetCommercialCustomerNumber",
                funcRetVal: [
                    "CommercialCustomerNumber": "987654"
                ]
            )
            sendCallback(to: webView, functionName: functionName, result: result)

        case "GetLocation":
            let result = buildSuccessPayload(
                consentName: "GetLocation",
                funcRetVal: [
                    "coords": [
                        "latitude": 41.015,
                        "longitude": 28.979
                    ]
                ]
            )
            sendCallback(to: webView, functionName: functionName, result: result)

        case "OpenMap":
            // Fire-and-forget: Callback gonderilmez
            // param'dan latitude/longitude alinir ve native map uygulamasi acilir
            let latitude = param["latitude"] as? Double ?? 41.0082
            let longitude = param["longitude"] as? Double ?? 28.9784
            openNativeMap(latitude: latitude, longitude: longitude)

        case "sendPayment":
            // amount (Double) ve orderId (String) zorunludur
            guard let amount = param["amount"] as? Double,
                  let orderId = param["orderId"] as? String else {
                let errorResult = buildErrorPayload(
                    message: "sendPayment: amount ve orderId zorunludur",
                    code: "70"
                )
                sendCallback(to: webView, functionName: functionName, result: errorResult)
                return
            }

            let type = param["type"] as? String ?? "creditCard"
            let installment = param["installment"] as? Int ?? 1
            let paymentToken = param["paymentToken"] as? String

            // SDK uzerinden native odeme akisi baslatilir
            initiatePayment(
                amount: amount,
                orderId: orderId,
                type: type,
                installment: installment,
                paymentToken: paymentToken
            ) { [weak self] success, response in
                guard let self = self else { return }

                if success {
                    let result = self.buildPaymentSuccessPayload(retVal: response ?? "Odeme basarili")
                    self.sendCallback(to: webView, functionName: functionName, result: result)
                } else {
                    let errorResult = self.buildErrorPayload(
                        message: response as? String ?? "Odeme basarisiz",
                        code: "70"
                    )
                    self.sendCallback(to: webView, functionName: functionName, result: errorResult)
                }
            }

        default:
            let errorResult = buildErrorPayload(
                message: "Desteklenmeyen functionName: \(functionName)",
                code: "70"
            )
            sendCallback(to: webView, functionName: functionName, result: errorResult)
        }
    }

    // MARK: - Native Implementations (Stubs)

    /// Cihazdaki harita uygulamasini acar (fire-and-forget)
    private func openNativeMap(latitude: Double, longitude: Double) {
        let urlString = "https://maps.apple.com/?ll=\(latitude),\(longitude)"
        guard let url = URL(string: urlString) else { return }

        DispatchQueue.main.async {
            if UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
        }
    }

    /// Native odeme SDK'sini cagirir
    private func initiatePayment(amount: Double,
                                 orderId: String,
                                 type: String,
                                 installment: Int,
                                 paymentToken: String?,
                                 completion: @escaping (Bool, Any?) -> Void) {
        // SuperSDK odeme SDK'si entegrasyonu burada yapilir
        // Ornek basarili sonuc:
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            completion(true, [
                "transactionId": "TXN-\(orderId)",
                "amount": amount,
                "status": "approved"
            ])
        }
    }
}

// ============================================================
// KULLANIM ORNEGI - AppDelegate veya ViewController icinde:
// ============================================================
//
// let bridge = MiniAppBridgeHandler()
// let contentController = WKUserContentController()
// contentController.add(bridge, name: "miniapp")
//
// let config = WKWebViewConfiguration()
// config.userContentController = contentController
//
// let webView = WKWebView(frame: .zero, configuration: config)
// webView.loadFileURL(miniAppURL, allowingReadAccessTo: bundleRoot)
//