const $=id=>document.getElementById(id);
let currentUser=null, direction="en-pl", questions=[], qIndex=0, correct=0, attempted=0, accounts=[];
const storageKey=()=>`wc_${currentUser||"guest"}`;
function getSets(){try{return JSON.parse(localStorage.getItem(storageKey())||"[]")}catch{return[]}}
function saveSets(s){localStorage.setItem(storageKey(),JSON.stringify(s))}
function openLogin(){$("loginModal").classList.remove("hidden");$("loginError").textContent=""}
["loginTop","heroLogin","ctaLogin"].forEach(id=>$(id).addEventListener("click",openLogin));
$("closeModal").onclick=()=>$("loginModal").classList.add("hidden");
$("doLogin").onclick=()=>{
 const u=$("username").value.trim(),p=$("password").value;
 if((u==="admin"&&p==="wordclass")||(u==="uczen1"&&p==="start1")){
 currentUser=u;$("loginModal").classList.add("hidden");$("home").classList.add("hidden");document.querySelectorAll("main,.topbar,footer").forEach(e=>e.classList.add("hidden"));$("app").classList.remove("hidden");
 $("userPill").textContent=u==="admin"?"🛠️ Administrator":"👋 uczeń 1";$("welcomeName").textContent=u==="admin"?"Administrator":"Uczniu";
 document.querySelectorAll(".admin-only").forEach(e=>e.classList.toggle("hidden",u!=="admin"));
 renderSets();renderStats();buildQuestions();
 }else $("loginError").textContent="Nieprawidłowy login lub hasło. Skorzystaj z danych demo poniżej.";
};
$("logout").onclick=()=>{currentUser=null;$("app").classList.add("hidden");document.querySelectorAll("main,.topbar,footer").forEach(e=>e.classList.remove("hidden"));};
document.querySelectorAll(".side-link").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>showTab(b.dataset.goto));
function showTab(tab){document.querySelectorAll(".tab-panel").forEach(p=>p.classList.add("hidden"));$("tab-"+tab).classList.remove("hidden");document.querySelectorAll(".side-link").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));if(tab==="notebook")renderSets();if(tab==="progress")renderStats();}
$("wordInput").addEventListener("input",()=>{let n=$("wordInput").value.split(/\r?\n/).filter(x=>x.trim()).length;$("wordCount").textContent=`${n} / 100`; $("wordCount").style.color=n>100?"#d34c75":"";});
$("saveWords").onclick=()=>{
 const lines=$("wordInput").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!lines.length){$("noteMessage").textContent="Wklej najpierw słówka.";return}
 if(lines.length>100){$("noteMessage").textContent="Możesz dodać maksymalnie 100 wierszy.";return}
 const pairs=[];for(const line of lines){let parts=line.split(/\s+-\s+| – | — | \| /);if(parts.length<2){$("noteMessage").textContent=`Nie rozpoznaję wiersza: ${line}. Użyj formatu apple - jabłko.`;return}pairs.push({en:parts[0].trim(),pl:parts.slice(1).join(" - ").trim()});}
 if(pairs.some(x=>!x.en||!x.pl)){$("noteMessage").textContent="Każdy wiersz musi mieć słówko angielskie i polskie.";return}
 let sets=getSets();sets.push({name:$("setName").value.trim()||`Zestaw ${sets.length+1}`,pairs});saveSets(sets);$("wordInput").value="";$("setName").value="";$("wordCount").textContent="0 / 100";$("noteMessage").textContent=`Zapisano ${pairs.length} słówek! ✨`;renderSets();renderStats();buildQuestions();
};
function renderSets(){let sets=getSets();$("setsList").innerHTML=sets.length?sets.map((s,i)=>`<div class="set-row"><div><b>📘 ${escapeHtml(s.name)}</b><br><small>${s.pairs.length} słówek</small></div><button onclick="practiceSet(${i})">Ćwicz zestaw →</button></div>`).join(""):"<p class='hint'>Nie masz jeszcze zestawów. Wklej pierwszą listę powyżej!</p>";}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function practiceSet(i){questions=getSets()[i]?.pairs||[];questions=[...questions].sort(()=>Math.random()-.5);qIndex=0;showTab("learn");showQuestion();}
function buildQuestions(){questions=getSets().flatMap(s=>s.pairs);questions=[...questions].sort(()=>Math.random()-.5);qIndex=0;showQuestion();}
function showQuestion(){let total=questions.length;$("questionDirection").textContent=direction==="en-pl"?"Angielski → Polski":"Polski → Angielski";$("counter").textContent=total?`${Math.min(qIndex+1,total)} / ${total}`:"0 / 0";$("feedback").textContent="";if(!total){$("question").textContent="Dodaj słówka w swoim notesie, aby rozpocząć."; $("answers").innerHTML="";return}if(qIndex>=total)qIndex=0;let pair=questions[qIndex],correctAnswer=direction==="en-pl"?pair.pl:pair.en,question=direction==="en-pl"?pair.en:pair.pl;$("question").textContent=question;let all=getSets().flatMap(s=>s.pairs).map(p=>direction==="en-pl"?p.pl:p.en).filter(x=>x!==correctAnswer);let choices=[correctAnswer,...all.sort(()=>Math.random()-.5).slice(0,3)].sort(()=>Math.random()-.5);$("answers").innerHTML=choices.map(c=>`<button class="answer-option" data-answer="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");document.querySelectorAll(".answer-option").forEach(b=>b.onclick=()=>checkAnswer(b,correctAnswer));}
function checkAnswer(btn,answer){if(document.querySelector(".answer-option.correct,.answer-option.wrong"))return;attempted++;if(btn.dataset.answer===answer){btn.classList.add("correct");correct++;$("feedback").textContent="Brawo! Poprawna odpowiedź 🎉";$("feedback").style.color="#19976b"}else{btn.classList.add("wrong");document.querySelectorAll(".answer-option").forEach(b=>{if(b.dataset.answer===answer)b.classList.add("correct")});$("feedback").textContent=`Dobra odpowiedź: ${answer}. Powtórz ją jeszcze raz!`;$("feedback").style.color="#ce5578"}localStorage.setItem(storageKey()+"_stats",JSON.stringify({correct,attempted}));renderStats();}
$("nextQuestion").onclick=()=>{if(!questions.length)return;qIndex++;showQuestion()};
$("reverse").onclick=()=>{direction=direction==="en-pl"?"pl-en":"en-pl";showQuestion()};
function renderStats(){let sets=getSets(),total=sets.reduce((n,s)=>n+s.pairs.length,0);let st={correct:0,attempted:0};try{st=JSON.parse(localStorage.getItem(storageKey()+"_stats")||'{"correct":0,"attempted":0}')}catch{}$("totalWords").textContent=total;$("correctCount").textContent=st.correct;$("accuracy").textContent=st.attempted?Math.round(st.correct/st.attempted*100)+"%":"0%";}
$("generateAccounts").onclick=()=>{let n=Number($("accountAmount").value);accounts=Array.from({length:n},(_,i)=>({login:`uczen${i+1}`,password:Math.random().toString(36).slice(2,7).toUpperCase()}));$("accountsOutput").innerHTML=`<p><b>Wygenerowano ${n} kont (podgląd demo):</b></p><div class="sets-list">${accounts.map(a=>`<div class="set-row"><b>${a.login}</b><code>${a.password}</code></div>`).join("")}</div>`};
$("printAccounts").onclick=()=>{if(!accounts.length){alert("Najpierw wygeneruj konta.");return}let w=window.open("","_blank");w.document.write(`<html><head><title>WordClass — konta</title><style>body{font:14px Arial;padding:25px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px;text-align:left}</style></head><body><h1>WordClass — konta uczniów</h1><table><tr><th>Login</th><th>Hasło jednorazowe</th></tr>${accounts.map(a=>`<tr><td>${a.login}</td><td>${a.password}</td></tr>`).join("")}</table><script>window.print()<\/script></body></html>`);w.document.close()};
