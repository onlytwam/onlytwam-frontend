package in.twam.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends BridgeActivity {

    private static final int MIC_PERMISSION_CODE = 1001;

    @CapacitorPlugin(name = "NativeSpeech")
    public static class NativeSpeechPlugin extends Plugin {

        private static final String TRANSCRIBE_URL =
            "https://twam-backend.delightfulglacier-694e73d0.centralindia.azurecontainerapps.io/api/Speech/transcribe";

        private static final int SAMPLE_RATE    = 16000;
        private static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
        private static final int AUDIO_FORMAT   = AudioFormat.ENCODING_PCM_16BIT;

        private AudioRecord      audioRecord;
        private volatile boolean recording = false;
        private Thread           recordThread;

        // ── start ─────────────────────────────────────────────────────────────
        @PluginMethod
        public void start(PluginCall call) {
            android.util.Log.d("TWAM_SPEECH", "=== start() called ===");
            stopRecording();
            getActivity().runOnUiThread(() -> {
                notifyListeners("onStatus", statusObj("ready"));
                call.resolve();
            });
            recordThread = new Thread(this::doRecord);
            recordThread.start();
        }

        // ── stop ──────────────────────────────────────────────────────────────
        @PluginMethod
        public void stop(PluginCall call) {
            android.util.Log.d("TWAM_SPEECH", "=== stop() called ===");
            stopRecording();
            call.resolve();
        }

        // ── isAvailable ───────────────────────────────────────────────────────
        @PluginMethod
        public void isAvailable(PluginCall call) {
            JSObject d = new JSObject();
            d.put("available", true);
            call.resolve(d);
        }

        // ── Core recording ────────────────────────────────────────────────────
        private void doRecord() {
            int bufSize = AudioRecord.getMinBufferSize(
                SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT);

            android.util.Log.d("TWAM_SPEECH", "bufSize=" + bufSize);

            if (bufSize <= 0) {
                android.util.Log.e("TWAM_SPEECH", "Invalid bufSize: " + bufSize);
                notifyListeners("onError",
                    errorObj("Cannot create AudioRecord buffer", true));
                return;
            }

            try {
                audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT, bufSize * 4);

                int state = audioRecord.getState();
                android.util.Log.d("TWAM_SPEECH", "AudioRecord state=" + state
                    + " (1=INITIALIZED)");

                if (state != AudioRecord.STATE_INITIALIZED) {
                    android.util.Log.e("TWAM_SPEECH", "AudioRecord not initialized");
                    notifyListeners("onError",
                        errorObj("AudioRecord failed to initialize", true));
                    return;
                }

                ByteArrayOutputStream pcmBuffer = new ByteArrayOutputStream();
                byte[] chunk = new byte[bufSize];
                recording    = true;

                final long NO_SPEECH_TIMEOUT_MS   = 4000;
                final long POST_SPEECH_SILENCE_MS = 1500;
                final long HARD_MAX_MS            = 5000;

                audioRecord.startRecording();
                android.util.Log.d("TWAM_SPEECH",
                    "=== Recording started, bufSize=" + bufSize + " ===");
                notifyListeners("onStatus", statusObj("speechStart"));

                long    startMs          = System.currentTimeMillis();
                boolean speechStarted    = false;
                long    silenceStartedMs = 0;
                int     loopCount        = 0;

                while (recording) {
                    long elapsed = System.currentTimeMillis() - startMs;

                    if (elapsed >= HARD_MAX_MS) {
                        android.util.Log.d("TWAM_SPEECH", "Hard cap reached at " + elapsed + "ms");
                        break;
                    }

                    if (!speechStarted && elapsed >= NO_SPEECH_TIMEOUT_MS) {
                        android.util.Log.d("TWAM_SPEECH",
                            "No speech detected in " + elapsed + "ms — discarding");
                        pcmBuffer.reset();
                        break;
                    }

                    int read = audioRecord.read(chunk, 0, chunk.length);
                    if (read <= 0) continue;

                    pcmBuffer.write(chunk, 0, read);
                    boolean silent = isSilent(chunk, read);

                    // Log amplitude every 10 loops so we can see if mic is working
                    loopCount++;
                    if (loopCount % 10 == 0) {
                        long amp = getAmplitude(chunk, read);
                        android.util.Log.d("TWAM_SPEECH",
                            "Loop " + loopCount
                            + " | elapsed=" + elapsed + "ms"
                            + " | amplitude=" + amp
                            + " | silent=" + silent
                            + " | speechStarted=" + speechStarted);
                    }

                    if (!silent) {
                        speechStarted    = true;
                        silenceStartedMs = 0;
                    } else if (speechStarted) {
                        if (silenceStartedMs == 0) {
                            silenceStartedMs = System.currentTimeMillis();
                        } else if ((System.currentTimeMillis() - silenceStartedMs)
                                    >= POST_SPEECH_SILENCE_MS) {
                            android.util.Log.d("TWAM_SPEECH",
                                "Post-speech silence detected — stopping");
                            break;
                        }
                    }
                }

                stopRecording();

                byte[] pcmBytes = pcmBuffer.toByteArray();
                android.util.Log.d("TWAM_SPEECH",
                    "Recording stopped. speechStarted=" + speechStarted
                    + " pcmSize=" + pcmBytes.length
                    + " durationSec=" + (pcmBytes.length / 32000.0));

                notifyListeners("onStatus", statusObj("speechEnd"));

                if (pcmBytes.length < 3200) {
                    android.util.Log.d("TWAM_SPEECH",
                        "Audio too short or silent — not sending to backend");
                    notifyListeners("onResult", resultObj("", true));
                    return;
                }

                android.util.Log.d("TWAM_SPEECH",
                    "Sending " + pcmBytes.length + " bytes to backend...");
                String transcript = sendToBackend(pcmBytes);
                android.util.Log.d("TWAM_SPEECH", "Final transcript: '" + transcript + "'");

                JSObject d = new JSObject();
                d.put("transcript", transcript);
                d.put("isFinal",    true);
                notifyListeners("onResult", d);

            } catch (Exception e) {
                android.util.Log.e("TWAM_SPEECH", "doRecord exception: " + e.getMessage(), e);
                notifyListeners("onError", errorObj(e.getMessage(), true));
                stopRecording();
            }
        }

        // ── Silence detection ─────────────────────────────────────────────────
        private boolean isSilent(byte[] buf, int len) {
            return getAmplitude(buf, len) < 600;
        }

        private long getAmplitude(byte[] buf, int len) {
            long sum     = 0;
            int  samples = len / 2;
            for (int i = 0; i < len - 1; i += 2) {
                short s = (short) ((buf[i + 1] << 8) | (buf[i] & 0xff));
                sum += Math.abs(s);
            }
            return samples > 0 ? sum / samples : 0;
        }

        // ── POST PCM to backend ───────────────────────────────────────────────
        private String sendToBackend(byte[] pcmBytes) throws Exception {
            android.util.Log.d("TWAM_SPEECH", "=== Sending audio to backend ===");
            android.util.Log.d("TWAM_SPEECH", "PCM bytes: " + pcmBytes.length);
            android.util.Log.d("TWAM_SPEECH", "Duration: " + (pcmBytes.length / 32000.0) + "s");
            android.util.Log.d("TWAM_SPEECH", "URL: " + TRANSCRIBE_URL);

            String            boundary = "----TwamAudioBoundary";
            URL               url      = new URL(TRANSCRIBE_URL);
            HttpURLConnection conn     = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(20_000);
            conn.setRequestProperty("Content-Type",
                "multipart/form-data; boundary=" + boundary);

            try (OutputStream     out = conn.getOutputStream();
                 DataOutputStream  dos = new DataOutputStream(out)) {
                dos.writeBytes("--" + boundary + "\r\n");
                dos.writeBytes(
                    "Content-Disposition: form-data; name=\"audio\"; "
                    + "filename=\"voice.pcm\"\r\n");
                dos.writeBytes("Content-Type: application/octet-stream\r\n\r\n");
                dos.write(pcmBytes);
                dos.writeBytes("\r\n--" + boundary + "--\r\n");
                dos.flush();
            }

            int status = conn.getResponseCode();
            android.util.Log.d("TWAM_SPEECH", "HTTP status: " + status);

            java.io.InputStream is = (status == 200)
                ? conn.getInputStream()
                : conn.getErrorStream();

            StringBuilder sb = new StringBuilder();
            if (is != null) {
                try (java.io.BufferedReader br = new java.io.BufferedReader(
                        new java.io.InputStreamReader(is, "UTF-8"))) {
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line);
                }
            }

            String body = sb.toString();
            android.util.Log.d("TWAM_SPEECH", "Response body: " + body);

            if (status != 200) {
                android.util.Log.e("TWAM_SPEECH",
                    "Backend error HTTP " + status + ": " + body);
                throw new Exception("Backend HTTP " + status + " — " + body);
            }

            String transcript = new JSONObject(body).optString("transcript", "");
            android.util.Log.d("TWAM_SPEECH", "Transcript: '" + transcript + "'");
            return transcript;
        }

        // ── Helpers ───────────────────────────────────────────────────────────
        private void stopRecording() {
            recording = false;
            if (audioRecord != null) {
                try { audioRecord.stop();    } catch (Exception ignored) {}
                try { audioRecord.release(); } catch (Exception ignored) {}
                audioRecord = null;
            }
        }

        private JSObject statusObj(String status) {
            JSObject d = new JSObject();
            d.put("status", status);
            return d;
        }

        private JSObject resultObj(String transcript, boolean isFinal) {
            JSObject d = new JSObject();
            d.put("transcript", transcript);
            d.put("isFinal",    isFinal);
            return d;
        }

        private JSObject errorObj(String message, boolean fatal) {
            JSObject d = new JSObject();
            d.put("error", message);
            d.put("fatal", fatal);
            return d;
        }
    }

    // ── Activity lifecycle ────────────────────────────────────────────────────

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeSpeechPlugin.class);
        super.onCreate(savedInstanceState);

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                new String[]{ Manifest.permission.RECORD_AUDIO },
                MIC_PERMISSION_CODE);
        }

        bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
    }

    @Override
    public void onBackPressed() {
        if (bridge != null) {
            WebView wv = bridge.getWebView();
            if (wv != null && wv.canGoBack()) { wv.goBack(); return; }
        }
        super.onBackPressed();
    }
}