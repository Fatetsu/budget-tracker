const KEY="budgetTrackerV1";
let data=JSON.parse(localStorage.getItem(KEY)||'{"paychecks":[],"bills":[],"spending":[],"debt":[],"goals":[]}');
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n)||0);
function save(){localStorage.setItem(KEY,JSON.stringify(data));render()}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){
 const income=data.paychecks.reduce((a,x)=>a+Number(x.amount),0), bills=data.bills.filter(x=>!x.paid).reduce((a,x)=>a+Number(x.amount),0), spent=data.spending.reduce((a,x)=>a+Number(x.amount),0), debt=data.debt.reduce((a,x)=>a+Number(x.balance),0);
 $("balance").textContent=money(income-spent); $("nextPay").textContent=money(data.paychecks.slice().sort((a,b)=>a.date.localeCompare(b.date)).find(x=>x.date>=new Date().toISOString().slice(0,10))?.amount||0);
 $("billTotal").textContent=money(bills); $("debtTotal").textContent=money(debt);
 const safe=income-spent-bills; $("safe").textContent=money(safe); $("safeNote").textContent=safe>=0?"Based on entered income, unpaid bills, and spending.":"You're over the entered budget.";
 list("paycheckList",data.paychecks,(x,i)=>`<div class="item"><div><b>${money(x.amount)}</b><small>${esc(x.note||"Paycheck")} • ${esc(x.date)}</small></div><div class="right"><button class="danger" onclick="del('paychecks',${i})">Delete</button></div></div>`);
 list("billList",data.bills,(x,i)=>`<div class="item"><div><b>${esc(x.name)} — ${money(x.amount)}</b><small>Due ${esc(x.date)}${x.frequency?" • "+esc(x.frequency):""}</small></div><div class="right"><button onclick="toggleBill(${i})">${x.paid?"Paid ✓":"Mark paid"}</button><button class="danger" onclick="del('bills',${i})">Delete</button></div></div>`);
 list("spendingList",data.spending,(x,i)=>`<div class="item"><div><b>${esc(x.name)} — ${money(x.amount)}</b><small>${esc(x.category)} • ${esc(x.date)}</small></div><button class="danger" onclick="del('spending',${i})">Delete</button></div>`);
 list("debtList",data.debt,(x,i)=>`<div class="item"><div><b>${esc(x.name)}</b><small>Balance ${money(x.balance)} • Limit ${money(x.limit||0)}</small></div><div class="right"><b>${x.limit?Math.round(x.balance/x.limit*100):0}%</b><button class="danger" onclick="del('debt',${i})">Delete</button></div></div>`);
 list("goalList",data.goals,(x,i)=>{let p=Math.min(100,Number(x.saved)/Number(x.target)*100||0);return `<div class="item"><div style="flex:1"><b>${esc(x.name)}</b><small>${money(x.saved)} of ${money(x.target)}</small><div class="progress"><i style="width:${p}%"></i></div></div><button class="danger" onclick="del('goals',${i})">Delete</button></div>`});
 const recent=data.spending.slice(-5).reverse(); $("recent").innerHTML=recent.length?recent.map(x=>`<div class="item"><div><b>${esc(x.name)}</b><small>${esc(x.date)}</small></div><b>${money(x.amount)}</b></div>`).join(""):`<div class="empty">No spending yet.</div>`;
}
function list(id,arr,fn){$(id).innerHTML=arr.length?arr.map(fn).join(""):`<div class="card empty">Nothing here yet.</div>`}
function del(type,i){data[type].splice(i,1);save()}
function toggleBill(i){data.bills[i].paid=!data.bills[i].paid;save()}
function closeForm(){$("modal").classList.add("hidden")}
function openForm(type){
 $("modal").classList.remove("hidden"); const f=$("form"); let title,fields;
 const date=new Date().toISOString().slice(0,10);
 if(type==="paycheck"){title="Add paycheck";fields=`<label>Amount<input name="amount" type="number" step=".01" required></label><label>Date<input name="date" type="date" value="${date}" required></label><label>Note<input name="note" placeholder="Walmart paycheck"></label>`}
 if(type==="bill"){title="Add bill";fields=`<label>Name<input name="name" required></label><label>Amount<input name="amount" type="number" step=".01" required></label><label>Due date<input name="date" type="date" value="${date}" required></label><label>Frequency<select name="frequency"><option>One-time</option><option>Weekly</option><option>Every 2 weeks</option><option>Monthly</option></select></label>`}
 if(type==="spending"){title="Add spending";fields=`<label>Name<input name="name" placeholder="Gas, food, etc." required></label><label>Amount<input name="amount" type="number" step=".01" required></label><label>Category<select name="category"><option>Food</option><option>Gas</option><option>Entertainment</option><option>Shopping</option><option>Subscriptions</option><option>Other</option></select></label><label>Date<input name="date" type="date" value="${date}" required></label>`}
 if(type==="debt"){title="Add debt";fields=`<label>Name<input name="name" placeholder="Discover" required></label><label>Balance<input name="balance" type="number" step=".01" required></label><label>Credit limit (optional)<input name="limit" type="number" step=".01"></label>`}
 if(type==="goal"){title="Add savings goal";fields=`<label>Name<input name="name" placeholder="Emergency fund" required></label><label>Target<input name="target" type="number" step=".01" required></label><label>Already saved<input name="saved" type="number" step=".01" value="0"></label>`}
 $("formTitle").textContent=title;f.innerHTML=fields+`<button type="submit">Save</button>`;
 f.onsubmit=e=>{e.preventDefault();let o=Object.fromEntries(new FormData(f));data[type==="paycheck"?"paychecks":type==="bill"?"bills":type==="spending"?"spending":type==="debt"?"debt":"goals"].push(o);closeForm();save()}
}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));$(b.dataset.screen).classList.add("active");document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");window.scrollTo(0,0)});
$("reset").onclick=()=>{if(confirm("Erase all budget data?")){data={paychecks:[],bills:[],spending:[],debt:[],goals:[]};save()}};
render();document.querySelector('nav button').classList.add('active');
