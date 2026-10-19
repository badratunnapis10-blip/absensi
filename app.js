const $ = (selector) => document.querySelector(selector);
const modal = $("#login-modal");
function openLogin(){modal?.classList.remove("hidden");$("#nim")?.focus();}
function closeLogin(){modal?.classList.add("hidden");}
document.querySelectorAll("[data-open-login]").forEach(el=>el.addEventListener("click",openLogin));
document.querySelectorAll("[data-close-login]").forEach(el=>el.addEventListener("click",closeLogin));
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeLogin();});
$("#year").textContent = new Date().getFullYear();
function showToast(message){const el=$("#toast");el.textContent=message;el.classList.remove("hidden");setTimeout(()=>el.classList.add("hidden"),3500);}
async function loadStats(){
 try{
  const r=await fetch("/api/stats/public");const d=await r.json();
  if(d.students!==null && d.students!==undefined){$("#stat-students").textContent=Number(d.students).toLocaleString("id-ID");$("#band-students").textContent=Number(d.students).toLocaleString("id-ID")+" mahasiswa";}
  if(typeof d.attendancePercent==="number"){$("#stat-attendance").textContent=d.attendancePercent+"%";$("#band-attendance").textContent=d.attendancePercent+"% rata-rata";}
  else {$("#stat-attendance").textContent="—%";$("#band-attendance").textContent="Data real-time";}
 }catch{ /* landing page remains usable if database is not configured */ }
}
$("#login-form").addEventListener("submit",async e=>{
 e.preventDefault();const button=$("#login-submit"),error=$("#login-error");error.textContent="";button.disabled=true;button.textContent="Memeriksa akun…";
 try{
  const response=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nim:$("#nim").value.trim(),password:$("#password").value})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||"Login gagal.");
  sessionStorage.setItem("hadirin_token",data.token);sessionStorage.setItem("hadirin_user",JSON.stringify(data.user));
  location.href="/dashboard.html";
 }catch(err){error.textContent=err.message||"Tidak dapat terhubung ke server.";}
 finally{button.disabled=false;button.textContent="Masuk portal →";}
});
loadStats();