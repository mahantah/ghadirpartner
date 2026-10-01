package ir.ghadirpartner.nativeapp;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String HOME = "https://ghadirpartner.ir/partners/";
    private static final int FILE_CHOOSER = 1001;
    private static final int DEVICE_AUTH = 1002;

    private WebView webView;
    private ProgressBar progress;
    private LinearLayout errorPanel;
    private ValueCallback<Uri[]> fileCallback;
    private boolean authenticatedThisProcess = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();
        buildUi();
        configureWebView();

        if (savedInstanceState == null) {
            webView.loadUrl(HOME);
        } else {
            webView.restoreState(savedInstanceState);
        }

        requestSingleUnlockIfAvailable();
    }

    private void configureWindow() {
        Window w = getWindow();
        w.setStatusBarColor(0xFF0B2E4F);
        w.setNavigationBarColor(0xFF0B2E4F);
        if (Build.VERSION.SDK_INT >= 28) {
            w.getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
    }

    private void buildUi() {
        FrameLayout root = new FrameLayout(this);

        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        FrameLayout.LayoutParams pp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, dp(3));
        pp.gravity = Gravity.TOP;
        root.addView(progress, pp);

        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(24), dp(24), dp(24), dp(24));
        errorPanel.setBackgroundColor(0xFFF7F9FC);

        TextView title = new TextView(this);
        title.setText("اتصال به قدیر پارتنر برقرار نشد");
        title.setTextSize(18);
        title.setTextColor(0xFF0B2E4F);
        title.setGravity(Gravity.CENTER);

        TextView desc = new TextView(this);
        desc.setText("اینترنت را بررسی کنید و دوباره تلاش کنید.");
        desc.setTextSize(13);
        desc.setTextColor(0xFF667788);
        desc.setGravity(Gravity.CENTER);
        desc.setPadding(0, dp(12), 0, dp(18));

        Button retry = new Button(this);
        retry.setText("تلاش دوباره");
        retry.setOnClickListener(v -> {
            hideError();
            webView.loadUrl(HOME);
        });

        errorPanel.addView(title);
        errorPanel.addView(desc);
        errorPanel.addView(retry);
        errorPanel.setVisibility(View.GONE);

        root.addView(errorPanel, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);
    }

    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadsImagesAutomatically(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " GhadirPartner-R7/7.0.0");

        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= 21) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUri(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUri(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progress.setVisibility(View.VISIBLE);
                hideError();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER);
                } catch (Exception e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "انتخاب فایل در دسترس نیست", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                req.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url));
                req.addRequestHeader("User-Agent", userAgent);
                req.setMimeType(mimeType);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, guessName(contentDisposition));
                ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(req);
                Toast.makeText(this, "دانلود شروع شد", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                openExternal(Uri.parse(url));
            }
        });
    }

    private boolean handleUri(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();

        if ((scheme.equals("https") || scheme.equals("http")) &&
                (host.equals("ghadirpartner.ir") || host.endsWith(".ghadirpartner.ir"))) {
            return false;
        }

        if (scheme.equals("tel") || scheme.equals("sms") || scheme.equals("mailto") ||
                scheme.equals("geo") || scheme.equals("intent") ||
                scheme.equals("whatsapp") || scheme.equals("bale")) {
            openExternal(uri);
            return true;
        }

        if (scheme.equals("https") || scheme.equals("http")) {
            openExternal(uri);
            return true;
        }
        return false;
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception e) {
            Toast.makeText(this, "برنامه مناسب برای باز کردن لینک پیدا نشد", Toast.LENGTH_SHORT).show();
        }
    }

    private void requestSingleUnlockIfAvailable() {
        if (authenticatedThisProcess) return;
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (prefs.getBoolean(PREF_UNLOCK_DONE, false)) {
            authenticatedThisProcess = true;
            return;
        }
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        if (km == null || !km.isDeviceSecure()) {
            authenticatedThisProcess = true;
            prefs.edit().putBoolean(PREF_UNLOCK_DONE, true).apply();
            return;
        }
        Intent intent = km.createConfirmDeviceCredentialIntent(
                "قدیر پارتنر",
                "برای ورود، قفل دستگاه را یک‌بار تأیید کنید"
        );
        if (intent != null) {
            startActivityForResult(intent, DEVICE_AUTH);
        } else {
            authenticatedThisProcess = true;
        }
    }

    private void showError() {
        if (!isOnline()) {
            errorPanel.setVisibility(View.VISIBLE);
            webView.setVisibility(View.INVISIBLE);
        }
    }

    private void hideError() {
        errorPanel.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
    }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null) return true;
        if (Build.VERSION.SDK_INT >= 23) {
            NetworkCapabilities nc = cm.getNetworkCapabilities(cm.getActiveNetwork());
            return nc != null && (nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                    || nc.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
                    || nc.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
        }
        return cm.getActiveNetworkInfo() != null && cm.getActiveNetworkInfo().isConnected();
    }

    private String guessName(String contentDisposition) {
        String fallback = "ghadirpartner-download";
        if (contentDisposition == null) return fallback;
        int p = contentDisposition.indexOf("filename=");
        if (p < 0) return fallback;
        String v = contentDisposition.substring(p + 9).replace(String.valueOf((char)34), "").trim();
        return v.isEmpty() ? fallback : v;
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER) {
            if (fileCallback != null) {
                Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                fileCallback.onReceiveValue(result);
                fileCallback = null;
            }
            return;
        }

        if (requestCode == DEVICE_AUTH) {
            if (resultCode == RESULT_OK) {
                authenticatedThisProcess = true;
                getSharedPreferences(PREFS, MODE_PRIVATE)
                        .edit()
                        .putBoolean(PREF_UNLOCK_DONE, true)
                        .apply();
            } else {
                new AlertDialog.Builder(this)
                        .setTitle("ورود به قدیر پارتنر")
                        .setMessage("برای ورود باید قفل دستگاه را تأیید کنید.")
                        .setCancelable(false)
                        .setPositiveButton("تلاش دوباره", (d, w) -> requestSingleUnlockIfAvailable())
                        .setNegativeButton("خروج", (d, w) -> finish())
                        .show();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
