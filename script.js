(function(){
  "use strict";

  const $ = (id) => document.getElementById(id);
  let toastTimer = null;
  function toast(msg){
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> t.classList.remove("show"), 3200);
  }

  /* ---------------- GitHub connection (commits data.json & photos for you) ---------------- */
  const GH = {
    key: "gh-config",
    getConfig(){
      try{ const raw = window.localStorage.getItem(this.key); return raw ? JSON.parse(raw) : null; }
      catch(e){ return null; }
    },
    setConfig(cfg){ window.localStorage.setItem(this.key, JSON.stringify(cfg)); },
    clearConfig(){ window.localStorage.removeItem(this.key); },
    isConfigured(){
      const c = this.getConfig();
      return !!(c && c.owner && c.repo && c.token);
    },
    apiBase(){ const c = this.getConfig(); return `https://api.github.com/repos/${c.owner}/${c.repo}`; },
    branch(){ const c = this.getConfig(); return (c && c.branch) || "main"; },
    headers(){
      const c = this.getConfig();
      return { "Authorization": `Bearer ${c.token}`, "Accept": "application/vnd.github+json" };
    },
    encode(str){ return btoa(unescape(encodeURIComponent(str))); },
    decode(b64){ return decodeURIComponent(escape(atob(b64.replace(/\n/g, "")))); },
    async getFile(path){
      const res = await fetch(`${this.apiBase()}/contents/${path}?ref=${encodeURIComponent(this.branch())}&_=${Date.now()}`, { headers: this.headers(), cache: "no-store" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`GitHub couldn't read ${path} (${res.status})`);
      return res.json();
    },
    async putFile(path, contentStr, message, sha){
      const body = { message, content: this.encode(contentStr), branch: this.branch() };
      if (sha) body.sha = sha;
      const res = await fetch(`${this.apiBase()}/contents/${path}`, {
        method: "PUT",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok){
        const t = await res.text().catch(()=> "");
        throw new Error(`GitHub couldn't save ${path} (${res.status}): ${t.slice(0,200)}`);
      }
      return res.json();
    },
    async putBase64File(path, base64Content, message){
      const res = await fetch(`${this.apiBase()}/contents/${path}`, {
        method: "PUT",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ message, content: base64Content, branch: this.branch() })
      });
      if (!res.ok){
        const t = await res.text().catch(()=> "");
        throw new Error(`GitHub couldn't save ${path} (${res.status}): ${t.slice(0,200)}`);
      }
      return res.json();
    }
  };

  function updateGhStatus(){
    const el = $("ghStatus");
    const configured = GH.isConfigured();
    if (configured){
      const c = GH.getConfig();
      el.textContent = `Connected · ${c.owner}/${c.repo}`;
      el.classList.add("connected");
    } else {
      el.textContent = "Not connected";
      el.classList.remove("connected");
    }
  }

  $("settingsBtn").addEventListener("click", ()=>{
    const c = GH.getConfig() || {};
    $("ghOwner").value = c.owner || "";
    $("ghRepo").value = c.repo || "";
    $("ghBranch").value = c.branch || "main";
    $("ghToken").value = c.token || "";
    $("settingsError").textContent = "";
    $("settingsModal").classList.remove("hidden");
  });
  $("settingsModal").addEventListener("click", (e)=>{ if (e.target.id === "settingsModal") $("settingsModal").classList.add("hidden"); });
  $("settingsClearBtn").addEventListener("click", ()=>{
    GH.clearConfig();
    updateGhStatus();
    renderWeeklyLogs(lastWeeklyLogs);
    $("settingsModal").classList.add("hidden");
    toast("Disconnected from GitHub.");
  });
  $("settingsSaveBtn").addEventListener("click", async ()=>{
    const owner = $("ghOwner").value.trim();
    const repo = $("ghRepo").value.trim();
    const branch = $("ghBranch").value.trim() || "main";
    const token = $("ghToken").value.trim();
    if (!owner || !repo || !token){ $("settingsError").textContent = "Fill in owner, repo, and token."; return; }
    $("settingsSaveBtn").disabled = true;
    $("settingsSaveBtn").textContent = "Checking...";
    GH.setConfig({ owner, repo, branch, token });
    try{
      await GH.getFile("data.json");
      updateGhStatus();
      renderWeeklyLogs(lastWeeklyLogs);
      $("settingsModal").classList.add("hidden");
      toast("Connected to GitHub.");
    }catch(err){
      $("settingsError").textContent = err.message || "Couldn't connect — check owner, repo, and token.";
      GH.clearConfig();
      updateGhStatus();
    }finally{
      $("settingsSaveBtn").disabled = false;
      $("settingsSaveBtn").textContent = "Save & connect";
    }
  });

  const DOC_TYPES = [
    { id:"moa", name:"Memorandum of Agreement", file:"documents/moa.pdf" },
    { id:"loe", name:"Letter of Endorsement", file:"documents/loe.pdf" },
    { id:"loi", name:"Letter of Intent", file:"documents/loi.pdf" },
    { id:"ia",  name:"Internship Agreement", file:"documents/internship-agreement.pdf" },
    { id:"waiver", name:"Student Waiver", file:"documents/waiver.pdf" },
    { id:"consent", name:"Consent Form", file:"documents/consent.pdf" }
  ];

  /* ---------------- theme (local, per-browser display preference only) ---------------- */
  function initTheme(){
    let saved = null;
    try{ saved = window.localStorage.getItem("theme"); }catch(e){}
    const theme = saved || "light";
    document.documentElement.setAttribute("data-theme", theme);
    $("themeToggle").textContent = theme === "dark" ? "☀️" : "🌙";
  }
  $("themeToggle").addEventListener("click", ()=>{
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    $("themeToggle").textContent = next === "dark" ? "☀️" : "🌙";
    try{ window.localStorage.setItem("theme", next); }catch(e){}
  });

  /* ---------------- image fallback loader ---------------- */
  function loadImageWithFallback(imgEl, candidates, onFound, onFail){
    let i = 0;
    function tryNext(){
      if (i >= candidates.length){ onFail(); return; }
      imgEl.onerror = tryNext;
      imgEl.onload = onFound;
      imgEl.src = candidates[i++] + "?v=" + Date.now();
    }
    tryNext();
  }

  function initAvatar(){
    loadImageWithFallback(
      $("avatarImg"),
      ["images/profile.jpg","images/profile.jpeg","images/profile.png"],
      ()=>{ $("avatarImg").style.display = "block"; $("avatarInitials").style.display = "none"; },
      ()=>{ /* keep initials */ }
    );
  }
  function initLogo(){
    loadImageWithFallback(
      $("logoImg"),
      ["images/company-logo.png","images/company-logo.jpg","images/company-logo.jpeg"],
      ()=>{ $("logoImg").style.display = "block"; $("logoPlaceholder").style.display = "none"; },
      ()=>{ /* keep placeholder */ }
    );
  }

  /* ---------------- documents: probe /documents for each file ---------------- */
  async function fileExists(url){
    try{
      const res = await fetch(url + "?v=" + Date.now(), { method:"HEAD", cache:"no-store" });
      return res.ok;
    }catch(e){ return false; }
  }
  async function initDocuments(){
    const grid = $("docGrid");
    const results = await Promise.all(DOC_TYPES.map(d => fileExists(d.file)));
    grid.innerHTML = DOC_TYPES.map((doc, i)=>{
      const uploaded = results[i];
      return `
        <div class="doc-card">
          <div class="doc-top">
            <div class="doc-name">${doc.name}</div>
            <div class="doc-status ${uploaded ? "on":"off"}">${uploaded ? "Uploaded" : "Not uploaded"}</div>
          </div>
          <div class="doc-meta">${uploaded ? doc.file : "documents/" + doc.file.split("/")[1]}</div>
          <div class="doc-actions">
            ${uploaded ? `<button class="btn small primary" data-action="view-doc" data-file="${doc.file}" data-name="${doc.name}">View</button>` : ""}
          </div>
        </div>`;
    }).join("");
  }
  $("docGrid").addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-action='view-doc']");
    if (!btn) return;
    openDocModal(btn.dataset.file, btn.dataset.name);
  });
  function openDocModal(file, name){
    $("docModalTitle").textContent = name;
    $("docModalFrame").src = file;
    $("docModalOpenNew").href = file;
    $("docModal").classList.remove("hidden");
  }
  function closeDocModal(){
    $("docModal").classList.add("hidden");
    $("docModalFrame").src = "about:blank";
  }
  $("docModalClose").addEventListener("click", closeDocModal);
  $("docModal").addEventListener("click", (e)=>{ if (e.target.id === "docModal") closeDocModal(); });

  /* ---------------- data.json: progress + weekly logs ---------------- */
  let lastProgress = { completedHours:0, targetHours:300 };

  function animateFillTo(pct){
    const fill = $("progressFill");
    // Two nested rAFs guarantee the browser has actually painted the current
    // width at least once before we change it — without this, a width change
    // that happens synchronously on page load can get collapsed into the very
    // first paint, and the CSS transition never visibly plays.
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        fill.style.width = pct + "%";
      });
    });
  }

  function animateCountUp(el, endValue, suffix){
    const start = parseInt(el.textContent, 10) || 0;
    if (start === endValue){ el.textContent = endValue + suffix; return; }
    const duration = 700;
    const startTime = performance.now();
    function tick(now){
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(start + (endValue - start) * eased) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderProgress(completed, target){
    completed = Math.max(0, Number(completed) || 0);
    target = Math.max(1, Number(target) || 1);
    lastProgress = { completedHours: completed, targetHours: target };
    const pct = Math.min(100, Math.round((completed / target) * 100));
    animateCountUp($("progressPct"), pct, "%");
    animateFillTo(pct);
    $("hoursCompleted").value = completed;
    $("hoursTarget").value = target;
    $("statCompleted").textContent = completed + " hrs";
    $("statRemaining").textContent = Math.max(0, target - completed) + " hrs";
    $("statTarget").textContent = target + " hrs";
  }

  function escapeHTML(str){
    const d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }

  /* ---------------- edit hours (commits to GitHub) ---------------- */
  function setHoursEditing(on){
    $("hoursCompleted").disabled = !on;
    $("hoursTarget").disabled = !on;
    $("editHoursBtn").style.display = on ? "none" : "";
    $("hoursSaveBtn").style.display = on ? "" : "none";
    $("hoursCancelBtn").style.display = on ? "" : "none";
    $("hoursFormError").textContent = "";
  }
  $("editHoursBtn").addEventListener("click", ()=>{
    if (!GH.isConfigured()){
      toast("Connect GitHub first — tap ⚙️ in the top bar.");
      $("settingsBtn").click();
      return;
    }
    setHoursEditing(true);
    $("hoursCompleted").focus();
  });
  $("hoursCancelBtn").addEventListener("click", ()=>{
    renderProgress(lastProgress.completedHours, lastProgress.targetHours);
    setHoursEditing(false);
  });
  $("hoursSaveBtn").addEventListener("click", async ()=>{
    const completed = parseInt($("hoursCompleted").value, 10);
    const target = parseInt($("hoursTarget").value, 10);
    if (isNaN(completed) || completed < 0){ $("hoursFormError").textContent = "Enter a valid number of completed hours."; return; }
    if (isNaN(target) || target < 1){ $("hoursFormError").textContent = "Enter a valid target (at least 1 hour)."; return; }

    $("hoursSaveBtn").disabled = true;
    $("hoursSaveBtn").textContent = "Committing...";
    try{
      await commitDataJSON((data)=>{
        data.progress.completedHours = completed;
        data.progress.targetHours = target;
      }, `Update hours to ${completed}/${target}`);
      setHoursEditing(false);
      toast("Hours updated on GitHub.");
    }catch(err){
      console.error(err);
      $("hoursFormError").textContent = err.message || "Something went wrong committing to GitHub.";
    }finally{
      $("hoursSaveBtn").disabled = false;
      $("hoursSaveBtn").textContent = "Commit";
    }
  });

  let lastWeeklyLogs = [];

  function attachImageRetry(img, attemptsLeft, delayMs){
    img.addEventListener("error", function onErr(){
      if (attemptsLeft > 0){
        attemptsLeft--;
        setTimeout(()=>{ img.src = img.dataset.src + "?retry=" + Date.now(); }, delayMs);
      } else {
        img.removeEventListener("error", onErr);
        img.classList.add("img-unavailable");
      }
    });
  }

  function renderWeeklyLogs(weeks){
    lastWeeklyLogs = Array.isArray(weeks) ? weeks : [];
    const list = lastWeeklyLogs.slice();
    list.sort((a,b)=> (a.week||0) - (b.week||0));
    $("weekEmpty").style.display = list.length ? "none" : "block";
    const canEdit = GH.isConfigured();
    $("weekList").innerHTML = list.map(w=>{
      const imgs = Array.isArray(w.images) ? w.images.map((name,i)=>{
        const src = "images/weekly/" + name;
        return `<img src="${src}" data-src="${src}" alt="Week ${w.week} photo ${i+1}">`;
      }).join("") : "";
      return `
        <div class="week-card" data-week="${w.week}">
          <div class="week-title-row">
            <div class="week-tab"><span class="dot"></span>WEEK ${String(w.week||0).padStart(2,"0")}</div>
            <div class="week-dates">${escapeHTML(w.dates||"")}</div>
          </div>
          <div class="week-tasks"><div class="week-subhead">Tasks</div>${escapeHTML(w.tasks||"")}</div>
          ${w.takeaways ? `<div class="week-takeaways"><div class="week-subhead">Takeaways</div>${escapeHTML(w.takeaways)}</div>` : ""}
          ${imgs ? `<div class="week-images">${imgs}</div>` : ""}
          ${canEdit ? `<div class="week-actions">
            <button class="btn small" data-action="edit-week" data-week="${w.week}">Edit</button>
            <button class="btn small ghost-danger" data-action="delete-week" data-week="${w.week}">Delete</button>
          </div>` : ""}
        </div>`;
    }).join("");
    // Right after committing a new photo, GitHub Pages can take a while to actually
    // start serving it. Rather than silently giving up on the first failed load,
    // retry a few times with a delay before treating it as genuinely missing.
    $("weekList").querySelectorAll("img[data-src]").forEach(img => attachImageRetry(img, 6, 5000));
  }

  async function initDataJSON(){
    try{
      const res = await fetch("data.json?v=" + Date.now(), { cache:"no-store" });
      if (!res.ok) throw new Error("data.json not found (" + res.status + ")");
      const data = await res.json();
      const progress = data.progress || {};
      renderProgress(progress.completedHours, progress.targetHours != null ? progress.targetHours : 300);
      renderWeeklyLogs(data.weeklyLogs || []);
    }catch(err){
      console.error("Couldn't load data.json:", err);
      renderProgress(0, 300);
      renderWeeklyLogs([]);
      toast("Couldn't read data.json — showing defaults. Check the file for a JSON syntax error.");
    }
  }

  /* ---------------- add / edit / delete week (commits to GitHub) ---------------- */
  function nextWeekNumber(){
    const nums = lastWeeklyLogs.map(w => w.week || 0);
    return nums.length ? Math.max(...nums) + 1 : 1;
  }
  function openWeekForm(weekNumber){
    if (!GH.isConfigured()){
      toast("Connect GitHub first — tap ⚙️ in the top bar.");
      $("settingsBtn").click();
      return;
    }
    $("weekFormError").textContent = "";
    $("weekImages").value = "";
    if (weekNumber != null){
      const w = lastWeeklyLogs.find(x => x.week === weekNumber);
      $("weekEditId").value = weekNumber;
      $("weekNumber").value = w ? w.week : weekNumber;
      $("weekDates").value = w ? (w.dates || "") : "";
      $("weekTasks").value = w ? (w.tasks || "") : "";
      $("weekTakeaways").value = w ? (w.takeaways || "") : "";
    } else {
      $("weekEditId").value = "";
      $("weekNumber").value = nextWeekNumber();
      $("weekDates").value = "";
      $("weekTasks").value = "";
      $("weekTakeaways").value = "";
    }
    $("weekForm").classList.add("open");
    $("weekForm").scrollIntoView({ behavior:"smooth", block:"center" });
  }
  $("addWeekBtn").addEventListener("click", ()=> openWeekForm(null));
  $("weekCancelBtn").addEventListener("click", ()=> $("weekForm").classList.remove("open"));

  $("weekList").addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const weekNumber = parseInt(btn.dataset.week, 10);
    if (btn.dataset.action === "edit-week") openWeekForm(weekNumber);
    if (btn.dataset.action === "delete-week"){
      if (confirm(`Delete week ${weekNumber}? This commits the removal to GitHub.`)) deleteWeek(weekNumber);
    }
  });

  async function commitDataJSON(mutatorFn, message){
    async function attempt(){
      const file = await GH.getFile("data.json");
      let data = file ? JSON.parse(GH.decode(file.content)) : { progress:{ completedHours:0, targetHours:300 }, weeklyLogs:[] };
      if (!data.progress) data.progress = { completedHours:0, targetHours:300 };
      if (!Array.isArray(data.weeklyLogs)) data.weeklyLogs = [];
      mutatorFn(data);
      data.weeklyLogs.sort((a,b)=> (a.week||0) - (b.week||0));
      await GH.putFile("data.json", JSON.stringify(data, null, 2) + "\n", message, file ? file.sha : undefined);
      return data;
    }
    let data;
    try{
      data = await attempt();
    }catch(err){
      // A 409 means the sha we sent is stale (e.g. a previous edit landed a moment
      // ago). Re-fetch the latest version and re-apply the same change once more
      // before giving up.
      if (String(err.message).includes("(409)")){
        data = await attempt();
      } else {
        throw err;
      }
    }
    renderProgress(data.progress.completedHours, data.progress.targetHours);
    renderWeeklyLogs(data.weeklyLogs);
  }

  function compressImage(file, maxDim, quality){
    maxDim = maxDim || 1100; quality = quality || 0.72;
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = (e)=>{
        const img = new Image();
        img.onload = ()=>{
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim){
            if (w > h){ h = Math.round(h * maxDim / w); w = maxDim; }
            else { w = Math.round(w * maxDim / h); h = maxDim; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  $("weekSaveBtn").addEventListener("click", async ()=>{
    const weekNumber = parseInt($("weekNumber").value, 10);
    const dates = $("weekDates").value.trim();
    const tasks = $("weekTasks").value.trim();
    const takeaways = $("weekTakeaways").value.trim();
    const editRaw = $("weekEditId").value;
    const originalNumber = editRaw === "" ? null : parseInt(editRaw, 10);
    if (!weekNumber || weekNumber < 1){ $("weekFormError").textContent = "Enter a valid week number."; return; }
    if (!tasks){ $("weekFormError").textContent = "Add a short description of your tasks."; return; }

    $("weekSaveBtn").disabled = true;
    $("weekFormError").textContent = "";
    $("weekSaveBtn").textContent = "Uploading...";

    try{
      const existing = originalNumber != null ? lastWeeklyLogs.find(w => w.week === originalNumber) : null;
      let images = (existing && Array.isArray(existing.images)) ? existing.images.slice() : [];

      const files = Array.from($("weekImages").files || []).slice(0, 12);
      for (let i = 0; i < files.length; i++){
        const dataUrl = await compressImage(files[i], 1000, 0.7);
        const base64 = dataUrl.split(",")[1];
        const filename = `week${weekNumber}-${Date.now()}-${i}.jpg`;
        await GH.putBase64File(`images/weekly/${filename}`, base64, `Add photo for week ${weekNumber}`);
        images.push(filename);
      }

      $("weekSaveBtn").textContent = "Committing...";
      const entry = { week: weekNumber, dates, tasks, takeaways, images };
      await commitDataJSON((data)=>{
        if (originalNumber != null){
          data.weeklyLogs = data.weeklyLogs.filter(w => w.week !== originalNumber);
        }
        data.weeklyLogs = data.weeklyLogs.filter(w => w.week !== weekNumber);
        data.weeklyLogs.push(entry);
      }, originalNumber != null ? `Update week ${weekNumber}` : `Add week ${weekNumber}`);

      $("weekForm").classList.remove("open");
      toast(originalNumber != null ? "Week updated on GitHub." : "Week committed to GitHub.");
    }catch(err){
      console.error(err);
      $("weekFormError").textContent = err.message || "Something went wrong committing to GitHub.";
    }finally{
      $("weekSaveBtn").disabled = false;
      $("weekSaveBtn").textContent = "Commit to GitHub";
    }
  });

  async function deleteWeek(weekNumber){
    try{
      await commitDataJSON((data)=>{
        data.weeklyLogs = data.weeklyLogs.filter(w => w.week !== weekNumber);
      }, `Delete week ${weekNumber}`);
      toast("Week deleted on GitHub.");
    }catch(err){
      console.error(err);
      toast("Couldn't delete — " + (err.message || "GitHub error."));
    }
  }

  /* ---------------- lightbox ---------------- */
  $("weekList") && document.addEventListener("click", (e)=>{
    const img = e.target.closest("img[data-src]");
    if (!img) return;
    $("lightboxImg").src = img.dataset.src;
    $("lightbox").classList.remove("hidden");
  });
  $("lightboxClose").addEventListener("click", ()=> $("lightbox").classList.add("hidden"));
  $("lightbox").addEventListener("click", (e)=>{ if (e.target.id === "lightbox") $("lightbox").classList.add("hidden"); });

  /* ---------------- boot ---------------- */
  (async function boot(){
    initTheme();
    updateGhStatus();
    initAvatar();
    initLogo();
    await initDocuments();
    await initDataJSON();
  })();

})();
