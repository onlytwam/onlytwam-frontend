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

        private AudioRecord     audioRecord;
        private volatile boolean recording = false;
        private Thread          recordThread;

        // ── start ─────────────────────────────────────────────────────────────
        @PluginMethod
        public void start(PluginCall call) {
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
            stopRecording();
            call.resolve();
        }

        // ── isAvailable ───────────────────────────────────────────────────────
        @PluginMethod
        public void isAvailable(PluginCall call) {
            JSObject d = new JSObject();
            d.put("available", true);   // always true — no Google dependency
            call.resolve(d);
        }

        // ── Core recording ────────────────────────────────────────────────────
        private void doRecord() {
            int bufSize = AudioRecord.getMinBufferSize(
                SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT);

            if (bufSize <= 0) {
                notifyListeners("onError",
                    errorObj("Cannot create AudioRecord buffer", true));
                return;
            }

            try {
                audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT, bufSize * 4);

                if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                    notifyListeners("onError",
                        errorObj("AudioRecord failed to initialize", true));
                    return;
                }

                ByteArrayOutputStream pcmBuffer = new ByteArrayOutputStream();
                byte[] chunk = new byte[bufSize];
                recording    = true;

                // ── Smart timeout constants ───────────────────────────────────
                // No speech at all → stop after this, send NOTHING (zero cost)
                final long NO_SPEECH_TIMEOUT_MS   = 4000;
                // After speech is heard, stop after this long of silence
                final long POST_SPEECH_SILENCE_MS = 1500;
                // Hard cap — search keywords are short, no need for more
                final long HARD_MAX_MS            = 5000;

                audioRecord.startRecording();
                notifyListeners("onStatus", statusObj("speechStart"));

                long    startMs          = System.currentTimeMillis();
                boolean speechStarted    = false;
                long    silenceStartedMs = 0;

                while (recording) {
                    long elapsed = System.currentTimeMillis() - startMs;

                    // Hard cap: 5 seconds regardless
                    if (elapsed >= HARD_MAX_MS) {
                        break;
                    }

                    // No speech detected in 4 seconds → discard, cost = zero
                    if (!speechStarted && elapsed >= NO_SPEECH_TIMEOUT_MS) {
                        pcmBuffer.reset();
                        break;
                    }

                    int read = audioRecord.read(chunk, 0, chunk.length);
                    if (read <= 0) continue;

                    pcmBuffer.write(chunk, 0, read);
                    boolean silent = isSilent(chunk, read);

                    if (!silent) {
                        // Active speech
                        speechStarted    = true;
                        silenceStartedMs = 0;
                    } else if (speechStarted) {
                        // Speech started but now gone quiet
                        if (silenceStartedMs == 0) {
                            silenceStartedMs = System.currentTimeMillis();
                        } else if ((System.currentTimeMillis() - silenceStartedMs)
                                    >= POST_SPEECH_SILENCE_MS) {
                            // User finished speaking — stop immediately
                            break;
                        }
                    }
                }

                stopRecording();
                notifyListeners("onStatus", statusObj("speechEnd"));

                byte[] pcmBytes = pcmBuffer.toByteArray();

                // Too short or silence timeout → empty result, no API call
                if (pcmBytes.length < 3200) {
                    notifyListeners("onResult", resultObj("", true));
                    return;
                }

                // Send to FastAPI → Azure Speech
                String transcript = sendToBackend(pcmBytes);

                JSObject d = new JSObject();
                d.put("transcript", transcript);
                d.put("isFinal",    true);
                notifyListeners("onResult", d);

            } catch (Exception e) {
                notifyListeners("onError", errorObj(e.getMessage(), true));
                stopRecording();
            }
        }

        // ── Silence detection ─────────────────────────────────────────────────
        // Average amplitude below 600 = silence / room noise.
        // Raise threshold if ambient noise triggers false speech detection.
        // Lower if soft voices are not being picked up.
        private boolean isSilent(byte[] buf, int len) {
            long sum     = 0;
            int  samples = len / 2;
            for (int i = 0; i < len - 1; i += 2) {
                short s = (short) ((buf[i + 1] << 8) | (buf[i] & 0xff));
                sum += Math.abs(s);
            }
            return samples > 0 && (sum / samples) < 600;
        }

        // ── POST PCM to backend ───────────────────────────────────────────────
        private String sendToBackend(byte[] pcmBytes) throws Exception {
            String          boundary = "----TwamAudioBoundary";
            URL             url      = new URL(TRANSCRIBE_URL);
            HttpURLConnection conn   = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(20_000);
            conn.setRequestProperty("Content-Type",
                "multipart/form-data; boundary=" + boundary);

            try (OutputStream    out = conn.getOutputStream();
                 DataOutputStream dos = new DataOutputStream(out)) {
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
            if (status != 200) {
                throw new Exception("Backend returned HTTP " + status);
            }

            StringBuilder sb = new StringBuilder();
            try (java.io.InputStream      is = conn.getInputStream();
                 java.io.BufferedReader   br = new java.io.BufferedReader(
                     new java.io.InputStreamReader(is, "UTF-8"))) {
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
            }

            return new JSONObject(sb.toString()).optString("transcript", "");
        }

        // ── Internal helpers ──────────────────────────────────────────────────
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