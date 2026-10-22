(function(){
  // BV 号自动变蓝链（evt-note / evt-target 里的 BV1xxx → 可点击 a 标签）
  window.bvLink=function(text){
    return String(text||'').replace(/\b(BV[0-9A-Za-z]{10})\b/g,'<a href="https://www.bilibili.com/video/$1" target="_blank" rel="noopener" style="color:#1890ff;text-decoration:none;font-weight:600" onclick="event.stopPropagation()">$1</a>');
  };
  function setFS(s){
    var m={sm:'15',md:'19',lg:'24'};
    var p=m[s]||'19';
    localStorage.setItem('fs',p);
    document.documentElement.style.setProperty('--fs-base',p+'px');
    // 页面大部分字号是固定 px，仅靠变量看不出变化；整体缩放才能生效
    document.body.style.zoom=(parseInt(p,10)/19);
    document.querySelectorAll('#btn-fs-sm,#btn-fs-md,#btn-fs-lg').forEach(function(b){b.classList.remove('active')});
    var mp={sm:'btn-fs-sm',md:'btn-fs-md',lg:'btn-fs-lg'};
    var el=document.getElementById(mp[s]);
    if(el)el.classList.add('active');
  }
  function setTheme(t){
    localStorage.setItem('theme',t);
    document.documentElement.setAttribute('data-theme',t);
    var b=document.getElementById('btn-theme');
    if(b)b.innerHTML=t==='light'?'<span class="iconfont icon-sun" style="font-size:14px"></span>':'<span class="iconfont icon-moon" style="font-size:14px"></span>';
  }
  var c=localStorage.getItem('fs')||'19';
  if(c==='15')setFS('sm');else if(c==='24')setFS('lg');else setFS('md');
  setTheme(localStorage.getItem('theme')||'light');
  var s1=document.getElementById('btn-fs-sm');if(s1)s1.onclick=function(){setFS('sm')};
  var s2=document.getElementById('btn-fs-md');if(s2)s2.onclick=function(){setFS('md')};
  var s3=document.getElementById('btn-fs-lg');if(s3)s3.onclick=function(){setFS('lg')};
  var s4=document.getElementById('btn-theme');if(s4)s4.onclick=function(){var n=document.documentElement.getAttribute('data-theme')||'dark';setTheme(n==='dark'?'light':'dark')};

  // ===== 形象设置 =====
  var MASCOTS=[
    {id:'doubao',name:'豆包'},{id:'deepseek',name:'DeepSeek'},{id:'gpt',name:'ChatGPT'},
    {id:'kimi',name:'Kimi'},{id:'claud',name:'Claude'},{id:'gemini',name:'Gemini'},
    {id:'qwen',name:'通义千问'},{id:'yuanbao',name:'元宝'},{id:'hunyuan',name:'混元'},
    {id:'gork',name:'Grok'},{id:'minimax',name:'MiniMax'},{id:'mistral',name:'Mistral'},
    {id:'wxyy',name:'文心一言'},{id:'xiaomi',name:'小米'},{id:'RWKV',name:'RWKV'}
  ];
  var MS_KEY='mascot-settings';
  var ms={char:'doubao',pos:'sidebar',scale:100,opacity:100,offset:0,x:0};
  try{var saved=JSON.parse(localStorage.getItem(MS_KEY)||'null');if(saved)ms=Object.assign(ms,saved)}catch(e){}
  function msUrl(id){return '/mascot/'+id+'.png'}
  function applyMascot(){
    var sb=document.getElementById('sb-mascot');
    var pg=document.getElementById('page-mascot');
    var url=msUrl(ms.char);
    var w=Math.round(250*ms.scale/100);
    if(sb){
      if(ms.pos==='sidebar'){sb.style.display='';sb.src=url;sb.style.width=w+'px';sb.style.opacity=ms.opacity/100;sb.style.bottom=(60+ms.offset)+'px';sb.style.marginLeft=ms.x+'px'}
      else sb.style.display='none';
    }
    if(pg){
      if(ms.pos==='float'){pg.style.display='';pg.src=url;pg.style.width=w+'px';pg.style.opacity=ms.opacity/100;pg.style.bottom=ms.offset+'px';pg.style.right=(24-ms.x)+'px'}
      else pg.style.display='none';
    }
    document.querySelectorAll('.mp-char').forEach(function(c){c.classList.toggle('active',c.dataset.id===ms.char)});
    document.querySelectorAll('#mp-pos button').forEach(function(b){b.classList.toggle('active',b.dataset.pos===ms.pos)});
    localStorage.setItem(MS_KEY,JSON.stringify(ms));
  }
  var mpGrid=document.getElementById('mp-grid');
  if(mpGrid){
    MASCOTS.forEach(function(m){
      var d=document.createElement('div');
      d.className='mp-char';d.dataset.id=m.id;d.title=m.name;
      d.innerHTML='<img src="'+msUrl(m.id)+'" alt="'+m.name+'" loading="lazy">';
      d.onclick=function(){ms.char=m.id;applyMascot()};
      mpGrid.appendChild(d);
    });
  }
  document.querySelectorAll('#mp-pos button').forEach(function(b){
    b.onclick=function(){ms.pos=b.dataset.pos;applyMascot()};
  });
  var mpScale=document.getElementById('mp-scale');
  if(mpScale){mpScale.value=ms.scale;
    document.getElementById('mp-scale-val').textContent=ms.scale+'%';
    mpScale.oninput=function(){ms.scale=parseInt(mpScale.value,10);document.getElementById('mp-scale-val').textContent=ms.scale+'%';applyMascot()};
  }
  var mpOff=document.getElementById('mp-offset');
  if(mpOff){mpOff.value=ms.offset;
    document.getElementById('mp-offset-val').textContent=ms.offset+'px';
    mpOff.oninput=function(){ms.offset=parseInt(mpOff.value,10);document.getElementById('mp-offset-val').textContent=ms.offset+'px';applyMascot()};
  }
  var mpX=document.getElementById('mp-x');
  if(mpX){mpX.value=ms.x;
    document.getElementById('mp-x-val').textContent=ms.x+'px';
    mpX.oninput=function(){ms.x=parseInt(mpX.value,10);document.getElementById('mp-x-val').textContent=ms.x+'px';applyMascot()};
  }
  var mpOp=document.getElementById('mp-opacity');
  if(mpOp){mpOp.value=ms.opacity;
    document.getElementById('mp-opacity-val').textContent=ms.opacity+'%';
    mpOp.oninput=function(){ms.opacity=parseInt(mpOp.value,10);document.getElementById('mp-opacity-val').textContent=ms.opacity+'%';applyMascot()};
  }
  var btnMs=document.getElementById('btn-mascot-set');
  var msPanel=document.getElementById('mascot-panel');
  if(btnMs&&msPanel){
    btnMs.onclick=function(e){e.stopPropagation();msPanel.style.display=msPanel.style.display==='none'?'':'none'};
    document.addEventListener('click',function(e){
      if(msPanel.style.display!=='none'&&!msPanel.contains(e.target))msPanel.style.display='none';
    });
  }
  applyMascot();
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

  var biliSt=document.getElementById('stat-bili-api');
  if(biliSt){biliSt.classList.remove('ok','err');biliSt.classList.add(d.creds?.sessdata?'ok':'err');biliSt.querySelector('.value').textContent=d.creds?.sessdata?'Cookie OK':'请登录'}

  var userSt=document.getElementById('stat-user');
  userSt.classList.remove('ok','err');
  userSt.classList.add(d.bili?.ownerMid?'ok':'err');
  userSt.querySelector('.value').textContent=d.bili?.ownerName||'未设置';

  if(d.latestDiary){
    var card=document.getElementById('latest-diary-card');
    card.style.display='block';
    document.getElementById('latest-diary-title').textContent='最新日记 · '+(d.latestDiary.date||'');
    var body=document.getElementById('latest-diary-body');
    // BV 号自动变蓝链（bvLink 定义在文件顶部）
    var html='<div class="diary-event evt-thought" style="cursor:pointer" onclick="this.classList.toggle(\'expanded\')"><div class="evt-body"><div class="evt-note">'+bvLink(d.latestDiary.summary||'...')+'</div></div></div>';
    (d.latestDiary.events||[]).forEach(function(ev){
      html+='<div class="diary-event evt-'+(ev.kind||'event')+'" style="cursor:pointer" onclick="this.classList.toggle(\'expanded\')"><div class="evt-body"><div class="evt-head"><span class="evt-time">'+(ev.time||'')+'</span>'+(ev.target?'<span class="evt-target">'+bvLink(ev.target)+'</span>':'')+'</div><div class="evt-note">'+bvLink(ev.note||'')+'</div></div></div>';
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
loadAtMe();

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
    var fw=await fetch('/api/fw-config').then(function(r){return r.json()}).catch(function(){return {}});
    var fwEl=document.getElementById('fw-enabled');if(fwEl)fwEl.checked=!!fw.enabled;
    fwEl=document.getElementById('fw-interval');if(fwEl)fwEl.value=fw.interval||300;
    fwEl=document.getElementById('fw-ol');if(fwEl)fwEl.checked=!!fw.onlyWhitelist;
    fwEl=document.getElementById('fw-nc');if(fwEl)fwEl.checked=!!fw.noComment;
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

var diaryAutoCb=document.getElementById('diary-auto-cb');
var diaryAutoTag=document.getElementById('diary-auto-tag');
if(diaryAutoCb){
  (async function(){
    var cfg=await fetch('/config').then(function(r){return r.json()});
    var auto=cfg.diary?cfg.diary.auto!==false:true;
    diaryAutoCb.checked=auto;
    if(diaryAutoTag){
      diaryAutoTag.textContent=auto?'自动日记：开':'自动日记：关';
      diaryAutoTag.className='tag '+(auto?'online':'offline');
    }
  })();
  diaryAutoCb.onchange=async function(){
    var body={diary:{auto:diaryAutoCb.checked}};
    await fetch('/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(diaryAutoTag){
      diaryAutoTag.textContent=diaryAutoCb.checked?'自动日记：开':'自动日记：关';
      diaryAutoTag.className='tag '+(diaryAutoCb.checked?'online':'offline');
    }
    toast('自动日记已'+(diaryAutoCb.checked?'开启':'关闭'),'ok');
  };
}
var btnGenDiary=document.getElementById('btn-gen-diary');
if(btnGenDiary){
  btnGenDiary.onclick=async function(){
    btnGenDiary.disabled=true;btnGenDiary.textContent='正在生成...';
    var resultDiv=document.getElementById('diary-gen-result');
    try{
      var r=await fetch('/api/generate-diary',{method:'POST'}).then(function(r){return r.json()});
      if(r.ok){
        btnGenDiary.textContent='✨ 生成完成！';
        resultDiv.style.display='block';
        resultDiv.style.color='#52c41a';
        resultDiv.textContent='已写入 '+r.count+' 条日记事件。'+(r.note||'');
        toast('日记生成成功 ✓','ok');
        setTimeout(function(){btnGenDiary.disabled=false;btnGenDiary.textContent='✨ 生成今日日记总结';loadDiary();},2000);
      }else{
        throw new Error(r.error||'生成失败');
      }
    }catch(e){
      btnGenDiary.disabled=false;btnGenDiary.textContent='✨ 生成今日日记总结';
      resultDiv.style.display='block';resultDiv.style.color='#ff4d4f';resultDiv.textContent=e.message;
      toast('生成失败：'+e.message,'error');
    }
  };
}

var btnExportLog=document.getElementById('btn-export-log');
if(btnExportLog){
  btnExportLog.onclick=async function(){
    var tip=document.getElementById('export-log-tip');
    var box=document.getElementById('export-log-box');
    btnExportLog.disabled=true;btnExportLog.textContent='生成中...';
    try{
      var r=await fetch('/api/export-log').then(function(r){return r.json()});
      if(!r.ok)throw new Error(r.error||'导出失败');
      box.style.display='block';
      box.value=r.text;
      box.scrollTop=0;
      var copied=false;
      try{await navigator.clipboard.writeText(r.text);copied=true;}catch(e){}
      if(!copied){
        try{box.focus();box.select();copied=document.execCommand('copy');}catch(e){}
      }
      if(!copied){box.focus();box.select();}
      tip.textContent=copied?'已复制到剪贴板 · '+r.date:'已生成，请手动复制 · '+r.date;
      toast('日志素材已生成'+(copied?'并复制':''));
    }catch(e){
      tip.textContent=e.message;
      toast('导出失败：'+e.message,'error');
    }finally{
      btnExportLog.disabled=false;btnExportLog.textContent='生成日志素材';
    }
  };
}

var btnSaveFW=document.getElementById('btn-save-fw');if(btnSaveFW)btnSaveFW.onclick=async function(){
  var body={
    enabled:document.getElementById('fw-enabled').checked,
    interval:document.getElementById('fw-interval').value,
    onlyWhitelist:document.getElementById('fw-ol').checked,
    noComment:document.getElementById('fw-nc').checked,
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
    var evts=(d.events||[]).slice().reverse().map(function(ev){
      var cls='evt-'+(ev.kind||'event');
      var label=KIND_LABEL[ev.kind]||ev.kind||'事件';
      return '<div class="diary-event '+cls+'" style="cursor:pointer" onclick="this.classList.toggle(\'expanded\')">'+
        '<span class="evt-tag">'+label+'</span>'+
        '<div class="evt-body">'+
          '<div class="evt-head">'+
            '<span class="evt-time">'+(ev.time||'')+'</span>'+
            (ev.target?'<span class="evt-target">'+bvLink(ev.target)+'</span>':'')+
          '</div>'+
          '<div class="evt-note">'+bvLink(ev.note||'')+'</div>'+
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
    var typeTag='';if(t.type==='script')typeTag='<span class="task-chip" style="background:#f0f5ff;color:#1890ff;border-color:#adc6ff">脚本</span>';
    var meta='<div class="task-meta">'+
      typeTag+
      '<span class="task-chip">'+(t.days||'每天')+'</span>'+
      '<span class="task-chip">'+(t.time||'--:--')+'</span>'+
      '<span class="task-chip">提前'+(t.leadMin||0)+'分钟</span>'+
      (t.ownerRef?'<span class="task-chip">引流: '+t.ownerRef+'</span>':'')+
      (t.lastRun?'<span class="mini">上次: '+t.lastRun+'</span>':'')+
    '</div>';
    var desc='';if(t.description)desc='<div class="task-desc">'+t.description+'</div>';
    var tmpl='';if(t.template)tmpl='<div class="task-desc" style="opacity:.6">预设文案: '+t.template.slice(0,60)+(t.template.length>60?'...':'')+'</div>';
    var act='<div class="task-actions">'+
      '<button class="btn ghost" data-id="'+t.id+'" onclick="runNowTask(this)">立即执行</button>'+
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

function loadTaskDashboard(){
  var d=new Date();
  document.getElementById('task-date').textContent=d.toLocaleDateString('zh-CN')+' '+['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];

  fetch('/api/daily-report').then(function(r){return r.json()}).then(function(d){
    var box=document.getElementById('task-overview');
    if(!box||!d)return;
    var total=(d.archives||0)+(d.danmus||0)+(d.comments||0);
    box.innerHTML=
      '<div class="ov-chip"><div class="ov-num">'+(d.archives||0)+'</div><div class="ov-lbl">三连</div></div>'+
      '<div class="ov-chip"><div class="ov-num">'+(d.danmus||0)+'</div><div class="ov-lbl">弹幕</div></div>'+
      '<div class="ov-chip"><div class="ov-num">'+(d.comments||0)+'</div><div class="ov-lbl">评论</div></div>'+
      '<div class="ov-chip accent"><div class="ov-num">'+total+'</div><div class="ov-lbl">今日互动</div></div>'+
      '<div class="ov-chip"><div class="ov-num">'+(d.totalLogs||0)+'</div><div class="ov-lbl">日志条数</div></div>';
  }).catch(function(){});

  fetch('/api/daily-checkin').then(function(r){return r.json()}).then(function(c){
    var box=document.getElementById('checkin-box');
    if(!box)return;
    if(!c.ok){box.innerHTML='<span class="mini" style="color:#ff4d4f">'+(c.error||'查询失败')+'</span>';return}
    var level=c.level||{};
    var levelHtml='';
    if(level.current_level!=null){
      var cur=level.current_exp||0;var next=level.next_exp||1;var min=level.current_min||0;
      var pct=Math.min(100,Math.round((cur-min)/(next-min)*100));
      levelHtml='<div class="ci-level">'+
        '<div class="ci-lv">Lv.'+level.current_level+'</div>'+
        '<div class="ci-bar-bg"><div class="ci-bar" style="width:'+pct+'%"></div></div>'+
        '<div class="ci-exp">'+cur+' / '+next+' 经验</div>'+
      '</div>';
    }
    var taskHtml=(c.tasks||[]).map(function(t){
      return '<div class="ci-task '+(t.done?'done':'')+'">'+
        '<span class="ci-check">'+(t.done?'✓':'○')+'</span>'+
        '<span class="ci-name">'+t.label+'</span>'+
        '<span class="ci-exp">+'+t.exp+' 经验</span>'+
      '</div>';
    }).join('');
    box.innerHTML=levelHtml+'<div class="ci-total">今日可得: <b>'+c.totalExp+'</b> 经验 '+
      (c.allDone?'<span style="color:#52c41a">· 全部完成 🎉</span>':'<span style="color:#faad14">· 还有未完成</span>')+'</div>'+
      '<div class="ci-tasks">'+taskHtml+'</div>';
  }).catch(function(){});

  fetch('/api/follow/status').then(function(r){return r.json()}).then(function(f){
    var box=document.getElementById('follow-box');
    if(!box)return;
    var statusHtml=f.running?'<span class="tag ok">● 运行中 (PID '+f.pid+')</span>':'<span class="tag err">○ 已停止</span>';
    var modeHtml=f.noComment?'<span class="tag warn">养号模式</span>':'<span class="tag ok">全功能模式</span>';
    var whitelist=f.onlyWhitelist?'<span class="tag">仅白名单</span>':'<span class="tag">全部关注</span>';
    var btnHtml=f.running?'<button class="btn ghost danger" onclick="followToggle(\'stop\')">停止守望</button>':'<button class="btn primary" onclick="followToggle(\'start\')">启动守望</button>';
    box.innerHTML='<div class="follow-head">'+statusHtml+modeHtml+whitelist+'</div>'+
      '<div class="follow-info">扫描间隔: <b>'+f.interval+'s</b> ('+(Math.round(f.interval/60*10)/10)+' 分钟)</div>'+
      '<div style="margin-top:10px">'+btnHtml+'</div>';
  }).catch(function(){});

  fetch('/api/follow/sync-status').then(function(r){return r.json()}).then(function(s){
    var box=document.getElementById('sync-box');
    var info=document.getElementById('sync-info');
    if(!box)return;
    if(s.total===0){box.innerHTML='<span class="mini" style="color:var(--c-text-mid)">暂无同步计划</span>';return}
    if(info&&s.lastRunDate)info.textContent='上次: '+s.lastRunDate+' · 今日: '+s.doneToday;
    var barColor=s.remaining>0?'#1890ff':'#52c41a';
    box.innerHTML=
      '<div class="sync-bar-bg"><div class="sync-bar" style="width:'+s.pct+'%;background:'+barColor+'"></div></div>'+
      '<div class="sync-nums">'+
        '<span>总目标 <b>'+s.total+'</b></span>'+
        '<span style="color:#52c41a">已同步 <b>'+s.done+'</b></span>'+
        '<span style="color:#ff4d4f">失败 <b>'+s.failed+'</b></span>'+
        '<span style="color:#faad14">剩余 <b>'+s.remaining+'</b></span>'+
        '<span class="mini">('+s.pct+'%)</span>'+
      '</div>'+
      (s.recentFailures&&s.recentFailures.length?'<div style="margin-top:8px;font-size:12px;color:#ff4d4f">最近失败: '+s.recentFailures.map(function(x){return x.uname+'('+x.code+')'}).join(' · ')+'</div>':'')+
      '<div style="margin-top:10px"><button class="btn ghost" onclick="runFollowSync()">立即手动跑一轮</button></div>';
  }).catch(function(){});
}

window.runFollowSync=async function(){
  var r=await fetch('/api/task/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'follow-sync'})}).then(function(r){return r.json()});
  if(r&&r.ok)toast('关注同步执行成功','success');
  else toast('执行失败: '+(r&&r.err?r.err.slice(0,60):'未知错误'),'error');
  loadTaskDashboard();loadTasks();
};
loadTaskDashboard();
setInterval(loadTaskDashboard,60000);

window.runNowTask=async function(btn){
  var id=btn.dataset.id;
  var oldText=btn.textContent;
  btn.textContent='执行中...';btn.disabled=true;
  var r=await fetch('/api/task/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id})}).then(function(r){return r.json()});
  btn.textContent=oldText;btn.disabled=false;
  if(r&&r.ok){toast('任务执行成功','success');loadTasks()}
  else toast('执行失败: '+(r&&r.err?r.err.slice(0,60):'未知错误'),'error');
};

window.followToggle=async function(action){
  var r=await fetch('/api/follow/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action})}).then(function(r){return r.json()});
  if(r&&r.ok)toast(action==='start'?'守望已启动':'守望已停止','success');
  else toast('操作失败','error');
  loadTaskDashboard();
};

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
    b.disabled=false;b.textContent='<span class="iconfont icon-feedback"></span> 测试凭据'
  });
}

function abortAgent(){
  if(!confirm('确定中止AI? (当前tool跑完后收工)'))return;
  fetch('/api/abort',{method:'POST'}).then(function(){alert('中止信号已发送')}).catch(function(e){alert('失败 '+e.message)});
}

var _trajTimer=null;
function _bjTime(s){if(!s)return '';if(typeof s==='string'&&(/^\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)||/^\d{2}:\d{2}:\d{2}$/.test(s)))return s;try{return new Date(s).toLocaleTimeString('zh-CN',{hour12:false,timeZone:'Asia/Shanghai'}).slice(0,8)}catch{return s||''}}
function _renderTrajectory(d){
  var el=document.getElementById('trajectory-panel');
  if(!el)return;
  var h='';
  var cs=d.currentStatus||{};
  var dot=cs.status==='running'?'<span style="display:inline-block;width:8px;height:8px;background:#52c41a;border-radius:50%;animation:pulse 1s infinite"></span>':'<span style="display:inline-block;width:8px;height:8px;background:#888;border-radius:50%"></span>';
  h+='<div style="padding:10px 14px;background:#16212f;border-bottom:1px solid #333">';
  h+='  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
  h+='    <span style="color:#fff;font-weight:600">'+dot+' 当前状态</span>';
  h+='    <span style="color:#aaa;font-size:11px">'+_bjTime(cs.lastAt)+'</span>';
  h+='  </div>';
  h+='  <div style="color:#38bdf8;font-size:13px">'+(cs.status==='running'?'<span class="iconfont icon-dot" style="color:#52c41a"></span> 在忙 · '+cs.activity:'<span class="iconfont icon-dot" style="color:#888"></span> 空闲中 · 上一次 '+cs.activity||'无记录')+'</div>';
  h+='  <div style="color:#888;font-size:11px;margin-top:3px">'+(cs.detail||'')+'</div>';
  h+='</div>';
  h+='<div style="padding:8px 14px;background:'+(d.followRunning?'#0d2818':'#2a1010')+';border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center">';
  h+='  <span style="font-size:12px;color:'+(d.followRunning?'#52c41a':'#ff7875')+'">'+(d.followRunning?'<span class="iconfont icon-dot" style="color:#52c41a"></span> 关注守望运行中':'<span class="iconfont icon-dot" style="color:#ff4d4f"></span> 关注守望已停止')+'</span>';
  h+='  <span class="iconfont icon-doubao" style="font-size:10px;margin-right:3px;color:#ff6b35"></span><span style="font-size:11px;color:#888">'+(d.whaleMtime?'日记文件最后更新: '+d.whaleMtime:'无日记文件')+'</span>';
  h+='</div>';
  h+='<div style="padding:12px;font-size:12.5px;font-family:monospace;color:#d0d4dc;line-height:1.75">';
  if(d.runs&&d.runs.length){
    h+='<div style="font-weight:700;margin:6px 0 6px;color:#fff"><span class="iconfont icon-trajectory"></span> 活动流水 ('+d.runs.length+')</div>';
    d.runs.slice(-30).reverse().forEach(function(r){
      var t=_bjTime(r.time);
      var ic=r.event==='start'?'<span class="iconfont icon-play"></span>':r.event==='round'?'<span class="iconfont icon-refresh"></span>':r.event==='tool'?'<span class="iconfont icon-settings"></span>':r.event==='done'?'<span class="iconfont icon-done"></span>':r.event==='aborted'?'<span class="iconfont icon-x"></span>':r.event==='api_error'?'<span class="iconfont icon-report"></span>':r.event==='forced'?'<span class="iconfont icon-x"></span>':r.event==='wake'?'<span class="iconfont icon-bell"></span>':r.event==='thought'?'<span class="iconfont icon-message"></span>':r.event==='comment'?'<span class="iconfont icon-edit-pen"></span>':r.event==='feeling'?'<span class="iconfont icon-qa"></span>':r.event==='summary'?'<span class="iconfont icon-history"></span>':'<span class="iconfont icon-plus-circle"></span>';
      var col=r.event==='tool'?'#38bdf8':r.event==='api_error'?'#ff4d4f':r.event==='done'?'#52c41a':r.event==='comment'?'#95de64':r.event==='summary'?'#ffd666':r.event==='wake'?'#36cfc9':'#c9d1d9';
      var detail='';
      if(r.event==='thought'||r.event==='event'||r.event==='summary'){
        detail=r.content||r.note||r.summary||'';
      }else if(r.usage){detail=' usage:'+r.usage.total}
      else if(r.tool){detail=' '+r.tool+' '+(r.args?JSON.stringify(r.args).slice(0,60):'')}
      var _detail=detail||''; if(r.link&&r.target){_detail=_detail.replace(r.target,'<a href="'+r.link+'" target="_blank" style="color:#40a9ff;text-decoration:none">'+r.target+'</a>')} h+='<div style="color:'+col+';margin:2px 0">'+t+' '+ic+' '+_detail+'</div>';
    });
  }
  if(d.tools&&d.tools.length){
    h+='<div style="font-weight:700;margin:12px 0 6px;color:#fff"><span class="iconfont icon-settings"></span> 工具调用</div>';
    d.tools.slice(-15).reverse().forEach(function(t){
      var ti=_bjTime(t.time);
      var col=t.status==='ok'?'#52c41a':t.status==='warn'?'#faad14':'#ff4d4f';
      var _lbl=t.label; if(t.link&&t.target){_lbl=_lbl.replace(t.target,'<a href="'+t.link+'" target="_blank" style="color:#40a9ff;text-decoration:none;font-weight:600">'+t.target+'</a>')} h+='<div style="color:'+col+';margin:2px 0">'+ti+' ['+t.status+'] '+_lbl+': '+t.resultSize+'chars '+t.durationMs+'ms</div>';
    });
  }
  if(!d.runs?.length&&!d.tools?.length)h+='<div style="color:#888">暂无数据</div>';
  h+='</div>';
  el.querySelector('.traj-body').innerHTML=h;
}
function showTrajectory(){
  var el=document.getElementById('trajectory-panel');
  if(!el){
    el=document.createElement('div');
    el.id='trajectory-panel';
    el.style.cssText='position:fixed;right:20px;bottom:20px;width:560px;max-height:720px;background:#1a1b1f;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.5);z-index:9999;border:1px solid #333;overflow:hidden;display:flex;flex-direction:column';
    el.innerHTML='<div style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;background:#25252e;border-bottom:1px solid #333"><strong style="color:#fff">📋 AI活动轨迹</strong><button onclick="closeTrajectory()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1">×</button></div><div class="traj-body" style="overflow-y:auto;flex:1"></div>';
    document.body.appendChild(el);
  }
  function load(){
    fetch('/api/trajectory').then(function(x){return x.json()}).then(_renderTrajectory).catch(function(e){var b=el.querySelector('.traj-body');if(b)b.innerHTML='<div style="padding:20px;color:#ff4d4f">加载失败 '+e.message+'</div>'});
  }
  load();
  if(_trajTimer)clearInterval(_trajTimer);
  _trajTimer=setInterval(load,10000);
}
function closeTrajectory(){
  if(_trajTimer){clearInterval(_trajTimer);_trajTimer=null}
  var el=document.getElementById('trajectory-panel');if(el)el.remove();
}

fetch('/api/version').then(function(x){return x.json()}).then(function(d){var el=document.getElementById('ver-badge');if(el)el.textContent='v'+(d.version||'?')}).catch(function(){});

async function loadAtMe(){
  var listEl=document.getElementById('at-me-list');
  var badge=document.getElementById('at-me-badge');
  if(!listEl)return;
  listEl.textContent='加载中...';
  if(badge){badge.className='tag offline';badge.textContent='加载中'}
  try{
    var d=await fetch('/api/at-me').then(function(r){return r.json()});
    if(d.error){listEl.innerHTML='<div style="color:#ff4d4f">'+d.error+'</div>';return}
    var items=d.items||[];
    if(badge){badge.className='tag '+(items.length>0?'online':'offline');badge.textContent=items.length>0?('主人 '+items.length+' 条未回'):'没有主人的艾特'}
    if(items.length===0){listEl.innerHTML='<div style="color:#888;padding:16px 0;text-align:center">好钢用在刀刃上——目前没有主人的未处理艾特</div>';return}
    var h='';
    items.forEach(function(it){
      var time=new Date(it.at_time*1000);
      var timeStr=time.toLocaleString('zh-CN',{hour12:false});
      h+='<div style="border:1px solid #2a2d35;border-radius:10px;padding:12px 14px;margin-bottom:10px;background:#15171c">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
      h+='<a href="https://www.bilibili.com/video/'+it.bvid+'" target="_blank" style="color:#1890ff;font-weight:600;text-decoration:none">'+it.nickname+'</a>';
      h+='<span style="color:#888;font-size:13px">'+timeStr+'</span>';
      h+='</div>';
      h+='<div style="color:#c9d1d9;margin-bottom:10px;font-size:15px">'+(it.content||'(无内容)')+'</div>';
      h+='<div style="display:flex;gap:8px;align-items:center">';
      h+='<button class="btn primary" onclick="replyAtEvent('+it.id+')" id="reply-btn-'+it.id+'">✨ 一键回复</button>';
      h+='<a href="https://www.bilibili.com/video/'+it.bvid+'#reply'+it.source_id+'" target="_blank" style="font-size:13px;color:#888">前往视频</a>';
      h+='</div>';
      h+='<div id="reply-result-'+it.id+'" style="margin-top:8px"></div>';
      h+='</div>';
    });
    listEl.innerHTML=h;
  }catch(e){listEl.innerHTML='<div style="color:#ff4d4f">加载失败: '+e.message+'</div>'}
}

async function replyAtEvent(id){
  var btn=document.getElementById('reply-btn-'+id);
  var resEl=document.getElementById('reply-result-'+id);
  if(!btn)return;
  btn.disabled=true;btn.textContent='生成中...';
  if(resEl)resEl.innerHTML='';
  try{
    var r=await fetch('/api/reply-at',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:String(id)})});
    var d=await r.json();
    if(d.error){if(resEl)resEl.innerHTML='<div style="color:#ff4d4f;margin-top:6px">❌ '+d.error+'</div>';btn.disabled=false;btn.textContent='✨ 一键回复';return}
    if(resEl){
      resEl.innerHTML='<div style="color:#52c41a;margin-top:6px;padding:8px 12px;background:#162316;border-radius:8px"><div style="font-weight:600;margin-bottom:4px">✅ 已发出：</div><div style="color:#c9d1d9">'+(d.message||'')+'</div></div>';
    }
    btn.disabled=true;btn.textContent='✅ 已回复';
    setTimeout(loadAtMe,1500);
  }catch(e){
    if(resEl)resEl.innerHTML='<div style="color:#ff4d4f;margin-top:6px">❌ '+e.message+'</div>';
    btn.disabled=false;btn.textContent='✨ 一键回复';
  }
}

function animateNumber(el, target, duration) {
  duration = duration || 1000;
  var start = parseInt(el.textContent) || 0;
  var startTime = null;
  function step(ts) {
    if (!startTime) startTime = ts;
    var progress = Math.min((ts - startTime) / duration, 1);
    var ease = 1 - Math.pow(1 - progress, 3);
    var current = Math.round(start + (target - start) * ease);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function loadDailyReport() {
  fetch('/api/daily-report').then(function(r){return r.json()}).then(function(d){
    var dateEl = document.getElementById('daily-date');
    if (dateEl) dateEl.textContent = '· ' + (d.date || '');
    var roles = ['archives','danmus','comments','interactions'];
    var maxMap = { archives: 30, danmus: 30, comments: 10, interactions: 60 };
    roles.forEach(function(role){
      var card = document.querySelector('.mini-stat[data-role="'+role+'"]');
      if (!card) return;
      var numEl = card.querySelector('.mini-num');
      var barEl = card.querySelector('.mini-bar > div');
      animateNumber(numEl, d[role] || 0, 1200);
      if (barEl) {
        var pct = Math.min((d[role] || 0) / (maxMap[role] || 1), 1) * 100;
        setTimeout(function(){ barEl.style.width = pct + '%'; }, 100);
      }
    });
    var planText = document.getElementById('plan-text');
    if (planText) {
      var archives = d.archives || 0, danmus = d.danmus || 0, comments = d.comments || 0;
      var archiveOk = archives >= 30, danmuOk = danmus >= 30, commentOk = comments >= 5;
      var parts = [];
      parts.push('<span style="color:'+ (archiveOk ? '#52c41a' : '#faad14') +'"><span class="iconfont icon-bookmark-check" style="vertical-align:-2px"></span> 三连 '+archives+'/30</span>');
      parts.push('<span style="color:'+ (danmuOk ? '#52c41a' : '#faad14') +'"><span class="iconfont icon-barrage" style="vertical-align:-2px"></span> 弹幕 '+danmus+'/30</span>');
      var cfg = null;
      try { cfg = document.getElementById('fw-nc') } catch {}
      var noComment = cfg ? cfg.checked : false;
      if (noComment) {
        parts.push('<span style="color:#888"><span class="iconfont icon-edit-pen" style="vertical-align:-2px"></span> 评论（养号模式已关）</span>');
      } else {
        parts.push('<span style="color:'+ (commentOk ? '#52c41a' : '#faad14') +'"><span class="iconfont icon-edit-pen" style="vertical-align:-2px"></span> 评论 '+comments+'/5</span>');
      }
      planText.innerHTML = parts.join(' &nbsp;·&nbsp; ') + '<span style="color:#888;margin-left:12px">· 每 3 轮 idle 自动触发热门互动</span>';
      var actBox = document.getElementById('daily-actions');
      if (actBox && d.actions && d.actions.length) {
        var h = '<div style="font-size:12px;color:#888;margin-bottom:6px"><span class="iconfont icon-list" style="vertical-align:-2px"></span> 今日已操作 · 点击可跳转视频</div>';
        d.actions.slice(0,20).forEach(function(a){
          var t=new Date(a.t); var ts=t.toLocaleTimeString('zh-CN',{hour12:false,timeZone:'Asia/Shanghai'}).slice(0,5);
          var toolMap={archive:'三连',danmu:'弹幕',like:'点赞',fav:'收藏',share:'分享',comment:'评论',action:'动作'};
          var label=toolMap[a.tool]||a.tool||'操作';
          var note=(a.note||'').slice(0,40);
          var col=a.success===false?'#ff7875':'#a6e3a1';
          h += '<div style="display:flex;gap:8px;align-items:center;margin:3px 0;font-size:12px">';
          h += '<span style="color:#666;font-family:monospace">'+ts+'</span>';
          h += '<span style="color:'+col+'">'+label+'</span>';
          if(a.link) h += '<a href="'+a.link+'" target="_blank" style="color:#40a9ff;text-decoration:none;font-weight:600;font-family:monospace">'+a.target+'</a>';
          h += '<span style="color:#888;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+note+'</span>';
          h += '</div>';
        });
        actBox.innerHTML = h;
      } else if (actBox) { actBox.innerHTML = ''; }
    }
  }).catch(function(){});
}

var _biliStatsCache = null;
var _currentEcoTab = 'self';

function setupEcoTabs() {
  document.querySelectorAll('.eco-tab').forEach(function(btn){
    btn.onclick = function(){
      document.querySelectorAll('.eco-tab').forEach(function(b){b.classList.remove('active')});
      btn.classList.add('active');
      _currentEcoTab = btn.dataset.eco || 'self';
      renderBiliStats();
    };
  });
}

function renderBiliStats() {
  if (!_biliStatsCache) return;
  var d = _biliStatsCache;
  var src = _currentEcoTab === 'owner' ? d.owner : d.self;
  if (!src) return;

  var statMap = {
    following: src.following || 0,
    follower: src.follower || 0,
    likes: src.likes || 0,
    at: (_currentEcoTab === 'self' && src.unread) ? src.unread.at : 0,
    reply: (_currentEcoTab === 'self' && src.unread) ? src.unread.reply : 0,
    likeReply: (_currentEcoTab === 'self' && src.unread) ? src.unread.likeReply : 0,
  };

  var unameEl = document.getElementById('bili-uname');
  if (unameEl) {
    var label = _currentEcoTab === 'owner' ? '主号' : '小号';
    var name = src.name || src.uname || '';
    var mid = src.mid || '';
    unameEl.textContent = label + ' · ' + (name || '未知') + (mid ? ' (UID ' + mid + ')' : '');
  }

  Object.keys(statMap).forEach(function(role){
    var card = document.querySelector('.mini-stat[data-role="'+role+'"]');
    if (!card) return;
    if (_currentEcoTab === 'owner' && card.dataset.ecoOnly) {
      card.style.display = 'none';
      return;
    }
    card.style.display = '';
    var numEl = card.querySelector('.mini-num');
    animateNumber(numEl, statMap[role], 800);
  });
}

function checkCookieStatus() {
  fetch('/api/bili-stats').then(function(r){return r.json()}).then(function(d){
    _biliStatsCache = d;
    renderBiliStats();
    updateCookieUI(d);
  }).catch(function(){});
}

function formatExpire(expireTs) {
  if (!expireTs) return null;
  try {
    var ts = Number(expireTs);
    if (!ts || ts <= 0) return null;
    var now = Date.now() / 1000;
    var leftSec = ts - now;
    if (leftSec <= 0) return '已过期';
    var days = Math.floor(leftSec / 86400);
    var hours = Math.floor((leftSec % 86400) / 3600);
    var mins = Math.floor((leftSec % 3600) / 60);
    if (days > 0) return '剩 ' + days + ' 天 ' + hours + ' 小时';
    if (hours > 0) return '剩 ' + hours + ' 小时 ' + mins + ' 分';
    return '剩 ' + mins + ' 分钟';
  } catch { return null; }
}

function updateCookieUI(d) {
  var cookieInfo = d.cookieInfo;
  var biliApiStat = document.getElementById('stat-bili-api');
  var biliApiValue = biliApiStat ? biliApiStat.querySelector('.value') : null;

  if (!cookieInfo) {
    if (biliApiStat) {
      biliApiStat.classList.remove('ok', 'err', 'warn');
      biliApiStat.classList.add('err');
    }
    if (biliApiValue) biliApiValue.textContent = '未配置 Cookie';
    setSidebarCookieBadge(null);
    setCredsPageCookieStatus(null);
    return;
  }

  var isLogin = cookieInfo.isLogin === true;
  var expireStr = formatExpire(cookieInfo.expireTs);

  if (isLogin && expireStr !== '已过期') {
    if (biliApiStat) { biliApiStat.classList.remove('err', 'warn'); biliApiStat.classList.add('ok'); }
    if (biliApiValue) biliApiValue.textContent = 'Cookie OK · ' + (expireStr || '有效');
  } else if (isLogin === false) {
    if (biliApiStat) { biliApiStat.classList.remove('ok', 'warn'); biliApiStat.classList.add('err'); }
    if (biliApiValue) biliApiValue.textContent = 'Cookie 已失效';
  } else {
    if (biliApiStat) { biliApiStat.classList.remove('ok', 'err'); biliApiStat.classList.add('warn'); }
    if (biliApiValue) biliApiValue.textContent = 'Cookie 临期 · ' + expireStr;
  }

  setSidebarCookieBadge(isLogin ? 'ok' : 'expired', expireStr);
  setCredsPageCookieStatus(isLogin ? 'ok' : 'expired', expireStr);

  if (!isLogin && !window._cookieWarned) {
    window._cookieWarned = true;
    toast('⚠️ B站 Cookie 已失效，请前往「凭据」页更新', 'error');
  } else if (expireStr && expireStr.indexOf('剩') === 0) {
    var days = parseInt(expireStr, 10);
    if (days <= 3 && days >= 1 && !window._cookieWarnedSoon) {
      window._cookieWarnedSoon = true;
      toast('⏰ Cookie 即将过期，' + expireStr, 'info');
    }
  }
}

function setSidebarCookieBadge(status, expireStr) {
  var desc = document.querySelector('.sb-user-desc');
  if (!desc) return;
  if (status === 'ok') {
    desc.innerHTML = '<span style="color:#52c41a"><span class="iconfont icon-dot" style="font-size:8px"></span> Cookie 有效</span>' +
      (expireStr ? '<span style="color:#888;margin-left:6px;font-size:11px">(' + expireStr + ')</span>' : '');
  } else if (status === 'expired') {
    desc.innerHTML = '<span style="color:#ff4d4f;font-weight:600"><span class="iconfont icon-report"></span> Cookie 已过期</span>' +
      '<a href="javascript:void(0)" onclick="document.querySelector(\'.tab[data-tab=creds]\').click()" style="color:#ff7875;margin-left:6px;font-size:11px;text-decoration:underline">去更新 →</a>';
  } else {
    desc.innerHTML = '<span style="color:#888">B站小号 · 养号中</span>';
  }
}

function setCredsPageCookieStatus(status, expireStr) {
  var tag = document.getElementById('bili-status');
  if (!tag) return;
  if (status === 'ok') {
    tag.className = 'tag online';
    tag.textContent = 'Cookie OK' + (expireStr ? ' · ' + expireStr : '');
  } else if (status === 'expired') {
    tag.className = 'tag offline';
    tag.textContent = 'Cookie 已过期，急需更新！';
  } else {
    tag.className = 'tag offline';
    tag.textContent = '未配置';
  }
}

setupEcoTabs();
loadDailyReport();
checkCookieStatus();
setInterval(loadDailyReport, 60000);
setInterval(checkCookieStatus, 300000);

// ===== 数据面板图表 =====
var _dataPanelLoaded = false;
var _dataPanelCache = null;
var _dataCurrentAcc = 'self';

function setupDataPanel() {
  var group = document.getElementById('data-account');
  if (group) {
    group.querySelectorAll('.seg-btn').forEach(function(btn){
      btn.onclick = function(){
        group.querySelectorAll('.seg-btn').forEach(function(b){b.classList.remove('active')});
        btn.classList.add('active');
        _dataCurrentAcc = btn.dataset.acc;
        if (_dataPanelCache) {
          drawDataCharts(_dataPanelCache);
          renderDataSummary(_dataPanelCache);
        }
      };
    });
  }
}

function loadDataPanel() {
  if (_dataPanelLoaded) return;
  _dataPanelLoaded = true;
  fetch('/api/stats-history').then(function(r){return r.json()}).then(function(d){
    if (!d.ok || !Array.isArray(d.data)) return;
    _dataPanelCache = d.data.sort(function(a,b){return a.date.localeCompare(b.date)});
    drawDataCharts(_dataPanelCache);
    renderDataSummary(_dataPanelCache);
  }).catch(function(){});
}

function drawDataCharts(list) {
  ['follower','following','likes'].forEach(function(key){
    drawSingleChart('chart-'+key, list, key);
  });
}

function drawSingleChart(svgId, list, key) {
  var svg = document.getElementById(svgId);
  if (!svg || !list.length) return;
  var W = 600, H = 200, padL = 42, padR = 14, padT = 12, padB = 28;
  var plotW = W - padL - padR, plotH = H - padT - padB;

  var points = list.map(function(entry, idx){
    var src = _dataCurrentAcc === 'owner' ? entry.owner : entry.self;
    if (!src) return null;
    return { date: entry.date, idx: idx, val: Number(src[key]) || 0 };
  }).filter(Boolean);

  if (!points.length) {
    svg.innerHTML = '<text x="300" y="100" class="chart-label" text-anchor="middle">暂无数据</text>';
    return;
  }

  var vals = points.map(function(p){return p.val});
  var vmin = Math.min.apply(null, vals);
  var vmax = Math.max.apply(null, vals);
  if (vmin === vmax) { vmin -= 1; vmax += 1; }
  var vrange = vmax - vmin;

  function xPos(i) {
    return points.length === 1 ? padL + plotW/2 : padL + (i / (points.length-1)) * plotW;
  }
  function yPos(v) {
    return padT + plotH - ((v - vmin) / vrange) * plotH;
  }

  var color = key === 'follower' ? '#ff7eb9' : key === 'following' ? '#52c41a' : '#faad14';

  var gridLines = '';
  for (var g = 0; g <= 4; g++) {
    var gy = padT + (g / 4) * plotH;
    var gval = Math.round(vmax - (g / 4) * vrange);
    gridLines += '<line x1="'+padL+'" y1="'+gy+'" x2="'+(W-padR)+'" y2="'+gy+'" class="chart-grid"/>';
    gridLines += '<text x="'+(padL-6)+'" y="'+(gy+3)+'" text-anchor="end" class="chart-label">'+gval+'</text>';
  }

  var linePath = '', areaPath = '';
  points.forEach(function(p, i){
    var x = xPos(i), y = yPos(p.val);
    linePath += (i === 0 ? 'M' : 'L') + x + ',' + y + ' ';
    areaPath += (i === 0 ? 'M' : 'L') + x + ',' + y + ' ';
  });
  var firstX = xPos(0), lastX = xPos(points.length-1);
  areaPath += 'L' + lastX + ',' + (padT + plotH) + ' L' + firstX + ',' + (padT + plotH) + ' Z';

  var dots = '', xLabels = '';
  points.forEach(function(p, i){
    var x = xPos(i), y = yPos(p.val);
    dots += '<circle cx="'+x+'" cy="'+y+'" r="3.5" fill="'+color+'" stroke="#fff" stroke-width="1.5" class="chart-dot"><title>'+p.date+' · '+p.val+'</title></circle>';
    if (points.length <= 12 || i % Math.ceil(points.length/8) === 0 || i === points.length-1) {
      xLabels += '<text x="'+x+'" y="'+(H-8)+'" text-anchor="middle" class="chart-label">'+p.date.slice(5)+'</text>';
    }
  });

  svg.innerHTML = gridLines +
    '<path d="'+areaPath+'" fill="'+color+'" class="chart-area"/>' +
    '<path d="'+linePath+'" stroke="'+color+'" class="chart-line"/>' +
    dots + xLabels;
}

function renderDataSummary(list) {
  var box = document.getElementById('data-summary');
  if (!box || !list.length) return;
  var latest = list[list.length - 1];
  var first = list[0];
  var acc = _dataCurrentAcc === 'owner' ? 'owner' : 'self';
  var startSrc = first[acc] || {};
  var endSrc = latest[acc] || {};
  var diffFollower = (endSrc.follower || 0) - (startSrc.follower || 0);
  var diffFollowing = (endSrc.following || 0) - (startSrc.following || 0);
  var diffLikes = (endSrc.likes || 0) - (startSrc.likes || 0);
  var days = list.length;

  function chip(label, val, delta) {
    var deltaStr = delta > 0 ? '<span style="color:#52c41a;margin-left:6px">+'+delta+'</span>' : delta < 0 ? '<span style="color:#ff4d4f;margin-left:6px">'+delta+'</span>' : '';
    return '<div style="flex:1;padding:10px 14px;background:var(--c-bg2);border:1px solid var(--c-border2);border-radius:10px">' +
      '<div style="font-size:11px;color:var(--c-text-mid)">'+label+'</div>' +
      '<div style="font-size:20px;font-weight:700;color:var(--c-text)">'+val+deltaStr+'</div></div>';
  }

  box.innerHTML =
    chip('运营天数', days + ' 天', 0) +
    chip('粉丝累计增量', diffFollower, diffFollower) +
    chip('关注净增量', diffFollowing, diffFollowing) +
    chip('点赞累计增量', diffLikes, diffLikes);
}

setupDataPanel();
document.querySelectorAll('.tab').forEach(function(tab){
  tab.addEventListener('click', function(){
    if (tab.dataset.tab === 'data') setTimeout(loadDataPanel, 80);
  });
});