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
            ${uploaded ? `<a class="btn small primary" href="${doc.file}" target="_blank" rel="noopener">View</a>` : ""}
          </div>
        </div>`;
    }).join("");
  }

  /* ---------------- data.json: progress + weekly logs ---------------- */
  function renderProgress(completed, target){
    completed = Math.max(0, Number(completed) || 0);
    target = Math.max(1, Number(target) || 1);
    const pct = Math.min(100, Math.round((completed / target) * 100));
    $("progressPct").textContent = pct + "%";
    $("progressFill").style.width = pct + "%";
    $("hoursCompleted").textContent = completed;
    $("hoursTarget").textContent = target;
    $("statCompleted").textContent = completed + " hrs";
    $("statRemaining").textContent = Math.max(0, target - completed) + " hrs";
    $("statTarget").textContent = target + " hrs";
  }

  function escapeHTML(str){
    const d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }

  function renderWeeklyLogs(weeks){
    const list = Array.isArray(weeks) ? weeks.slice() : [];
    list.sort((a,b)=> (a.week||0) - (b.week||0));
    $("weekEmpty").style.display = list.length ? "none" : "block";
    $("weekList").innerHTML = list.map(w=>{
      const imgs = Array.isArray(w.images) ? w.images.map((name,i)=>{
        const src = "images/weekly/" + name;
        return `<img src="${src}" data-src="${src}" alt="Week ${w.week} photo ${i+1}" onerror="this.style.display='none'">`;
      }).join("") : "";
      return `
        <div class="week-card">
          <div class="week-title-row">
            <div class="week-tab"><span class="dot"></span>WEEK ${String(w.week||0).padStart(2,"0")}</div>
            <div class="week-dates">${escapeHTML(w.dates||"")}</div>
          </div>
          <div class="week-tasks">${escapeHTML(w.tasks||"")}</div>
          ${imgs ? `<div class="week-images">${imgs}</div>` : ""}
        </div>`;
    }).join("");
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
    initAvatar();
    initLogo();
    await initDocuments();
    await initDataJSON();
  })();

})();
