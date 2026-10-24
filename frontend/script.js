const API_BASE = "http://localhost:5004/api";

let ngoSlug = "";
let reportMethod = "";
let recordedBlob = null;
let recordedUrl = null;
let uploadedFile = null;
let recorder = null;
let recorderStream = null;
let chunks = [];
let organizationCases = [];
let selectedCaseId = null;

let videoRecordedBlob = null;
let videoRecordedUrl = null;
let videoRecorder = null;
let videoRecorderStream = null;
let videoChunks = [];

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

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function setError(id, message) { 
    const el = $(id); 
    if (!el) return; 
    el.textContent = message || ""; 
}

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
    
    const videoBtn = $("video-record-btn");
    if (videoBtn) videoBtn.addEventListener("click", toggleVideoRecording);

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
    
    const videoPanel = $("method-video");
    if (videoPanel) videoPanel.classList.toggle("hidden", method !== "video");

    setError("method-error", "");
    if (method !== "record" && recorder && recorder.state !== "inactive") stopRecording();
    if (method !== "video" && videoRecorder && videoRecorder.state !== "inactive") stopVideoRecording();
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
        setError("method-error", error.name === "NotAllowedError" ? "Microphone permission was denied." : "Could not start recording.");
    }
}

function stopRecording() { if (recorder && recorder.state !== "inactive") recorder.stop(); }

function cleanupRecorder() {
    recorderStream?.getTracks().forEach(t => t.stop());
    recorderStream = null; recorder = null;
    $("record-btn").textContent = "● Start recording";
    $("record-btn").classList.remove("recording");
}

async function toggleVideoRecording() {
    if (videoRecorder && videoRecorder.state === "recording") {
        stopVideoRecording();
        return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        setError("method-error", "Your browser does not support video recording.");
        return;
    }
    try {
        videoRecorderStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const preview = $("video-preview");
        if (preview) {
            preview.srcObject = videoRecorderStream;
            preview.muted = true;
        }

        videoChunks = [];
        videoRecordedBlob = null;
        
        const videoTypes = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
        const vType = videoTypes.find(t => MediaRecorder.isTypeSupported(t)) || "";
        videoRecorder = vType ? new MediaRecorder(videoRecorderStream, { mimeType: vType }) : new MediaRecorder(videoRecorderStream);

        videoRecorder.ondataavailable = e => { if (e.data?.size) videoChunks.push(e.data); };

        videoRecorder.onstop = () => {
            // Force strict video/webm type so browser reads duration correctly
            videoRecordedBlob = new Blob(videoChunks, { type: 'video/webm' });
            if (videoRecordedUrl) URL.revokeObjectURL(videoRecordedUrl);
            videoRecordedUrl = URL.createObjectURL(videoRecordedBlob);
            
            const playback = $("video-playback");
            if (playback) {
                playback.src = videoRecordedUrl;
                playback.classList.remove("hidden");
                playback.load();
            }
            $("video-record-status").textContent = "Video recorded successfully! Click Continue to Review.";
            cleanupVideoRecorder();
        };

        videoRecorder.onerror = () => {
            cleanupVideoRecorder();
            setError("method-error", "Video recording failed. Please try again.");
        };
        videoRecorder.start(250);
        const vBtn = $("video-record-btn");
        if (vBtn) {
            vBtn.textContent = "■ Stop Video Recording";
            vBtn.classList.add("recording");
        }
        $("video-record-status").textContent = "Recording video...";
    } catch (error) {
        cleanupVideoRecorder();
        setError("method-error", error.name === "NotAllowedError" ? "Camera/Microphone permission was denied." : "Could not start video recording.");
    }
}

function stopVideoRecording() {
    if (videoRecorder && videoRecorder.state !== "inactive") {
        videoRecorder.stop();
    }
}

function cleanupVideoRecorder() {
    videoRecorderStream?.getTracks().forEach(t => t.stop());
    videoRecorderStream = null;
    videoRecorder = null;
    const vBtn = $("video-record-btn");
    if (vBtn) {
        vBtn.textContent = "● Start Video Recording";
        vBtn.classList.remove("recording");
    }
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

function selectedVideo() {
    if (reportMethod === "video" && videoRecordedBlob) {
        return new File([videoRecordedBlob], `video-report.webm`, { type: videoRecordedBlob.type || "video/webm" });
    }
    return null;
}

async function continueToReview() {
    const text = $("report-text").value.trim();
    const audio = selectedAudio();
    const videoFile = selectedVideo();

    if (reportMethod === "text" && !text) return setError("method-error", "Please write your report before continuing.");
    if (reportMethod === "record" && !audio) return setError("method-error", "Please make a recording before continuing.");
    if (reportMethod === "upload" && !audio) return setError("method-error", "Please choose an audio file before continuing.");
    if (reportMethod === "video" && !videoFile) return setError("method-error", "Please record your video before continuing.");

    setError("method-error", "");
    const continueButton = $("report-continue");
    continueButton.disabled = true;

    try {
        let finalText = text;
        const status = $("transcription-status");

        if (reportMethod === "video" && videoFile) {
            status.textContent = "Converting video speech to text... Please wait.";
            status.classList.remove("hidden");

            const form = new FormData();
            form.append("file", videoFile);
            
            try {
                const response = await fetch(`${API_BASE}/cases/transcribe`, { method: "POST", body: form });
                const data = await json(response);

                if (response.ok && data.success && data.transcript) {
                    finalText = text ? `${text}\n\n[Video transcript]\n${data.transcript}` : data.transcript;
                    status.textContent = "✓ Video transcript generated. Please review and edit it before submitting.";
                } else {
                    finalText = text || "[Video Report Submitted]";
                    status.textContent = "Video attached. Proceeding to review.";
                }
            } catch (err) {
                console.warn("Transcription fallback:", err);
                finalText = text || "[Video Report Submitted]";
                status.textContent = "Video attached. Proceeding to review.";
            }
        } else if (audio) {
            status.textContent = "Converting your audio to text... Please wait.";
            status.classList.remove("hidden");

            const form = new FormData();
            form.append("file", audio);
            
            try {
                const response = await fetch(`${API_BASE}/cases/transcribe`, { method: "POST", body: form });
                const data = await json(response);

                if (response.ok && data.success && data.transcript) {
                    finalText = text ? `${text}\n\n[Voice transcript]\n${data.transcript}` : data.transcript;
                    status.textContent = "✓ Transcript generated. Please review and edit it before submitting.";
                } else {
                    finalText = text || "Audio recording submitted.";
                    status.textContent = "Audio attached. Proceeding to review.";
                }
            } catch (err) {
                console.warn("Audio transcription fallback:", err);
                finalText = text || "Audio recording submitted.";
                status.textContent = "Audio attached. Proceeding to review.";
            }
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
        if (videoFile) {
            videoWrap.classList.remove("hidden");
            const videoElement = $("review-video");
            if (videoRecordedUrl) {
                videoElement.src = videoRecordedUrl;
            } else if (videoRecordedBlob) {
                videoElement.src = URL.createObjectURL(videoRecordedBlob);
            }
            videoElement.load();
        } else {
            videoWrap.classList.add("hidden");
            $("review-video").removeAttribute("src");
        }

        showScreen(4);
    } catch (error) {
        console.error("Review error:", error);
        setError("method-error", error.message);
    } finally {
        continueButton.disabled = false;
    }
}

async function submitVictimReport() {
    const audio = selectedAudio();
    const videoFile = selectedVideo();
    const statement = $("review-text").value.trim();
    if (!ngoSlug || (!statement && !audio && !videoFile)) return;

    $("submit-btn").disabled = true; 
    showScreen(5);

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
        if (videoFile) form.append("video", videoFile);

        const response = await fetch(`${API_BASE}/cases/submit`, { method:"POST", body:form });
        const data = await json(response);
        if (!response.ok || !data.success) throw new Error(data.message || data.error || "Submission failed.");
        $("case-id-display").textContent = data.caseId;
        showScreen(6);
    } catch (error) {
        alert(error.message); 
        showScreen(4);
    } finally { 
        $("submit-btn").disabled = false; 
    }
}

function setupOrg() {
    const loginTab = $("login-tab");
    const registerTab = $("register-tab");
    const loginForm = $("login-form");
    const registerForm = $("register-form");
    
    if (!loginTab || !registerForm) return;

    const savedId = localStorage.getItem("ngoId");
    if (savedId) showOrgPortal();

    loginTab.addEventListener("click", (e) => {
        e.preventDefault();
        loginForm.classList.remove("hidden");
        registerForm.classList.add("hidden");
        loginTab.classList.add("active");
        registerTab.classList.remove("active");
        setError("auth-error", "");
    });

    registerTab.addEventListener("click", (e) => {
        e.preventDefault();
        registerForm.classList.remove("hidden");
        loginForm.classList.add("hidden");
        registerTab.classList.add("active");
        loginTab.classList.remove("active");
        setError("auth-error", "");
    });

    if (loginForm) loginForm.onsubmit = e => login(e);
    if (registerForm) registerForm.onsubmit = e => registerNgo(e);
    
    const logoutBtn = $("logout-btn");
    if (logoutBtn) logoutBtn.onclick = logout;
    
    const copyLink = $("copy-link");
    if (copyLink) copyLink.onclick = async () => { 
        await navigator.clipboard.writeText($("unique-link").value); 
        copyLink.textContent = "Copied"; 
        setTimeout(() => copyLink.textContent = "Copy", 1200); 
    };
    
    const refreshCases = $("refresh-cases");
    if (refreshCases) refreshCases.onclick = loadOrgCases;
    
    const closeDetail = $("close-detail");
    if (closeDetail) closeDetail.onclick = () => $("case-detail").classList.add("hidden");
}

async function login(e) {
    e.preventDefault(); setError("auth-error", "");
    try { 
        const r = await fetch(`${API_BASE}/ngo/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:$("login-email").value.trim(),password:$("login-password").value}) }); 
        const d = await json(r); 
        if(!r.ok||!d.success) throw new Error(d.message||"Login failed."); 
        saveNgo(d.ngo); 
        showOrgPortal(); 
    } catch(err){ setError("auth-error",err.message); }
}

async function registerNgo(e) {
    e.preventDefault(); setError("auth-error", "");
    try { 
        const r = await fetch(`${API_BASE}/ngo/register`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:$("reg-name").value.trim(),email:$("reg-email").value.trim(),password:$("reg-password").value}) }); 
        const d = await json(r); 
        if(!r.ok||!d.success) throw new Error(d.message||"Registration failed."); 
        saveNgo(d.ngo); 
        showOrgPortal(); 
    } catch(err){ setError("auth-error",err.message); }
}

function saveNgo(ngo){ 
    localStorage.setItem("ngoId",ngo.id); 
    localStorage.setItem("ngoName",ngo.name); 
    localStorage.setItem("uniqueLink",ngo.uniqueLink); 
}

function showOrgPortal(){
    if ($("auth-view")) $("auth-view").classList.add("hidden"); 
    if ($("portal-view")) $("portal-view").classList.remove("hidden");
    if ($("ngo-title")) $("ngo-title").textContent=localStorage.getItem("ngoName")||"Organization"; 
    const link=localStorage.getItem("uniqueLink")||""; 
    if ($("unique-link")) $("unique-link").value=link; 
    if ($("open-link")) $("open-link").href=link; 
    loadOrgCases();
}

function logout(){ localStorage.clear(); location.reload(); }

async function loadOrgCases(){
    const id=localStorage.getItem("ngoId"); if(!id) return;
    try { 
        const r=await fetch(`${API_BASE}/cases/ngo/${encodeURIComponent(id)}`); 
        const d=await json(r); 
        if(!r.ok||!d.success) throw new Error(d.message||"Could not load cases."); 
        organizationCases=d.cases||[]; 
        renderCases($("cases-list"),organizationCases); 
        updateStats("total-count","new-count","review-count","resolved-count"); 
    } catch(err){ 
        if ($("cases-list")) $("cases-list").innerHTML=`<p>${escapeHtml(err.message)}</p>`; 
    }
}

function updateStats(total,newId,reviewId,resolvedId){
    if ($(total))$(total).textContent=organizationCases.length;
    if ($(newId))$(newId).textContent=organizationCases.filter(c=>c.status==="NEW").length;
    if ($(reviewId))$(reviewId).textContent=organizationCases.filter(c=>c.status==="IN_REVIEW").length;
    if ($(resolvedId))$(resolvedId).textContent=organizationCases.filter(c=>c.status==="RESOLVED").length;
}

function renderCases(container,cases){
    if (!container) return;
    const detail=$("case-detail");
    if(detail && detail.parentElement !== $("portal-view")) $("portal-view").appendChild(detail);
    if(!cases.length){container.innerHTML="<p>No cases have been submitted yet.</p>";return;}
    
    container.innerHTML=cases.map(c=> {
        return `<div class="case-item" data-case="${escapeHtml(c.caseId)}">
            <div class="case-meta">
                <strong>${escapeHtml(c.caseId)}</strong>
                <span>${escapeHtml(c.source)}</span>
                <span class="badge ${String(c.severity||"").toLowerCase()}">${escapeHtml(c.severity||"Medium")}</span>
                <span class="badge ${String(c.priority||"").toLowerCase()}">${escapeHtml(c.priority||"NORMAL")}</span>
                <span>${escapeHtml(c.status||"NEW")}</span>
            </div>
            <p>${escapeHtml((c.statement||"Recording submitted.").slice(0,180))}</p>
            <small>${c.createdAt?new Date(c.createdAt).toLocaleString():""}</small>
        </div>`;
    }).join("");
    
    container.querySelectorAll("[data-case]").forEach(el=>el.onclick=()=>openCase(el.dataset.case));
}

async function openCase(caseId){
    try{
        const r=await fetch(`${API_BASE}/cases/${encodeURIComponent(caseId)}`);
        const d=await json(r);
        if(!r.ok||!d.case) throw new Error(d.message||"Case not found.");
        selectedCaseId=caseId;
        const c=d.case;
        if ($("detail-id")) $("detail-id").textContent=c.caseId;
        if ($("detail-content")) $("detail-content").innerHTML=caseDetailHtml(c);
        const detail=$("case-detail");
        const clickedCase=document.querySelector(`[data-case="${CSS.escape(caseId)}"]`);
        if(clickedCase && detail) clickedCase.insertAdjacentElement("afterend",detail);
        if (detail) detail.classList.remove("hidden");
        requestAnimationFrame(()=>detail?.scrollIntoView({behavior:"smooth",block:"start"}));
    }catch(err){alert(err.message);}
}

function caseDetailHtml(c){
    const v=c.victimDetails||{};
    const flags=Array.isArray(c.aiFlags)?c.aiFlags:[];
    const flagHtml = flags.length ? `<div style="margin-top:12px;"><b>AI Flags</b><ul style="margin:7px 0 0 18px;padding:0;">${flags.map(flag=>`<li style="margin-bottom:5px;">${escapeHtml(flag)}</li>`).join("")}</ul></div>` : `<p class="muted" style="margin:8px 0 0;">No specific AI flags were identified.</p>`;
    const priority=String(c.priority||"").trim();
    const priorityHtml=priority?`<div class="case-meta" style="margin-top:8px;">Priority: <span class="badge ${priority.toLowerCase()}">${escapeHtml(priority)}</span></div>`:"";
    
    const videoBox = c.video?.filename ? `<div class="section-box"><b>Video Report</b><video controls class="audio-preview" style="max-width:100%;" src="${API_BASE}/cases/${encodeURIComponent(c.caseId)}/video"></video><p class="muted" style="margin:6px 0 0;">${escapeHtml(c.video.originalName||c.video.filename)} · ${escapeHtml(formatFileSize(c.video.size||0))}</p></div>` : "";
    const audioBox = c.audio?.filename ? `<div class="section-box"><b>Original audio</b><audio controls class="audio-preview" src="${API_BASE}/cases/${encodeURIComponent(c.caseId)}/audio"></audio><p class="muted" style="margin:6px 0 0;">${escapeHtml(c.audio.originalName||c.audio.filename)} · ${escapeHtml(formatFileSize(c.audio.size||0))}</p></div>` : "";

    return `<div class="detail-grid"><div><b>Name</b><div class="detail-value">${escapeHtml(v.name)}</div></div><div><b>Age</b><div class="detail-value">${escapeHtml(v.age)}</div></div><div><b>Gender</b><div class="detail-value">${escapeHtml(v.gender)}</div></div><div><b>Phone</b><div class="detail-value">${escapeHtml(v.phone)}</div></div><div><b>Email</b><div class="detail-value">${escapeHtml(v.email)}</div></div><div><b>Address</b><div class="detail-value">${escapeHtml(v.address)}</div></div></div><div class="section-box"><b>Statement / reviewed transcript</b><div class="detail-value">${escapeHtml(c.statement||"Recording submitted.")}</div></div><div class="section-box"><b>AI-assisted assessment</b><div class="case-meta" style="margin-top:8px;">Severity: <span class="badge ${String(c.severity||"").toLowerCase()}">${escapeHtml(c.severity||"Medium")}</span></div>${priorityHtml}<div style="margin-top:12px;"><b>AI Summary</b><p style="margin:7px 0 0;">${escapeHtml(c.aiSummary||"Assessment not available.")}</p></div>${flagHtml}<p class="muted" style="margin-top:12px;">This is an assessment aid for human review, not a medical or psychological diagnosis.</p></div>${videoBox}${audioBox}<div class="section-box"><b>Status</b><select id="status-select"><option value="NEW" ${c.status==="NEW"?"selected":""}>NEW</option><option value="IN_REVIEW" ${c.status==="IN_REVIEW"?"selected":""}>IN_REVIEW</option><option value="RESOLVED" ${c.status==="RESOLVED"?"selected":""}>RESOLVED</option></select><button class="btn small-btn" id="status-save">Update Status</button><hr><b>Assigned counsellor</b><input id="counsellor-input" value="${escapeHtml(c.counsellor||"")}" placeholder="Counsellor name"><button class="btn small-btn" id="counsellor-save">Save Counsellor</button></div>`;
}

async function saveCasePatch(body){
    const r=await fetch(`${API_BASE}/cases/${encodeURIComponent(selectedCaseId)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const d=await json(r);
    if(!r.ok||!d.success)throw new Error(d.message||"Update failed.");
    return d.case;
}

document.addEventListener("click",async e=>{
    if(e.target.id==="status-save"){
        try{await saveCasePatch({status:$("status-select").value});await loadOrgCases();alert("Status updated.");}catch(err){alert(err.message);}
    }
    if(e.target.id==="counsellor-save"){
        try{await saveCasePatch({counsellor:$("counsellor-input").value.trim()});alert("Counsellor updated.");}catch(err){alert(err.message);}
    }
});

function setupDashboard(){
    if(!$("dashboard-content"))return;
    const id=localStorage.getItem("ngoId");
    if(!id){
        $("dashboard-content").classList.add("hidden");
        if ($("dashboard-auth-message")) $("dashboard-auth-message").classList.remove("hidden");
        return;
    }
    if ($("dash-ngo-name")) $("dash-ngo-name").textContent=localStorage.getItem("ngoName")||"Organization Dashboard";
    if ($("dash-logout")) $("dash-logout").onclick=logout;
    if ($("dash-refresh")) $("dash-refresh").onclick=loadDashboardCases;
    loadDashboardCases();
}

async function loadDashboardCases(){
    const id=localStorage.getItem("ngoId");
    try{
        const r=await fetch(`${API_BASE}/cases/ngo/${encodeURIComponent(id)}`);
        const d=await json(r);
        if(!r.ok||!d.success) throw new Error(d.message||"Could not load cases.");
        organizationCases=d.cases||[];
        renderCases($("dash-cases-list"),organizationCases);
        updateStats("dash-total","dash-new","dash-review","dash-resolved");
    }catch(err){
        if ($("dash-cases-list")) $("dash-cases-list").innerHTML=`<p>${escapeHtml(err.message)}</p>`;
    }
}

document.addEventListener("DOMContentLoaded",()=>{
    setupVictim();
    setupOrg();
    setupDashboard();
});