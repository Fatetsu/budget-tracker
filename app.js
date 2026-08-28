const KEY="budgetTrackerV4";
const old=JSON.parse(localStorage.getItem("budgetTrackerV3")||localStorage.getItem("budgetTrackerV2")||localStorage.getItem("budgetTrackerV1")||"null");
let data=JSON.parse(localStorage.getItem(KEY)||"null")||{
 settings:{balance:0,defaultPay:0,frequency:"biweekly"},
 paychecks:[],bills:[],spending:[],debt:[],goals:[]
};
if(old && !localStorage.getItem(KEY)){
 data.settings.balance=Number(old.settings?.balance||0);
 data.paychecks=old.paychecks||[];
 data.bills=old.bills||[];
 data.spending=old.spending||[];
 data.debt=(old.debt||[]).map(x=>({...x,payment:x.payment||0}));
 data.goals=old.goals||[];
}
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n)||0);
const today=()=>new Date().toISOString().slice(0,10);
const fmt=d=>new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const monthKey=()=>today().slice(0,7);
function save(){localStorage.setItem(KEY,JSON.stringify(data));render()}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function currentSpending(){return data.spending.filter(x=>x.date<=today()).reduce((a,x)=>a+Number(x.amount),0)}
function upcoming(){return data.paychecks.filter(x=>x.date>today()).sort((a,b)=>a.date.localeCompare(b.date))}
function nextPay(){return upcoming()[0]}
function billsBeforePayday(){
 const p=nextPay()?.date;
 return data.bills.filter(x=>!x.paid && (!p || x.date<=p)).reduce((a,x)=>a+Number(x.amount),0)
}
function render(){
 const bal=Number(data.settings.balance||0);
 const next=nextPay();
 const bills=billsBeforePayday();
 const safe=bal-bills;
 const debt=data.debt.reduce((a,x)=>a+Number(x.balance||0),0);
 $("balance").textContent=money(bal);
 $("nextPay").textContent=next?money(next.amount):"$0.00";
 $("nextPayDate").textContent=next?fmt(next.date):"No future paycheck";
 $("billTotal").textContent=money(bills);
 $("debtTotal").textContent=money(debt);
 $("safe").textContent=money(safe);
 $("safeNote").textContent=next?`${money(bills)} in bills before ${fmt(next.date)}. Future paychecks are excluded.`:"Add your next paycheck to calculate your safe-to-spend amount.";
 $("periodLabel").textContent=next?`Next payday ${fmt(next.date)}`:"Paycheck planner";
 $("monthTotal").textContent=money(data.spending.filter(x=>x.date.startsWith(monthKey())).reduce((a,x)=>a+Number(x.amount),0));
 $("spendingMonthTotal").textContent=$("monthTotal").textContent;
 $("paycheckSummary").innerHTML=next?`<div class="item"><div><b>${money(next.amount)}</b><small>${esc(next.note||"Upcoming paycheck")} • ${fmt(next.date)}</small></div><div class="right"><button onclick="editItem('paychecks',${data.paychecks.indexOf(next)})">Edit</button></div></div>`:`<div class="empty">No upcoming paycheck. Add one to plan ahead.</div>`;
 renderChart(); renderLists();
}
function renderChart(){
 const cats={Food:0,Gas:0,Entertainment:0,Shopping:0,Subscriptions:0,Debt:0,Other:0};
 data.spending.filter(x=>x.date.startsWith(monthKey())).forEach(x=>cats[x.category]=(cats[x.category]||0)+Number(x.amount));
 const vals=Object.entries(cats).filter(x=>x[1]>0), max=Math.max(...vals.map(x=>x[1]),1);
 $("chart").innerHTML=vals.length?vals.map(([c,v])=>`<div class="barRow"><div class="barLabel"><span>${esc(c)}</span><b>${money(v)}</b></div><div class="bar"><i style="width:${v/max*100}%"></i></div></div>`).join(""):`<div class="empty">No spending this month.</div>`;
 $("categoryBars").innerHTML=$("chart").innerHTML;
}
function renderLists(){
 list("paycheckList",data.paychecks.slice().sort((a,b)=>b.date.localeCompare(a.date)),(x)=>{let i=data.paychecks.indexOf(x),future=x.date>today();return `<div class="item"><div><b>${money(x.amount)} ${future?"• Upcoming":"• Received"}</b><small>${esc(x.note||"Paycheck")} • ${fmt(x.date)}</small></div><div class="right"><button onclick="editItem('paychecks',${i})">Edit</button><button class="danger" onclick="del('paychecks',${i})">Delete</button></div></div>`});
 list("billList",data.bills,(x)=>{let i=data.bills.indexOf(x);return `<div class="item"><div><b>${esc(x.name)} — ${money(x.amount)}</b><small>Due ${fmt(x.date)} • ${esc(x.frequency||"One-time")}${x.paid?" • Paid":""}</small></div><div class="right"><button onclick="toggleBill(${i})">${x.paid?"Undo":"Paid ✓"}</button><button onclick="editItem('bills',${i})">Edit</button><button class="danger" onclick="del('bills',${i})">Delete</button></div></div>`});
 list("spendingList",data.spending.slice().sort((a,b)=>b.date.localeCompare(a.date)),(x)=>{let i=data.spending.indexOf(x);return `<div class="item"><div><b>${esc(x.name)} — ${money(x.amount)}</b><small>${esc(x.category)} • ${fmt(x.date)}</small></div><div class="right"><button onclick="editItem('spending',${i})">Edit</button><button class="danger" onclick="del('spending',${i})">Delete</button></div></div>`});
 list("debtList",data.debt,(x)=>{let i=data.debt.indexOf(x),u=x.limit?Number(x.balance)/Number(x.limit)*100:0;return `<div class="card"><div class="sectionHead"><div><h2>${esc(x.name)}</h2><small>Balance ${money(x.balance)} • Limit ${money(x.limit||0)}</small></div><b>${x.limit?Math.round(u):"—"}%</b></div>${x.limit?`<div class="progress"><i style="width:${Math.min(u,100)}%"></i></div>`:""}<div class="hint">Planned payment: ${money(x.payment||0)}</div><div class="right" style="margin-top:10px"><button onclick="editItem('debt',${i})">Edit</button><button class="danger" onclick="del('debt',${i})">Delete</button></div></div>`});
 list("goalList",data.goals,(x)=>{let i=data.goals.indexOf(x),p=Math.min(100,Number(x.saved)/Number(x.target)*100||0);return `<div class="item"><div style="flex:1"><b>${esc(x.name)}</b><small>${money(x.saved)} of ${money(x.target)} • ${Math.round(p)}%</small><div class="progress"><i style="width:${p}%"></i></div></div><div class="right"><button onclick="editItem('goals',${i})">Edit</button><button class="danger" onclick="del('goals',${i})">Delete</button></div></div>`});
 const recent=data.spending.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
 $("recent").innerHTML=recent.length?recent.map(x=>`<div class="item"><div><b>${esc(x.name)}</b><small>${esc(x.category)} • ${fmt(x.date)}</small></div><b>${money(x.amount)}</b></div>`).join(""):`<div class="empty">No spending yet.</div>`;
}
function list(id,arr,fn){$(id).innerHTML=arr.length?arr.map(fn).join(""):`<div class="card empty">Nothing here yet.</div>`}
function del(type,i){if(confirm("Delete this item?")){data[type].splice(i,1);save()}}
function toggleBill(i){data.bills[i].paid=!data.bills[i].paid;if(data.bills[i].paid && data.bills[i].frequency!=="One-time" && data.bills[i].frequency){let b=data.bills[i],d=new Date(b.date+"T00:00:00");if(b.frequency==="Weekly")d.setDate(d.getDate()+7);if(b.frequency==="Every 2 weeks")d.setDate(d.getDate()+14);if(b.frequency==="Monthly")d.setMonth(d.getMonth()+1);data.bills.push({...b,date:d.toISOString().slice(0,10),paid:false});}save()}
function closeForm(){$("modal").classList.add("hidden")}
function openForm(type,index=null){
 $("modal").classList.remove("hidden");const f=$("form");let title,fields;const date=today();
 const existing=index!==null?data[type==="paycheck"?"paychecks":type==="bill"?"bills":type==="spending"?"spending":type==="debt"?"debt":"goals"][index]:null;
 if(type==="paycheck"){title=existing?"Edit paycheck":"Add paycheck";fields=`<label>Amount<input name="amount" type="number" step=".01" value="${existing?.amount??data.settings.defaultPay??""}" required></label><label>Date<input name="date" type="date" value="${existing?.date??date}" required></label><label>Note<input name="note" value="${esc(existing?.note??"")}"></label>`}
 if(type==="bill"){title=existing?"Edit bill":"Add bill";fields=`<label>Name<input name="name" value="${esc(existing?.name??"")}" required></label><label>Amount<input name="amount" type="number" step=".01" value="${existing?.amount??""}" required></label><label>Due date<input name="date" type="date" value="${existing?.date??date}" required></label><label>Frequency<select name="frequency">${["One-time","Weekly","Every 2 weeks","Monthly"].map(v=>`<option ${existing?.frequency===v?"selected":""}>${v}</option>`).join("")}</select></label>`}
 if(type==="spending"){title=existing?"Edit spending":"Add spending";fields=`<label>Name<input name="name" value="${esc(existing?.name??"")}" required></label><label>Amount<input name="amount" type="number" step=".01" value="${existing?.amount??""}" required></label><label>Category<select name="category">${["Food","Gas","Entertainment","Shopping","Subscriptions","Debt","Other"].map(v=>`<option ${existing?.category===v?"selected":""}>${v}</option>`).join("")}</select></label><label>Date<input name="date" type="date" value="${existing?.date??date}" required></label>`}
 if(type==="debt"){title=existing?"Edit debt card":"Add debt card";fields=`<label>Card name<input name="name" placeholder="Discover or Capital One" value="${esc(existing?.name??"")}" required></label><label>Balance<input name="balance" type="number" step=".01" value="${existing?.balance??""}" required></label><label>Credit limit<input name="limit" type="number" step=".01" value="${existing?.limit??""}"></label><label>Planned payment<input name="payment" type="number" step=".01" value="${existing?.payment??""}"></label>`}
 if(type==="goal"){title=existing?"Edit savings goal":"Add savings goal";fields=`<label>Name<input name="name" value="${esc(existing?.name??"")}" required></label><label>Target<input name="target" type="number" step=".01" value="${existing?.target??""}" required></label><label>Saved<input name="saved" type="number" step=".01" value="${existing?.saved??0}"></label>`}
 $("formTitle").textContent=title;
 f.innerHTML=fields+`<div class="formActions"><button type="submit">${existing?"Update":"Save"}</button><button type="button" class="secondary" onclick="closeForm()">Cancel</button></div>`;
 f.onsubmit=e=>{e.preventDefault();let o=Object.fromEntries(new FormData(f));let arr=type==="paycheck"?"paychecks":type==="bill"?"bills":type==="spending"?"spending":type==="debt"?"debt":"goals";if(existing)data[arr][index]={...data[arr][index],...o};else data[arr].push(o);closeForm();save()}
}
function editItem(type,i){openForm(type,i)}
function saveSettings(){data.settings.balance=Number($("currentBalance").value||0);data.settings.defaultPay=Number($("defaultPay").value||0);data.settings.frequency=$("payFrequency").value;save();alert("Setup saved.")}
function loadSettings(){$("currentBalance").value=data.settings.balance||0;$("defaultPay").value=data.settings.defaultPay||0;$("payFrequency").value=data.settings.frequency||"biweekly"}
function resetAll(){if(confirm("Erase all budget data from this browser?")){localStorage.removeItem(KEY);location.reload()}}
function exportData(){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="budget-tracker-backup.json";a.click();URL.revokeObjectURL(a.href)}
$("importFile").onchange=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{data=JSON.parse(r.result);save();alert("Backup imported.")}catch{alert("That backup file is not valid.")}};r.readAsText(file)}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));$(b.dataset.screen).classList.add("active");document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");if(b.dataset.screen==="settings")loadSettings();scrollTo(0,0)});
$("settingsBtn").onclick=()=>{document.querySelector('[data-screen="settings"]').click()};
const savedTheme=localStorage.getItem("budgetTheme")||"light";
function applyTheme(t){document.body.classList.toggle("dark",t==="dark");$("themeToggle").textContent=t==="dark"?"☀️":"🌙";localStorage.setItem("budgetTheme",t)}
$("themeToggle").onclick=()=>applyTheme(document.body.classList.contains("dark")?"light":"dark");
applyTheme(savedTheme);render();document.querySelector('nav button').classList.add('active');
