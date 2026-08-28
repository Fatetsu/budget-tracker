const KEY="budgetTrackerV10";

const blankData=()=>({
  settings:{balance:0,defaultPay:0,frequency:"biweekly"},
  paychecks:[],bills:[],spending:[],debt:[],goals:[]
});

function num(v){return Number(v)||0}
function normDebt(x){
  const balance=num(x.balance ?? x.currentBalance ?? x.amount);
  const starting=num(x.startingBalance ?? x.originalBalance ?? x.initialBalance ?? x.startBalance);
  return {
    ...x,
    name:x.name||"Debt",
    balance,
    limit:num(x.limit ?? x.creditLimit),
    payment:num(x.payment ?? x.plannedPayment ?? x.paycheckPayment),
    startingBalance:starting>0?starting:balance
  };
}
function normalize(raw){
  const d=blankData();
  if(!raw || typeof raw!=="object") return d;
  d.settings={
    ...d.settings,
    ...(raw.settings||{}),
    balance:num(raw.settings?.balance ?? raw.balance),
    defaultPay:num(raw.settings?.defaultPay ?? raw.settings?.paycheck ?? raw.defaultPay),
    frequency:raw.settings?.frequency||"biweekly"
  };
  d.paychecks=Array.isArray(raw.paychecks)?raw.paychecks.map(x=>({
    ...x,amount:num(x.amount),date:x.date||today(),savings:num(x.savings)
  })):[];
  d.bills=Array.isArray(raw.bills)?raw.bills.map(x=>({
    ...x,amount:num(x.amount),date:x.date||today(),frequency:x.frequency||"One-time",paid:!!x.paid
  })):[];
  d.spending=Array.isArray(raw.spending)?raw.spending.map(x=>({
    ...x,amount:num(x.amount),date:x.date||today()
  })):[];
  d.debt=Array.isArray(raw.debt)?raw.debt.map(normDebt):[];
  d.goals=Array.isArray(raw.goals)?raw.goals.map(x=>({
    ...x,target:num(x.target),saved:num(x.saved)
  })):[];
  return d;
}
function itemKey(x){
  return JSON.stringify([
    x.name||"",x.date||"",num(x.amount),x.frequency||"",
    num(x.balance),num(x.limit),num(x.payment),num(x.target)
  ]);
}
function mergeUnique(a,b){
  const out=[...a], seen=new Set(a.map(itemKey));
  for(const x of b){const k=itemKey(x);if(!seen.has(k)){seen.add(k);out.push(x)}}
  return out;
}

// Pull from the current version first, then older versions. This preserves
// existing data while recovering anything that exists only in an older build.
let data=blankData();
const versionKeys=[
  "budgetTrackerV10","budgetTrackerV9","budgetTrackerV8","budgetTrackerV7",
  "budgetTrackerV6","budgetTrackerV5","budgetTrackerV4","budgetTrackerV3",
  "budgetTrackerV2","budgetTrackerV1"
];
let found=false;
for(const k of versionKeys){
  const raw=localStorage.getItem(k);
  if(!raw) continue;
  try{
    const d=normalize(JSON.parse(raw));
    if(!found){
      data=d; found=true;
    }else{
      // Newer version remains authoritative for settings; older versions
      // only fill in records that are missing.
      data.paychecks=mergeUnique(data.paychecks,d.paychecks);
      data.bills=mergeUnique(data.bills,d.bills);
      data.spending=mergeUnique(data.spending,d.spending);
      data.debt=mergeUnique(data.debt,d.debt);
      data.goals=mergeUnique(data.goals,d.goals);
    }
  }catch(e){}
}
if(!found) data=blankData();
localStorage.setItem(KEY,JSON.stringify(data));

const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n)||0);
const today=()=>new Date().toISOString().slice(0,10);
const fmt=d=>new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
function dateObj(s){return new Date(s+"T00:00:00")}
function addDays(s,n){const d=dateObj(s);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function save(){localStorage.setItem(KEY,JSON.stringify(data));render()}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function paychecksSorted(){return data.paychecks.slice().sort((a,b)=>a.date.localeCompare(b.date))}
function paycheckEnd(p){return addDays(p.date,13)}
function billAssignedToPaycheck(b,p){
  return b.date>=p.date && b.date<=paycheckEnd(p) && !b.paid;
}
function assignedBills(p){
  return data.bills.filter(b=>billAssignedToPaycheck(b,p));
}
function assignedBillTotal(p){
  return assignedBills(p).reduce((a,b)=>a+Number(b.amount||0),0);
}
function assignedDebtTotal(p){
  return data.debt.reduce((a,d)=>a+Number(d.payment||0),0);
}
function paycheckAvailable(p){
  return Number(p.amount||0)-assignedBillTotal(p)-assignedDebtTotal(p)-Number(p.savings||0);
}
function currentBalance(){return Number(data.settings.balance||0)}
function nextPay(){return paychecksSorted().find(p=>p.date>=today())}
function nextPayBills(){const p=nextPay();return p?assignedBillTotal(p):0}

function render(){
  const bal=currentBalance(), next=nextPay(), bills=nextPayBills();
  const debt=data.debt.reduce((a,x)=>a+Number(x.balance||0),0);
  const safe=next?Math.max(0,bal-bills):bal;

  $("balance").textContent=money(bal);
  $("nextPay").textContent=next?money(next.amount):"$0.00";
  $("nextPayDate").textContent=next?`${fmt(next.date)} • 2-week period`:"No upcoming paycheck";
  $("billTotal").textContent=money(bills);
  $("debtTotal").textContent=money(debt);
  $("safe").textContent=money(safe);
  $("safe").classList.remove("good","bad","neutral");
  $("safe").classList.add(safe>0?"good":safe<0?"bad":"neutral");
  $("safeNote").textContent=next
    ? `${money(bills)} of bills are assigned to the ${fmt(next.date)} paycheck.`
    : "Add a paycheck to start your two-week plan.";
  $("periodLabel").textContent=next?`Pay period: ${fmt(next.date)} – ${fmt(paycheckEnd(next))}`:"Paycheck planner";

  renderPaycheckSummary();
  renderChart();
  renderLists();
}

function renderPaycheckSummary(){
  const ps=paychecksSorted();
  if(!ps.length){
    $("paycheckSummary").innerHTML=`<div class="empty">No paychecks yet. Add your next paycheck and we'll automatically assign bills that fall inside its 14-day period.</div>`;
    return;
  }
  const upcoming=ps.filter(p=>p.date>=today()).slice(0,3);
  $("paycheckSummary").innerHTML=upcoming.map(p=>{
    const bills=assignedBills(p), bt=assignedBillTotal(p), dt=assignedDebtTotal(p), sav=Number(p.savings||0), left=paycheckAvailable(p);
    const idx=data.paychecks.indexOf(p);
    return `<div class="planner card">
      <div class="sectionHead">
        <div><b>${money(p.amount)}</b><small>${esc(p.note||"Paycheck")} • ${fmt(p.date)} – ${fmt(paycheckEnd(p))}</small></div>
        <button onclick="editItem('paychecks',${idx})">Edit</button>
      </div>
      ${bills.length?`<div class="assignedBills">${bills.map(b=>`<div class="miniRow"><span>🧾 ${esc(b.name)}</span><b>${money(b.amount)}</b></div>`).join("")}</div>`:`<div class="empty">No bills fall inside this 2-week period.</div>`}
      <div class="miniRow"><span>Paycheck</span><b>${money(p.amount)}</b></div>
      <div class="miniRow"><span>Bills</span><b class="bad">−${money(bt)}</b></div>
      ${dt?`<div class="miniRow"><span>Planned debt payments</span><b class="bad">−${money(dt)}</b></div>`:""}
      ${sav?`<div class="miniRow"><span>Savings</span><b class="good">−${money(sav)}</b></div>`:""}
      <div class="plannerLeft"><span>Left from paycheck</span><strong class="${left>=0?"good":"bad"}">${money(left)}</strong></div>
    </div>`;
  }).join("");
}

function renderChart(){
  const cats={Food:0,Gas:0,Entertainment:0,Shopping:0,Subscriptions:0,Debt:0,Other:0};
  data.spending.filter(x=>x.date.startsWith(today().slice(0,7))).forEach(x=>cats[x.category]=(cats[x.category]||0)+Number(x.amount));
  const vals=Object.entries(cats).filter(x=>x[1]>0), max=Math.max(...vals.map(x=>x[1]),1);
  const markup=vals.length?vals.map(([c,v])=>`<div class="barRow"><div class="barLabel"><span>${esc(c)}</span><b>${money(v)}</b></div><div class="bar"><i style="width:${v/max*100}%"></i></div></div>`).join(""):`<div class="empty">No spending this month.</div>`;
  $("chart").innerHTML=markup;$("categoryBars").innerHTML=markup;
  const mt=data.spending.filter(x=>x.date.startsWith(today().slice(0,7))).reduce((a,x)=>a+Number(x.amount),0);
  $("monthTotal").textContent=money(mt);$("spendingMonthTotal").textContent=money(mt);
}

function renderLists(){
  list("paycheckList",paychecksSorted().reverse(),p=>{
    const i=data.paychecks.indexOf(p), future=p.date>today(), bills=assignedBills(p), left=paycheckAvailable(p);
    return `<div class="item"><div><b>${money(p.amount)} ${future?"• Upcoming":"• Current"}</b><small>${esc(p.note||"Paycheck")} • ${fmt(p.date)} – ${fmt(paycheckEnd(p))}</small><small>${bills.length} bill(s) assigned • ${money(assignedBillTotal(p))} bills • ${money(left)} left</small></div><div class="right"><button onclick="editItem('paychecks',${i})">Edit</button><button class="danger" onclick="del('paychecks',${i})">Delete</button></div></div>`
  });
  list("billList",data.bills.slice().sort((a,b)=>a.date.localeCompare(b.date)),b=>{
    const i=data.bills.indexOf(b), p=paychecksSorted().find(p=>b.date>=p.date&&b.date<=paycheckEnd(p));
    return `<div class="item"><div><b>${esc(b.name)} — ${money(b.amount)}</b><small>Due ${fmt(b.date)} • ${esc(b.frequency||"One-time")}${b.paid?" • Paid":""}</small><small>${p&&!b.paid?`Assigned to paycheck ${fmt(p.date)}`:"Not assigned to a paycheck"}</small></div><div class="right"><button onclick="toggleBill(${i})">${b.paid?"Undo":"Paid ✓"}</button><button onclick="editItem('bills',${i})">Edit</button><button class="danger" onclick="del('bills',${i})">Delete</button></div></div>`
  });
  list("spendingList",data.spending.slice().sort((a,b)=>b.date.localeCompare(a.date)),x=>{
    const i=data.spending.indexOf(x);return `<div class="item"><div><b>${esc(x.name)} — ${money(x.amount)}</b><small>${esc(x.category)} • ${fmt(x.date)}</small></div><div class="right"><button onclick="editItem('spending',${i})">Edit</button><button class="danger" onclick="del('spending',${i})">Delete</button></div></div>`
  });
  list("debtList",data.debt,x=>{
    const i=data.debt.indexOf(x),u=x.limit?Number(x.balance)/Number(x.limit)*100:0;
    const start=Math.max(Number(x.startingBalance||0),Number(x.balance||0));
    const paidPct=start>0?Math.max(0,Math.min(100,(start-Number(x.balance||0))/start*100)):0;
    return `<div class="card"><div class="sectionHead"><div><h2>${esc(x.name)}</h2><small>Balance remaining ${money(x.balance)} • Starting balance ${money(start)}</small></div><div class="debtPercent"><b>${Math.round(paidPct)}%</b><small>paid off</small></div></div><div class="hint debtUtil"><b>${x.limit?Math.round(u)+"% utilization":"No credit limit entered"}</b> • ${money(Math.max(0,start-Number(x.balance||0)))} paid so far</div><div class="progress payoff"><i style="width:${paidPct}%"></i></div>${x.limit?`<div class="debtStats"><span>Used ${money(x.balance)}</span><span>Available ${money(Math.max(0,Number(x.limit)-Number(x.balance)))}</span></div>`:""}<div class="hint">Planned payment each paycheck: ${money(x.payment||0)}</div><div class="right" style="margin-top:10px"><button onclick="editItem('debt',${i})">Edit</button><button class="danger" onclick="del('debt',${i})">Delete</button></div></div>`
  });
  list("goalList",data.goals,x=>{const i=data.goals.indexOf(x),p=Math.min(100,Number(x.saved)/Number(x.target)*100||0);return `<div class="item"><div style="flex:1"><b>${esc(x.name)}</b><small>${money(x.saved)} of ${money(x.target)} • ${Math.round(p)}%</small><div class="progress"><i style="width:${p}%"></i></div></div><div class="right"><button onclick="editItem('goals',${i})">Edit</button><button class="danger" onclick="del('goals',${i})">Delete</button></div></div>`});
  const recent=data.spending.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  $("recent").innerHTML=recent.length?recent.map(x=>`<div class="item"><div><b>${esc(x.name)}</b><small>${esc(x.category)} • ${fmt(x.date)}</small></div><b>${money(x.amount)}</b></div>`).join(""):`<div class="empty">No spending yet.</div>`;
}
function list(id,arr,fn){$(id).innerHTML=arr.length?arr.map(fn).join(""):`<div class="card empty">Nothing here yet.</div>`}
function del(type,i){if(confirm("Delete this item?")){data[type].splice(i,1);save()}}
function toggleBill(i){
  data.bills[i].paid=!data.bills[i].paid;
  if(data.bills[i].paid && data.bills[i].frequency!=="One-time"){
    const b=data.bills[i],d=dateObj(b.date);
    if(b.frequency==="Weekly")d.setDate(d.getDate()+7);
    if(b.frequency==="Every 2 weeks")d.setDate(d.getDate()+14);
    if(b.frequency==="Monthly")d.setMonth(d.getMonth()+1);
    data.bills.push({...b,date:d.toISOString().slice(0,10),paid:false});
  }
  save()
}

function closeForm(){$("modal").classList.add("hidden")}
function openForm(type,index=null){
  $("modal").classList.remove("hidden");const f=$("form");let title,fields;const date=today();
  const arr=type==="paycheck"?"paychecks":type==="bill"?"bills":type==="spending"?"spending":type==="debt"?"debt":"goals";
  const existing=index!==null?data[arr][index]:null;
  if(type==="paycheck"){title=existing?"Edit paycheck":"Add paycheck";fields=`<label>Paycheck amount<input name="amount" type="number" step=".01" value="${existing?.amount??data.settings.defaultPay??""}" required></label><label>Pay date<input name="date" type="date" value="${existing?.date??date}" required></label><label>Note<input name="note" value="${esc(existing?.note??"")}" placeholder="Walmart paycheck"></label><label>Extra savings from this paycheck<input name="savings" type="number" step=".01" value="${existing?.savings??0}"></label><div class="hint">Bills due from this date through the next 13 days will automatically be assigned to this paycheck.</div>`}
  if(type==="bill"){title=existing?"Edit bill":"Add bill";fields=`<label>Name<input name="name" value="${esc(existing?.name??"")}" required></label><label>Amount<input name="amount" type="number" step=".01" value="${existing?.amount??""}" required></label><label>Due date<input name="date" type="date" value="${existing?.date??date}" required></label><label>Frequency<select name="frequency">${["One-time","Weekly","Every 2 weeks","Monthly"].map(v=>`<option ${existing?.frequency===v?"selected":""}>${v}</option>`).join("")}</select></label>`}
  if(type==="spending"){title=existing?"Edit spending":"Add spending";fields=`<label>Name<input name="name" value="${esc(existing?.name??"")}" required></label><label>Amount<input name="amount" type="number" step=".01" value="${existing?.amount??""}" required></label><label>Category<select name="category">${["Food","Gas","Entertainment","Shopping","Subscriptions","Debt","Other"].map(v=>`<option ${existing?.category===v?"selected":""}>${v}</option>`).join("")}</select></label><label>Date<input name="date" type="date" value="${existing?.date??date}" required></label>`}
  if(type==="debt"){title=existing?"Edit debt card":"Add debt card";const sb=existing?.startingBalance??existing?.balance??"";fields=`<label>Card name<input name="name" value="${esc(existing?.name??"")}" placeholder="Discover or Capital One" required></label><label>Current balance<input name="balance" type="number" step=".01" value="${existing?.balance??""}" required></label><label>Starting balance<input name="startingBalance" type="number" step=".01" value="${sb}" required></label><label>Credit limit<input name="limit" type="number" step=".01" value="${existing?.limit??""}"></label><label>Planned payment each paycheck<input name="payment" type="number" step=".01" value="${existing?.payment??""}"></label><div class="hint">Paid off % = amount paid down from your starting balance. Utilization is shown separately.</div>`}
  if(type==="goal"){title=existing?"Edit savings goal":"Add savings goal";fields=`<label>Name<input name="name" value="${esc(existing?.name??"")}" required></label><label>Target<input name="target" type="number" step=".01" value="${existing?.target??""}" required></label><label>Saved<input name="saved" type="number" step=".01" value="${existing?.saved??0}"></label>`}
  $("formTitle").textContent=title;
  f.innerHTML=fields+`<div class="formActions"><button type="submit">${existing?"Update":"Save"}</button><button type="button" class="secondary" onclick="closeForm()">Cancel</button></div>`;
  f.onsubmit=e=>{
    e.preventDefault();const o=Object.fromEntries(new FormData(f));
    ["amount","savings","balance","startingBalance","limit","payment","target","saved"].forEach(k=>{if(k in o)o[k]=num(o[k])});
    if(existing)data[arr][index]={...data[arr][index],...o};else data[arr].push(o);
    closeForm();save()
  }
}
function editItem(type,i){const map={paychecks:'paycheck',bills:'bill',spending:'spending',debt:'debt',goals:'goal'};openForm(map[type]||type,i)}
function saveSettings(){
  data.settings.balance=Number($("currentBalance").value||0);
  data.settings.defaultPay=Number($("defaultPay").value||0);
  data.settings.frequency=$("payFrequency").value;
  save();alert("Setup saved.")
}
function loadSettings(){$("currentBalance").value=data.settings.balance||0;$("defaultPay").value=data.settings.defaultPay||0;$("payFrequency").value=data.settings.frequency||"biweekly"}
function resetAll(){if(confirm("Erase all budget data from this browser?")){localStorage.removeItem(KEY);location.reload()}}
function exportData(){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="budget-tracker-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$("importFile").onchange=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{data=JSON.parse(r.result);save();alert("Backup imported.")}catch{alert("That backup file is not valid.")}};r.readAsText(file)}

function showScreen(name){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  const target=$(name);if(target)target.classList.add("active");
  document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("active",x.dataset.screen===name));
  if(name==="settings")loadSettings();
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("nav button").forEach(b=>b.addEventListener("click",()=>showScreen(b.dataset.screen)));
$("settingsBtn").addEventListener("click",e=>{e.preventDefault();e.stopPropagation();showScreen("settings")});

const savedTheme=localStorage.getItem("budgetTheme")||"light";
function applyTheme(t){document.body.classList.toggle("dark",t==="dark");document.documentElement.classList.toggle("dark",t==="dark");$("themeToggle").textContent=t==="dark"?"☀️":"🌙";localStorage.setItem("budgetTheme",t)}
$("themeToggle").addEventListener("click",e=>{e.preventDefault();e.stopPropagation();applyTheme(document.body.classList.contains("dark")?"light":"dark")});
applyTheme(savedTheme);
render();
document.querySelector('nav button[data-screen="dashboard"]').classList.add("active");
