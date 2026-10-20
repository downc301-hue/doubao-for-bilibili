(function(){
  function setFS(s){
    var m={sm:'15',md:'19',lg:'24'};
    var p=m[s]||'19';
    localStorage.setItem('fs',p);
    document.documentElement.style.setProperty('--fs-base',p+'px');
    document.querySelectorAll('#btn-fs-sm,#btn-fs-md,#btn-fs-lg').forEach(function(b){b.classList.remove('active')});
    var mp={sm:'btn-fs-sm',md:'btn-fs-md',lg:'btn-fs-lg'};
    var el=document.getElementById(mp[s]);
    if(el)el.classList.add('active');
  }
  function setTheme(t){
    localStorage.setItem('theme',t);
    document.documentElement.setAttribute('data-theme',t);
    var b=document.getElementById('btn-theme');
    if(b)b.textContent=t==='light'?'☀️':'🌙';
  }
  var c=localStorage.getItem('fs')||'19';
  if(c==='15')setFS('sm');else if(c==='24')setFS('lg');else setFS('md');
  setTheme(localStorage.getItem('theme')||'dark');
  var s1=document.getElementById('btn-fs-sm');if(s1)s1.onclick=function(){setFS('sm')};
  var s2=document.getElementById('btn-fs-md');if(s2)s2.onclick=function(){setFS('md')};
  var s3=document.getElementById('btn-fs-lg');if(s3)s3.onclick=function(){setFS('lg')};
  var s4=document.getElementById('btn-theme');if(s4)s4.onclick=function(){var n=document.documentElement.getAttribute('data-theme')||'dark';setTheme(n==='dark'?'light':'dark')};
})();

document.querySelectorAll('.tab').forEach(function(t){t.onclick=function(){
  document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')});
  document.querySelectorAll('.pane').forEach(function(x){x.classList.remove('active')});
  t.classList.add('active');
  document.getElementById('pane-'+t.dataset.tab).classList.add('active');
}});

var btnRun=document.getElementById('btn-run');if(btnRun)btnRun.onclick=async function(){
  var btn=document.getElementById('btn-run');
  var log=document.getElementById('run-log');
  var status=document.getElementById('run-status');
  btn.disabled=true;btn.textContent='运行中...';
  status.className='tag online';status.textContent='运行中';
  log.textContent='';
  var es=new EventSource('/run');
  var started=false;
  es.onmessage=function(e){
    var d=JSON.parse(e.data);
    if(d.type==='start'){started=true;log.textContent+='分身开始醒来...\n'}
    else if(d.type==='stdout'){log.textContent+=d.text+'\n';log.classList.add('streaming');log.scrollTop=log.scrollHeight}
    else if(d.type==='stderr'){log.textContent+='[错误] '+d.text+'\n'}
    else if(d.type==='done'){
      log.classList.remove('streaming');
      log.textContent+=('\n完成，退出码: '+d.code+' 于 '+new Date(d.time).toLocaleTimeString()+'\n');
      status.className=d.code===0?'tag online':'tag offline';
      status.textContent=d.code===0?'完成 (码0)':'退出码 '+d.code;
      btn.disabled=false;btn.textContent='唤醒分身';
      es.close();
    }
  };
  es.onerror=function(){if(!started){log.textContent='连接失败，检查服务端口\n';btn.disabled=false;btn.textContent='唤醒分身';es.close()}};
};

async function renderDashboard(){
  var d=await fetch('/api/dashboard').then(function(r){return r.json()});
  if(!d)return;

  var tok=d.todayTokens||0,bud=d.budget||50000,pct=Math.min(100,Math.round(tok/bud*100));
  var bar=document.querySelector('#stat-tokens-bar');
  bar.className='bar'+(pct>95?' crit':pct>80?' warn':'');
  bar.querySelector('div').style.width=pct+'%';
  document.getElementById('stat-tokens-value').textContent=tok.toLocaleString()+' / '+bud.toLocaleString();
  var st=document.getElementById('stat-tokens');
  st.classList.remove('ok','warn','err');
  st.classList.add(tok>bud?'warn':'ok');

  var doubaoSt=document.getElementById('stat-doubao');
  doubaoSt.classList.remove('ok','err');
  doubaoSt.classList.add(d.creds?.doubaoApiKey?'ok':'err');
  doubaoSt.querySelector('.value').textContent=d.creds?.doubaoApiKey?'已配置':'未配置';

  var biliSt=document.getElementById('stat-bili');
  biliSt.classList.remove('ok','err');
  biliSt.classList.add(d.creds?.sessdata?'ok':'err');
  biliSt.querySelector('.value').textContent=d.creds?.sessdata?'Cookie OK':'请登录';

  var userSt=document.getElementById('stat-user');
  userSt.classList.remove('ok','err');
  userSt.classList.add(d.bili?.ownerMid?'ok':'err');
  userSt.querySelector('.value').textContent=d.bili?.ownerName||'未设置';

  if(d.latestDiary){
    var card=document.getElementById('latest-diary-card');
    card.style.display='block';
    document.getElementById('latest-diary-title').textContent='最新日记 · '+(d.latestDiary.date||'');
    var body=document.getElementById('latest-diary-body');
    var html='<div class="diary-event evt-thought" style="cursor:pointer" onclick="this.classList.toggle(\'expanded\')"><div class="evt-body"><div class="evt-note">'+(d.latestDiary.summary||'...')+'</div></div></div>';
    (d.latestDiary.events||[]).forEach(function(ev){
      html+='<div class="diary-event evt-'+(ev.kind||'event')+'" style="cursor:pointer" onclick="this.classList.toggle(\'expanded\')"><div class="evt-body"><div class="evt-head"><span class="evt-time">'+(ev.time||'')+'</span>'+(ev.target?'<span class="evt-target">'+ev.target+'</span>':'')+'</div><div class="evt-note">'+(ev.note||'')+'</div></div></div>';
    });
    body.innerHTML=html;
  }

  var btnRun=document.getElementById('btn-run');
  var runStatus=document.getElementById('run-status');
  if(btnRun&&runStatus){
    var st=d.agentStatus||'idle';
    if(st==='running'){
      btnRun.disabled=true;btnRun.textContent='运行中...';
      runStatus.className='tag online';runStatus.textContent='运行中';
    }else if(st==='done'){
      btnRun.disabled=false;btnRun.textContent='现在就唤醒';
      runStatus.className='tag online';runStatus.textContent='本轮已完成';
    }else if(st==='forced'){
      btnRun.disabled=false;btnRun.textContent='现在就唤醒';
      runStatus.className='tag offline';runStatus.textContent='达上限收工';
    }else if(st==='aborted'){
      btnRun.disabled=false;btnRun.textContent='现在就唤醒';
      runStatus.className='tag offline';runStatus.textContent='已中止';
    }else{
      btnRun.disabled=false;btnRun.textContent='现在就唤醒';
      runStatus.className='tag offline';runStatus.textContent='待运行';
    }
  }
}

renderDashboard();

async function loadConfig(){
  try{
    var c=await fetch('/config').then(function(r){return r.json()});
    if(c.persona){
      var p=c.persona;
      var el=document.getElementById('cf-name');if(el)el.value=p.name||'';
      el=document.getElementById('cf-tags');if(el)el.value=(p.tags||[]).join(', ');
      el=document.getElementById('cf-like');if(el)el.value=((c.preferences||{}).like||[]).join(', ');
      el=document.getElementById('cf-dislike');if(el)el.value=((c.preferences||{}).dislike||[]).join(', ');
      el=document.getElementById('cf-budget');if(el)el.value=(c.budget?.dailyTokens||50000);
      el=document.getElementById('cf-owner-name');if(el)el.value=(c.bili||{}).ownerName||'';
      el=document.getElementById('cf-owner-mid');if(el)el.value=(c.bili||{}).ownerMid||'';
      var creds=c._creds||{};
      var be=document.getElementById('cred-endpoint');if(be)be.value=creds.endpointId||'';
      var bs=document.getElementById('bili-status');if(bs){bs.textContent=creds.biliCookieSet?'Cookie 已配置':'未配置';bs.className='tag '+(creds.biliCookieSet?'online':'offline')}
    }
    var fw=await fetch('/fw-config-all').then(function(r){return r.json()}).catch(function(){return {}});
    var fwEl=document.getElementById('fw-enabled');if(fwEl)fwEl.checked=!!fw.enabled;
    fwEl=document.getElementById('fw-interval');if(fwEl)fwEl.value=fw.interval||300;
    fwEl=document.getElementById('fw-ol');if(fwEl)fwEl.checked=!!fw.onlyWhitelist;
    fwEl=document.getElementById('fw-wl');if(fwEl)fwEl.value=(fw.whitelist||[]).join(', ');
    fwEl=document.getElementById('fw-bl');if(fwEl)fwEl.value=(fw.blacklist||[]).join(', ');
    fwEl=document.getElementById('fw-templates');if(fwEl)fwEl.value=(fw.templates||[]).join('\n');
    var fwStatus=document.getElementById('fw-status');
    if(fwStatus){
      var run=fw.running;var en=fw.enabled;
      fwStatus.textContent=en?(run?'运行中':'已启用但未启动'):'未启用';
      fwStatus.className='tag '+(en&&run?'online':'offline');
    }
  }catch(e){console.log('config load err',e)}
}
loadConfig();

var btnSaveP=document.getElementById('btn-save-persona');if(btnSaveP)btnSaveP.onclick=async function(){
  var p={};
  var n=document.getElementById('cf-name').value.trim();if(n)p.name=n;
  var t=document.getElementById('cf-tags').value.trim();if(t)p.tags=t.split(/[,，、\s]+/).filter(Boolean);
  var body={persona:p,preferences:{}};
  var l=document.getElementById('cf-like').value.trim();if(l)body.preferences.like=l.split(/[,，、\s]+/).filter(Boolean);
  var d=document.getElementById('cf-dislike').value.trim();if(d)body.preferences.dislike=d.split(/[,，、\s]+/).filter(Boolean);
  await fetch('/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  alert('人设已保存');
};
var btnSaveBud=document.getElementById('btn-save-budget');if(btnSaveBud)btnSaveBud.onclick=async function(){
  var body={budget:{dailyTokens:parseInt(document.getElementById('cf-budget').value)||50000}};
  await fetch('/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  alert('预算已保存');
  renderDashboard();
};
var btnSaveC=document.getElementById('btn-save-owner');if(btnSaveC)btnSaveC.onclick=async function(){
  var body={bili:{}};
  var n=document.getElementById('cf-owner-name').value.trim();if(n)body.bili.ownerName=n;
  var m=document.getElementById('cf-owner-mid').value.trim();if(m)body.bili.ownerMid=m;
  await fetch('/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  alert('已保存');renderDashboard();
};

var btnSaveFW=document.getElementById('btn-save-fw');if(btnSaveFW)btnSaveFW.onclick=async function(){
  var body={
    enabled:document.getElementById('fw-enabled').checked,
    interval:document.getElementById('fw-interval').value,
    onlyWhitelist:document.getElementById('fw-ol').checked,
    whitelist:document.getElementById('fw-wl').value,
    blacklist:document.getElementById('fw-bl').value,
    templates:document.getElementById('fw-templates').value,
  };
  await fetch('/follow-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  alert('关注守望已保存并重启');location.reload();
};
window.testFollowFetch=async function(){
  var r=await fetch('/follow-test').then(function(r){return r.json()});
  var items=r.items||[];
  var msg='';
  if(items.length>0){
    msg='API OK! '+items.length+' feeds:\n';
    items.slice(0,5).forEach(function(i){msg+='  '+i.pub+' '+i.up+'('+i.mid+') '+i.title+' BV='+i.bvid+'\n'});
  }else{
    msg='API returned: '+(r.error||'empty, cookie expired?');
  }
  alert(msg);
};
var d=document.getElementById('btn-save-doubao');if(d)d.onclick=async function(){
  var k=document.getElementById('cred-doubao-key').value;
  var e=document.getElementById('cred-endpoint').value;
  if(!k&&!e){alert('请至少填一项');return}
  await fetch('/creds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({doubaoApiKey:k,doubaoEndpointId:e})});
  alert('豆包凭据已保存');location.reload();
};
var bi=document.getElementById('btn-save-bili');if(bi)bi.onclick=async function(){
  var cookie=document.getElementById('cred-bili-cookie').value;
  if(!cookie.trim()){alert('请粘贴 Cookie');return}
  await fetch('/creds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({biliCookie:cookie})});
  alert('B站 Cookie 已保存');location.reload();
};

async function loadDiary(){
  var KIND_LABEL={wake:'醒来',thought:'想法',feeling:'心情',action:'动作',comment:'评论',summary:'总结',event:'事件'};
  var diary=await fetch('/diary').then(function(r){return r.json()});
  var list=document.getElementById('diary-list');
  if(!list)return;
  if(!Array.isArray(diary)||diary.length===0){list.innerHTML='<p class="mini">还没有日记，唤醒分身一次就会有了~</p>';return}
  list.innerHTML=diary.slice().reverse().map(function(d){
    var evts=(d.events||[]).map(function(ev){
      var cls='evt-'+(ev.kind||'event');
      var label=KIND_LABEL[ev.kind]||ev.kind||'事件';
      return '<div class="diary-event '+cls+'" style="cursor:pointer" onclick="this.classList.toggle(\'expanded\')">'+
        '<span class="evt-tag">'+label+'</span>'+
        '<div class="evt-body">'+
          '<div class="evt-head">'+
            '<span class="evt-time">'+(ev.time||'')+'</span>'+
            (ev.target?'<span class="evt-target">'+ev.target+'</span>':'')+
          '</div>'+
          '<div class="evt-note">'+(ev.note||'')+'</div>'+
        '</div>'+
      '</div>';
    }).join('');
    return '<div class="diary-day">'+
      '<div class="diary-date">'+d.date+' <span class="mini">'+(d.summary||'')+'</span></div>'+
      evts+
    '</div>';
  }).join('');
}
loadDiary();

var btnRunDaily=document.getElementById('btn-run-daily');if(btnRunDaily)btnRunDaily.onclick=async function(){
  await fetch('/run-daily',{method:'POST'});
  alert('已触发日常唤醒');
};

function toast(msg,type){
  var t=document.createElement('div');
  t.textContent=msg;
  t.style.cssText='position:fixed;top:24px;right:24px;padding:12px 20px;border-radius:10px;color:#fff;z-index:9999;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.3);transition:opacity .3s;opacity:0';
  t.style.background=type==='error'?'#ff4d4f':type==='ok'?'#52c41a':'#0ea5e9';
  document.body.appendChild(t);
  requestAnimationFrame(function(){t.style.opacity=1});
  setTimeout(function(){t.style.opacity=0;setTimeout(function(){t.remove()},300)},2500);
}

var editingTaskId=null;
async function saveTask(){
  var nameEl=document.getElementById('tk-name');
  var urlEl=document.getElementById('tk-target-url');
  var dayEl=document.getElementById('tk-day');
  var timeEl=document.getElementById('tk-time');
  var leadEl=document.getElementById('tk-lead');
  var task={
    id:editingTaskId||('task-'+Date.now()),
    name:nameEl.value.trim(),
    targetUrl:urlEl.value.trim(),
    day:parseInt(dayEl.value),
    time:timeEl.value,
    leadMin:parseInt(leadEl.value)||15,
    template:document.getElementById('tk-template').value.trim(),
    ownerRef:document.getElementById('tk-owner-ref').value.trim(),
    description:document.getElementById('tk-desc').value.trim(),
    enabled:true,
  };
  if(!task.name){nameEl.focus();nameEl.style.borderColor='#ff6b6b';toast('请填任务名称','error');return}
  if(!task.targetUrl){urlEl.focus();urlEl.style.borderColor='#ff6b6b';toast('请填视频链接','error');return}
  if(!/^(https?:)?\/\//.test(task.targetUrl)&&!/^BV\d+/.test(task.targetUrl)&&!/^ss\d+/.test(task.targetUrl)){
    urlEl.focus();urlEl.style.borderColor='#ff6b6b';toast('视频链接格式不对','error');return
  }
  if(isNaN(task.day)||task.day<0||task.day>6){dayEl.focus();dayEl.style.borderColor='#ff6b6b';toast('请选更新日','error');return}
  if(!task.time||!/^\d{1,2}:\d{2}$/.test(task.time)){timeEl.focus();timeEl.style.borderColor='#ff6b6b';toast('上线时间格式应为 HH:MM','error');return}
  if(task.leadMin<0||task.leadMin>120){leadEl.focus();leadEl.style.borderColor='#ff6b6b';toast('提前量在 0-120 分钟之间','error');return}
  [nameEl,urlEl,dayEl,timeEl,leadEl].forEach(function(el){if(el)el.style.borderColor=''});
  var saveBtn=document.getElementById('tk-save-btn');
  if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='保存中...'}
  var resp=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add',task})});
  var result=await resp.json();
  if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='保存任务'}
  if(result.ok){
    toast('任务已保存 ✓','ok');
    editingTaskId=null;
    var hint=document.getElementById('tk-editor-hint');if(hint)hint.remove();
    ['tk-name','tk-target-url','tk-template','tk-owner-ref','tk-desc'].forEach(function(id){var e=document.getElementById(id);if(e)e.value=''});
    if(dayEl)dayEl.value='6';
    if(timeEl)timeEl.value='11:00';
    if(leadEl)leadEl.value='20';
    loadTasks();
    window.scrollTo({top:document.getElementById('pane-tasks').offsetTop-40,behavior:'smooth'});
  }else{
    toast('保存失败','error');
  }
}

async function loadTasks(){
  var list=await fetch('/api/tasks').then(function(r){return r.json()});
  var wrap=document.getElementById('task-list');
  if(!wrap)return;
  if(!list||list.length===0){wrap.innerHTML='<div class="task-empty">还没有定时任务，下面加一个吧~</div>';return}
  wrap.innerHTML=list.map(function(t){
    var chip='<span class="task-chip '+(t.enabled===false?'disabled':(t.todayDone?'done':'pending'))+'">'+
      (t.enabled===false?'已暂停':(t.todayDone?(t.todayStatus==='fail'?'失败':'今日已完成'):'待触发'))+'</span>';
    var meta='<div class="task-meta">'+
      '<span class="task-chip">'+(t.days||'每天')+'</span>'+
      '<span class="task-chip">'+(t.time||'--:--')+'</span>'+
      '<span class="task-chip">提前'+(t.leadMin||0)+'分钟</span>'+
      (t.ownerRef?'<span class="task-chip">引流: '+t.ownerRef+'</span>':'')+
      (t.lastRun?'<span class="mini">上次: '+t.lastRun+'</span>':'')+
    '</div>';
    var desc='';if(t.description)desc='<div class="task-desc">'+t.description+'</div>';
    var tmpl='';if(t.template)tmpl='<div class="task-desc" style="opacity:.6">预设文案: '+t.template.slice(0,60)+(t.template.length>60?'...':'')+'</div>';
    var act='<div class="task-actions">'+
      '<button class="btn ghost" data-id="'+t.id+'" onclick="editTask(this)">编辑</button>'+
      '<button class="btn ghost" data-id="'+t.id+'" onclick="toggleTask(this)">'+(t.enabled===false?'启用':'暂停')+'</button>'+
      '<button class="btn ghost danger" data-id="'+t.id+'" onclick="deleteTask(this)">删除</button>'+
    '</div>';
    return '<div class="task-card">'+
      '<div class="task-head">'+
        '<span class="task-name">'+(t.name||'')+'</span>'+
        chip+
      '</div>'+
      meta+desc+tmpl+act+
    '</div>';
  }).join('');
}

async function editTask(btn){
  var id=btn.dataset.id;
  var list=await fetch('/api/tasks').then(function(r){return r.json()});
  var t=list.find(function(x){return x.id===id});
  if(!t)return;
  editingTaskId=id;
  document.getElementById('tk-name').value=t.name||'';
  document.getElementById('tk-target-url').value=t.targetUrl||'';
  document.getElementById('tk-day').value=t.day!=null?t.day:'';
  document.getElementById('tk-time').value=t.time||'';
  document.getElementById('tk-lead').value=t.leadMin||15;
  document.getElementById('tk-template').value=t.template||'';
  document.getElementById('tk-owner-ref').value=t.ownerRef||'';
  document.getElementById('tk-desc').value=t.description||'';
  var hint=document.getElementById('tk-editor-hint');
  if(!hint){
    hint=document.createElement('div');
    hint.id='tk-editor-hint';
    hint.style.cssText='background:#fff7e6;border:1px solid #ffd591;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:14px;color:#d46b08;display:flex;justify-content:space-between;align-items:center';
    hint.innerHTML='正在编辑任务，保存会覆盖原有设置 <button class="btn ghost danger" style="padding:4px 10px;min-width:auto" onclick="cancelEdit()">取消编辑</button>';
    var card=document.querySelector('#pane-tasks .card:last-of-type')||document.body;
    card.insertBefore(hint, card.firstChild);
  }
  var saveBtn=document.getElementById('tk-save-btn');
  if(saveBtn)saveBtn.textContent='更新任务';
  window.scrollTo({top:document.getElementById('pane-tasks').offsetTop-40,behavior:'smooth'});
}
function cancelEdit(){
  editingTaskId=null;
  var hint=document.getElementById('tk-editor-hint');if(hint)hint.remove();
  ['tk-name','tk-target-url','tk-template','tk-owner-ref','tk-desc'].forEach(function(id){var e=document.getElementById(id);if(e)e.value=''});
  var d=document.getElementById('tk-day');if(d)d.value='6';
  var ti=document.getElementById('tk-time');if(ti)ti.value='11:00';
  var l=document.getElementById('tk-lead');if(l)l.value='20';
  var saveBtn=document.getElementById('tk-save-btn');if(saveBtn)saveBtn.textContent='保存任务';
}

async function toggleTask(btn){
  var id=btn.dataset.id;
  await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'toggle',id:id})});
  loadTasks();
}
async function deleteTask(btn){
  var id=btn.dataset.id;
  if(!confirm('确定删除这个任务吗？'))return;
  await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id:id})});
  loadTasks();
}

async function runTool(kind){
  var resultEl=document.getElementById('tool-result');
  function showErr(msg){toast(msg,'error');if(resultEl)resultEl.textContent='❌ '+msg}
  var url='', q, label='';
  if(kind==='search'){
    q=document.getElementById('tool-search-q');if(!q)return;
    var v=q.value.trim();
    if(!v){toast('请输入搜索关键词','error');q.focus();q.style.borderColor='#ff6b6b';return}
    q.style.borderColor='';
    url='/tools/search?q='+encodeURIComponent(v);label='搜索: '+v;
  }else if(kind==='video'){
    q=document.getElementById('tool-video-bvid');if(!q)return;
    var v=q.value.trim();
    if(!v){toast('请输入视频 BV 号','error');q.focus();q.style.borderColor='#ff6b6b';return}
    if(!/^BV[A-Za-z0-9]+$/i.test(v)){toast('BV 号格式不对，应以 BV 开头，如 BV1xx411c7mu','error');q.focus();q.select();q.style.borderColor='#ff6b6b';return}
    q.style.borderColor='';
    url='/tools/video?bvid='+v;label='视频: '+v;
  }else if(kind==='whois'){
    q=document.getElementById('tool-whois-mid');if(!q)return;
    var v=q.value.trim();
    if(!v){toast('请输入 UP 主 MID','error');q.focus();q.style.borderColor='#ff6b6b';return}
    if(!/^\d+$/.test(v)){toast('MID 必须是纯数字','error');q.focus();q.select();q.style.borderColor='#ff6b6b';return}
    q.style.borderColor='';
    url='/tools/whois?mid='+v;label='MID: '+v;
  }else if(kind==='feed'){
    url='/tools/feed';label='刷新 Feed';
  }else{toast('未知工具: '+kind,'error');return}
  toast('请求中...','info');
  if(resultEl){resultEl.textContent='⏳ '+label+'\n请求中，请稍候...\n';resultEl.scrollTop=0}
  try{
    var r=await fetch(url);
    var text=await r.text();
    if(!r.ok){if(resultEl)resultEl.textContent='❌ HTTP '+r.status+'\n\n'+text;toast('请求失败: '+r.status,'error');return}
    if(resultEl)resultEl.textContent=text||'(空输出)';
    toast('完成 ✓','ok');
  }catch(e){
    if(resultEl)resultEl.textContent='❌ 网络错误: '+e.message;
    toast('网络错误','error');
  }
}

loadTasks();
setInterval(loadTasks,30000);

async function showTokenChart(){
  var modal=document.getElementById('token-modal');
  var content=document.getElementById('token-chart-content');
  modal.style.display='flex';
  content.textContent='加载中...';
  try{
    var r=await fetch('/tokens');
    var j=await r.json();
    var data=j.history||[];
    if(data.length===0){
      content.innerHTML='<div style="text-align:center;padding:40px;color:var(--c-text-dim)">暂无数据<br><small>分身还没醒过，今天 token 消耗为 0</small></div>';
      return;
    }
    renderTokenChart(data);
  }catch(e){
    content.textContent='加载失败: '+e.message;
  }
}
function closeTokenChart(){document.getElementById('token-modal').style.display='none'}
function renderTokenChart(data){
  var content=document.getElementById('token-chart-content');
  var W=720,H=280,PL=60,PR=20,PT=20,PB=40;
  var iw=W-PL-PR,ih=H-PT-PB;
  var maxVal=Math.max(...data.map(function(d){return Math.max(d.total||0,d.input||0,d.output||0)}),5000);
  var niceMax=Math.ceil(maxVal/5000)*5000;
  var n=data.length;
  var xStep=n>1?iw/(n-1):0;
  var xOf=function(i){return PL+i*xStep};
  var yOf=function(v){return PT+ih-(v/niceMax*ih)};
  var svg='<svg width="100%" viewBox="0 0 '+W+' '+H+'" style="max-width:720px">';
  for(var i=0;i<=4;i++){
    var y=PT+ih/4*i;
    var v=Math.round(niceMax-niceMax/4*i);
    svg+='<line x1="'+PL+'" y1="'+y+'" x2="'+(W-PR)+'" y2="'+y+'" stroke="#2a2d36" stroke-dasharray="3,3"/>';
    svg+='<text x="'+(PL-8)+'" y="'+(y+4)+'" text-anchor="end" fill="#889" font-size="12">'+(v>=1000?(v/1000).toFixed(0)+'k':v)+'</text>';
  }
  data.forEach(function(d,i){
    var x=xOf(i);
    var shortDate=d.date.slice(5);
    svg+='<text x="'+x+'" y="'+(H-PB+18)+'" text-anchor="middle" fill="#889" font-size="11">'+shortDate+'</text>';
  });
  var colors={input:'#38bdf8',output:'#ff9f43'};
  ['input','output'].forEach(function(key){
    var pts='';
    data.forEach(function(d,i){pts+=xOf(i)+','+yOf(d[key]||0)+' '});
    pts=pts.trim();
    svg+='<polyline points="'+pts+'" fill="none" stroke="'+colors[key]+'" stroke-width="2.5"/>';
    data.forEach(function(d,i){
      var v=d[key]||0;
      var label=key==='input'?'输入':'输出';
      svg+='<circle cx="'+xOf(i)+'" cy="'+yOf(v)+'" r="5" fill="'+colors[key]+'" stroke="#fff" stroke-width="1.5" style="cursor:pointer"><title>'+d.date+' '+label+': '+v.toLocaleString()+' tokens</title></circle>';
    });
  });
  var today=new Date().toLocaleDateString('sv-SE');
  var todayIdx=data.findIndex(function(d){return d.date===today});
  if(todayIdx>=0){
    var xs=xOf(todayIdx);
    var w=xStep||40;
    svg+='<rect x="'+(xs-w/2)+'" y="'+PT+'" width="'+w+'" height="'+ih+'" fill="#0ea5e9" opacity="0.08"/>';
  }
  svg+='</svg>';
  var tot=data.reduce(function(s,d){return s+(d.total||0)},0);
  var calls=data.reduce(function(s,d){return s+(d.apiCalls||0)},0);
  var avgDays=data.length;
  var avg=Math.round(tot/Math.max(avgDays,1));
  content.innerHTML='<div class="chart-summary">'+
    '<div class="mini-stat"><div class="ms-label">总消耗</div><div class="ms-value">'+tot.toLocaleString()+'</div></div>'+
    '<div class="mini-stat"><div class="ms-label">API 调用</div><div class="ms-value">'+calls+'</div></div>'+
    '<div class="mini-stat"><div class="ms-label">有效天数</div><div class="ms-value">'+avgDays+'</div></div>'+
    '<div class="mini-stat"><div class="ms-label">日均</div><div class="ms-value">'+avg.toLocaleString()+'</div></div>'+
    '</div>'+
    '<div class="chart-legend">'+
    '<span><i class="dot" style="background:#38bdf8"></i>输入 (prompt)</span>'+
    '<span><i class="dot" style="background:#ff9f43"></i>输出 (completion)</span>'+
    (todayIdx>=0?'<span style="color:#0ea5e9">▌今日高亮</span>':'')+
    '</div>'+svg;
}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeTokenChart()});

function testCreds(){
  var b=document.getElementById('btn-test-creds');
  var r=document.getElementById('creds-test-result');
  if(!b)return;
  b.disabled=true;b.textContent='测试中...';
  if(r){r.textContent='';r.style.color=''};
  fetch('/api/test-creds',{method:'POST'}).then(function(x){return x.json()}).then(function(d){
    var p=[];
    if(d.doubao)p.push('豆包: '+(d.doubao.ok?'✅':'❌')+' '+(d.doubao.message||'').split('（')[0]);
    if(d.bili)p.push('B站: '+(d.bili.ok?'✅':'❌')+' '+(d.bili.message||''));
    if(r){r.innerHTML=p.join('<br>');r.style.color=(d.doubao?.ok&&d.bili?.ok)?'#52c41a':'#ff4d4f'}
  }).catch(function(e){if(r){r.textContent='请求失败 '+e.message;r.style.color='#ff4d4f'}}).finally(function(){
    b.disabled=false;b.textContent='🔗 测试凭据'
  });
}

function abortAgent(){
  if(!confirm('确定中止AI? (当前tool跑完后收工)'))return;
  fetch('/api/abort',{method:'POST'}).then(function(){alert('中止信号已发送')}).catch(function(e){alert('失败 '+e.message)});
}

function showTrajectory(){
  fetch('/api/trajectory').then(function(x){return x.json()}).then(function(d){
    var h='<div style="padding:12px;font-size:13px;font-family:monospace;color:#d0d4dc;line-height:1.8">';
    if(d.runs&&d.runs.length){
      h+='<div style="font-weight:700;margin:10px 0 6px;color:#fff">📋 运行轨迹</div>';
      d.runs.slice(-20).forEach(function(r){
        var t=r.time?new Date(r.time).toLocaleTimeString('zh-CN',{hour12:false}):'';
        var ic=r.event==='start'?'🚀':r.event==='round'?'🔄':r.event==='tool'?'🛠️':r.event==='done'?'✅':r.event==='aborted'?'🛑':r.event==='api_error'?'❌':(r.event||'');
        var col=r.event==='tool'?'#38bdf8':r.event==='api_error'?'#ff4d4f':r.event==='done'?'#52c41a':'#c9d1d9';
        var det=r.usage?' usage:'+r.usage.total:r.tool?' args:'+JSON.stringify(r.args||{}).slice(0,80):'';
        h+='<div style="color:'+col+';margin:3px 0">'+t+' '+ic+' '+det+'</div>';
      });
    }
    if(d.tools&&d.tools.length){
      h+='<div style="font-weight:700;margin:14px 0 8px;color:#fff">🛠️ 工具调用历史</div>';
      d.tools.slice(-15).forEach(function(t){
        var ti=t.time?new Date(t.time).toLocaleTimeString('zh-CN',{hour12:false}):'';
        var col=t.status==='ok'?'#52c41a':t.status==='warn'?'#faad14':'#ff4d4f';
        h+='<div style="color:'+col+';margin:3px 0">'+ti+' ['+t.status+'] '+t.label+': '+t.resultSize+'chars '+t.durationMs+'ms</div>';
      });
    }
    if(!d.runs?.length&&!d.tools?.length)h+='<div style="color:#888">暂无数据 — 还没运行过</div>';
    h+='</div>';
    var el=document.getElementById('trajectory-panel');
    if(!el){
      el=document.createElement('div');
      el.id='trajectory-panel';
      el.style.cssText='position:fixed;right:20px;bottom:20px;width:540px;max-height:620px;overflow-y:auto;background:#1a1b1f;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.5);z-index:9999;border:1px solid #333';
      document.body.appendChild(el);
    }
    el.innerHTML='<div style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;background:#25252e;border-radius:12px 12px 0 0;border-bottom:1px solid #333"><strong style="color:#fff">📋 AI活动轨迹</strong><button onclick="document.getElementById(\'trajectory-panel\').remove()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:22px;line-height:1">×</button></div>'+h;
  }).catch(function(e){alert('加载失败 '+e.message)});
}

fetch('/api/version').then(function(x){return x.json()}).then(function(d){var el=document.getElementById('ver-badge');if(el)el.textContent='v'+(d.version||'?')}).catch(function(){});