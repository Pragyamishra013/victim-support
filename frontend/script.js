const API_BASE = "http://localhost:5004/api";

let ngoSlug = "";
let reportMethod = "";
let recordedBlob = null;
let recordedUrl = null;
let uploadedFile = null;
let recordedVideoBlob = null;
let recordedVideoUrl = null;
let uploadedVideoFile = null;
let videoRecorder = null;
let videoStream = null;
let videoChunks = [];
let recorder = null;
let recorderStream = null;
let chunks = [];
let organizationCases = [];
let selectedCaseId = null;

function $(id) { return document.getElementById(id); }
function showScreen(number) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const target = $("screen-" + number);
    if (target) target.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
}
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;","\"":"&quot;"}[c]));
}
function setError(id, message) { const el = $(id); if (!el) return; el.textContent = message || ""; }

async function json(response) {
    const text = await response.text();
    try { return text ? JSON.parse(text) : {}; } catch { return { success:false, message:text || `HTTP ${response.status}` }; }
}

function setupVictim() {
    if (!$("consent-btn")) return;
    ngoSlug = new URLSearchParams(location.search).get("ngo") || "";
    if (!ngoSlug) {
        $("ngo-name-box").textContent = "This page must be opened from the unique reporting link provided by an organization.";
        $("consent-checkbox").disabled = true;
        return;
    }
    fetch(`${API_BASE}/ngo/by-slug/${encodeURIComponent(ngoSlug)}`)
        .then(json)
        .then(data => {
            if (!data.success) throw new Error(data.message || "Invalid reporting link.");
            $("ngo-name-box").textContent = `Secure reporting link for ${data.ngo.name}.`;
        })
        .catch(error => {
            $("ngo-name-box").textContent = error.message;
            $("consent-checkbox").disabled = true;
        });

    $("consent-checkbox").addEventListener("change", () => {
        $("consent-btn").disabled = !$("consent-checkbox").checked;
    });
    $("consent-btn").addEventListener("click", () => showScreen(2));
    $("details-back").addEventListener("click", () => showScreen(1));
    $("victim-details-form").addEventListener("submit", e => { e.preventDefault(); showScreen(3); });

    document.querySelectorAll(".method-card").forEach(card => card.addEventListener("click", () => selectMethod(card.dataset.method)));
    $("report-text").addEventListener("input", () => $("char-counter").textContent = `${$("report-text").value.length} / 5000`);
    $("record-btn").addEventListener("click", toggleRecording);
    $("audio-file").addEventListener("change", handleUpload);
    $("video-file").addEventListener("change", handleVideoUpload);
    $("video-record-btn").addEventListener("click", toggleVideoRecording);
    $("report-continue").addEventListener("click", continueToReview);
    $("report-back").addEventListener("click", () => showScreen(2));
    $("review-back").addEventListener("click", () => showScreen(3));
    $("submit-btn").addEventListener("click", submitVictimReport);
    $("done-btn").addEventListener("click", () => location.reload());
    selectMethod("text");
}

function selectMethod(method) {
    reportMethod = method;
    document.querySelectorAll(".method-card").forEach(c => c.classList.toggle("selected", c.dataset.method === method));
    $("method-text").classList.toggle("hidden", method !== "text");
    $("method-record").classList.toggle("hidden", method !== "record");
    $("method-upload").classList.toggle("hidden", method !== "upload");
    $("method-video-record").classList.toggle("hidden", method !== "video-record");
    $("method-video-upload").classList.toggle("hidden", method !== "video-upload");
    if (method !== "video-record" && videoRecorder && videoRecorder.state !== "inactive") stopVideoRecording();
    if (method !== "video-record") stopCameraPreview();
    setError("method-error", "");
    if (method !== "record" && recorder && recorder.state !== "inactive") stopRecording();
}

function mimeType() {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
    return types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
}

async function toggleRecording() {
    if (recorder && recorder.state === "recording") { stopRecording(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        setError("method-error", "Your browser does not support microphone recording."); return;
    }
    try {
        recorderStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        recordedBlob = null;
        const type = mimeType();
        recorder = type ? new MediaRecorder(recorderStream, { mimeType:type }) : new MediaRecorder(recorderStream);
        recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
        recorder.onstop = () => {
            const finalType = recorder.mimeType || type || "audio/webm";
            recordedBlob = new Blob(chunks, { type:finalType });
            if (recordedUrl) URL.revokeObjectURL(recordedUrl);
            recordedUrl = URL.createObjectURL(recordedBlob);
            $("record-preview").src = recordedUrl;
            $("record-preview").classList.remove("hidden");
            $("record-status").textContent = "Recording ready. You can record again if needed.";
            cleanupRecorder();
        };
        recorder.onerror = () => { cleanupRecorder(); setError("method-error", "Recording failed. Please try again."); };
        recorder.start(250);
        $("record-btn").textContent = "■ Stop recording";
        $("record-btn").classList.add("recording");
        $("record-status").textContent = "Recording...";
    } catch (error) {
        cleanupRecorder();
        setError("method-error", error.name === "NotAllowedError" ? "Microphone permission was denied. Allow microphone access and try again." : "Could not start recording.");
    }
}
function stopRecording() { if (recorder && recorder.state !== "inactive") recorder.stop(); }
function cleanupRecorder() {
    recorderStream?.getTracks().forEach(t => t.stop());
    recorderStream = null; recorder = null;
    $("record-btn").textContent = "● Start recording";
    $("record-btn").classList.remove("recording");
}
function handleUpload() {
    uploadedFile = $("audio-file").files?.[0] || null;
    $("upload-name").textContent = uploadedFile ? `${uploadedFile.name} selected` : "";
}
function selectedAudio() {
    if (reportMethod === "record" && recordedBlob) {
        const ext = recordedBlob.type.includes("ogg") ? "ogg" : recordedBlob.type.includes("mp4") ? "mp4" : "webm";
        return new File([recordedBlob], `voice-report.${ext}`, { type: recordedBlob.type || "audio/webm" });
    }
    if (reportMethod === "upload") return uploadedFile;
    return null;
}
function supportedVideoType() {
    const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    return types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
}
async function toggleVideoRecording() {
    if (videoRecorder && videoRecorder.state === "recording") { stopVideoRecording(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        setError("method-error", "Video recording is not supported in this browser. Try Chrome or Edge on HTTPS or localhost."); return;
    }
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
        $("camera-preview").srcObject = videoStream;
        $("camera-preview").classList.remove("hidden");
        videoChunks = []; recordedVideoBlob = null;
        const type = supportedVideoType();
        videoRecorder = type ? new MediaRecorder(videoStream, { mimeType: type }) : new MediaRecorder(videoStream);
        videoRecorder.ondataavailable = e => { if (e.data?.size) videoChunks.push(e.data); };
        videoRecorder.onstop = () => {
            const finalType = videoRecorder?.mimeType || type || "video/webm";
            recordedVideoBlob = new Blob(videoChunks, { type: finalType });
            if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
            recordedVideoUrl = URL.createObjectURL(recordedVideoBlob);
            $("video-record-preview").src = recordedVideoUrl;
            $("video-record-preview").classList.remove("hidden");
            $("video-record-status").textContent = "Video ready. You can review it or record again.";
            cleanupVideoRecorder();
        };
        videoRecorder.onerror = () => { cleanupVideoRecorder(); setError("method-error", "Video recording failed. Please try again."); };
        videoRecorder.start(500);
        $("video-record-btn").textContent = "■ Stop video recording";
        $("video-record-btn").classList.add("recording");
        $("video-record-status").textContent = "Recording video...";
    } catch (error) {
        cleanupVideoRecorder();
        setError("method-error", error.name === "NotAllowedError" ? "Camera or microphone permission was denied. Allow access and try again." : "Could not start the camera. Check that a camera is connected and not being used by another app.");
    }
}
function stopVideoRecording() { if (videoRecorder && videoRecorder.state !== "inactive") videoRecorder.stop(); }
function cleanupVideoRecorder() {
    videoStream?.getTracks().forEach(track => track.stop());
    videoStream = null; videoRecorder = null;
    $("video-record-btn").textContent = "● Start video recording";
    $("video-record-btn").classList.remove("recording");
    $("camera-preview").srcObject = null;
}
function stopCameraPreview() { if (videoStream && (!videoRecorder || videoRecorder.state === "inactive")) cleanupVideoRecorder(); }
function handleVideoUpload() {
    uploadedVideoFile = $("video-file").files?.[0] || null;
    $("video-upload-name").textContent = uploadedVideoFile ? `${uploadedVideoFile.name} selected (${formatFileSize(uploadedVideoFile.size)})` : "";
}
function selectedVideo() {
    if (reportMethod === "video-record" && recordedVideoBlob) {
        const ext = recordedVideoBlob.type.includes("mp4") ? "mp4" : "webm";
        return new File([recordedVideoBlob], `video-report.${ext}`, { type: recordedVideoBlob.type || "video/webm" });
    }
    if (reportMethod === "video-upload") return uploadedVideoFile;
    return null;
}

async function continueToReview() {
    const text = $("report-text").value.trim();
    const audio = selectedAudio();
    const video = selectedVideo();
    if (reportMethod === "text" && !text) return setError("method-error", "Please write your report before continuing.");
    if (reportMethod === "record" && !audio) return setError("method-error", "Please make a recording before continuing.");
    if (reportMethod === "upload" && !audio) return setError("method-error", "Please choose an audio file before continuing.");
    if (reportMethod === "video-record" && !video) return setError("method-error", "Please record a video before continuing.");
    if (reportMethod === "video-upload" && !video) return setError("method-error", "Please choose a video file before continuing.");
    if (video && video.size > 25 * 1024 * 1024) return setError("method-error", "Please choose a video smaller than 25 MB.");

    setError("method-error", "");
    const continueButton = $("report-continue");
    continueButton.disabled = true;

    try {
        let finalText = text;
        const status = $("transcription-status");

        if (audio || video) {
            status.textContent = video
                ? "Extracting speech from your video and converting it to text... Please wait."
                : "Converting your audio to text... Please wait.";
            status.classList.remove("hidden");

            const form = new FormData();
            if (audio) form.append("audio", audio);
            if (video) form.append("video", video);

            const endpoint = video ? "/cases/transcribe-video" : "/cases/transcribe";
            const response = await fetch(`${API_BASE}${endpoint}`, { method: "POST", body: form });
            const data = await json(response);

            if (!response.ok || !data.success) {
                throw new Error(data.message || data.error || `Could not transcribe the ${video ? "video" : "audio"}.`);
            }

            const transcript = String(data.transcript || "").trim();
            if (!transcript) throw new Error(`No speech was detected in the ${video ? "video" : "audio recording"}.`);

            const transcriptLabel = video ? "[Video transcript]" : "[Voice transcript]";
            finalText = text ? `${text}\n\n${transcriptLabel}\n${transcript}` : transcript;
            status.textContent = "✓ Transcript generated. Please review and edit it before submitting.";
        } else {
            status.textContent = "";
            status.classList.add("hidden");
        }

        $("review-text").value = finalText;
        const wrap = $("review-audio-wrap");
        if (audio) {
            wrap.classList.remove("hidden");
            const url = reportMethod === "record" ? recordedUrl : URL.createObjectURL(audio);
            $("review-audio").src = url;
        } else {
            wrap.classList.add("hidden");
            $("review-audio").removeAttribute("src");
        }
        const videoWrap = $("review-video-wrap");
        if (video) {
            videoWrap.classList.remove("hidden");
            $("review-video").src = reportMethod === "video-record" ? recordedVideoUrl : URL.createObjectURL(video);
        } else { videoWrap.classList.add("hidden"); $("review-video").removeAttribute("src"); }
        showScreen(4);
    } catch (error) {
        console.error("Transcription error:", error);
        setError("method-error", error.message);
    } finally {
        continueButton.disabled = false;
    }
}

async function submitVictimReport() {
    const audio = selectedAudio();
    const video = selectedVideo();
    const statement = $("review-text").value.trim();
    if (!ngoSlug || (!statement && !audio && !video)) return;
    $("submit-btn").disabled = true; showScreen(5);
    try {
        const form = new FormData();
        form.append("ngoSlug", ngoSlug);
        form.append("name", $("v-name").value.trim());
        form.append("age", $("v-age").value);
        form.append("gender", $("v-gender").value.trim());
        form.append("phone", $("v-phone").value.trim());
        form.append("address", $("v-address").value.trim());
        form.append("email", $("v-email").value.trim());
        form.append("statement", statement);
        form.append("source", reportMethod);
        if (audio) form.append("audio", audio);
        if (video) form.append("video", video);
        const response = await fetch(`${API_BASE}/cases/submit`, { method:"POST", body:form });
        const data = await json(response);
        if (!response.ok || !data.success) throw new Error(data.message || data.error || "Submission failed.");
        $("case-id-display").textContent = data.caseId;
        showScreen(6);
    } catch (error) {
        alert(error.message); showScreen(4);
    } finally { $("submit-btn").disabled = false; }
}

function authHeaders(extra = {}) {
    const token = localStorage.getItem("ngoToken");
    return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
function showAuthForm(which) {
    ["login-form", "register-form", "reset-form"].forEach(id => $(id)?.classList.toggle("hidden", id !== which));
}
function setupOrg() {
    if (!$("login-form")) return;
    if (new URLSearchParams(location.search).get("verified") === "1") setError("auth-error", "Email verified. You can now sign in.");
    const resetToken = new URLSearchParams(location.search).get("resetToken");
    if (resetToken) { sessionStorage.setItem("ngoResetToken", resetToken); showAuthForm("reset-form"); }
    const token = localStorage.getItem("ngoToken");
    if (token && localStorage.getItem("ngoId")) showOrgPortal();
    $("login-tab").onclick = () => { showAuthForm("login-form"); $("login-tab").classList.add("active"); $("register-tab").classList.remove("active"); };
    $("register-tab").onclick = () => { showAuthForm("register-form"); $("register-tab").classList.add("active"); $("login-tab").classList.remove("active"); };
    $("login-form").onsubmit = login;
    $("register-form").onsubmit = registerNgo;
    $("reset-form").onsubmit = resetNgoPassword;
    $("forgot-password-btn").onclick = forgotNgoPassword;
    $("resend-verification-btn").onclick = resendNgoVerification;
    $("logout-btn").onclick = logout;
    $("copy-link").onclick = async () => { try { await navigator.clipboard.writeText($("unique-link").value); $("copy-link").textContent="Copied"; } catch (_) { setError("auth-error", "Could not copy link."); } };
    $("refresh-cases").onclick = loadOrgCases;
    $("close-detail").onclick = () => $("case-detail").classList.add("hidden");
}
async function apiPost(path, body) {
    const response = await fetch(`${API_BASE}${path}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
    const data = await json(response);
    if (!response.ok || !data.success) throw new Error(data.message || "Request failed.");
    return data;
}
async function login(e) {
    e.preventDefault(); setError("auth-error", "");
    try {
        const d = await apiPost("/ngo/login", { email:$("login-email").value.trim(), password:$("login-password").value });
        saveNgo(d.ngo || {id:d.ngoId,name:d.ngoName,uniqueLink:d.uniqueLink}, d.token);
        showOrgPortal();
    } catch(err) { setError("auth-error", err.message); }
}
async function registerNgo(e) {
    e.preventDefault(); setError("auth-error", "");
    try {
        const d = await apiPost("/ngo/register", { name:$("reg-name").value.trim(), email:$("reg-email").value.trim(), password:$("reg-password").value });
        setError("auth-error", d.message || "Check your email for the verification link.");
        showAuthForm("login-form");
    } catch(err) { setError("auth-error", err.message); }
}
async function forgotNgoPassword() {
    const email = $("login-email").value.trim();
    if (!email) return setError("auth-error", "Enter your email address first.");
    try { const d=await apiPost("/ngo/forgot-password",{email}); setError("auth-error",d.message); }
    catch(e){setError("auth-error",e.message);}
}
async function resendNgoVerification() {
    const email = $("login-email").value.trim();
    if (!email) return setError("auth-error", "Enter your email address first.");
    try { const d=await apiPost("/ngo/resend-verification",{email}); setError("auth-error",d.message); }
    catch(e){setError("auth-error",e.message);}
}
async function resetNgoPassword(e) {
    e.preventDefault();
    const token=sessionStorage.getItem("ngoResetToken");
    try {
        const d=await apiPost("/ngo/reset-password",{token,newPassword:$("reset-password").value});
        sessionStorage.removeItem("ngoResetToken"); history.replaceState({},"",location.pathname);
        setError("auth-error",d.message); showAuthForm("login-form");
    } catch(err){setError("auth-error",err.message);}
}
function saveNgo(ngo, token) {
    localStorage.setItem("ngoId",ngo.id); localStorage.setItem("ngoName",ngo.name);
    localStorage.setItem("uniqueLink",ngo.uniqueLink); localStorage.setItem("ngoToken",token);
}
function showOrgPortal() {
    $("auth-view").classList.add("hidden"); $("portal-view").classList.remove("hidden");
    $("ngo-title").textContent=localStorage.getItem("ngoName")||"Organization";
    const link=localStorage.getItem("uniqueLink")||""; $("unique-link").value=link; $("open-link").href=link; loadOrgCases();
}
function logout() {
    ["ngoId","ngoName","uniqueLink","ngoToken"].forEach(k=>localStorage.removeItem(k)); location.reload();
}
async function loadOrgCases() {
    const id=localStorage.getItem("ngoId"); if(!id) return;
    try {
        const r=await fetch(`${API_BASE}/cases/ngo/${encodeURIComponent(id)}`,{headers:authHeaders()});
        const d=await json(r); if(r.status===401||r.status===403){logout();return;}
        if(!r.ok||!d.success) throw new Error(d.message||"Could not load cases.");
        organizationCases=d.cases||[]; renderCases($("cases-list"),organizationCases); updateStats("total-count","new-count","review-count","resolved-count");
    } catch(err){ $("cases-list").textContent=err.message; }
}
function updateStats(total,newId,reviewId,resolvedId){$(total).textContent=organizationCases.length;$(newId).textContent=organizationCases.filter(c=>c.status==="NEW").length;$(reviewId).textContent=organizationCases.filter(c=>c.status==="IN_REVIEW").length;$(resolvedId).textContent=organizationCases.filter(c=>c.status==="RESOLVED").length;}
function renderCases(container,cases){ if(!cases.length){container.innerHTML="<p>No cases have been submitted yet.</p>";return;} container.innerHTML=cases.map(c=>`<div class="case-item" data-case="${escapeHtml(c.caseId)}"><div class="case-meta"><strong>${escapeHtml(c.caseId)}</strong><span>${escapeHtml(c.source)}</span><span class="badge ${String(c.severity||"").toLowerCase()}">${escapeHtml(c.severity||"Medium")}</span><span class="badge ${String(c.priority||"").toLowerCase()}">${escapeHtml(c.priority||"NORMAL")}</span><span>${escapeHtml(c.status||"NEW")}</span></div><p>${escapeHtml((c.statement||"Voice recording submitted.").slice(0,180))}</p><small>${c.createdAt?new Date(c.createdAt).toLocaleString():""}</small></div>`).join(""); container.querySelectorAll("[data-case]").forEach(el=>el.onclick=()=>openCase(el.dataset.case)); }
async function openCase(caseId){ try{const r=await fetch(`${API_BASE}/cases/${encodeURIComponent(caseId)}`,{headers:authHeaders()});const d=await json(r);if(!r.ok||!d.case)throw new Error(d.message||"Case not found.");selectedCaseId=caseId;const c=d.case;$("detail-id").textContent=c.caseId;$("detail-content").innerHTML=caseDetailHtml(c);$("case-detail").classList.remove("hidden");loadCaseMedia(c);}catch(err){alert(err.message);} }
async function loadCaseMedia(c) {
    for (const [selector, kind] of [["audio[data-case-audio]", "audio"], ["video[data-case-video]", "video"]]) {
        const el = $("detail-content").querySelector(selector);
        if (!el) continue;
        try {
            const response = await fetch(`${API_BASE}/cases/${encodeURIComponent(c.caseId)}/${kind}`, { headers: authHeaders() });
            if (!response.ok) throw new Error(`Could not load ${kind}.`);
            const blob = await response.blob();
            el.src = URL.createObjectURL(blob);
        } catch (error) {
            const note = document.createElement("p"); note.className = "muted"; note.textContent = `${kind === "video" ? "Video" : "Audio"} preview could not be loaded.`; el.replaceWith(note);
        }
    }
}

function caseDetailHtml(c){
    const v=c.victimDetails||{};
    const flags=Array.isArray(c.aiFlags)?c.aiFlags:[];
    const flagHtml = flags.length ? `<div style="margin-top:12px;"><b>AI Flags</b><ul style="margin:7px 0 0 18px;padding:0;">${flags.map(flag=>`<li style="margin-bottom:5px;">${escapeHtml(flag)}</li>`).join("")}</ul></div>` : `<p class="muted" style="margin:8px 0 0;">No specific AI flags were identified.</p>`;
    const priority=String(c.priority||"").trim();
    const priorityHtml=priority?`<div class="case-meta" style="margin-top:8px;">Priority: <span class="badge ${priority.toLowerCase()}">${escapeHtml(priority)}</span></div>`:"";
    return `<div class="detail-grid"><div><b>Name</b><div class="detail-value">${escapeHtml(v.name)}</div></div><div><b>Age</b><div class="detail-value">${escapeHtml(v.age)}</div></div><div><b>Gender</b><div class="detail-value">${escapeHtml(v.gender)}</div></div><div><b>Phone</b><div class="detail-value">${escapeHtml(v.phone)}</div></div><div><b>Email</b><div class="detail-value">${escapeHtml(v.email)}</div></div><div><b>Address</b><div class="detail-value">${escapeHtml(v.address)}</div></div></div><div class="section-box"><b>Statement / reviewed transcript</b><div class="detail-value">${escapeHtml(c.statement||"Voice recording submitted.")}</div></div><div class="section-box"><b>AI-assisted assessment</b><div class="case-meta" style="margin-top:8px;">Severity: <span class="badge ${String(c.severity||"").toLowerCase()}">${escapeHtml(c.severity||"Medium")}</span></div>${priorityHtml}<div style="margin-top:12px;"><b>AI Summary</b><p style="margin:7px 0 0;">${escapeHtml(c.aiSummary||"Assessment not available.")}</p></div>${flagHtml}<p class="muted" style="margin-top:12px;">This is an assessment aid for human review, not a medical or psychological diagnosis.</p></div>${c.audio?.filename?`<div class="section-box"><b>Original audio</b><audio controls class="audio-preview" data-case-audio="${encodeURIComponent(c.caseId)}"></audio><p class="muted" style="margin:6px 0 0;">${escapeHtml(c.audio.originalName||c.audio.filename)} · ${escapeHtml(formatFileSize(c.audio.size||0))}</p></div>`:""}${c.video?.filename?`<div class="section-box"><b>Original video</b><video controls playsinline class="video-preview" data-case-video="${encodeURIComponent(c.caseId)}"></video><p class="muted" style="margin:6px 0 0;">${escapeHtml(c.video.originalName||c.video.filename)} · ${escapeHtml(formatFileSize(c.video.size||0))}</p></div>`:""}<div class="section-box"><b>Status</b><select id="status-select"><option value="NEW" ${c.status==="NEW"?"selected":""}>NEW</option><option value="IN_REVIEW" ${c.status==="IN_REVIEW"?"selected":""}>IN_REVIEW</option><option value="RESOLVED" ${c.status==="RESOLVED"?"selected":""}>RESOLVED</option></select><button class="btn small-btn" id="status-save">Update Status</button><hr><b>Assigned counsellor</b><input id="counsellor-input" value="${escapeHtml(c.counsellor||"")}" placeholder="Counsellor name"><button class="btn small-btn" id="counsellor-save">Save Counsellor</button></div>`
}

async function saveCasePatch(body){const r=await fetch(`${API_BASE}/cases/${encodeURIComponent(selectedCaseId)}`,{headers:authHeaders({"Content-Type":"application/json"}),method:"PATCH",body:JSON.stringify(body)});const d=await json(r);if(!r.ok||!d.success)throw new Error(d.message||"Update failed.");return d.case;}
document.addEventListener("click",async e=>{if(e.target.id==="status-save"){try{await saveCasePatch({status:$("status-select").value});await loadOrgCases();alert("Status updated.");}catch(err){alert(err.message);}}if(e.target.id==="counsellor-save"){try{await saveCasePatch({counsellor:$("counsellor-input").value.trim()});alert("Counsellor updated.");}catch(err){alert(err.message);}}});

function setupDashboard(){if(!$("dashboard-content"))return;const id=localStorage.getItem("ngoId");if(!id){$("dashboard-content").classList.add("hidden");$("dashboard-auth-message").classList.remove("hidden");return;}$("dash-ngo-name").textContent=localStorage.getItem("ngoName")||"Organization Dashboard";$("dash-logout").onclick=logout;$("dash-refresh").onclick=loadDashboardCases;loadDashboardCases();}
async function loadDashboardCases(){const id=localStorage.getItem("ngoId");try{const r=await fetch(`${API_BASE}/cases/ngo/${encodeURIComponent(id)}`,{headers:authHeaders()});const d=await json(r);if(!r.ok||!d.success)throw new Error(d.message||"Could not load cases.");organizationCases=d.cases||[];renderCases($("dash-cases-list"),organizationCases);updateStats("dash-total","dash-new","dash-review","dash-resolved");}catch(err){$("dash-cases-list").innerHTML=`<p>${escapeHtml(err.message)}</p>`;}}

document.addEventListener("DOMContentLoaded",()=>{setupVictim();setupOrg();setupDashboard();});
