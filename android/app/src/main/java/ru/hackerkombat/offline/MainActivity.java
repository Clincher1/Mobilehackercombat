package ru.hackerkombat.offline;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Locale;

/** Offline-only shell. The synthetic HTTPS origin is intercepted locally; it never uses a network. */
public final class MainActivity extends Activity {
    private static final String HOST = "offline.hackerkombat.invalid";
    private static final String START = "https://" + HOST + "/";
    private static final int OPEN_SAVE = 101;
    private static final int CREATE_SAVE = 102;
    private static final int MAX_SAVE_BYTES = 5 * 1024 * 1024;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingSave;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        // Required for the system file picker; WebView navigation remains restricted.
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        webView.addJavascriptInterface(new BackupBridge(), "AndroidBackup");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isLocal(request.getUrl());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loadAsset(request.getUrl(), request.getMethod());
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {"application/json", "text/plain", "application/octet-stream"});
                    startActivityForResult(intent, OPEN_SAVE);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    toast("Не удалось открыть выбор файла");
                    return true;
                }
            }
        });
        webView.loadUrl(START);
    }

    private static boolean isLocal(Uri uri) {
        return uri != null && "https".equalsIgnoreCase(uri.getScheme()) && HOST.equalsIgnoreCase(uri.getHost())
                && uri.getPort() == -1 && uri.getUserInfo() == null;
    }

    private WebResourceResponse loadAsset(Uri uri, String method) {
        if (!isLocal(uri) || !"GET".equals(method)) return failure(403, "Forbidden");
        String path = uri.getPath();
        if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
        if (path.contains("..") || path.contains("\\") || path.indexOf('\0') >= 0) return failure(403, "Forbidden");
        String asset = "web" + path;
        try {
            InputStream stream = getAssets().open(asset);
            String mime = mimeType(path);
            WebResourceResponse response = new WebResourceResponse(mime, mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") ? "UTF-8" : null, stream);
            response.setResponseHeaders(Collections.singletonMap("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'"));
            return response;
        } catch (IOException e) {
            // A reload on a client-side route must load the app shell.
            if (!path.substring(path.lastIndexOf('/') + 1).contains(".")) {
                try { return new WebResourceResponse("text/html", "UTF-8", getAssets().open("web/index.html")); }
                catch (IOException ignored) { /* show error below */ }
            }
            return failure(404, "Not found");
        }
    }

    private static WebResourceResponse failure(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason, Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    private static String mimeType(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private void toast(String text) { runOnUiThread(() -> Toast.makeText(this, text, Toast.LENGTH_LONG).show()); }

    public final class BackupBridge {
        @JavascriptInterface public void save(String json) {
            if (json == null) return;
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > MAX_SAVE_BYTES) { toast("Сохранение слишком большое"); return; }
            runOnUiThread(() -> {
                if (pendingSave != null) { toast("Завершите сохранение файла"); return; }
                pendingSave = bytes;
                try {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/json");
                    intent.putExtra(Intent.EXTRA_TITLE, "hacker-kombat-save.json");
                    startActivityForResult(intent, CREATE_SAVE);
                } catch (Exception e) {
                    pendingSave = null;
                    toast("Не удалось открыть сохранение файла");
                }
            });
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == OPEN_SAVE) {
            if (fileCallback != null) {
                Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
                fileCallback.onReceiveValue(uri == null ? null : new Uri[] {uri});
                fileCallback = null;
            }
        } else if (requestCode == CREATE_SAVE) {
            byte[] bytes = pendingSave;
            pendingSave = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    if (out == null) throw new IOException("No output stream");
                    out.write(bytes);
                    toast("Резервный файл сохранён");
                } catch (IOException | SecurityException e) { toast("Не удалось записать файл"); }
            }
        }
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (webView != null) { webView.removeJavascriptInterface("AndroidBackup"); webView.destroy(); }
        super.onDestroy();
    }
}
