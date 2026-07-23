(function(){
  "use strict";

  /* ---------------- storage wrapper ----------------
  const Store = {
    async get(key){
      try{ return window.localStorage.getItem(key); }
      catch(e){ console.error("storage get failed", key, e); return null; }
    },
    async set(key, value){
      try{ window.localStorage.setItem(key, value); return true; }
      catch(e){ console.error("storage set failed", key, e); return false; }
    },
    async del(key){
      try{ window.localStorage.removeItem(key); return true; }
      catch(e){ return false; }
    }
  };

  const $ = (id) => document.getElementById(id);
  let toastTimer = null;
  function toast(msg){
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> t.classList.remove("show"), 2600);
  }

  const state = {
    unlocked: false,
    pinMode: null, // 'create' | 'enter'
    documents: {},
    weekEditingId: null
  };

  const DOC_TYPES = [
    { id:"moa", name:"Memorandum of Agreement" },
    { id:"loe", name:"Letter of Endorsement" },
    { id:"loi", name:"Letter of Intent" },
    { id:"ia",  name:"Internship Agreement" },
    { id:"waiver", name:"Student Waiver" },
    { id:"consent", name:"Consent Form" }
  ];

  const MAX_FILE_BYTES = 4.2 * 1024 * 1024;

  /* ---------------- image compression ---------------- */
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
  function readAsDataURL(file){
    return new Promise((resolve, reject)=>{
      const r = new FileReader();
      r.onload = (e)=> resolve(e.target.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  /* ---------------- theme ---------------- */
  async function initTheme(){
    const saved = await Store.get("theme");
    const theme = saved || "light";
    document.documentElement.setAttribute("data-theme", theme);
    $("themeToggle").textContent = theme === "dark" ? "☀️" : "🌙";
  }
  $("themeToggle").addEventListener("click", async ()=>{
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    $("themeToggle").textContent = next === "dark" ? "☀️" : "🌙";
    await Store.set("theme", next);
  });

  /* ---------------- edit lock ---------------- */
  function setUnlocked(v){
    state.unlocked = v;
    document.body.classList.toggle("editing", v);
    const btn = $("editToggle");
    btn.classList.toggle("unlocked", v);
    btn.textContent = v ? "🔓 Editing" : "🔒 View only";
    [ "fieldName","fieldRole","fieldSchool","fieldCompany","hoursCompleted","hoursTarget" ]
      .forEach(id => $(id).disabled = !v);
  }

  $("editToggle").addEventListener("click", async ()=>{
    if (state.unlocked){ setUnlocked(false); toast("Editing locked."); return; }
    const existingPin = await Store.get("edit-pin");
    state.pinMode = existingPin ? "enter" : "create";
    openPinModal();
  });

  function openPinModal(){
    $("pinError").textContent = "";
    $("pinInput").value = "";
    $("pinConfirmInput").value = "";
    if (state.pinMode === "create"){
      $("pinTitle").textContent = "Create an edit PIN";
      $("pinSubtitle").textContent = "Set a PIN so only you can edit this page. This is a light client-side lock, not encryption — don't reuse a sensitive password.";
      $("pinConfirmInput").style.display = "block";
    } else {
      $("pinTitle").textContent = "Unlock editing";
      $("pinSubtitle").textContent = "Enter your PIN to edit this page.";
      $("pinConfirmInput").style.display = "none";
    }
    $("pinModal").classList.remove("hidden");
    $("pinInput").focus();
  }
  $("pinCancelBtn").addEventListener("click", ()=> $("pinModal").classList.add("hidden"));
  $("pinModal").addEventListener("click", (e)=>{ if (e.target.id === "pinModal") $("pinModal").classList.add("hidden"); });

  $("pinSubmitBtn").addEventListener("click", async ()=>{
    const val = $("pinInput").value.trim();
    if (val.length < 4){ $("pinError").textContent = "PIN must be at least 4 characters."; return; }
    if (state.pinMode === "create"){
      const confirmVal = $("pinConfirmInput").value.trim();
      if (val !== confirmVal){ $("pinError").textContent = "PINs don't match."; return; }
      const ok = await Store.set("edit-pin", val);
      if (!ok){ $("pinError").textContent = "Couldn't save PIN. Try again."; return; }
      $("pinModal").classList.add("hidden");
      setUnlocked(true);
      toast("PIN created. Editing unlocked.");
    } else {
      const saved = await Store.get("edit-pin");
      if (val !== saved){ $("pinError").textContent = "Incorrect PIN."; return; }
      $("pinModal").classList.add("hidden");
      setUnlocked(true);
      toast("Editing unlocked.");
    }
  });
  $("pinInput").addEventListener("keydown", (e)=>{ if (e.key === "Enter" && state.pinMode === "enter") $("pinSubmitBtn").click(); });

  /* ---------------- profile ---------------- */
  async function initProfile(){
    const saved = await Store.get("profile");
    if (saved){
      try{
        const p = JSON.parse(saved);
        if (p.name) $("fieldName").value = p.name;
        if (p.role) $("fieldRole").value = p.role;
        if (p.school) $("fieldSchool").value = p.school;
        if (p.company) $("fieldCompany").value = p.company;
        if (p.avatar){
          $("avatarImg").src = p.avatar;
          $("avatarImg").style.display = "block";
          $("avatarInitials").style.display = "none";
        }
      }catch(e){}
    }
    updateInitials();
    updateBrandMark();
  }
  function updateInitials(){
    const name = $("fieldName").value.trim();
    const parts = name.split(/\s+/).filter(Boolean);
    const initials = parts.length ? (parts[0][0] + (parts[parts.length-1][0]||"")).toUpperCase() : "?";
    $("avatarInitials").textContent = initials;
  }
  function updateBrandMark(){
    document.querySelector(".brand-mark").textContent = $("avatarInitials").textContent;
  }
  async function saveProfile(){
    const p = {
      name: $("fieldName").value.trim(),
      role: $("fieldRole").value.trim(),
      school: $("fieldSchool").value.trim(),
      company: $("fieldCompany").value.trim(),
      avatar: $("avatarImg").style.display === "block" ? $("avatarImg").src : null
    };
    await Store.set("profile", JSON.stringify(p));
    updateInitials();
    updateBrandMark();
  }
  ["fieldName","fieldRole","fieldSchool","fieldCompany"].forEach(id=>{
    $(id).addEventListener("change", saveProfile);
  });
  $("avatarUploadBtn").addEventListener("click", ()=> $("avatarInput").click());
  $("avatarInput").addEventListener("change", async (e)=>{
    const file = e.target.files[0];
    if (!file) return;
    try{
      const dataUrl = await compressImage(file, 500, 0.8);
      $("avatarImg").src = dataUrl;
      $("avatarImg").style.display = "block";
      $("avatarInitials").style.display = "none";
      await saveProfile();
      toast("Profile photo updated.");
    }catch(err){ toast("Couldn't process that image."); }
    e.target.value = "";
  });

  /* ---------------- company logo ---------------- */
  async function initCompanyLogo(){
    const saved = await Store.get("company-logo");
    if (saved){
      $("logoImg").src = saved;
      $("logoImg").style.display = "block";
      $("logoPlaceholder").style.display = "none";
    }
  }
  $("logoUploadBtn").addEventListener("click", ()=> $("logoInput").click());
  $("logoInput").addEventListener("change", async (e)=>{
    const file = e.target.files[0];
    if (!file) return;
    try{
      const dataUrl = await compressImage(file, 400, 0.85);
      const ok = await Store.set("company-logo", dataUrl);
      if (!ok){ toast("Couldn't save the logo."); return; }
      $("logoImg").src = dataUrl;
      $("logoImg").style.display = "block";
      $("logoPlaceholder").style.display = "none";
      toast("Company logo updated.");
    }catch(err){ toast("Couldn't process that image."); }
    e.target.value = "";
  });

  /* ---------------- documents ---------------- */
  function docCardHTML(doc, data){
    const uploaded = !!data;
    const statusClass = uploaded ? "on" : "off";
    const statusText = uploaded ? "Uploaded" : "Not uploaded";
    const meta = uploaded ? `${data.fileName} · ${new Date(data.uploadedAt).toLocaleDateString()}` : "Awaiting file";
    return `
      <div class="doc-card" data-doc="${doc.id}">
        <div class="doc-top">
          <div class="doc-name">${doc.name}</div>
          <div class="doc-status ${statusClass}">${statusText}</div>
        </div>
        <div class="doc-meta">${meta}</div>
        <div class="doc-actions">
          ${uploaded ? `<button class="btn small" data-action="view" data-doc="${doc.id}">View</button>` : ""}
          <button class="btn small primary eo" data-action="upload" data-doc="${doc.id}">${uploaded ? "Replace" : "Upload"}</button>
          ${uploaded ? `<button class="btn small ghost-danger eo" data-action="remove" data-doc="${doc.id}">Remove</button>` : ""}
        </div>
      </div>`;
  }
  async function initDocuments(){
    const grid = $("docGrid");
    for (const doc of DOC_TYPES){
      const raw = await Store.get("document:" + doc.id);
      state.documents[doc.id] = raw ? JSON.parse(raw) : null;
    }
    renderDocuments();
  }
  function renderDocuments(){
    $("docGrid").innerHTML = DOC_TYPES.map(doc => docCardHTML(doc, state.documents[doc.id])).join("");
  }
  $("docGrid").addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const docId = btn.dataset.doc;
    const action = btn.dataset.action;
    const data = state.documents[docId];
    if (action === "view" && data){
      if (data.mime && data.mime.startsWith("image/")){
        $("lightboxImg").src = data.dataUrl;
        $("lightbox").classList.remove("hidden");
      } else {
        const w = window.open();
        if (w) { w.document.write(`<title>${data.fileName}</title><iframe src="${data.dataUrl}" style="border:none;width:100%;height:100vh;"></iframe>`); }
        else { toast("Allow pop-ups to view this document."); }
      }
    } else if (action === "upload"){
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,.doc,.docx,image/*";
      input.addEventListener("change", async ()=>{
        const file = input.files[0];
        if (!file) return;
        if (file.size > MAX_FILE_BYTES){ toast("File is too large (max ~4MB). Try a smaller scan."); return; }
        try{
          let dataUrl;
          if (file.type.startsWith("image/")) dataUrl = await compressImage(file, 1600, 0.78);
          else dataUrl = await readAsDataURL(file);
          const record = { fileName:file.name, mime:file.type || "application/octet-stream", dataUrl, uploadedAt:new Date().toISOString() };
          const ok = await Store.set("document:" + docId, JSON.stringify(record));
          if (!ok){ toast("Couldn't save that file — it may be too large."); return; }
          state.documents[docId] = record;
          renderDocuments();
          toast(DOC_TYPES.find(d=>d.id===docId).name + " uploaded.");
        }catch(err){ toast("Couldn't process that file."); }
      });
      input.click();
    } else if (action === "remove"){
      if (!confirm("Remove this document?")) return;
      Store.del("document:" + docId).then(()=>{
        state.documents[docId] = null;
        renderDocuments();
        toast("Document removed.");
      });
    }
  });

  /* ---------------- progress ---------------- */
  function renderProgress(){
    const completed = Math.max(0, parseInt($("hoursCompleted").value, 10) || 0);
    const target = Math.max(1, parseInt($("hoursTarget").value, 10) || 1);
    const pct = Math.min(100, Math.round((completed / target) * 100));
    $("progressPct").textContent = pct + "%";
    $("progressFill").style.width = pct + "%";
    $("statCompleted").textContent = completed + " hrs";
    $("statRemaining").textContent = Math.max(0, target - completed) + " hrs";
    $("statTarget").textContent = target + " hrs";
  }
  async function initProgress(){
    const saved = await Store.get("progress");
    if (saved){
      try{
        const p = JSON.parse(saved);
        if (p.completed !== undefined) $("hoursCompleted").value = p.completed;
        if (p.target !== undefined) $("hoursTarget").value = p.target;
      }catch(e){}
    }
    renderProgress();
  }
  async function saveProgress(){
    renderProgress();
    await Store.set("progress", JSON.stringify({
      completed: parseInt($("hoursCompleted").value,10) || 0,
      target: parseInt($("hoursTarget").value,10) || 1
    }));
  }
  $("hoursCompleted").addEventListener("change", saveProgress);
  $("hoursTarget").addEventListener("change", saveProgress);

  /* ---------------- weekly logs ---------------- */
  let weekIndex = []; // array of ids
  let weekEntries = {}; // id -> entry

  async function initWeeklyLogs(){
    const idxRaw = await Store.get("weeklog-index");
    weekIndex = idxRaw ? JSON.parse(idxRaw) : [];
    for (const id of weekIndex){
      const raw = await Store.get("weeklog:" + id);
      if (raw) weekEntries[id] = JSON.parse(raw);
    }
    weekIndex = weekIndex.filter(id => weekEntries[id]);
    renderWeeklyLogs();
  }
  function renderWeeklyLogs(){
    const sorted = weekIndex.slice().sort((a,b)=> (weekEntries[a].weekNumber||0) - (weekEntries[b].weekNumber||0));
    $("weekEmpty").style.display = sorted.length ? "none" : "block";
    $("weekList").innerHTML = sorted.map(id=>{
      const w = weekEntries[id];
      const imgs = (w.images||[]).map((src,i)=> `<img src="${src}" data-src="${src}" alt="Week ${w.weekNumber} photo ${i+1}">`).join("");
      return `
        <div class="week-card" data-id="${id}">
          <div class="week-title-row">
            <div class="week-tab"><span class="dot"></span>WEEK ${String(w.weekNumber).padStart(2,"0")}</div>
            <div class="week-dates">${w.dateRange || ""}</div>
          </div>
          <div class="week-tasks">${escapeHTML(w.tasks || "")}</div>
          ${imgs ? `<div class="week-images">${imgs}</div>` : ""}
          <div class="week-actions eo-flex">
            <button class="btn small" data-action="edit-week" data-id="${id}">Edit</button>
            <button class="btn small ghost-danger" data-action="delete-week" data-id="${id}">Delete</button>
          </div>
        </div>`;
    }).join("");
  }
  function escapeHTML(str){
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  $("weekList").addEventListener("click", (e)=>{
    const img = e.target.closest("img[data-src]");
    if (img){ $("lightboxImg").src = img.dataset.src; $("lightbox").classList.remove("hidden"); return; }
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === "edit-week") openWeekForm(id);
    if (btn.dataset.action === "delete-week"){
      if (!confirm("Delete this week's log?")) return;
      deleteWeek(id);
    }
  });

  function nextWeekNumber(){
    const nums = weekIndex.map(id => weekEntries[id].weekNumber || 0);
    return nums.length ? Math.max(...nums) + 1 : 1;
  }
  function openWeekForm(editId){
    state.weekEditingId = editId || null;
    $("weekFormError").textContent = "";
    $("weekImages").value = "";
    if (editId){
      const w = weekEntries[editId];
      $("weekNumber").value = w.weekNumber;
      $("weekDates").value = w.dateRange || "";
      $("weekTasks").value = w.tasks || "";
    } else {
      $("weekNumber").value = nextWeekNumber();
      $("weekDates").value = "";
      $("weekTasks").value = "";
    }
    $("weekForm").classList.add("open");
    $("weekForm").scrollIntoView({behavior:"smooth", block:"center"});
  }
  $("addWeekBtn").addEventListener("click", ()=> openWeekForm(null));
  $("weekCancelBtn").addEventListener("click", ()=>{
    $("weekForm").classList.remove("open");
    state.weekEditingId = null;
  });

  $("weekSaveBtn").addEventListener("click", async ()=>{
    const weekNumber = parseInt($("weekNumber").value, 10);
    const dateRange = $("weekDates").value.trim();
    const tasks = $("weekTasks").value.trim();
    if (!weekNumber || weekNumber < 1){ $("weekFormError").textContent = "Enter a valid week number."; return; }
    if (!tasks){ $("weekFormError").textContent = "Add a short description of your tasks."; return; }

    const id = state.weekEditingId || ("w" + Date.now());
    let images = (state.weekEditingId && weekEntries[id] && weekEntries[id].images) || [];

    const files = Array.from($("weekImages").files || []);
    if (files.length){
      $("weekSaveBtn").disabled = true;
      $("weekSaveBtn").textContent = "Saving...";
      try{
        const compressed = await Promise.all(files.slice(0,6).map(f => compressImage(f, 1000, 0.7)));
        images = images.concat(compressed);
      }catch(err){
        $("weekFormError").textContent = "Couldn't process one of the images.";
        $("weekSaveBtn").disabled = false; $("weekSaveBtn").textContent = "Save week";
        return;
      }
    }

    const record = { id, weekNumber, dateRange, tasks, images };
    const ok = await Store.set("weeklog:" + id, JSON.stringify(record));
    $("weekSaveBtn").disabled = false; $("weekSaveBtn").textContent = "Save week";
    if (!ok){ $("weekFormError").textContent = "Couldn't save — this week's photos may be too large together."; return; }

    weekEntries[id] = record;
    if (!weekIndex.includes(id)){
      weekIndex.push(id);
      await Store.set("weeklog-index", JSON.stringify(weekIndex));
    }
    $("weekForm").classList.remove("open");
    state.weekEditingId = null;
    renderWeeklyLogs();
    toast("Week saved.");
  });

  async function deleteWeek(id){
    await Store.del("weeklog:" + id);
    weekIndex = weekIndex.filter(x => x !== id);
    delete weekEntries[id];
    await Store.set("weeklog-index", JSON.stringify(weekIndex));
    renderWeeklyLogs();
    toast("Week deleted.");
  }

  /* ---------------- lightbox ---------------- */
  $("lightboxClose").addEventListener("click", ()=> $("lightbox").classList.add("hidden"));
  $("lightbox").addEventListener("click", (e)=>{ if (e.target.id === "lightbox") $("lightbox").classList.add("hidden"); });

  /* ---------------- boot ---------------- */
  (async function boot(){
    await initTheme();
    await initProfile();
    await initCompanyLogo();
    await initDocuments();
    await initProgress();
    await initWeeklyLogs();
  })();

})();
